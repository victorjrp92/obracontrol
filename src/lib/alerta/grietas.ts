/**
 * Tipos, límites y validación compartidos del triage de grietas
 * (/alerta/grietas) — espejo de `acta.ts` (Fase 1). Usado por el cliente
 * (`GrietaWizard.tsx`) y por las dos rutas API nuevas
 * (`observar-grieta`, `informe-grietas-pdf`) para no duplicar el contrato
 * ni los topes de payload en cada lado.
 *
 * TypeScript puro, sin dependencias de UI ni de red — igual que el resto de
 * `src/lib/alerta/`.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md, sección 3.
 */
import { MAX_BODY_BYTES, MAX_FOTO_BASE64_CHARS } from "./acta";
import type { Elemento, Nivel, Veredicto } from "./tipos";

// ─── Límites de payload ─────────────────────────────────────────────────────
/** = 10 fotos de evidencia, mismo presupuesto que MAX_FOTOS del acta (acta.ts). */
export const MAX_GRIETAS = 5;
/** Tope del payload de POST /api/alerta/observar-grieta (dos fotos SIN overlay, D5). */
export const MAX_BODY_OBSERVACION_BYTES = 1.5 * 1024 * 1024;
/** Tope del payload del informe en PDF (hoy POST /api/juntos/informe-pdf) — reusa el mismo presupuesto que el Acta. */
export { MAX_BODY_BYTES };

const DATA_URL_IMAGEN = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const ELEMENTOS_VALIDOS: Elemento[] = [
  "columna",
  "viga",
  "nudo_viga_columna",
  "muro_carga",
  "muro_divisorio",
  "losa_techo",
  "piso",
  "fachada",
  "no_determinado",
];
const NIVELES_VALIDOS: Nivel[] = ["rojo", "amarillo", "verde"];
const MAX_LARGO_RAZON = 300;
const MAX_LARGO_QUE_HACER = 300;
const MAX_LARGO_QUE_NO_HACER_ITEM = 100;
const MAX_LARGO_NOTA_VISUAL = 140;

// ─── POST /api/alerta/observar-grieta ──────────────────────────────────────

export interface ObservarGrietaPayload {
  /** Data-URI base64 (image/jpeg) — foto de acercamiento con moneda, SIN overlay (blobAnalisis, D5). */
  fotoCercaDataUrl: string;
  /** Data-URI base64 (image/jpeg) — foto del elemento completo, SIN overlay (blobAnalisis, D5). */
  fotoLejosDataUrl: string;
}

export type ValidacionObservarGrietaPayload =
  | { ok: true; payload: ObservarGrietaPayload }
  | { ok: false; error: string };

/** Valida el payload crudo que llega a `observar-grieta`: solo forma (dos data-URI de imagen). */
export function validarObservarGrietaPayload(body: unknown): ValidacionObservarGrietaPayload {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  const fotoCercaDataUrl = b.fotoCercaDataUrl;
  if (typeof fotoCercaDataUrl !== "string" || !DATA_URL_IMAGEN.test(fotoCercaDataUrl)) {
    return { ok: false, error: "La foto de acercamiento no tiene un formato válido." };
  }
  const fotoLejosDataUrl = b.fotoLejosDataUrl;
  if (typeof fotoLejosDataUrl !== "string" || !DATA_URL_IMAGEN.test(fotoLejosDataUrl)) {
    return { ok: false, error: "La foto del elemento completo no tiene un formato válido." };
  }

  return { ok: true, payload: { fotoCercaDataUrl, fotoLejosDataUrl } };
}

/** Mensaje 413 de POST /api/alerta/observar-grieta. */
export function mensajeObservacionMuyPesada(): string {
  const mb = (MAX_BODY_OBSERVACION_BYTES / (1024 * 1024)).toFixed(1);
  return `Las fotos son muy pesadas (máximo ${mb}MB). Vuelve a intentarlo con fotos más livianas.`;
}

// ─── Contrato del informe en PDF (lo consume POST /api/juntos/informe-pdf) ──

export interface FotoGrieta {
  /** Data-URI base64 (image/jpeg) — foto de EVIDENCIA (blobEvidencia, CON overlay, D5). */
  dataUrl: string;
}

export interface GrietaInformeItem {
  elementoDeclarado: Elemento;
  elementoFinal: Elemento;
  hubo_discrepancia: boolean;
  veredicto: Veredicto;
  notaVisual: string | null;
  /** Exactamente 2: Foto A (acercamiento) y Foto B (elemento completo). */
  fotos: FotoGrieta[];
}

export interface InformeGrietasPayload {
  grietas: GrietaInformeItem[];
}

export type ValidacionInformeGrietasPayload =
  | { ok: true; payload: InformeGrietasPayload }
  | { ok: false; error: string };

