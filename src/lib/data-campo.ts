import type { NivelAcceso, TipoProductoTecnico } from "@/generated/prisma";
import { buildProjectWhereFilter, canAccessProject, getAccessibleProjectIds } from "@/lib/access";
import { avancePorFase, type AvanceFase } from "@/lib/fases-avance";
import { prisma } from "@/lib/prisma";
import { listarProductos } from "@/lib/productos-tecnicos/consultas";
import { calcularProgreso } from "@/lib/scoring";

// ─────────────────────────────────────────────────────────────────────────
// LECTURAS DE LA PANTALLA DEL PERSONAL DE CAMPO (/campo)
//
// El auxiliar o residente de obra no administra nada: ve las obras que un
// administrador le asignó, en qué fase van, y qué queda por hacer en cada
// espacio. Todo lo de aquí es SOLO LECTURA — este módulo no escribe.
//
// ══ DOS FILTROS, SIEMPRE LOS DOS ═══════════════════════════════════════════
//
// Cada consulta filtra por `constructora_id` Y por la lista de obras
// asignadas. Ninguno de los dos sobra:
//
//   - Sin `constructora_id`, un id de obra adivinado (o copiado de un
//     WhatsApp) devolvería la obra de OTRA constructora. El id es un cuid,
//     no un secreto: es la regla de tenant del repo, no una precaución.
//   - Sin la lista de asignadas, vería todas las obras de su empresa, que es
//     exactamente lo que el rol existe para evitar.
//
// Por eso las tres funciones piden `QuienPregunta` entero en vez de un
// `proyectoId` suelto: no hay forma de llamarlas y olvidarse de la mitad.
//
// Lo que NO se trae, a propósito: `precio`, `presupuesto_*` y los desgloses
// de la tarea. `canManageTaskPrice()` (src/lib/access.ts) deja fuera a este
// nivel igual que al OBRERO; no seleccionarlos es la otra mitad de esa
// regla — lo que no sale de la base no se filtra por descuido en una vista.
// ─────────────────────────────────────────────────────────────────────────

/** Quién pregunta. Los tres datos viajan juntos para que el filtro de tenant
 *  y el de obras asignadas no puedan separarse por accidente. */
export interface QuienPregunta {
  usuarioId: string;
  constructoraId: string;
  nivelAcceso: NivelAcceso;
}

// ─── 1. Sus obras ────────────────────────────────────────────────────────────

export interface ObraCampoResumen {
  id: string;
  nombre: string;
  estado: string;
  /** Dónde queda, si la obra lo tiene cargado. Para reconocerla de un vistazo. */
  ubicacion: string | null;
  total: number;
  aprobadas: number;
  reportadas: number;
  porcentajeAprobado: number;
  /** La fase donde hay trabajo AHORA. `null` si la obra no tiene tareas. */
  faseActual: { nombre: string; orden: number; porcentajeAprobado: number } | null;
  /** Para situar la fase actual dentro del recorrido: «fase 3 de 9». */
  posicionFaseActual: number;
  totalFases: number;
  fasesCompletas: number;
}

/**
 * «A qué fase va» la obra.
 *
 * Primero el `frente` que ya calcula `fases-avance.ts`: la fase con más
 * trabajo reportado y sin aprobar, o sea donde hay cuadrilla hoy. Si nadie
 * reportó nada (obra recién arrancada, o todo aprobado al día), cae a la
 * primera fase incompleta con tareas, que es donde le toca aparecer mañana.
 *
 * No se reimplementa el cálculo: `avancePorFase` ya lo hizo, esto solo elige
 * cuál de sus resultados se enseña.
 */
function faseEnCurso(fases: AvanceFase[], frente: number): AvanceFase | null {
  if (frente >= 0) return fases[frente];
  return fases.find((f) => f.total > 0 && !f.completa) ?? null;
}

