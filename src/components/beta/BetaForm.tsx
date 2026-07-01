import { ClipboardList } from "lucide-react";
import { TALLY_EMBED_URL, TALLY_PLACEHOLDER } from "./config";
import Reveal from "./Reveal";

// Bloque del formulario. Si la URL de Tally sigue en el placeholder mostramos un
// aviso claro (para que en producción nunca aparezca un iframe roto). Cuando Victor
// pega su URL real en config.ts (TALLY_EMBED_URL), se renderiza el iframe embebido.
export default function BetaForm() {
  const urlLista = TALLY_EMBED_URL !== TALLY_PLACEHOLDER;

  return (
    <section id="inscribirme" className="scroll-mt-20 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Reveal className="mb-8 text-center">
          <div
            data-reveal
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm"
          >
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Cuéntanos de tu obra y te reservamos tu cupo
          </h2>
          <p data-reveal className="mx-auto mt-3 max-w-md text-base text-slate-600">
            Toma 1 minuto. No pedimos correo ni tarjeta — solo tu nombre, WhatsApp
            y en qué va tu obra.
          </p>
        </Reveal>

        <Reveal>
          <div
            data-reveal
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {urlLista ? (
              <iframe
                src={TALLY_EMBED_URL}
                title="Formulario de inscripción al beta de Seiricon"
                loading="lazy"
                width="100%"
                height={720}
                // Endurecimiento del embed sin romper Tally: allow-same-origin es
                // OBLIGATORIO para que el formulario cargue, envíe y reporte su alto
                // (Tally usa postMessage/almacenamiento de su propio origen, que NO
                // es el nuestro, así que no expone las cookies/DOM de Seiricon).
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                referrerPolicy="no-referrer-when-downgrade"
                className="block h-[720px] w-full border-0"
              />
            ) : (
              // Fallback visible mientras no haya URL real de Tally.
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <ClipboardList className="h-7 w-7 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">
                  Aquí va el formulario — pega tu link de Tally
                </p>
                <p className="max-w-sm text-sm text-slate-500">
                  Abre{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                    src/components/beta/config.ts
                  </code>{" "}
                  y reemplaza <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">TALLY_EMBED_URL</code>{" "}
                  con la URL real de tu formulario Tally.
                </p>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
