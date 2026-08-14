/**
 * Tipos, límites y validación compartidos del Acta de daños
 * (/alerta/documentar). Usado por el cliente (`ActaWizard.tsx`) y por las dos
 * rutas API (`acta-pdf`, `acta-email`) para no duplicar el contrato ni los
 * topes de payload en cada lado.
 *
 * TypeScript puro, sin dependencias de UI ni de red — igual que el resto de
 * `src/lib/alerta/`. `TipoInmueble` reutiliza el tipo `TipoPropiedad` que ya
 * existe para el wizard B2C (import type, sin costo en runtime) en vez de
 * inventar un enum paralelo.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección C y addendum R1.
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

export interface ActaPayload {
  inmueble: {
    tipo: TipoInmueble;
    /** Dirección o descripción libre del inmueble, sin geocodificar. */
    descripcion: string;
  };
  espacios: EspacioActa[];
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

const TIPOS_VALIDOS: TipoInmueble[] = ["CASA", "APARTAMENTO", "EDIFICIO", "LOCAL"];
const DATA_URL_IMAGEN = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_LARGO_DESCRIPCION = 500;
const MAX_LARGO_NOMBRE_ESPACIO = 100;
const MAX_LARGO_NOTA = 500;

export type ValidacionActaPayload = { ok: true; payload: ActaPayload } | { ok: false; error: string };

/**
 * Valida el payload crudo que llega a `acta-pdf` / `acta-email`. Solo valida
 * forma y topes (cantidad de espacios/fotos, largos de texto, que las fotos
 * sean data-URIs de imagen) — la compresión y el tope de tamaño real ya los
 * aplicó el cliente antes de mandar el request; esta validación es la
 * segunda línea de defensa del servidor.
 */
export function validarActaPayload(body: unknown): ValidacionActaPayload {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  const inmueble = b.inmueble as Record<string, unknown> | undefined;
  const tipo = inmueble?.tipo;
  if (typeof tipo !== "string" || !TIPOS_VALIDOS.includes(tipo as TipoInmueble)) {
    return { ok: false, error: "Tipo de inmueble inválido." };
  }

  const descripcion = typeof inmueble?.descripcion === "string" ? inmueble.descripcion.trim() : "";
  if (!descripcion) {
    return { ok: false, error: "Falta la dirección o descripción del inmueble." };
  }
  if (descripcion.length > MAX_LARGO_DESCRIPCION) {
    return { ok: false, error: "La descripción del inmueble es muy larga." };
  }

  if (!Array.isArray(b.espacios) || b.espacios.length === 0) {
    return { ok: false, error: "Agrega al menos un espacio con fotos." };
  }
  if (b.espacios.length > MAX_ESPACIOS) {
    return { ok: false, error: `Máximo ${MAX_ESPACIOS} espacios por acta.` };
  }

  let totalFotos = 0;
  const espacios: EspacioActa[] = [];

  for (const raw of b.espacios) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Uno de los espacios tiene un formato inválido." };
    }
    const e = raw as Record<string, unknown>;

    const nombre = typeof e.nombre === "string" ? e.nombre.trim() : "";
    if (!nombre) {
      return { ok: false, error: "Cada espacio necesita un nombre." };
    }
    if (nombre.length > MAX_LARGO_NOMBRE_ESPACIO) {
      return { ok: false, error: `El nombre del espacio "${nombre.slice(0, 30)}…" es muy largo.` };
    }

    const notaCruda = typeof e.nota === "string" ? e.nota.trim() : "";
    const nota = notaCruda ? notaCruda.slice(0, MAX_LARGO_NOTA) : null;

    if (!Array.isArray(e.fotos) || e.fotos.length === 0) {
      return { ok: false, error: `El espacio "${nombre}" necesita al menos una foto.` };
    }

    const fotos: FotoActa[] = [];
    for (const rawFoto of e.fotos) {
      const dataUrl = (rawFoto as Record<string, unknown> | null)?.dataUrl;
      if (typeof dataUrl !== "string") {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" no tiene un formato válido.` };
      }
      if (dataUrl.length > MAX_FOTO_BASE64_CHARS) {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" es demasiado pesada. Repítela e intenta de nuevo.` };
      }
      if (!DATA_URL_IMAGEN.test(dataUrl)) {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" no tiene un formato válido.` };
      }
      fotos.push({ dataUrl });
    }

    totalFotos += fotos.length;
    if (totalFotos > MAX_FOTOS) {
      return { ok: false, error: `Máximo ${MAX_FOTOS} fotos por acta.` };
    }

    espacios.push({ nombre, nota, fotos });
  }

  return {
    ok: true,
    payload: {
      inmueble: { tipo: tipo as TipoInmueble, descripcion },
      espacios,
    },
  };
}

/** Mensaje 413 estándar de las dos rutas API del Acta (spec addendum R1). */
export function mensajeActaMuyPesada(): string {
  const mb = (MAX_BODY_BYTES / (1024 * 1024)).toFixed(1);
  return `El acta es muy pesada (máximo ${mb}MB). Elimina algunas fotos e intenta de nuevo.`;
}
