import Link from "next/link";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { CANAL_OFICIAL_PLACEHOLDER, CANALES_OFICIALES, CONTACTO_EMAIL, CONTACTO_WHATSAPP, CONTACTO_WHATSAPP_PLACEHOLDER } from "./config";

/**
 * Paso 6 del triage: puente con ingenieros. Contacto por correo (real,
 * mismo que el resto del sitio) y WhatsApp (botón oculto mientras el número
 * siga en placeholder — mismo patrón que TALLY_EMBED_URL en
 * src/components/beta/config.ts), canal oficial del municipio con
 * placeholders, y UNA sola línea de remarketing al final, después de la
 * ayuda real. Sin banner, sin modal, sin interrumpir (spec sección 3).
 */
export default function PuenteIngenieros() {
  const whatsappListo = CONTACTO_WHATSAPP !== CONTACTO_WHATSAPP_PLACEHOLDER;
  const canalesListos = CANALES_OFICIALES.filter((c) => c.url !== CANAL_OFICIAL_PLACEHOLDER);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900">¿Quieres que un ingeniero lo revise?</h2>
        <p className="mt-1 text-xs text-slate-500">Comparte el informe en PDF que descargaste como punto de partida.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`mailto:${CONTACTO_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Mail className="h-4 w-4" /> Escríbenos a {CONTACTO_EMAIL}
        </a>
        {whatsappListo && (
          <a
            href={`https://wa.me/${CONTACTO_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
      </div>

      {canalesListos.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Canal oficial de tu ciudad</p>
          <ul className="flex flex-col gap-1">
            {canalesListos.map((c) => (
              <li key={c.ciudad}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                >
                  {c.ciudad} — {c.descripcion} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Seiricon también ayuda a constructoras y contratistas a llevar el control de una obra —{" "}
        <Link href="/para-ti" className="font-medium text-blue-600 hover:text-blue-700">
          conócenos
        </Link>
        .
      </p>
    </div>
  );
}