export async function getObrasDeCampo(quien: QuienPregunta): Promise<ObraCampoResumen[]> {
  const accesibles = await getAccessibleProjectIds(
    quien.usuarioId,
    quien.constructoraId,
    quien.nivelAcceso,
  );
  // Sin obras asignadas no hay nada que consultar. El corte temprano evita
  // el `id: { in: [] }`, que es una consulta entera para traer cero filas.
  if (accesibles !== "ALL" && accesibles.length === 0) return [];

  const proyectos = await prisma.proyecto.findMany({
    where: {
      constructora_id: quien.constructoraId,
      ...buildProjectWhereFilter(accesibles),
    },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      estado: true,
      ciudad: true,
      direccion_inmueble: true,
      fases: { orderBy: { orden: "asc" }, select: { id: true, nombre: true, orden: true } },
      edificios: {
        orderBy: { nombre: "asc" },
        select: {
          nombre: true,
          pisos: {
            select: {
              unidades: {
                select: {
                  espacios: {
                    select: { tareas: { select: { estado: true, fase_id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return proyectos.map((p) => {
    const resumen = avancePorFase(p.fases, p.edificios);
    const actual = faseEnCurso(resumen.fases, resumen.frente);

    const todasTareas = p.edificios.flatMap((e) =>
      e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas))),
    );
    const progreso = calcularProgreso(todasTareas);

    return {
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      ubicacion: p.direccion_inmueble ?? p.ciudad ?? null,
      total: progreso.total,
      aprobadas: progreso.aprobadas,
      reportadas: resumen.totalReportadas,
      porcentajeAprobado: progreso.porcentajeAprobado,
      faseActual: actual
        ? {
            nombre: actual.nombre,
            orden: actual.orden,
            porcentajeAprobado: actual.porcentajeAprobado,
          }
        : null,
      posicionFaseActual: actual ? resumen.fases.findIndex((f) => f.id === actual.id) + 1 : 0,
      totalFases: resumen.fases.length,
      fasesCompletas: resumen.fases.filter((f) => f.completa).length,
    };
  });
}

// ─── 2. Una obra: fases en orden, tareas por espacio ─────────────────────────

export interface TareaCampo {
  id: string;
  nombre: string;
  estado: string;
  subfase: string | null;
  tiempoAcordadoDias: number;
  /** Quién la tiene a cargo. `null` si nadie la ha tomado todavía. */
  asignadoNombre: string | null;
}

export interface EspacioCampo {
  id: string;
  nombre: string;
  /** "Torre A · Piso 3 · Apto 301" — para no tener que cruzar ids a mano. */
  ubicacion: string;
  total: number;
  aprobadas: number;
  tareas: TareaCampo[];
}

export interface FaseCampo {
  avance: AvanceFase;
  /** Los espacios donde esta fase tiene trabajo, en orden de recorrido de obra. */
  espacios: EspacioCampo[];
}

export interface ObraCampoDetalle {
  id: string;
  nombre: string;
  estado: string;
  ubicacion: string | null;
  total: number;
  aprobadas: number;
  porcentajeAprobado: number;
  /** Las fases EN ORDEN (`Fase.orden`), como se recorre la obra. */
  fases: FaseCampo[];
  /** Id de la fase que es el frente de trabajo, o `null` si no hay ninguna. */
  faseActualId: string | null;
  totalReportadas: number;
  totalDevueltas: number;
}

/**
 * La obra completa para la pantalla de campo. Devuelve `null` cuando la obra
 * no es de su constructora O no está entre las que le asignaron: los dos
 * casos se contestan igual a propósito, porque distinguirlos ya diría si esa
 * obra existe.
 */
export async function getObraCampo(
  quien: QuienPregunta,
  proyectoId: string,
): Promise<ObraCampoDetalle | null> {
  const accesibles = await getAccessibleProjectIds(
    quien.usuarioId,
    quien.constructoraId,
    quien.nivelAcceso,
  );
  if (!canAccessProject(accesibles, proyectoId)) return null;

  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: quien.constructoraId },
    select: {
      id: true,
      nombre: true,
      estado: true,
      ciudad: true,
      direccion_inmueble: true,
      fases: { orderBy: { orden: "asc" }, select: { id: true, nombre: true, orden: true } },
      edificios: {
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          pisos: {
            orderBy: { numero: "asc" },
            select: {
              id: true,
              numero: true,
              unidades: {
                orderBy: { nombre: "asc" },
                select: {
                  id: true,
                  nombre: true,
                  espacios: {
                    orderBy: { nombre: "asc" },
                    select: {
                      id: true,
                      nombre: true,
                      tareas: {
                        orderBy: { nombre: "asc" },
                        select: {
                          id: true,
                          nombre: true,
                          estado: true,
                          subfase: true,
                          fase_id: true,
                          tiempo_acordado_dias: true,
                          asignado_usuario: { select: { nombre: true } },
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
  });
  if (!proyecto) return null;

  const resumen = avancePorFase(proyecto.fases, proyecto.edificios);

  // fase_id → espacio_id → espacio con sus tareas de ESA fase. Un espacio
  // aparece en tantas fases como fases lo tocan: la cocina sale en «Enchapes»
  // y otra vez en «Pintura», y así es como se camina la obra.
  const porFase = new Map<string, Map<string, EspacioCampo>>();

  for (const edificio of proyecto.edificios) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        const ubicacion = `${edificio.nombre} · Piso ${piso.numero} · ${unidad.nombre}`;
        for (const espacio of unidad.espacios) {
          for (const tarea of espacio.tareas) {
            let espaciosDeLaFase = porFase.get(tarea.fase_id);
            if (!espaciosDeLaFase) {
              espaciosDeLaFase = new Map();
              porFase.set(tarea.fase_id, espaciosDeLaFase);
            }

            let acumulado = espaciosDeLaFase.get(espacio.id);
            if (!acumulado) {
              acumulado = {
                id: espacio.id,
                nombre: espacio.nombre,
                ubicacion,
                total: 0,
                aprobadas: 0,
                tareas: [],
              };
              espaciosDeLaFase.set(espacio.id, acumulado);
            }

            acumulado.total++;
            if (tarea.estado === "APROBADA") acumulado.aprobadas++;
            acumulado.tareas.push({
              id: tarea.id,
              nombre: tarea.nombre,
              estado: tarea.estado,
              subfase: tarea.subfase,
              tiempoAcordadoDias: tarea.tiempo_acordado_dias,
              asignadoNombre: tarea.asignado_usuario?.nombre ?? null,
            });
          }
        }
      }
    }
  }

  const todasTareas = proyecto.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas))),
  );
  const progreso = calcularProgreso(todasTareas);
  const actual = faseEnCurso(resumen.fases, resumen.frente);

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    estado: proyecto.estado,
    ubicacion: proyecto.direccion_inmueble ?? proyecto.ciudad ?? null,
    total: progreso.total,
    aprobadas: progreso.aprobadas,
    porcentajeAprobado: progreso.porcentajeAprobado,
    // `resumen.fases` ya viene ordenado por `orden`; se conservan TODAS, incluso
    // las que todavía no tienen tareas: el recorrido de la obra es la lista
    // completa, y una fase vacía dice «esto aún no empieza», no «no existe».
    fases: resumen.fases.map((avance) => ({
      avance,
      espacios: [...(porFase.get(avance.id)?.values() ?? [])],
    })),
    faseActualId: actual?.id ?? null,
    totalReportadas: resumen.totalReportadas,
    totalDevueltas: resumen.totalDevueltas,
  };
}

// ─── 3. Planos y renders de la obra ──────────────────────────────────────────

export interface ProductosDeObraCampo {
  proyecto: { id: string; nombre: string };
  /** El árbol de la obra, para traducir `piso_id`/`unidad_id` a una frase. */
  edificios: { id: string; nombre: string; pisos: { id: string; numero: number; unidades: { id: string; nombre: string }[] }[] }[];
  /** Versiones VIGENTES de PLANO y RENDER, con la fecha ya en ISO. */
  productos: {
    id: string;
    proyecto_id: string;
    piso_id: string | null;
    unidad_id: string | null;
    tipo: TipoProductoTecnico;
    nombre: string;
    descripcion: string | null;
    mime: string;
    bytes: number;
    version: number;
    vigente: boolean;
    reemplaza_a: string | null;
    subido_por_id: string;
    created_at: string;
  }[];
  /** usuario_id → nombre, para decir quién subió cada archivo. */
  nombrePorId: Map<string, string>;
}

/**
 * Planos y renders de una obra asignada, para MIRARLOS.
 *
 * Solo la versión vigente de cada uno (`incluirHistorico` se queda en su valor
 * por defecto). No es un recorte de permisos: es la regla que el propio módulo
 * declara en `vista-planos.ts` — el desastre que hay que evitar es alguien
 * construyendo sobre un plano viejo, y quien está en la obra con el celular en
 * la mano no tiene por qué elegir entre seis versiones.
 *
 * El acceso al MÓDULO se cierra por tipo de cuenta (`perfilPuedeProductosTecnicos`,
 * src/lib/productos-tecnicos/acceso.ts), no por nivel; eso lo comprueba la
 * página. Aquí se cierra lo otro: la obra tiene que ser de su constructora y
 * estar entre las suyas.
 */
export async function getProductosDeObraCampo(
  quien: QuienPregunta,
  proyectoId: string,
): Promise<ProductosDeObraCampo | null> {
  const accesibles = await getAccessibleProjectIds(
    quien.usuarioId,
    quien.constructoraId,
    quien.nivelAcceso,
  );
  if (!canAccessProject(accesibles, proyectoId)) return null;

  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: quien.constructoraId },
    select: { id: true, nombre: true },
  });
  if (!proyecto) return null;

  const edificios = await prisma.edificio.findMany({
    where: { proyecto_id: proyectoId },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      pisos: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          unidades: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true } },
        },
      },
    },
  });

  const todos = await listarProductos({
    constructoraId: quien.constructoraId,
    proyectoId,
  });
  const productos = todos.filter((p) => p.tipo === "PLANO" || p.tipo === "RENDER");

  // Quién subió cada archivo: `CAMPOS_PUBLICOS` solo trae el id (no hace el
  // join), así que se resuelve aparte, como en `dashboard/.../tecnicos/page.tsx`.
  const ids = [...new Set(productos.map((p) => p.subido_por_id))];
  const autores = ids.length
    ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
    : [];

  return {
    proyecto,
    edificios,
    productos: productos.map((p) => ({ ...p, created_at: p.created_at.toISOString() })),
    nombrePorId: new Map(autores.map((u) => [u.id, u.nombre])),
  };
}
