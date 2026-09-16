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
import { firmarEvidencias } from "@/lib/storage";
import { MARGEN_PASADO_MS } from "@/lib/evidencia-hora";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { codigoDocumento } from "@/lib/pdf/estilos-informe";
import {
  ProgresoReport,
  type FilaDevolucionInforme,
  type FilaFaseInforme,
  type FilaGestionInforme,
  type FilaTorreInforme,
  type InformeAvanceData,
  type PeriodoInforme,
} from "@/lib/pdf/ProgresoReport";
import type {
  ActividadRegistro,
  FotoRegistro,
  GrupoUbicacion,
  RegistroFotograficoData,
} from "@/lib/pdf/RegistroFotografico";

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

// ─── El anexo fotografico: topes y por que ──────────────────────────────────
//
// La obra de referencia tiene 3.348 fotos. Un PDF con todas ni se genera -la
// funcion se queda sin memoria- ni se abre -el visor se atraganta- ni se lee.
// Un registro sin tope es tan inutil como no tener registro, asi que el tope
// es parte del formato y el documento DICE cuantas muestra de cuantas hay.
//
// La salida para quien necesita ver mas no es subir el tope: es acotar el
// periodo, que es justo lo que acompaña a esta funcion.

/** Imagenes que entran en el anexo A. 60 son ~15 hojas a cuatro por pagina. */
const TOPE_FOTOS_DOCUMENTO = 60;

/**
 * Imagenes por actividad.
 *
 * Los informes de interventoria piden entre 3 y 8 por actividad, en tres
 * planos. Cuatro cae dentro de ese rango y ademas coincide con un limite que
 * el producto YA tiene: `POST /api/evidencias` acepta un maximo de cuatro
 * fotos por intento de reporte. O sea que no es una cifra inventada para el
 * PDF: es el tamaño de una tanda de evidencia en esta obra.
 */
const TOPE_FOTOS_POR_ACTIVIDAD = 4;

/**
 * Cuantas evidencias se examinan para elegir esas 60.
 *
 * Se piden las mas RECIENTES del periodo. Con el tope por actividad, 600 filas
 * bastan de sobra para llenar 60 huecos aunque el periodo venga concentrado en
 * pocas actividades, y evitan traerse 3.348 filas para descartar 3.288.
 */
const MAX_EVIDENCIAS_EXAMINADAS = 600;

/** Descargas de imagen en vuelo a la vez. Ni de a una (lento) ni todas (RAM). */
const DESCARGAS_SIMULTANEAS = 6;

/**
 * Tope por imagen. Las fotos de la app salen de un `canvas` a 1600px y calidad
 * 0.8 -entre 150 y 450 KB-, pero las subidas directas admiten hasta 10 MB y
 * una sola de esas dentro del PDF pesa mas que el informe entero.
 */
const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

/**
 * Presupuesto total de bytes de imagen del documento.
 *
 * NO es una cifra de gusto: Vercel corta el cuerpo de una respuesta en 4,5 MB,
 * asi que un PDF que se genera bien en local puede llegar TRUNCADO al usuario
 * -o no llegar- en produccion. El tope de 60 fotos no protege de esto: 60
 * imagenes de 166 KB ya son 4,37 MB y rozan el limite; bastaria una subida
 * directa algo mas pesada para pasarse.
 *
 * Se deja margen para el texto, las fuentes incrustadas y la estructura del
 * PDF, que tambien ocupan. Si el presupuesto se agota antes de llenar las 60,
 * el documento dice cuantas imagenes muestra de cuantas hay — que es lo honesto
 * y ademas le indica al lector que hay mas en el anexo digital.
 */
const LIMITE_RESPUESTA_PLATAFORMA = 4.5 * 1024 * 1024;
const PRESUPUESTO_BYTES_IMAGENES = Math.floor(LIMITE_RESPUESTA_PLATAFORMA * 0.7);

// ─── El periodo ─────────────────────────────────────────────────────────────

/**
 * Los atajos que ofrece la pantalla. Aqui SOLO viven sus etiquetas: el calculo
 * de las dos fechas lo hace el cliente y lo que viaja son las fechas ya
 * resueltas. Si el servidor tambien las calculara, «el ultimo mes» dependeria
 * de si el reloj del servidor y el del usuario estan en el mismo dia.
 */
const ATAJOS_PERIODO: Record<string, string> = {
  semana: "última semana",
  quincena: "última quincena",
  mes: "último mes",
  trimestre: "último trimestre",
  semestre: "último semestre",
  ano: "último año",
};

