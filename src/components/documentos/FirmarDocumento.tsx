"use client";

import { useState } from "react";
import { CircleCheck, PenLine, TriangleAlert } from "lucide-react";
// Del submódulo, no del barril: el barril reexporta el adaptador de Prisma y
// esto es un componente de cliente. `lenguaje.ts` son solo textos.
import { COPY_FIRMA } from "@/lib/documentos/lenguaje";

interface Firmado {
  matricula: string | null;
  firmadoMomento: string | null;
}

/**
 * El botón con el que el profesional cierra el documento.
 *
 * Dos cosas se dicen antes de pulsar, y las dos importan: qué es esta firma —
 * electrónica simple, no certificada— y que al firmar el documento queda cerrado
 * para siempre. La segunda no es un aviso de cortesía: es la única oportunidad de
 * enterarse, porque después no hay forma de deshacerlo. Corregir es emitir otra
 * versión.
 *
 * No hay ningún campo donde escribir quién firma. La identidad es la sesión.
 */
export default function FirmarDocumento({
  documentoId,
  firmaInicial,
}: {
  documentoId: string;
  firmaInicial: Firmado;
}) {
  const [firma, setFirma] = useState<Firmado>(firmaInicial);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function firmar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/documentos/${encodeURIComponent(documentoId)}/firmar`, {
        method: "POST",
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos?.error ?? "No se pudo firmar. Intenta de nuevo.");
        return;
      }
      setFirma({ matricula: datos.matricula, firmadoMomento: datos.firmadoMomento });
      setConfirmando(false);
    } catch {
      setError("No se pudo firmar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (firma.firmadoMomento) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
        <div>
          <p className="text-sm font-bold text-slate-900">{COPY_FIRMA.hecho}</p>
          <p className="mt-1 text-sm text-slate-600">
            {firma.firmadoMomento}
            {firma.matricula ? ` · matrícula ${firma.matricula}` : ""}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{COPY_FIRMA.alcance}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900">{COPY_FIRMA.titulo}</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{COPY_FIRMA.alcance}</p>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
        <p className="text-xs leading-relaxed text-amber-900">{COPY_FIRMA.advertenciaCierre}</p>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {confirmando ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={firmar}
            disabled={enviando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
          >
            <PenLine className="h-4 w-4" />
            {enviando ? "Firmando…" : "Sí, firmar y cerrar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={enviando}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Todavía no
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <PenLine className="h-4 w-4" />
          {COPY_FIRMA.boton}
        </button>
      )}
    </div>
  );
}