function validarVeredicto(raw: unknown): Veredicto | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;

  if (typeof v.nivel !== "string" || !NIVELES_VALIDOS.includes(v.nivel as Nivel)) return null;
  if (typeof v.razon !== "string" || !v.razon.trim() || v.razon.length > MAX_LARGO_RAZON) return null;
  if (typeof v.que_hacer !== "string" || !v.que_hacer.trim() || v.que_hacer.length > MAX_LARGO_QUE_HACER) return null;
  if (!Array.isArray(v.que_no_hacer)) return null;

  const que_no_hacer: string[] = [];
  for (const item of v.que_no_hacer) {
    if (typeof item !== "string" || item.length > MAX_LARGO_QUE_NO_HACER_ITEM) return null;
    que_no_hacer.push(item);
  }

  return { nivel: v.nivel as Nivel, razon: v.razon, que_hacer: v.que_hacer, que_no_hacer };
}

/**
 * Valida el payload crudo que llega a `informe-grietas-pdf`: solo forma y
 * topes (cantidad de grietas, largos de texto, exactamente 2 fotos por
 * grieta) — igual que `validarActaPayload` en `acta.ts`, esta es la segunda
 * línea de defensa del servidor (el cliente ya calculó el veredicto y armó
 * el payload antes de mandar el request).
 */
export function validarInformeGrietasPayload(body: unknown): ValidacionInformeGrietasPayload {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.grietas) || b.grietas.length === 0) {
    return { ok: false, error: "Agrega al menos una grieta evaluada." };
  }
  if (b.grietas.length > MAX_GRIETAS) {
    return { ok: false, error: `Máximo ${MAX_GRIETAS} grietas por informe.` };
  }

  const grietas: GrietaInformeItem[] = [];
  for (const raw of b.grietas) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Una de las grietas tiene un formato inválido." };
    }
    const g = raw as Record<string, unknown>;

    const elementoDeclarado = g.elementoDeclarado;
    if (typeof elementoDeclarado !== "string" || !ELEMENTOS_VALIDOS.includes(elementoDeclarado as Elemento)) {
      return { ok: false, error: "El elemento declarado de una grieta no es válido." };
    }
    const elementoFinal = g.elementoFinal;
    if (typeof elementoFinal !== "string" || !ELEMENTOS_VALIDOS.includes(elementoFinal as Elemento)) {
      return { ok: false, error: "El elemento evaluado de una grieta no es válido." };
    }
    if (typeof g.hubo_discrepancia !== "boolean") {
      return { ok: false, error: "Falta indicar si hubo discrepancia en una grieta." };
    }

    const veredicto = validarVeredicto(g.veredicto);
    if (!veredicto) {
      return { ok: false, error: "El veredicto de una grieta no tiene un formato válido." };
    }

    const notaVisualCruda = g.notaVisual;
    const notaVisual =
      typeof notaVisualCruda === "string" && notaVisualCruda.trim()
        ? notaVisualCruda.trim().slice(0, MAX_LARGO_NOTA_VISUAL)
        : null;

    if (!Array.isArray(g.fotos) || g.fotos.length !== 2) {
      return { ok: false, error: "Cada grieta necesita exactamente 2 fotos (acercamiento y elemento completo)." };
    }
    const fotos: FotoGrieta[] = [];
    for (const rawFoto of g.fotos) {
      const dataUrl = (rawFoto as Record<string, unknown> | null)?.dataUrl;
      if (typeof dataUrl !== "string") {
        return { ok: false, error: "Una de las fotos de una grieta no tiene un formato válido." };
      }
      // Tope POR IMAGEN además del agregado (spec-go-juntos.md, Seguridad).
      if (dataUrl.length > MAX_FOTO_BASE64_CHARS) {
        return { ok: false, error: "Una de las fotos de una grieta es demasiado pesada. Repítela e intenta de nuevo." };
      }
      if (!DATA_URL_IMAGEN.test(dataUrl)) {
        return { ok: false, error: "Una de las fotos de una grieta no tiene un formato válido." };
      }
      fotos.push({ dataUrl });
    }

    grietas.push({
      elementoDeclarado: elementoDeclarado as Elemento,
      elementoFinal: elementoFinal as Elemento,
      hubo_discrepancia: g.hubo_discrepancia,
      veredicto,
      notaVisual,
      fotos,
    });
  }

  return { ok: true, payload: { grietas } };
}

/** Mensaje 413 del informe en PDF (POST /api/juntos/informe-pdf). */
export function mensajeInformeMuyPesado(): string {
  const mb = (MAX_BODY_BYTES / (1024 * 1024)).toFixed(1);
  return `El informe es muy pesado (máximo ${mb}MB). Elimina alguna grieta e intenta de nuevo.`;
}
