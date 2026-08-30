"use client";

import { useState } from "react";
import { ArrowRight, CircleCheck, Loader2, ShieldAlert, ShieldQuestion } from "lucide-react";
import { COPY_VERSION, ETIQUETA_TIPO } from "@/lib/documentos/lenguaje";

/**
 * El formulario de comprobación y su respuesta.
 *
 * REGLA DE COPY, la más importante de esta pantalla: se certifica EMISIÓN e
 * INTEGRIDAD, nunca el contenido. «Este documento se emitió aquí y nadie lo
 * modificó» es cierto y comprobable. «Documento válido» o «verificado por
 * Seiricon» nos pondría a responder por lo que dice el documento, que es
 * exactamente lo que el producto entero se cuida de no hacer. Por eso cada
 * respuesta afirmativa lleva pegada la aclaración de qué NO confirma.
 *
 * Los tipos se nombran con `ETIQUETA_TIPO` del módulo de documentos, no con un
 * diccionario propio: es el mismo sitio donde está escrito que
 * `INFORME_TECNICO` se lee «Concepto técnico». Un segundo diccionario aquí sería
 * el que un día dijera otra cosa.
 */

type Firmas = {
  profesional: { fecha: string; matricula: string | null } | null;
  recibido: { fecha: string } | null;
};

type Estado =
  | { fase: "inicial" }
  | { fase: "consultando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "listo";
      existe?: boolean;
      indisponible?: boolean;
      tipo?: keyof typeof ETIQUETA_TIPO;
      emitido?: string;
      huellaCoincide?: boolean | null;
      firmas?: Firmas;
      vigencia?: { version: number; reemplazado: boolean };
    };

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function VerificarDocumentoProfesional() {
  const [folio, setFolio] = useState("");
  const [huella, setHuella] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "inicial" });

  async function consultar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado.fase === "consultando") return;

    const folioLimpio = folio.trim();
    if (!folioLimpio) {
      setEstado({ fase: "error", mensaje: "Escribe el folio que aparece en el pie del documento." });
      return;
    }

    setEstado({ fase: "consultando" });
    try {
      const params = new URLSearchParams({ folio: folioLimpio });
      const h = huella.trim().toLowerCase();
      if (h) params.set("huella", h);

      const res = await fetch(`/api/documentos/verificar?${params.toString()}`);
      const datos = await res.json().catch(() => null);

      if (!res.ok) {
        setEstado({
          fase: "error",
          mensaje: datos?.error ?? "No pudimos hacer la consulta. Intenta de nuevo en un momento.",
        });
        return;
      }
      setEstado({ fase: "listo", ...datos });
    } catch {
      setEstado({
        fase: "error",
        mensaje: "No pudimos hacer la consulta. Revisa tu conexión e intenta de nuevo.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={consultar} noValidate className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="folio" className="text-sm font-semibold text-slate-800">
            Folio
          </label>
          <p className="text-xs text-slate-500">
            Está en el pie del documento. Tiene esta forma: AE-20260830-a3f9c1
          </p>
          <input
            id="folio"
            type="text"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="AE-20260830-a3f9c1"
            autoComplete="off"
            spellCheck={false}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="huella" className="text-sm font-semibold text-slate-800">
            Huella (opcional)
          </label>
          <p className="text-xs text-slate-500">
            El código que va justo después del folio. Comprueba además que el contenido no cambió.
          </p>
          <input
            id="huella"
            type="text"
            value={huella}
            onChange={(e) => setHuella(e.target.value)}
            placeholder="a1b2c3d4e5f6"
            autoComplete="off"
            spellCheck={false}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <button
          type="submit"
          disabled={estado.fase === "consultando"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
        >
          {estado.fase === "consultando" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {estado.fase === "consultando" ? "Consultando…" : "Comprobar"}
        </button>
      </form>

      {estado.fase === "error" && <p className="text-sm text-rose-700">{estado.mensaje}</p>}

      {/* El registro no responde. NO se puede decir «no encontramos este folio»:
          el documento puede ser auténtico y estaríamos sembrando una duda falsa
          justo sobre lo que alguien va a presentar. */}
      {estado.fase === "listo" && estado.indisponible && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5" role="status">
          <ShieldQuestion className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
          <div>
            <p className="font-bold text-slate-900">La comprobación no está disponible ahora.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Esto no dice nada sobre el documento: puede ser perfectamente auténtico. Inténtalo de
              nuevo en unos minutos.
            </p>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && !estado.existe && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5" role="status">
          <ShieldQuestion className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
          <div>
            <p className="font-bold text-slate-900">No encontramos este folio.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Revísalo: se copia del pie del documento y tiene esta forma — AE-20260830-a3f9c1. Si
              está bien copiado, este documento no se emitió en Seiricon.
            </p>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && estado.existe && estado.huellaCoincide === false && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-5" role="status">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-700" />
          <div>
            <p className="font-bold text-slate-900">Este folio existe, pero el contenido no coincide.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              El documento se emitió el {estado.emitido && fechaLarga(estado.emitido)}, pero lo que
              estás cotejando no es igual al original. Pídele el archivo original a quien te lo
              entregó.
            </p>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && estado.existe && estado.huellaCoincide !== false && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5" role="status">
          <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-700" />
          <div>
            <p className="font-bold text-slate-900">Documento emitido en Seiricon.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {estado.tipo && ETIQUETA_TIPO[estado.tipo]
                ? `${ETIQUETA_TIPO[estado.tipo]}, emitido`
                : "Emitido"}{" "}
              el {estado.emitido && fechaLarga(estado.emitido)}
              {estado.huellaCoincide === true && ", y su contenido no ha sido modificado"}.
            </p>

            {estado.firmas?.profesional && (
              <p className="mt-2 text-sm text-slate-600">
                Firmado por el profesional el {fechaLarga(estado.firmas.profesional.fecha)}
                {estado.firmas.profesional.matricula
                  ? ` · matrícula ${estado.firmas.profesional.matricula}`
                  : ""}
                .
              </p>
            )}
            {estado.firmas && !estado.firmas.profesional && (
              <p className="mt-2 text-sm text-slate-600">
                Todavía no lleva la firma del profesional.
              </p>
            )}
            {estado.firmas?.recibido && (
              <p className="mt-1 text-sm text-slate-600">
                El cliente dejó constancia de haberlo recibido el{" "}
                {fechaLarga(estado.firmas.recibido.fecha)}. Es constancia de entrega, no aprobación
                del contenido.
              </p>
            )}

            {estado.vigencia && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Versión {estado.vigencia.version}.{" "}
                {estado.vigencia.reemplazado ? COPY_VERSION.reemplazado : COPY_VERSION.vigente}
              </p>
            )}

            {/* Sin esta aclaración, «emitido en Seiricon» se lee como «Seiricon
                respalda lo que el documento dice». Se certifica el papel, nunca
                el estado del inmueble. */}
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Esto confirma que el documento se emitió aquí y, si aportaste la huella, que nadie lo
              alteró. <b>No confirma el estado del inmueble</b>: de eso responde el profesional que
              firma, con su matrícula y dentro del alcance que el propio documento describe.
            </p>
            {estado.huellaCoincide === null && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Para comprobar además que el contenido no cambió, vuelve a consultar añadiendo la
                huella que va después del folio.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