const ISO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

interface FechaElegida {
  iso: string;
  anio: number;
  mes: number;
  dia: number;
}

/**
 * Lee un `YYYY-MM-DD` del query string, o `null` si no lo es.
 *
 * El viaje de ida y vuelta descarta `2026-02-31` y `2026-13-01`, que `Date`
 * acepta corriendo el mes en silencio: un informe cuyo periodo se desplaza
 * solo es peor que uno que se niega a salir.
 */
function leerFechaElegida(valor: string | null): FechaElegida | null {
  if (!valor) return null;
  const m = ISO_FECHA.exec(valor.trim());
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return { iso: `${m[1]}-${m[2]}-${m[3]}`, anio, mes, dia };
}

/**
 * Colombia no tiene horario de verano: el desfase es constante.
 *
 * Los limites del periodo se construyen en hora COLOMBIANA y no en UTC, y eso
 * no es cosmetico. El informe imprime los instantes en hora de Colombia
 * (`fechaHoraColombia`); con limites en UTC, una foto sellada «14/09/2026
 * 20:30» caeria FUERA de un periodo que termina el 14 de septiembre, porque en
 * UTC ya son las 01:30 del 15. El lector veria la fecha dentro del rango y la
 * foto ausente, sin forma de explicarselo.
 */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

function inicioDelDiaColombia(f: FechaElegida): Date {
  return new Date(Date.UTC(f.anio, f.mes - 1, f.dia, 0, 0, 0, 0) + OFFSET_COLOMBIA_MS);
}

function finDelDiaColombia(f: FechaElegida): Date {
  return new Date(Date.UTC(f.anio, f.mes - 1, f.dia, 23, 59, 59, 999) + OFFSET_COLOMBIA_MS);
}

// ─── Imagenes para el PDF ───────────────────────────────────────────────────

/**
 * Los UNICOS formatos que `<Image>` de @react-pdf/renderer sabe dibujar.
 *
 * Y no es una preferencia: con cualquier otra cosa LANZA. Una excepcion ahi no
 * deja un hueco en la hoja, tumba la generacion del informe entero — asi que
 * el formato se comprueba antes de meter nada en el documento.
 *
 * Se mira la FIRMA de los bytes y no el `Content-Type` que declare Storage: el
 * tipo se guarda tal como lo mando el cliente al subir, o sea que es una
 * afirmacion del mismo sitio del que viene el archivo. Los bytes no mienten.
 */
function tipoDibujable(b: Buffer): "image/jpeg" | "image/png" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length > 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

/**
 * Trabaja una lista con un numero fijo de tareas en vuelo.
 *
 * De a una, sesenta descargas encadenadas son medio minuto de espera; todas a
 * la vez son sesenta imagenes en memoria al mismo tiempo y una rafaga contra
 * Storage. El cursor compartido reparte sin acumular promesas.
 */
async function enParalelo<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const salida = new Array<R>(items.length);
  let cursor = 0;
  async function trabajador() {
    while (cursor < items.length) {
      const i = cursor++;
      salida[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, () => trabajador()),
  );
  return salida;
}

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

