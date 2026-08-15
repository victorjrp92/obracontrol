import { prisma } from "@/lib/prisma";
import { calcularProgreso } from "@/lib/scoring";
import { getSignedEvidenciaUrl } from "@/lib/storage";
import {
  claveDeSolicitud,
  permitirPeticionDeToken,
} from "@/lib/rate-limit";
import { generarTokenAcceso, tokenTieneFormaValida } from "@/lib/tokens";

/**
 * Convierte un `url_storage` (path de bucket privado o URL legacy) en una signed
 * URL temporal servible. El bucket "evidencias" es PRIVADO: nunca devolvemos el
 * path crudo. Misma estrategia que `resolveEvidenciaUrl` en data-detail.ts.
 */
async function firmarFoto(stored: string): Promise<string> {
  if (!stored) return "";
  // Legacy: ya es una URL pública completa → extraemos el path y lo firmamos.
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const match = stored.match(/\/storage\/v1\/object\/public\/evidencias\/(.+)$/);
    if (match) return getSignedEvidenciaUrl(match[1]);
    return stored;
  }
  // Path nuevo del bucket privado.
  return getSignedEvidenciaUrl(stored);
}

// ─── Token ────────────────────────────────────────────────────────────────────

/** Genera un token aleatorio urlsafe (no cuid → no filtra orden de creación). */
export function generarClienteToken(): string {
  return generarTokenAcceso();
}

/**
 * Valida un token de cliente: existe + activo. Devuelve el proyecto_id si vale.
 * NO carga datos sensibles aquí; solo resuelve el token → proyecto.
 */
export async function validarClienteToken(
  token: string,
): Promise<{ proyectoId: string } | null> {
  // Mismo criterio que en `validateObreroToken`: descarte gratis de la basura,
  // y después un freno de CARGA (no de adivinación) que nunca niega un token
  // válido. Ver la nota larga en src/lib/rate-limit.ts.
  if (!tokenTieneFormaValida(token)) return null;
  if (!permitirPeticionDeToken(await claveDeSolicitud())) return null;

  const registro = await prisma.clienteAccesoToken.findUnique({
    where: { token },
    select: { activo: true, proyecto_id: true },
  });
  if (!registro || !registro.activo) return null;
  return { proyectoId: registro.proyecto_id };
}

// ─── Vista pública del avance (SOLO LECTURA, sin datos sensibles) ────────────

export interface ClienteTareaPublica {
  id: string;
  nombre: string;
  ubicacion: string; // "Edificio · Apto X · Espacio" (sin datos personales)
  estado: string; // PENDIENTE | REPORTADA | APROBADA | NO_APROBADA
  // Solo evidencias FOTO de tareas ya APROBADAS (avance verificado).
  fotos: string[];
}

export interface ClienteEspacioPublico {
  id: string;
  nombre: string;
  ubicacion: string; // "Edificio · Apto X"
  total: number;
  aprobadas: number;
  tareas: ClienteTareaPublica[];
}

export interface ClienteAvance {
  obra: string; // nombre de la obra
  estado: string; // ACTIVO | PAUSADO | COMPLETADO | ARCHIVADO
  ciudad: string | null;
  actualizado: Date; // última actualización conocida del avance
  progreso: {
    total: number;
    aprobadas: number;
    reportadas: number;
    porcentajeAprobado: number;
    porcentajeReportado: number;
  };
  semaforo: "verde" | "amarillo" | "rojo"; // semáforo global de la obra
  espacios: ClienteEspacioPublico[];
}

/**
 * Carga el avance público de un proyecto para la vista del cliente.
 * SOLO devuelve datos de avance: nombre de la obra, progreso, estado de tareas
 * y fotos de las tareas YA APROBADAS.
 *
 * NO expone: datos personales de obreros (cédula/teléfono/EPS), nombres de
 * trabajadores, costos/precios/presupuesto, gastos/anticipos, ni nada de otra
 * obra. Tenant-safe: arranca desde el proyecto_id del token.
 */
export async function getClienteAvance(
  proyectoId: string,
): Promise<ClienteAvance | null> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: {
      nombre: true,
      estado: true,
      ciudad: true,
      updated_at: true,
      edificios: {
        select: {
          nombre: true,
          pisos: {
            select: {
              unidades: {
                select: {
                  nombre: true,
                  espacios: {
                    select: {
                      id: true,
                      nombre: true,
                      tareas: {
                        select: {
                          id: true,
                          nombre: true,
                          estado: true,
                          updated_at: true,
                          // Solo fotos de avance; se filtran a APROBADA abajo.
                          evidencias: {
                            where: { tipo: "FOTO" },
                            select: { url_storage: true },
                            orderBy: { timestamp_captura: "asc" },
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
    },
  });

  if (!proyecto) return null;

  const espacios: ClienteEspacioPublico[] = [];
  const todasLasTareas: { estado: string }[] = [];
  let ultimaActualizacion = proyecto.updated_at;

  // Acumulamos las promesas de firma para resolverlas TODAS en paralelo al final
  // (el bucket es privado: las fotos van firmadas, nunca como path crudo).
  const firmasPendientes: Promise<void>[] = [];

  for (const edificio of proyecto.edificios) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        const ubicacionUnidad = `${edificio.nombre} · ${unidad.nombre}`;
        for (const espacio of unidad.espacios) {
          if (espacio.tareas.length === 0) continue;

          const tareas: ClienteTareaPublica[] = espacio.tareas.map((t) => {
            if (t.updated_at > ultimaActualizacion) ultimaActualizacion = t.updated_at;
            todasLasTareas.push({ estado: t.estado });

            const tareaPublica: ClienteTareaPublica = {
              id: t.id,
              nombre: t.nombre,
              ubicacion: `${ubicacionUnidad} · ${espacio.nombre}`,
              estado: t.estado,
              fotos: [],
            };

            // Fotos solo de tareas aprobadas (avance verificado por el dueño).
            // Se firman en paralelo y se asignan al campo `fotos` cuando resuelven.
            if (t.estado === "APROBADA" && t.evidencias.length > 0) {
              firmasPendientes.push(
                Promise.all(t.evidencias.map((e) => firmarFoto(e.url_storage))).then(
                  (urls) => {
                    tareaPublica.fotos = urls.filter(Boolean);
                  },
                ),
              );
            }

            return tareaPublica;
          });

          espacios.push({
            id: espacio.id,
            nombre: espacio.nombre,
            ubicacion: ubicacionUnidad,
            total: tareas.length,
            aprobadas: tareas.filter((t) => t.estado === "APROBADA").length,
            tareas,
          });
        }
      }
    }
  }

  // Esperamos a que todas las URLs queden firmadas antes de devolver el avance.
  await Promise.all(firmasPendientes);

  const progreso = calcularProgreso(todasLasTareas);

  // Semáforo global simple por % aprobado (no expone retrasos por tarea):
  // 0–33% rojo · 34–79% amarillo · 80–100% verde.
  const semaforo: "verde" | "amarillo" | "rojo" =
    progreso.porcentajeAprobado >= 80
      ? "verde"
      : progreso.porcentajeAprobado >= 34
        ? "amarillo"
        : "rojo";

  return {
    obra: proyecto.nombre,
    estado: proyecto.estado,
    ciudad: proyecto.ciudad,
    actualizado: ultimaActualizacion,
    progreso: {
      total: progreso.total,
      aprobadas: progreso.aprobadas,
      reportadas: progreso.reportadas,
      porcentajeAprobado: progreso.porcentajeAprobado,
      porcentajeReportado: progreso.porcentajeReportado,
    },
    semaforo,
    espacios,
  };
}
