import type {
  AsignacionOverride,
  EdificioInput,
  PersonaProyectoInput,
  TareaInput,
  TipoUnidadInput,
  UbicacionInput,
  VentanaPlan,
} from "./wizard-types";
import type { ModoCronograma } from "@/lib/reparto-cronograma";

/**
 * ─── Borrador local del asistente de proyecto ───────────────────────────────
 *
 * Existe por un incidente real del piloto (17-sep): el admin llenó el
 * formulario completo —torres, tipos, tareas—, se salió, y lo perdió TODO.
 * Lo marcaron en rojo en su documento de feedback, con razón.
 *
 * Decisiones de negocio detrás de este módulo (no cambiarlas a la ligera):
 *
 * - LOCAL, no servidor. El usuario real es un admin en su PC de oficina; el
 *   caso "retomar en otro equipo" es marginal frente a "se me cerró la
 *   pestaña". Un borrador en servidor crearía proyectos fantasma dentro del
 *   tenant y preguntas de permisos que hoy nadie necesita responder.
 * - UN slot por usuario, sobrescrito continuamente. La clave lleva el id del
 *   usuario porque los PC de oficina se comparten: el borrador de un admin no
 *   puede aparecérsele a otro.
 * - Recuperación EXPLÍCITA, nunca silenciosa: restaurar sin preguntar mete
 *   datos rancios en un proyecto nuevo sin que nadie lo note.
 * - Expira a los 7 días: una obra que no se creó en una semana es un borrador
 *   fantasma, no un proyecto.
 * - Se borra al crear el proyecto con éxito.
 *
 * Todo acceso a localStorage va en try/catch: en ventanas privadas o con el
 * almacenamiento bloqueado el accessor puede lanzar, y perder el autoguardado
 * jamás puede tumbar el asistente — que siga funcionando como antes de que
 * esto existiera es el piso de este módulo.
 */

/** Sube cuando cambie la FORMA de `datos`: un borrador viejo se descarta. */
export const BORRADOR_VERSION = 1;

const TTL_DIAS = 7;

export function claveBorrador(usuarioId: string): string {
  return `seiricon:borrador-proyecto:v${BORRADOR_VERSION}:${usuarioId}`;
}

/**
 * Lo que se serializa es el estado CRUDO del asistente (los useState), no el
 * payload del API: el payload ya viene traducido (ids locales a nombres,
 * filtrado por modo) y no alcanza para reconstruir la pantalla.
 */
export interface DatosBorrador {
  nombre: string;
  numeroRegistro: string;
  contratistaDefaultId: string;
  contratistasProyecto: string[];
  clienteId: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  diasHabiles: number;
  fechaInicio: string;
  fechaFin: string;
  ubicacion: UbicacionInput | null;
  tiposUnidad: TipoUnidadInput[];
  edificios: EdificioInput[];
  tieneZonasComunes: boolean;
  zonasSeleccionadas: string[];
  metrosEnabled: boolean;
  metrosZonas: Record<string, number>;
  fasesSeleccionadas: string[];
  tareas: TareaInput[];
  faseDias: Record<string, number | undefined>;
  modoCronograma: ModoCronograma;
  modoElegido: boolean;
  faseVentanas: Record<string, VentanaPlan>;
  tareaVentanas: Record<string, VentanaPlan>;
  personas: PersonaProyectoInput[];
  asignaciones: AsignacionOverride[];
  pool: Record<string, string[]>;
  fasesVaciadasAMano: string[];
}

export interface BorradorWizard {
  version: number;
  guardadoEn: string; // ISO
  step: number;
  datos: DatosBorrador;
}

/**
 * Lee y VALIDA el borrador. Devuelve null si no hay, si es de otra versión,
 * si está vencido o si no parsea — y en esos tres últimos casos además lo
 * borra: un borrador que nunca se va a poder retomar solo puede estorbar.
 */
export function leerBorrador(clave: string): BorradorWizard | null {
  try {
    const crudo = window.localStorage.getItem(clave);
    if (!crudo) return null;

    const b = JSON.parse(crudo) as BorradorWizard;
    const edadMs = Date.now() - new Date(b.guardadoEn).getTime();
    const vencido = !Number.isFinite(edadMs) || edadMs > TTL_DIAS * 24 * 3600 * 1000;

    if (b.version !== BORRADOR_VERSION || vencido || typeof b.datos !== "object" || b.datos === null) {
      window.localStorage.removeItem(clave);
      return null;
    }
    return b;
  } catch {
    return null;
  }
}

export function guardarBorrador(clave: string, borrador: BorradorWizard): void {
  try {
    window.localStorage.setItem(clave, JSON.stringify(borrador));
  } catch {
    // Cuota llena o almacenamiento bloqueado: el asistente sigue; simplemente
    // esta pasada no quedó guardada.
  }
}

export function borrarBorrador(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // Nada que hacer: si no se pudo borrar, la validación de versión/TTL lo
    // descartará en la próxima lectura.
  }
}

/** "hace 5 min", "hace 3 horas", "ayer", "hace 4 días" — para el aviso. */
export function edadLegible(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "hace un momento";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return horas === 1 ? "hace 1 hora" : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}
