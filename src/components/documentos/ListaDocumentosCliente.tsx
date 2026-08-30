import Link from "next/link";
import { FileText } from "lucide-react";
import type { DocumentoParaCliente } from "@/lib/documentos/vista-cliente";

/**
 * Los documentos firmados de la obra, en la vista del cliente.
 *
 * Marca cuáles ya tienen constancia de entrega y cuáles no, porque lo que el
 * cliente necesita saber de un vistazo es qué le falta por confirmar que recibió.
 */
export default function ListaDocumentosCliente({
  token,
  documentos,
}: {
  token: string;
  documentos: DocumentoParaCliente[];
}) {
  if (documentos.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5">
      <h2 className="mb-3 font-bold text-slate-900">Documentos</h2>
      <ul className="flex flex-col divide-y divide-slate-100">
        {documentos.map((doc) => (
          <li key={doc.folio} className="py-3 first:pt-0 last:pb-0">
            <Link
              href={`/c/${encodeURIComponent(token)}/documentos/${encodeURIComponent(doc.folio)}`}
              className="flex items-center justify-between gap-3 rounded-lg transition-colors hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {doc.etiqueta}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {doc.folio} · {doc.emitido}
                    {doc.reemplazado ? " · reemplazado por una versión posterior" : ""}
                  </span>
                </span>
              </span>
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  doc.recibidoEl
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {doc.recibidoEl ? "Recibido" : "Por confirmar"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
