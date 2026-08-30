import type { Metadata } from "next";
import VerificarDocumentoProfesional from "./client";

export const metadata: Metadata = {
  title: { absolute: "Verificar un documento — Seiricon" },
  description:
    "Comprueba que un acta de estado inicial o un concepto técnico se emitió en Seiricon, que su contenido no fue modificado y quién lo firmó.",
};

/**
 * /verificar — comprobación pública de un documento del profesional.
 *
 * Existe porque el pie de cada acta imprime «Verifica este documento en
 * seiricon.com/verificar · <folio> · <huella>», y un pie que remite a una página
 * que no existe es peor que no imprimir nada: quien lo intenta concluye que el
 * documento es falso.
 *
 * Sin login y sin cuenta, a propósito. Quien verifica no es nuestro usuario: es
 * su aseguradora, su cliente, o el juzgado. Pedirle una cuenta para comprobar un
 * papel que ya tiene en la mano convertiría la verificación en un trámite, y una
 * verificación que cuesta trabajo no se hace.
 *
 * La ruta API a la que llama (`/api/documentos/verificar`) responde SOLO por los
 * folios del profesional —`AE` y `CT`—, tiene freno por IP y no devuelve ningún
 * nombre: los nombres están impresos en el documento y entran en la huella, así
 * que si la huella coteja ya están probados, y republicarlos aquí solo expondría
 * a dos personas ante cualquiera que acierte un folio.
 */
export default function VerificarPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <p className="text-sm font-bold tracking-widest text-blue-700">SEIRICON</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Verificar un documento</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Comprueba que un documento se emitió aquí y que nadie lo modificó. El folio y la huella
          están en el pie de cada página del documento.
        </p>
      </header>

      <VerificarDocumentoProfesional />
    </main>
  );
}
