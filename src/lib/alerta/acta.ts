/**
 * Tipos y límites compartidos del Acta de daños. Hoy los consume el flujo de
 * «Juntos»: `src/lib/juntos/acta-juntos.ts` (que trae su propia validación,
 * con bloque de identidad), `ActaWizardJuntos.tsx`, `GrietaWizardJuntos.tsx` y
 * `src/lib/alerta/grietas.ts`.
 *
 * TypeScript puro, sin dependencias de UI ni de red — igual que el resto de
 * `src/lib/alerta/`. `TipoInmueble` reutiliza el tipo `TipoPropiedad` que ya
 * existe para el wizard B2C (import type, sin costo en runtime) en vez de
 * inventar un enum paralelo.
 *
 * Este archivo tenía además el contrato y la validación de la Fase 1
 * (`ActaPayload`, `validarActaPayload`, `mensajeActaMuyPesada`). Se borraron
 * junto con sus dos únicos consumidores —las rutas `/api/alerta/acta-pdf` y
 * `acta-email`, huérfanas y esta última un relay de correo abierto— y con
 * `src/lib/pdf/ActaDanosReport.tsx`. Lo que queda es lo que de verdad se usa.
 */
import type { TipoPropiedad } from "@/lib/plantillas-personal";

export type TipoInmueble = TipoPropiedad;

export interface FotoActa {
  /** Data-URI base64 (image/jpeg), ya comprimida y con overlay quemado por src/lib/media/overlay.ts. */
  dataUrl: string;
}

export interface EspacioActa {
  nombre: string;
  nota: string | null;
  fotos: FotoActa[];
}

// ─── Límites de payload (spec addendum R1) ─────────────────────────────────
// El perfil de compresión (MAX_DIM / calidad JPEG) vive en src/lib/media/overlay.ts.
export const MAX_FOTOS = 10;
export const MAX_ESPACIOS = 8;
/** Margen bajo los ~4.5MB que impone Vercel al body de una función serverless. */
export const MAX_BODY_BYTES = 3.5 * 1024 * 1024;
/**
 * Tope POR IMAGEN además del agregado (spec-go-juntos.md, Seguridad): el
 * cliente comprime a 1200px/JPEG 0.65 (≤ ~550KB en base64), así que 1.5M de
 * caracteres base64 (~1.1MB binarios) da margen de sobra a una foto legítima
 * y corta una imagen única sobredimensionada antes de llegar al render.
 */
export const MAX_FOTO_BASE64_CHARS = 1.5 * 1024 * 1024;

/** Estimado del tamaño que ocupa un blob binario codificado en base64 (~33% más grande). */
export function estimarBytesBase64(bytesBinarios: number): number {
  return Math.ceil(bytesBinarios / 3) * 4;
}
