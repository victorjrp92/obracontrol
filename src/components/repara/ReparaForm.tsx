import Link from "next/link";
import { ClipboardList, Mail, MessageCircle } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";
import {
  CONTACTO_EMAIL,
  CONTACTO_WHATSAPP,
  CONTACTO_WHATSAPP_PLACEHOLDER,
  MESES_GRATIS,
  TALLY_REPARA_PLACEHOLDER,
  TALLY_REPARA_URL,
} from "./config";

/**
 * Bloque `#cupo`. Si la URL de Tally sigue en placeholder, el fallback es PARA
 * EL USUARIO (correo real, y WhatsApp si ya está confirmado), no un mensaje
 * dirigido al desarrollador: quien llega aquí es alguien con la casa rota, y
 * tiene que salir con una forma de contactarnos igual. La pista para el
 * desarrollador solo se renderiza fuera de producción.
 */
export default function ReparaForm() {
  const urlLista = TALLY_REPARA_URL !== TALLY_REPARA_PLACEHOLDER;
  const whatsappListo = CONTACTO_WHATSAPP !== CONTACTO_WHATSAPP_PLACEHOLDER;
  const mostrarPistaDev = process.env.NODE_ENV !== "production";

  return (
    <section id="cupo" className="scroll-mt-20 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Reveal className="mb-8 text-center">
          <div
            data-reveal
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm"
          >
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Cuéntanos qué hay que reparar y te activamos el cupo
          </h2>
          <p data-reveal className="mx-auto mt-3 max-w-md text-base text-slate-600">
            Toma un minuto. Te escribimos por WhatsApp y te dejamos la cuenta lista. No pedimos
            tarjeta.
          </p>
        </Reveal>

        <Reveal>
          <div
            data-reveal
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {urlLista ? (
              <iframe
                src={TALLY_REPARA_URL}
                title="Formulario para pedir tu cupo de Seiricon Go"
                loading="lazy"
                width="100%"
                height={720}
                // Mismo endurecimiento del embed que en /beta: allow-same-origin es
                // OBLIGATORIO para que Tally cargue y envíe (usa postMessage y
                // almacenamiento de SU origen, que no es el nuestro).
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                referrerPolicy="no-referrer-when-downgrade"
                className="block h-[720px] w-full border-0"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <ClipboardList className="h-7 w-7 text-blue-600" />
                </div>
                <p className="max-w-sm text-base leading-relaxed text-slate-700">
                  Todavía estamos terminando de montar el formulario. Escríbenos y te activamos el
                  cupo igual.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={`mailto:${CONTACTO_EMAIL}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4" /> {CONTACTO_EMAIL}
                  </a>
                  {whatsappListo && (
                    <a
                      href={`https://wa.me/${CONTACTO_WHATSAPP}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                </div>
                {mostrarPistaDev && (
                  // Solo en desarrollo: la nota para quien mantiene el código.
                  // En producción el usuario nunca ve rutas de archivos.
                  <p className="max-w-sm text-xs text-slate-400">
                    Dev: pega la URL de Tally en <code>TALLY_REPARA_URL</code> (
                    <code>src/components/repara/config.ts</code>) para reemplazar este bloque por el
                    formulario.
                  </p>
                )}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="mt-6 text-center">
          <p data-reveal className="text-sm leading-relaxed text-slate-500">
            ¿Prefieres arrancar ya, sin esperarnos?{" "}
            <Link href="/registro" className="font-semibold text-blue-600 hover:text-blue-700">
              Crea tu cuenta gratis
            </Link>{" "}
            y luego nos escribes para activarte los {MESES_GRATIS} meses.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
