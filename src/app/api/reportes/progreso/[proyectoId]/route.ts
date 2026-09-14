// ---------------------------------------------------------------------------
// GET /api/reportes/progreso/[proyectoId] — INFORME DE AVANCE en PDF.
//
// Esta ruta ARMA los datos; `@/lib/pdf/ProgresoReport` solo los compone. La
// separacion importa: todo numero que aparece en el informe se calcula aqui,
// en un sitio, y el componente no tiene forma de inventarse ninguno.
//
// == LO QUE SE QUITO ========================================================
//
// La version anterior calculaba, justo debajo de los totales:
//
//     const enRiesgo = todasTareas.filter(
//       (t) => t.estado === "PENDIENTE" || t.estado === "REPORTADA"
//     ).length;
//
// y lo publicaba como «EN RIESGO 2.039» en naranja. Eso es TODO lo que no esta
// aprobado: el complemento del avance con nombre de alarma. Una obra que
// arranca manana sale con el 100% «en riesgo». No se ha redefinido con otro
// umbral inventado: se ha sustituido por la seccion 5 del informe, que separa
// las dos causas reales de detencion -devuelta sin rehacer, reportada sin
// revisar-, cuenta los dias de cada una y dice quien responde.
//
// == LA DISTINCION QUE GOBIERNA EL AVANCE PROGRAMADO ========================
//
// DIAS y FECHAS no son lo mismo. `tiempo_acordado_dias` / `tiempo_estimado_dias`
// son DURACIONES: cuanto dura algo. `fecha_*_plan` es POSICION EN EL
// CALENDARIO: cuando ocurre. Una linea base necesita lo segundo. En una obra
// de tres torres las fases SE SOLAPAN -la torre 1 en pintura mientras la torre
// 3 sigue en mamposteria-, asi que encadenar duraciones en fila produce un
// cronograma falso; por eso el programado NO se deduce de las duraciones.
//
// Y OJO con `Tarea.fecha_inicio`: es REAL, se rellena AL REPORTAR. Aqui se usa
// para medir cuanto lleva esperando revision una tarea reportada — nunca como
// fecha de plan.
//
// == TENANT =================================================================
//
// El acceso se valida con `getAccessibleProjectIds` + `canAccessProject` ANTES
// de tocar nada, y ademas cada consulta auxiliar cuelga de
// `edificio -> proyecto -> constructora_id`. Con solo el id del proyecto, uno
// adivinado devolveria la obra de otra constructora.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { diasHabilesEntre } from "@/lib/calendario-colombia";
import { avancePorFase } from "@/lib/fases-avance";
import { getBitacora } from "@/lib/data-bitacora";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { codigoDocumento } from "@/lib/pdf/estilos-informe";
import {
  ProgresoReport,
  type FilaDevolucionInforme,
  type FilaFaseInforme,
  type FilaGestionInforme,
  type FilaTorreInforme,
} from "@/lib/pdf/ProgresoReport";

/** Cuantas filas se listan en cada tabla de la seccion 5. El total va aparte. */
const FILAS_GESTION = 12;

/** Cuantas devoluciones con motivo se listan en la tabla 4.2-1. */
const FILAS_DEVOLUCIONES = 12;

/**
 * Tope de la consulta que busca la ULTIMA devolucion de cada actividad devuelta.
 *
 * La consulta ya esta acotada a actividades que HOY siguen devueltas, que en
 * la obra mas cargada son decenas. El tope solo evita que una obra
 * patologica -miles de idas y venidas sobre las mismas tareas- traiga la
 * bitacora entera a memoria para sacar doce filas.
 */
const MAX_DEVOLUCIONES = 3_000;

/** Una unidad con su piso y su torre, tal como se pide en las consultas. */
interface UnidadUbicable {
  nombre: string;
  nombre_personalizado: string | null;
  piso: { numero: number; edificio: { nombre: string } };
}

/** «Torre 2 · P3 · Apto 302». Es la direccion mas corta que ubica a alguien en obra. */
function ubicacionDe(unidad: UnidadUbicable): string {
  return `${unidad.piso.edificio.nombre} · P${unidad.piso.numero} · ${
    unidad.nombre_personalizado ?? unidad.nombre
  }`;
}

/** Porcentaje SIN redondear a entero: el informe publica un decimal. */
function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

