"use client";

import { useState } from "react";
import { CircleCheck, Info } from "lucide-react";
// Importado del submódulo y no del barril a propósito: `@/lib/documentos`
// reexporta el adaptador de Prisma, y en un componente de cliente eso arrastraría
// el cliente de base de datos al bundle del navegador. Estos dos módulos son
// puros —copys y reglas— y el tipo se importa como tipo, así que se borra al
// compilar.
import { COPY_RECIBIDO } from "@/lib/documentos/lenguaje";
import { RECEPTOR_LARGO_MAX, RECEPTOR_LARGO_MIN } from "@/lib/documentos/recibido";
import type { DocumentoParaCliente } from "@/lib/documentos/vista-cliente";

/**
 * El botón con el que el cliente deja constancia de que RECIBIÓ el documento.
 *
 * El microcopy no está debajo ni en un enlace de «más información»: está encima
 * del botón, en el mismo bloque, porque lo que hay que evitar es exactamente que
 * alguien confirme sin leer qué confirma. Y se sigue viendo después de
 * confirmar, que es cuando alguien podría acordarse de la palabra «conforme» y
 * entenderla como una aprobación del contenido.
 */
export default function RecibidoConforme({
  token,
  documento,
}: {
  token: string;
  documento: DocumentoParaCliente;
}) {
  const [estado, setEstado] = useState<DocumentoParaCliente>(documento);
  const [receptor, setReceptor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaRecibido = estado.recibidoMomento !== null;
  const puedeEnviar =
    !enviando && receptor.trim().length >= RECEPTOR_LARGO_MIN && estado.firmadoMomento !== null;

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documentos/c/${encodeURIComponent(token)}/${encodeURIComponent(estado.folio)}/recibido`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receptor }),
        }
      );
      const datos = await res.json();
      if (!res.ok) {
        setError(datos?.error ?? "No se pudo registrar la constancia. Intenta de nuevo.");
        return;
      }
      setEstado(datos as DocumentoParaCliente);
    } catch {
      setError("No se pudo registrar la constancia. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (yaRecibido) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-bold text-slate-900">{COPY_RECIBIDO.hecho}</p>
            <p className="mt-1 text-sm text-slate-600">
              {estado.recibidoPor} · {estado.recibidoMomento}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{COPY_RECIBIDO.aclaracion}</p>
          </div>
        </div>
      </section>
    );
  }

  if (estado.firmadoMomento === null) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-500">
          Este documento todavía no está firmado. Cuando el profesional lo cierre, podrás dejar aquí
          tu constancia de recibido.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900">{COPY_RECIBIDO.titulo}</h2>

      {/* La aclaración va ANTES del campo y del botón, no después. */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-600">{COPY_RECIBIDO.aclaracion}</p>
      </div>

      <label htmlFor="receptor" className="mt-4 block text-sm font-medium text-slate-700">
        ¿Quién recibe el documento?
      </label>
      <input
        id="receptor"
        type="text"
        value={receptor}
        onChange={(e) => setReceptor(e.target.value)}
        maxLength={RECEPTOR_LARGO_MAX}
        placeholder="Escribe cómo te identificas"
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
      />

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <button
        type="button"
        onClick={confirmar}
        disabled={!puedeEnviar}
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {enviando ? "Registrando…" : COPY_RECIBIDO.boton}
      </button>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{COPY_RECIBIDO.ayuda}</p>
    </section>
  );
}
