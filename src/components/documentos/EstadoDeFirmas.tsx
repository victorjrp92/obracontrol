import { Clock, PenLine, ShieldCheck } from "lucide-react";
import { COPY_RECIBIDO, COPY_VERSION } from "@/lib/documentos/lenguaje";
import type { DocumentoParaCliente } from "@/lib/documentos/vista-cliente";

/**
 * Las dos firmas de un documento, en una tarjeta de solo lectura.
 *
 * Se usa igual en la pantalla del cliente y en la de verificación, y por eso no
 * trae ninguna acción: pinta lo que hay. La aclaración de qué significa
 * «recibido conforme» va SIEMPRE visible, también cuando la constancia ya está
 * dada — es entonces cuando alguien podría malinterpretarla.
 */
export default function EstadoDeFirmas({ documento }: { documento: DocumentoParaCliente }) {
  const firmado = documento.firmadoMomento !== null;
  const recibido = documento.recibidoMomento !== null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Firmas</h2>

      <div className="mt-4 flex flex-col divide-y divide-slate-100">
        {/* ── Firma del profesional ─────────────────────────────────────── */}
        <div className="flex items-start gap-3 pb-4">
          <span
            className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
              firmado ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {firmado ? <PenLine className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Firma del profesional</p>
            {firmado ? (
              <p className="mt-0.5 text-sm text-slate-600">
                Firmado el {documento.firmadoMomento}
                {documento.matricula ? ` · matrícula ${documento.matricula}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-500">Todavía sin firmar.</p>
            )}
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Firma electrónica simple (Ley 527 de 1999). No es firma digital certificada.
            </p>
          </div>
        </div>

        {/* ── Recibido conforme del cliente ─────────────────────────────── */}
        <div className="flex items-start gap-3 pt-4">
          <span
            className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
              recibido ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {recibido ? <ShieldCheck className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{COPY_RECIBIDO.titulo}</p>
            {recibido ? (
              <p className="mt-0.5 text-sm text-slate-600">
                Constancia de entrega dejada el {documento.recibidoMomento}
                {documento.recibidoPor ? ` por ${documento.recibidoPor}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-500">Sin constancia de entrega todavía.</p>
            )}
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{COPY_RECIBIDO.aclaracion}</p>
          </div>
        </div>
      </div>

      {/* ── Versión ───────────────────────────────────────────────────── */}
      <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
        Versión {documento.version} ·{" "}
        {documento.reemplazado ? COPY_VERSION.reemplazado : COPY_VERSION.vigente}
      </p>
    </section>
  );
}