// GET /api/reportes/progreso/[proyectoId] — genera y devuelve PDF
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proyectoId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        nombre: true,
        constructora_id: true,
        rol_ref: { select: { nombre: true, nivel_acceso: true } },
      },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { proyectoId } = await params;

    // Project-access: ADMIN_PROYECTO may only generate reports for their assigned projects.
    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyectoId)) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // La fecha de CORTE: un solo instante para todo el informe. Si cada
    // seccion llamara a `new Date()` por su cuenta, dos cifras de la misma
    // hoja podrian estar separadas por segundos — y en una obra que reporta a
    // las 23:59 eso es un dia de diferencia.
    const corte = new Date();

    // Camino de tenant compartido por todas las consultas auxiliares.
    const espacioDeLaObra: Prisma.EspacioWhereInput = {
      unidad: {
        piso: {
          edificio: {
            proyecto_id: proyectoId,
            proyecto: { constructora_id: usuario.constructora_id },
          },
        },
      },
    };

    const [proyecto, aprobadasConEvidencia, ultimasDevoluciones, esperandoRevision, bitacora] =
      await Promise.all([
        prisma.proyecto.findUnique({
          where: { id: proyectoId },
          select: {
            nombre: true,
            numero_registro: true,
            ciudad: true,
            direccion_inmueble: true,
            conjunto_edificio: true,
            unidad_inmueble: true,
            fecha_inicio: true,
            fecha_fin_estimada: true,
            dias_habiles_semana: true,
            modo_cronograma: true,
            constructora_id: true,
            constructora: { select: { nombre: true, nit: true } },
            cliente: { select: { nombre: true, nit: true } },
            fases: {
              orderBy: { orden: "asc" },
              select: {
                id: true,
                nombre: true,
                orden: true,
                fecha_inicio_plan: true,
                fecha_fin_plan: true,
              },
            },
            edificios: {
              orderBy: { nombre: "asc" },
              select: {
                nombre: true,
                pisos: {
                  select: {
                    unidades: {
                      select: {
                        espacios: {
                          select: {
                            // Solo escalares: el arbol de una obra grande son
                            // 11.000 filas y cada columna de texto que se
                            // añada aqui se multiplica por ese numero.
                            tareas: {
                              select: {
                                estado: true,
                                fase_id: true,
                                fecha_inicio_plan: true,
                                fecha_fin_plan: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        // Cobertura documental: actividades APROBADAS que tienen al menos una
        // evidencia. `groupBy` devuelve un id por actividad distinta, que es
        // exactamente el conteo que se busca sin traerse las fotos.
        prisma.evidencia.groupBy({
          by: ["tarea_id"],
          where: { tarea: { estado: "APROBADA", espacio: espacioDeLaObra } },
        }),

        // La ultima devolucion de cada actividad que HOY sigue devuelta.
        // Descendente para que, al deduplicar por tarea, la primera que se ve
        // sea la mas reciente — que es desde cuando lleva parada de verdad.
        prisma.aprobacion.findMany({
          where: {
            estado: "NO_APROBADA",
            tarea: { estado: "NO_APROBADA", espacio: espacioDeLaObra },
          },
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          take: MAX_DEVOLUCIONES,
          select: {
            fecha: true,
            tarea_id: true,
            tarea: {
              select: {
                nombre: true,
                numero_registro: true,
                asignado_usuario: { select: { nombre: true } },
                espacio: {
                  select: {
                    unidad: {
                      select: {
                        nombre: true,
                        nombre_personalizado: true,
                        piso: { select: { numero: true, edificio: { select: { nombre: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        // Las que llevan mas tiempo esperando revision. `fecha_inicio` es la
        // marca del PRIMER reporte: Postgres ordena los nulos al final en ASC,
        // asi que una reportada sin marca no se cuela como la mas antigua.
        prisma.tarea.findMany({
          where: { estado: "REPORTADA", espacio: espacioDeLaObra },
          orderBy: [{ fecha_inicio: "asc" }, { id: "asc" }],
          take: FILAS_GESTION,
          select: {
            nombre: true,
            numero_registro: true,
            fecha_inicio: true,
            asignado_usuario: { select: { nombre: true } },
            espacio: {
              select: {
                unidad: {
                  select: {
                    nombre: true,
                    nombre_personalizado: true,
                    piso: { select: { numero: true, edificio: { select: { nombre: true } } } },
                  },
                },
              },
            },
          },
        }),

        // Seccion 4 entera. La aritmetica de quien aprueba, quien devuelve y
        // cuanto tarda ya vive en `@/lib/bitacora` y se reutiliza tal cual:
        // reimplementarla aqui daria dos definiciones de «tiempo de revision»
        // en el mismo producto, y la del PDF seria la que nadie revisa.
        getBitacora(proyectoId, usuario.constructora_id, {}, 1),
      ]);

    if (!proyecto || proyecto.constructora_id !== usuario.constructora_id) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const jornada = proyecto.dias_habiles_semana;

    // ── Totales de la obra ───────────────────────────────────────────────
    const tareas = proyecto.edificios.flatMap((e) =>
      e.pisos.flatMap((p) => p.unidades.flatMap((u) => u.espacios.flatMap((s) => s.tareas))),
    );
    const totalActividades = tareas.length;
    const aprobadas = tareas.filter((t) => t.estado === "APROBADA").length;
    const reportadas = tareas.filter((t) => t.estado === "REPORTADA").length;
    const devueltas = tareas.filter((t) => t.estado === "NO_APROBADA").length;
    // Por resta y no por filtro: si algun dia aparece un estado nuevo, la
    // tabla 2.1-1 seguiria sumando el total exacto en vez de perder filas.
    const pendientes = totalActividades - aprobadas - reportadas - devueltas;

    // `null` con la obra vacia: 0 de 0 no es cero por ciento, es una division
    // sin definir, y un 0,0% le diria al contratante que no se ha hecho nada.
    const pctEjecutado = totalActividades > 0 ? pct(aprobadas, totalActividades) : null;
    const pctReportado =
      totalActividades > 0 ? pct(aprobadas + reportadas, totalActividades) : null;

    // ── Tiempo ───────────────────────────────────────────────────────────
    const diasPlazo =
      proyecto.fecha_inicio && proyecto.fecha_fin_estimada
        ? diasHabilesEntre(proyecto.fecha_inicio, proyecto.fecha_fin_estimada, jornada)
        : null;
    const diasTranscurridos = proyecto.fecha_inicio
      ? diasHabilesEntre(proyecto.fecha_inicio, corte, jornada)
      : null;
    // NO se recorta a 100: una obra que ya paso su plazo tiene que poder
    // decirlo. La barra del informe si se recorta, pero la cifra no miente.
    const pctTiempo =
      diasPlazo !== null && diasPlazo > 0 && diasTranscurridos !== null
        ? (diasTranscurridos / diasPlazo) * 100
        : null;

    // ── Linea base del cronograma ────────────────────────────────────────
    interface Ventana {
      inicio: Date;
      fin: Date;
    }
    const ventanaDeFase = new Map<string, Ventana>();
    for (const f of proyecto.fases) {
      if (f.fecha_inicio_plan && f.fecha_fin_plan) {
        ventanaDeFase.set(f.id, { inicio: f.fecha_inicio_plan, fin: f.fecha_fin_plan });
      }
    }

    /**
     * La ventana de una actividad: la suya si el reparto se la dio, y si no la
     * de su fase. Sin ninguna de las dos, la actividad no tiene linea base.
     */
    function ventanaDe(t: {
      fase_id: string;
      fecha_inicio_plan: Date | null;
      fecha_fin_plan: Date | null;
    }): Ventana | null {
      if (t.fecha_inicio_plan && t.fecha_fin_plan) {
        return { inicio: t.fecha_inicio_plan, fin: t.fecha_fin_plan };
      }
      return ventanaDeFase.get(t.fase_id) ?? null;
    }

    /**
     * Fraccion de la ventana ya transcurrida a la fecha de corte, en dias
     * HABILES. Se memoriza por ventana: en modo AUTOMATICO o FASES miles de
     * actividades comparten la misma, y `diasHabilesEntre` camina dia a dia.
     */
    const fraccionCache = new Map<string, number>();
    function fraccionTranscurrida(v: Ventana): number {
      const clave = `${v.inicio.getTime()}|${v.fin.getTime()}`;
      const memo = fraccionCache.get(clave);
      if (memo !== undefined) return memo;

      let f: number;
      if (corte.getTime() <= v.inicio.getTime()) f = 0;
      else if (corte.getTime() >= v.fin.getTime()) f = 1;
      else {
        const duracion = diasHabilesEntre(v.inicio, v.fin, jornada);
        const ido = diasHabilesEntre(v.inicio, corte, jornada);
        // Ventana sin ni un dia habil dentro (fin = inicio, o toda en
        // festivos): ya empezo y ya acabo, luego cuenta entera.
        f = duracion > 0 ? Math.min(1, ido / duracion) : 1;
      }
      fraccionCache.set(clave, f);
      return f;
    }

    let sumaProgramada = 0;
    let actividadesConPlan = 0;
    let vencidasContraPlan = 0;
    for (const t of tareas) {
      const v = ventanaDe(t);
      if (!v) continue;
      actividadesConPlan++;
      sumaProgramada += fraccionTranscurrida(v);
      if (v.fin.getTime() < corte.getTime() && t.estado !== "APROBADA") vencidasContraPlan++;
    }

    /**
     * La linea base solo vale si cubre la obra ENTERA.
     *
     * Con cobertura parcial el programado se mediria sobre un trozo y el
     * ejecutado sobre todo: la diferencia no seria desviacion, seria el hueco
     * del plan disfrazado de retraso. Antes que publicar eso, el informe
     * declara NO CALCULABLE y explica que falta.
     */
    const lineaBaseCompleta = totalActividades > 0 && actividadesConPlan === totalActividades;
    const pctProgramado = lineaBaseCompleta ? (sumaProgramada / totalActividades) * 100 : null;
    const spi =
      pctEjecutado !== null && pctProgramado !== null && pctProgramado > 0
        ? pctEjecutado / pctProgramado
        : null;

    const fasesConPlan = proyecto.fases.filter(
      (f) => f.fecha_inicio_plan && f.fecha_fin_plan,
    ).length;

    // ── Avance por fase y por torre ──────────────────────────────────────
    // El reparto lo calcula `fases-avance.ts`; aqui solo se le pega la
    // ventana planeada y se recupera el decimal que su porcentaje redondea.
    const resumenFases = avancePorFase(proyecto.fases, proyecto.edificios);
    const fases: FilaFaseInforme[] = resumenFases.fases.map((f) => {
      const v = ventanaDeFase.get(f.id) ?? null;
      let situacionPlan: FilaFaseInforme["situacionPlan"];
      if (!v) situacionPlan = "SIN_PLAN";
      else if (f.completa) situacionPlan = "COMPLETA";
      else if (corte.getTime() < v.inicio.getTime()) situacionPlan = "NO_INICIADA";
      else if (corte.getTime() > v.fin.getTime()) situacionPlan = "VENCIDA";
      else situacionPlan = "EN_CURSO";

      return {
        nombre: f.nombre,
        total: f.total,
        aprobadas: f.aprobadas,
        reportadas: f.reportadas,
        devueltas: f.devueltas,
        pendientes: f.pendientes,
        pctAprobado: pct(f.aprobadas, f.total),
        inicioPlan: v?.inicio ?? null,
        finPlan: v?.fin ?? null,
        situacionPlan,
      };
    });

    const torres: FilaTorreInforme[] = proyecto.edificios.map((e) => {
      const suyas = e.pisos.flatMap((p) =>
        p.unidades.flatMap((u) => u.espacios.flatMap((s) => s.tareas)),
      );
      const ap = suyas.filter((t) => t.estado === "APROBADA").length;
      return {
        nombre: e.nombre,
        unidades: e.pisos.reduce((acc, p) => acc + p.unidades.length, 0),
        total: suyas.length,
        aprobadas: ap,
        reportadas: suyas.filter((t) => t.estado === "REPORTADA").length,
        pctAprobado: pct(ap, suyas.length),
      };
    });

    // ── Seccion 4: calidad ───────────────────────────────────────────────
    const devolucionesRecientes: FilaDevolucionInforme[] = bitacora.sucesos
      .filter((s) => s.estado === "NO_APROBADA")
      .slice(0, FILAS_DEVOLUCIONES)
      .map((s) => ({
        numeroRegistro: s.numeroRegistro,
        actividad: s.tareaNombre,
        ubicacion: `${s.torre} · P${s.piso} · ${s.unidad}`,
        fecha: s.fechaDecision,
        revisor: s.aprobador,
        motivo: s.motivo,
      }));

    // ── Seccion 5: gestion ───────────────────────────────────────────────
    // Una fila por actividad, con su devolucion MAS RECIENTE. La consulta vino
    // en orden descendente, asi que la primera aparicion de cada tarea ya es
    // la ultima decision: quedarse con ella evita contar los dias desde una
    // devolucion vieja que el contratista ya rehizo una vez.
    const ultimaPorTarea = new Map<string, (typeof ultimasDevoluciones)[number]>();
    for (const d of ultimasDevoluciones) {
      if (!ultimaPorTarea.has(d.tarea_id)) ultimaPorTarea.set(d.tarea_id, d);
    }
    const filasDevueltas: FilaGestionInforme[] = [...ultimaPorTarea.values()]
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .slice(0, FILAS_GESTION)
      .map((d) => ({
        numeroRegistro: d.tarea.numero_registro,
        actividad: d.tarea.nombre,
        ubicacion: ubicacionDe(d.tarea.espacio.unidad),
        dias: diasHabilesEntre(d.fecha, corte, jornada),
        responsable: d.tarea.asignado_usuario?.nombre ?? "Sin asignar",
      }));

    const filasEsperando: FilaGestionInforme[] = esperandoRevision.map((t) => ({
      numeroRegistro: t.numero_registro,
      actividad: t.nombre,
      ubicacion: ubicacionDe(t.espacio.unidad),
      // Sin marca de reporte no se puede afirmar cuanto lleva esperando. Raya,
      // no cero: un cero diria «se reporto hoy», y eso no consta.
      dias: t.fecha_inicio ? diasHabilesEntre(t.fecha_inicio, corte, jornada) : null,
      responsable: t.asignado_usuario?.nombre ?? "Sin asignar",
    }));

    // ── Identificacion ───────────────────────────────────────────────────
    const localizacion =
      [proyecto.direccion_inmueble, proyecto.conjunto_edificio, proyecto.unidad_inmueble]
        .map((p) => p?.trim())
        .filter((p): p is string => !!p)
        .join(" · ") || null;

    const pdfBuffer = await renderToBuffer(
      ProgresoReport({
        logoDataUrl: logoSeiriconDataUrl(),
        data: {
          identificacion: {
            contratante: proyecto.cliente?.nombre ?? null,
            contratanteNit: proyecto.cliente?.nit ?? null,
            ejecutor: proyecto.constructora.nombre,
            ejecutorNit: proyecto.constructora.nit ?? null,
            obra: proyecto.nombre,
            numeroRegistro: proyecto.numero_registro,
            localizacion,
            ciudad: proyecto.ciudad,
            fechaInicio: proyecto.fecha_inicio,
            fechaFinEstimada: proyecto.fecha_fin_estimada,
            diasHabilesSemana: jornada,
            corte,
            elaboradoPor: usuario.nombre,
            cargoElaborador: usuario.rol_ref.nombre,
          },
          avance: {
            totalActividades,
            aprobadas,
            reportadas,
            devueltas,
            pendientes,
            pctEjecutado,
            pctReportado,
            diasPlazo,
            diasTranscurridos,
            pctTiempo,
            pctProgramado,
            spi,
            actividadesConPlan,
            fasesConPlan,
            totalFases: proyecto.fases.length,
            modoCronograma: proyecto.modo_cronograma,
          },
          fases,
          torres,
          calidad: {
            decisiones: bitacora.resumen.decisiones,
            devoluciones: bitacora.resumen.devoluciones,
            pctDevoluciones: bitacora.resumen.pctDevoluciones,
            revisores: bitacora.resumen.personas.map((p) => ({
              nombre: p.nombre,
              aprobadas: p.aprobadas,
              devueltas: p.devueltas,
              total: p.total,
              pctDevueltas: p.pctDevueltas,
              horasMediana: p.horasMediana,
              medibles: p.medibles,
            })),
            devolucionesRecientes,
            ventanaRevisada: bitacora.sucesos.length,
            resumenTruncado: bitacora.resumenTruncado,
          },
          gestion: {
            devueltas: filasDevueltas,
            totalDevueltas: devueltas,
            esperandoRevision: filasEsperando,
            totalEsperando: reportadas,
            // Sin linea base completa la palabra «vencida» no significa nada:
            // se calla en vez de publicar un conteo parcial.
            vencidasPlan: lineaBaseCompleta ? vencidasContraPlan : null,
          },
          cobertura: {
            aprobadas,
            aprobadasConEvidencia: aprobadasConEvidencia.length,
            pct: aprobadas > 0 ? pct(aprobadasConEvidencia.length, aprobadas) : null,
          },
        },
      })
    );

    // El nombre del archivo lleva el codigo del documento: dos informes de la
    // misma obra en fechas distintas no se pisan en la carpeta de descargas.
    const filename = `informe-avance-${codigoDocumento(
      proyecto.numero_registro,
      proyecto.nombre,
      corte,
    ).toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reportes/progreso/[proyectoId]", error);
    return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
  }
}
