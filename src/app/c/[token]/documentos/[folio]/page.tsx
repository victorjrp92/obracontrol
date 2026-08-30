import { validarClienteToken } from "@/lib/data-cliente";
import {
  documentoParaCliente,
  esDocumentoError,
  esFolioDeFamilia,
  normalizarFolio,
  type PrefijoFolio,
} from "@/lib/documentos";
import EnlaceNoDisponible from "@/components/documentos/EnlaceNoDisponible";
import EstadoDeFirmas from "@/components/documentos/EstadoDeFirmas";
import RecibidoConforme from "@/components/documentos/RecibidoConforme";

/**
 * El documento visto por el cliente, sin cuenta, por el enlace de siempre.
 *
 * Reusa `/c/[token]` tal cual: el mismo token, el mismo validador endurecido y
 * el mismo aislamiento —el token resuelve a UNA obra y solo se sirven documentos
 * de esa obra—. No hay un segundo mecanismo de acceso que mantener ni que
 * auditar aparte.
 */

export const metadata = {
  title: "Documento de tu obra",
  robots: { index: false, follow: false },
};

// Sin caché: un token revocado deja de servir el documento de inmediato, y la
// constancia de entrega tiene que verse en cuanto se deja.
export const dynamic = "force-dynamic";

/** AE — acta de estado inicial · CT — concepto técnico. */
const PREFIJOS_PROFESIONAL: readonly PrefijoFolio[] = ["AE", "CT"];

export default async function DocumentoClientePage({
  params,
}: {
  params: Promise<{ token: string; folio: string }>;
}) {
  const { token, folio: folioCrudo } = await params;

  const valido = await validarClienteToken(token);
  if (!valido) return <EnlaceNoDisponible />;

  const folio = normalizarFolio(folioCrudo ?? "");
  if (!esFolioDeFamilia(folio, PREFIJOS_PROFESIONAL)) return <EnlaceNoDisponible />;

  let documento;
  try {
    documento = await documentoParaCliente(folio, valido.proyectoId);
  } catch (err) {
    if (esDocumentoError(err)) return <EnlaceNoDisponible />;
    throw err;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seiricon-icon.png" alt="Seiricon" className="h-7 w-7" />
          <span className="text-sm font-semibold text-slate-700">Seiricon</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {documento.etiqueta}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Folio {documento.folio} · emitido {documento.emitido}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Huella del contenido: {documento.huellaCorta} — la misma que aparece en el pie del PDF.
          </p>
        </div>

        <EstadoDeFirmas documento={documento} />

        <RecibidoConforme token={token} documento={documento} />

        <footer className="border-t border-slate-200 pt-5 text-center">
          <p className="text-xs text-slate-400">
            Puedes comprobar este documento en cualquier momento con su folio y su huella.
          </p>
        </footer>
      </main>
    </div>
  );
}
