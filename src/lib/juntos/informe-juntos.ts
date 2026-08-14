/**
 * Contrato y validación del Informe de grietas de «Juntos»
 * (/go/juntos/revisar → POST /api/juntos/informe-pdf). Extiende el informe de
 * Fase 2 (src/lib/alerta/grietas.ts) con el bloque de identidad del gate de
 * datos — mismo patrón que acta-juntos.ts sobre acta.ts.
 *
 * Por qué un contrato aparte y no `identidad` dentro de InformeGrietasPayload:
 * la ruta /api/alerta/informe-grietas-pdf sigue viva y la consume
 * src/components/alerta/GrietaWizard.tsx SIN identidad. Exigirla allí rompería
 * ese flujo; aquí es obligatoria, como manda el spec para todo PDF de Juntos.
 *
 * REGLA DURA (spec-go-juntos.md): `cedula` y `direccion` viajan SOLO en este
 * request, se imprimen en el PDF y se DESCARTAN. No se persisten en ninguna
 * tabla ni se escriben en ningún log — la ruta que consume este contrato no
 * loguea el body bajo ninguna circunstancia.
 */
import {
  MAX_BODY_BYTES,
  mensajeInformeMuyPesado,
  validarInformeGrietasPayload,
  type GrietaInformeItem,
} from "@/lib/alerta/grietas";
import { validarIdentidad, type IdentidadActa } from "./acta-juntos";

export { MAX_BODY_BYTES, mensajeInformeMuyPesado };

export interface InformeJuntosPayload {
  identidad: IdentidadActa;
  /** Mismos topes y allowlists que el informe de Fase 2 (grietas.ts). */
  grietas: GrietaInformeItem[];
}

export type ValidacionInformeJuntos =
  | { ok: true; payload: InformeJuntosPayload }
  | { ok: false; error: string };

/**
 * Valida el payload crudo que llega a `POST /api/juntos/informe-pdf`: el
 * bloque de identidad del gate (validarIdentidad, el mismo del acta) + las
 * grietas, delegadas tal cual en `validarInformeGrietasPayload` para no
 * duplicar topes ni allowlists. Segunda línea de defensa del servidor: el
 * cliente ya calculó el veredicto (el triage vive en el navegador) y aquí
 * solo se comprueba forma y límites, nunca se recalcula la lógica del motor.
 */
export function validarInformeJuntosPayload(body: unknown): ValidacionInformeJuntos {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  const identidadResultado = validarIdentidad(b.identidad);
  if (!identidadResultado.ok) return { ok: false, error: identidadResultado.error };

  const grietasResultado = validarInformeGrietasPayload({ grietas: b.grietas });
  if (!grietasResultado.ok) return { ok: false, error: grietasResultado.error };

  return {
    ok: true,
    payload: {
      identidad: identidadResultado.identidad,
      grietas: grietasResultado.payload.grietas,
    },
  };
}
