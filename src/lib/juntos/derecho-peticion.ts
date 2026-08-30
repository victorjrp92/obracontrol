/**
 * Contrato y validación del Derecho de petición de «Juntos»
 * (POST /api/juntos/derecho-peticion-pdf). Documento formal dirigido a la
 * alcaldía de la ciudad del peticionario (art. 23 de la Constitución
 * Política) pidiendo la inclusión en el censo de damnificados (RUD) y la
 * evaluación técnica de la vivienda. Ver spec-go-juntos.md, sección
 * «Derecho de petición».
 *
 * MISMA REGLA DURA que el acta: cédula y dirección viajan solo en este
 * request, se imprimen y se descartan. Nada se persiste ni se loguea.
 */
import { MAX_ESPACIOS } from "@/lib/alerta/acta";
import { validarIdentidad, type IdentidadActa } from "./acta-juntos";
import { esFolioDeFamilia } from "@/lib/documentos";

export interface DanoDeclarado {
  espacio: string;
  /** Pérdidas/daños declarados en ese espacio — null si no se describieron. */
  descripcion: string | null;
}

export interface DerechoPeticionPayload {
  identidad: IdentidadActa;
  danos: DanoDeclarado[];
  /** Folio del acta que se anexa (si ya se generó) — se cita en el texto. */
  folioActa: string | null;
}

/** Tope holgado del body: texto puro, sin fotos. */
export const MAX_BODY_PETICION_BYTES = 64 * 1024;

const MAX_LARGO_ESPACIO = 100;
const MAX_LARGO_DESCRIPCION = 500;
// Antes había aquí una copia del formato de folio. Una segunda definición del
// mismo patrón es exactamente la deriva que el módulo compartido elimina: si
// mañana cambia el formato, esta copia habría quedado atrás en silencio.

export type ValidacionDerechoPeticion =
  | { ok: true; payload: DerechoPeticionPayload }
  | { ok: false; error: string };

export function validarDerechoPeticionPayload(body: unknown): ValidacionDerechoPeticion {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  const identidadResultado = validarIdentidad(b.identidad);
  if (!identidadResultado.ok) return { ok: false, error: identidadResultado.error };

  if (!Array.isArray(b.danos) || b.danos.length === 0) {
    return { ok: false, error: "El derecho de petición necesita al menos un daño declarado." };
  }
  if (b.danos.length > MAX_ESPACIOS) {
    return { ok: false, error: "Hay más daños declarados de los permitidos por documento." };
  }

  const danos: DanoDeclarado[] = [];
  for (const raw of b.danos) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Uno de los daños declarados tiene un formato inválido." };
    }
    const d = raw as Record<string, unknown>;
    const espacio = typeof d.espacio === "string" ? d.espacio.trim() : "";
    if (!espacio || espacio.length > MAX_LARGO_ESPACIO) {
      return { ok: false, error: "Uno de los daños declarados no tiene un espacio válido." };
    }
    const descripcionCruda = typeof d.descripcion === "string" ? d.descripcion.trim() : "";
    const descripcion = descripcionCruda ? descripcionCruda.slice(0, MAX_LARGO_DESCRIPCION) : null;
    danos.push({ espacio, descripcion });
  }

  let folioActa: string | null = null;
  if (typeof b.folioActa === "string" && esFolioDeFamilia(b.folioActa.trim(), ["JT"])) {
    folioActa = b.folioActa.trim();
  }

  return { ok: true, payload: { identidad: identidadResultado.identidad, danos, folioActa } };
}

export function mensajePeticionMuyPesada(): string {
  return "La solicitud es muy larga. Acorta las descripciones e intenta de nuevo.";
}