// GET /api/reportes/progreso/[proyectoId]?desde=&hasta=&periodo= — genera el PDF
//
// `desde` y `hasta` son `YYYY-MM-DD` y los dos son OPCIONALES: sin ellos el
// informe cubre la historia completa, que es como se comportaba antes de que
// existiera el selector. `periodo` es solo la etiqueta del atajo que los
// produjo («mes»), para que la portada pueda decir «último mes» — no se usa
// para calcular nada.
export async function GET(
  req: NextRequest,
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
    //
    // El corte es SIEMPRE el momento de generar, aunque el periodo termine
    // antes. No se puede reconstruir el avance a una fecha pasada:
    // `Tarea.estado` guarda el estado de hoy, no su historia, asi que fechar
    // el corte al cierre del periodo publicaria las cifras de hoy con la fecha
    // de entonces. El informe lo declara en la seccion 1 en vez de fingirlo.
    const corte = new Date();

    // ── El periodo elegido ────────────────────────────────────────────────
    const sp = req.nextUrl.searchParams;
    const crudoDesde = sp.get("desde");
    const crudoHasta = sp.get("hasta");
    const desde = leerFechaElegida(crudoDesde);
    const hasta = leerFechaElegida(crudoHasta);

    // Una fecha ilegible NO se ignora en silencio: si se ignorara, el usuario
    // pidio «agosto» y recibiria la historia completa con aspecto de informe
    // de agosto. Se rechaza y se dice cual.
    if ((crudoDesde && !desde) || (crudoHasta && !hasta)) {
      return NextResponse.json(
        { error: "Las fechas del período deben venir como AAAA-MM-DD y ser fechas reales." },
        { status: 400 },
      );
    }
    if (desde && hasta && desde.iso > hasta.iso) {
      return NextResponse.json(
        { error: "La fecha inicial del período es posterior a la final." },
        { status: 400 },
      );
    }

    const instanteDesde = desde ? inicioDelDiaColombia(desde) : null;
    const instanteHasta = hasta ? finDelDiaColombia(hasta) : null;
    /** Filtro de instante reutilizado por evidencias y aprobaciones. */
    const enPeriodo: Prisma.DateTimeFilter | undefined =
      instanteDesde || instanteHasta
        ? {
            ...(instanteDesde ? { gte: instanteDesde } : {}),
            ...(instanteHasta ? { lte: instanteHasta } : {}),
          }
        : undefined;

    const atajoPedido = sp.get("periodo");
    const periodo: PeriodoInforme = {
      desde: desde?.iso ?? null,
      hasta: hasta?.iso ?? null,
      // Solo se acepta un atajo CONOCIDO: la etiqueta se imprime en la portada
      // del documento y lo que llega por query string lo escribe cualquiera.
      atajo: atajoPedido && ATAJOS_PERIODO[atajoPedido] ? ATAJOS_PERIODO[atajoPedido] : null,
    };

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

    const [
      proyecto,
      aprobadasConEvidencia,
      ultimasDevoluciones,
      esperandoRevision,
      bitacora,
      evidenciasCandidatas,
      totalFotosPeriodo,
      videosPeriodo,
      aprobadasEnPeriodo,
    ] = await Promise.all([
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
        //
        // El periodo se le pasa como las dos cadenas `YYYY-MM-DD` que ya
        // acepta, asi que la seccion 4 habla del periodo y no de la historia.
        getBitacora(
          proyectoId,
          usuario.constructora_id,
          { desde: desde?.iso, hasta: hasta?.iso },
          1,
        ),

        // ── Anexo A: las candidatas ───────────────────────────────────────
        // Las MAS RECIENTES del periodo. Cuando el periodo trae mas fotos de
        // las que caben, el corte se lleva las mas viejas y no una torre
        // entera: ordenar por ubicacion y cortar dejaria fuera los ultimos
        // edificios completos, y eso si es un sesgo.
        prisma.evidencia.findMany({
          where: {
            tipo: "FOTO",
            tarea: { espacio: espacioDeLaObra },
            ...(enPeriodo ? { timestamp_captura: enPeriodo } : {}),
          },
          orderBy: [{ timestamp_captura: "desc" }, { id: "desc" }],
          take: MAX_EVIDENCIAS_EXAMINADAS,
          select: {
            id: true,
            tarea_id: true,
            url_storage: true,
            timestamp_captura: true,
            created_at: true,
            usuario: { select: { nombre: true } },
            obrero: { select: { nombre: true } },
          },
        }),

        // Cuantas hay de verdad en el periodo: el anexo dice «N de M» y la M
        // no puede ser el tope de la consulta de arriba.
        prisma.evidencia.count({
          where: {
            tipo: "FOTO",
            tarea: { espacio: espacioDeLaObra },
            ...(enPeriodo ? { timestamp_captura: enPeriodo } : {}),
          },
        }),

        // Los videos no se incrustan en un PDF, pero callarlos daria a
        // entender que la evidencia del periodo son solo las fotos.
        prisma.evidencia.count({
          where: {
            tipo: "VIDEO",
            tarea: { espacio: espacioDeLaObra },
            ...(enPeriodo ? { timestamp_captura: enPeriodo } : {}),
          },
        }),

        // La PRODUCCION del periodo: actividades con al menos una aprobacion
        // firmada dentro de el. `groupBy` devuelve una fila por actividad
        // distinta, que es el conteo que se busca — una actividad aprobada,
        // devuelta y vuelta a aprobar en el mismo mes cuenta una vez.
        prisma.aprobacion.groupBy({
          by: ["tarea_id"],
          where: {
            estado: "APROBADA",
            tarea: { espacio: espacioDeLaObra },
            ...(enPeriodo ? { fecha: enPeriodo } : {}),
          },
        }),
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

    // ── Anexo A: el registro fotografico ─────────────────────────────────
    //
    // Cuatro pasos, en este orden y no en otro:
    //   1. ELEGIR cuales entran (topes), sobre las candidatas ya ordenadas de
    //      mas reciente a mas antigua.
    //   2. TRAER el contexto de esas actividades —y solo de esas—: ubicacion,
    //      fase y ultima decision firmada.
    //   3. AGRUPAR por ubicacion y numerar en orden de lectura.
    //   4. FIRMAR y DESCARGAR las imagenes elegidas, nunca las 3.348.
    const vecesPorTarea = new Map<string, number>();
    const elegidas: typeof evidenciasCandidatas = [];
    for (const e of evidenciasCandidatas) {
      if (elegidas.length >= TOPE_FOTOS_DOCUMENTO) break;
      const n = vecesPorTarea.get(e.tarea_id) ?? 0;
      if (n >= TOPE_FOTOS_POR_ACTIVIDAD) continue;
      vecesPorTarea.set(e.tarea_id, n + 1);
      elegidas.push(e);
    }
    const idsElegidas = [...vecesPorTarea.keys()];

    const [tareasDelRegistro, fotosPorTarea] = await Promise.all([
      idsElegidas.length === 0
        ? Promise.resolve([])
        : prisma.tarea.findMany({
            // `espacio` repetido no es redundante: acota al tenant tambien
            // esta consulta, que se arma con ids venidos de otra.
            where: { id: { in: idsElegidas }, espacio: espacioDeLaObra },
            select: {
              id: true,
              nombre: true,
              numero_registro: true,
              estado: true,
              fase: { select: { nombre: true, orden: true } },
              espacio: {
                select: {
                  nombre: true,
                  unidad: {
                    select: {
                      nombre: true,
                      nombre_personalizado: true,
                      piso: { select: { numero: true, edificio: { select: { nombre: true } } } },
                    },
                  },
                },
              },
              // La ULTIMA decision firmada: es el cuarto campo del pie de foto
              // -«aprobada por quien y cuando»- y sale de la tabla de
              // aprobaciones, no de un texto escrito a mano bajo la imagen.
              aprobaciones: {
                orderBy: [{ fecha: "desc" }, { id: "desc" }],
                take: 1,
                select: {
                  estado: true,
                  fecha: true,
                  aprobador: { select: { nombre: true } },
                },
              },
            },
          }),

      // Cuantas fotos tiene cada actividad elegida DENTRO del periodo, para
      // poder decir «se muestran 4 de 11» en la actividad concreta.
      idsElegidas.length === 0
        ? Promise.resolve([])
        : prisma.evidencia.groupBy({
            by: ["tarea_id"],
            where: {
              tipo: "FOTO",
              tarea_id: { in: idsElegidas },
              // Los ids ya vienen de una consulta acotada al tenant, pero el
              // camino se repite: la regla del repo es que NINGUNA consulta
              // dependa de que otra la haya filtrado.
              tarea: { espacio: espacioDeLaObra },
              ...(enPeriodo ? { timestamp_captura: enPeriodo } : {}),
            },
            _count: { _all: true },
          }),
    ]);

    const totalFotosDe = new Map(fotosPorTarea.map((f) => [f.tarea_id, f._count._all]));
    const contextoDeTarea = new Map(tareasDelRegistro.map((t) => [t.id, t]));

    /** Ubicacion COMPLETA, con el espacio: es como se agrupa el anexo. */
    function ubicacionConEspacio(t: (typeof tareasDelRegistro)[number]): string {
      return `${ubicacionDe(t.espacio.unidad)} · ${t.espacio.nombre}`;
    }

    /**
     * Una actividad del anexo con el id de su tarea al lado.
     *
     * El id NO va dentro de `ActividadRegistro` porque el documento no lo
     * imprime y el contrato del anexo no tiene por que conocerlo; pero aqui
     * hace falta para volver a encontrar sus evidencias sin buscarlas por
     * nombre: dos actividades del mismo espacio pueden llamarse igual, y una
     * busqueda por nombre les daria a las dos las fotos de una.
     */
    interface ActividadDelRegistro {
      id: string;
      actividad: ActividadRegistro;
      evidencias: typeof elegidas;
    }

    const porActividad = new Map<string, ActividadDelRegistro>();
    for (const e of elegidas) {
      const t = contextoDeTarea.get(e.tarea_id);
      // Sin contexto la actividad no es de esta obra (o se borro entre las dos
      // consultas): se descarta en vez de publicar una foto sin ubicacion.
      if (!t) continue;
      let entrada = porActividad.get(t.id);
      if (!entrada) {
        const ultima = t.aprobaciones[0] ?? null;
        entrada = {
          id: t.id,
          evidencias: [],
          actividad: {
            numeroRegistro: t.numero_registro,
            nombre: t.nombre,
            fase: t.fase.nombre,
            ordenFase: t.fase.orden,
            ubicacion: ubicacionConEspacio(t),
            estado: t.estado,
            decision: ultima
              ? {
                  estado: ultima.estado,
                  fecha: ultima.fecha,
                  firmante: ultima.aprobador?.nombre ?? "Revisor no identificado",
                }
              : null,
            fotosEnPeriodo: totalFotosDe.get(t.id) ?? 0,
            fotos: [],
          },
        };
        porActividad.set(t.id, entrada);
      }
      entrada.evidencias.push(e);
    }

    // Agrupar por ubicacion: espacio → fase → actividad. Quien revisa camina
    // la obra, no el calendario, y por eso el orden de lectura NO es el de
    // captura aunque la seleccion si lo haya sido.
    const porUbicacion = new Map<string, ActividadDelRegistro[]>();
    for (const entrada of porActividad.values()) {
      const lista = porUbicacion.get(entrada.actividad.ubicacion);
      if (lista) lista.push(entrada);
      else porUbicacion.set(entrada.actividad.ubicacion, [entrada]);
    }
    const ordenadas = [...porUbicacion.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([ubicacion, entradas]) => ({
        ubicacion,
        entradas: entradas.sort(
          (x, y) =>
            x.actividad.ordenFase - y.actividad.ordenFase ||
            x.actividad.nombre.localeCompare(y.actividad.nombre, "es"),
        ),
      }));

    // Numeracion correlativa EN ORDEN DE LECTURA: «Foto 017» tiene que ser la
    // decimoseptima que uno encuentra al pasar las hojas, o el numero no sirve
    // para citar nada.
    const enOrdenDeLectura: { foto: FotoRegistro; ruta: string }[] = [];
    let numero = 0;
    for (const grupo of ordenadas) {
      for (const { actividad, evidencias: suyas } of grupo.entradas) {
        const evidencias = suyas
          .slice()
          .sort((a, b) => a.timestamp_captura.getTime() - b.timestamp_captura.getTime());
        for (const e of evidencias) {
          numero++;
          const foto: FotoRegistro = {
            numero,
            imagen: null,
            fecha: e.timestamp_captura,
            // La hora es del SERVIDOR salvo que la evidencia llegara diferida
            // desde la cola sin señal. No hay columna que lo diga, pero el par
            // de fechas de la fila si: cuando el ingreso y la captura estan a
            // menos del margen de subida, la hora la puso el servidor al
            // recibirla; cuando el ingreso es MUCHO posterior, la hora es la
            // que declaro el dispositivo. Asi lo documenta la propia ruta de
            // subida: «hora_verificada no es una columna, es lo que el par de
            // fechas de la fila ya dice».
            horaDeServidor:
              e.created_at.getTime() - e.timestamp_captura.getTime() <= MARGEN_PASADO_MS,
            autor: e.usuario?.nombre ?? e.obrero?.nombre ?? "Autor no identificado",
          };
          actividad.fotos.push(foto);
          enOrdenDeLectura.push({ foto, ruta: e.url_storage });
        }
      }
    }

    // Lo que ve el documento: solo ubicacion y actividades. El id de la tarea
    // se queda aqui — el anexo no lo imprime y no tiene por que conocerlo.
    const grupos: GrupoUbicacion[] = ordenadas.map((g) => ({
      ubicacion: g.ubicacion,
      actividades: g.entradas.map((e) => e.actividad),
    }));

    // ── Firmar y descargar ────────────────────────────────────────────────
    //
    // El bucket `evidencias` es PRIVADO: la fila guarda la RUTA, no una URL, y
    // un `src` con la ruta cruda da 404. Se firman SOLO las que entran en el
    // documento —firmar 3.348 para usar 60 es absurdo— y `firmarEvidencias` lo
    // hace en una sola llamada por lote.
    //
    // Y se descargan aqui en vez de pasarle la URL firmada a react-pdf. Tres
    // razones, las tres comprobadas: (1) `<Image>` LANZA con cualquier formato
    // que no sea JPEG o PNG, y una excepcion durante el render no deja un
    // hueco, tumba el informe entero; (2) descargando se comprueba la firma de
    // los bytes antes de meterlos en el documento; (3) react-pdf resolveria las
    // URL de a una durante el layout, mientras que aqui van de seis en seis.
    let gastados = 0;
    let noIncrustadas = 0;
    if (enOrdenDeLectura.length > 0) {
      const firmadas = await firmarEvidencias(enOrdenDeLectura.map((x) => x.ruta));
      await enParalelo(enOrdenDeLectura, DESCARGAS_SIMULTANEAS, async (x) => {
        if (gastados >= PRESUPUESTO_BYTES_IMAGENES) return;
        const url = firmadas.get(x.ruta);
        if (!url) return;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          // Se mira la cabecera ANTES de leer el cuerpo: si Storage ya declara
          // diez megas, descargarlos para tirarlos es tiempo y memoria
          // gastados. La comprobacion sobre los bytes de abajo sigue estando,
          // porque la cabecera puede faltar o mentir.
          const declarado = Number(res.headers.get("content-length") ?? "0");
          if (Number.isFinite(declarado) && declarado > MAX_BYTES_IMAGEN) return;
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.byteLength > MAX_BYTES_IMAGEN) return;
          const mime = tipoDibujable(bytes);
          if (!mime) return;
          gastados += bytes.byteLength;
          x.foto.imagen = `data:${mime};base64,${bytes.toString("base64")}`;
        } catch {
          // Una imagen que no llega es un hueco numerado en la hoja, no un
          // informe que no sale. Se cuenta abajo y el anexo lo declara.
        }
      });
      noIncrustadas = enOrdenDeLectura.filter((x) => x.foto.imagen === null).length;
      if (noIncrustadas > 0) {
        console.error(
          `informe de avance: ${noIncrustadas} de ${enOrdenDeLectura.length} imágenes no se pudieron incrustar`,
        );
      }
    }

    const registro: RegistroFotograficoData = {
      grupos,
      mostradas: enOrdenDeLectura.length,
      totalEnPeriodo: totalFotosPeriodo,
      videosEnPeriodo: videosPeriodo,
      noIncrustadas,
      topePorActividad: TOPE_FOTOS_POR_ACTIVIDAD,
      topeDocumento: TOPE_FOTOS_DOCUMENTO,
      compiladoPor: usuario.nombre,
      cargoCompilador: usuario.rol_ref.nombre,
      corte,
    };

    // ── Identificacion ───────────────────────────────────────────────────
    const localizacion =
      [proyecto.direccion_inmueble, proyecto.conjunto_edificio, proyecto.unidad_inmueble]
        .map((p) => p?.trim())
        .filter((p): p is string => !!p)
        .join(" · ") || null;

    const datos: InformeAvanceData = {
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
      periodo,
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
        aprobadasEnPeriodo: aprobadasEnPeriodo.length,
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
      registro,
    };

    const logoDataUrl = logoSeiriconDataUrl();
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderToBuffer(ProgresoReport({ logoDataUrl, data: datos }));
    } catch (fallo) {
      // SEGUNDA PASADA SIN IMAGENES.
      //
      // Los bytes de cada imagen ya se comprobaron por su firma, asi que hasta
      // aqui no deberia llegarse; pero un JPEG con cabecera valida y cuerpo
      // corrupto todavia puede hacer estallar al decodificador de react-pdf, y
      // entonces UNA foto mala dejaria a la obra entera sin informe. El texto
      // -que es lo que se firma y se radica- sale igual, y el anexo declara
      // que las imagenes no pudieron incrustarse.
      console.error("informe de avance: falló el render con imágenes", fallo);
      for (const { foto } of enOrdenDeLectura) foto.imagen = null;
      pdfBuffer = await renderToBuffer(
        ProgresoReport({
          logoDataUrl,
          data: { ...datos, registro: { ...registro, noIncrustadas: registro.mostradas } },
        }),
      );
    }

    // El nombre del archivo lleva el codigo del documento y el periodo: dos
    // informes de la misma obra el mismo dia -uno del mes y otro de la semana-
    // no se pisan en la carpeta de descargas.
    const sufijoPeriodo =
      periodo.desde || periodo.hasta
        ? `-${periodo.desde ?? "inicio"}_${periodo.hasta ?? "corte"}`
        : "";
    const filename = `informe-avance-${codigoDocumento(
      proyecto.numero_registro,
      proyecto.nombre,
      corte,
    ).toLowerCase()}${sufijoPeriodo}.pdf`;

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
