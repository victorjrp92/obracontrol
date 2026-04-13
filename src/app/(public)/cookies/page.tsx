import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Cookies — Seiricon",
  description: "Politica de cookies de la plataforma Seiricon.",
};

export default function CookiesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Politica de Cookies</h1>
      <p className="text-sm text-slate-500 mb-10">Ultima actualizacion: 13 de abril de 2026</p>

      <div className="prose prose-slate prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-slate-600 [&_li]:text-slate-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">

        <h2>1. Que son las Cookies</h2>
        <p>
          Las cookies son pequenos archivos de texto que se almacenan en el dispositivo del usuario cuando
          visita un sitio web. Permiten que el sitio recuerde informacion sobre la visita, como las preferencias
          del usuario, para que la proxima visita sea mas facil y util.
        </p>

        <h2>2. Cookies que Utilizamos</h2>

        <h3>2.1 Cookies estrictamente necesarias</h3>
        <p>
          Son indispensables para el funcionamiento de la plataforma. No requieren consentimiento ya que sin
          ellas el servicio no puede prestarse.
        </p>
        <table className="text-sm border-collapse w-full not-prose mb-4">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-4 text-left font-medium text-slate-700">Cookie</th>
              <th className="py-2 pr-4 text-left font-medium text-slate-700">Proposito</th>
              <th className="py-2 text-left font-medium text-slate-700">Duracion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token</td><td className="py-2 pr-4">Sesion de autenticacion (Supabase)</td><td className="py-2">Sesion / 7 dias</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token-code-verifier</td><td className="py-2 pr-4">Verificacion PKCE de autenticacion</td><td className="py-2">Sesion</td></tr>
          </tbody>
        </table>

        <h3>2.2 Cookies de preferencias</h3>
        <p>
          Almacenan las preferencias del usuario para mejorar su experiencia.
        </p>
        <table className="text-sm border-collapse w-full not-prose mb-4">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-4 text-left font-medium text-slate-700">Cookie</th>
              <th className="py-2 pr-4 text-left font-medium text-slate-700">Proposito</th>
              <th className="py-2 text-left font-medium text-slate-700">Duracion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="py-2 pr-4 font-mono text-xs">seiricon-cookie-consent</td><td className="py-2 pr-4">Registro de consentimiento de cookies</td><td className="py-2">365 dias</td></tr>
          </tbody>
        </table>

        <h3>2.3 Cookies analiticas</h3>
        <p>
          Actualmente SEIRICON <strong>no utiliza cookies analiticas de terceros</strong> (Google Analytics,
          Mixpanel, etc.). Si en el futuro se implementan, esta politica sera actualizada y se solicitara
          el consentimiento correspondiente.
        </p>

        <h2>3. Base Legal</h2>
        <p>
          Las cookies estrictamente necesarias se basan en el interes legitimo de prestar el servicio contratado.
          Las cookies de preferencias y analiticas (cuando apliquen) requieren el consentimiento previo del usuario,
          conforme a la Ley 1581 de 2012 y las mejores practicas internacionales.
        </p>

        <h2>4. Como Gestionar las Cookies</h2>
        <p>
          El usuario puede configurar su navegador para rechazar o eliminar cookies. Sin embargo, al deshabilitar
          las cookies estrictamente necesarias, es posible que la plataforma no funcione correctamente.
        </p>
        <p>Instrucciones por navegador:</p>
        <ul>
          <li><strong>Chrome:</strong> Configuracion &gt; Privacidad y seguridad &gt; Cookies</li>
          <li><strong>Firefox:</strong> Configuracion &gt; Privacidad &gt; Cookies y datos del sitio</li>
          <li><strong>Safari:</strong> Preferencias &gt; Privacidad &gt; Gestionar datos del sitio web</li>
          <li><strong>Edge:</strong> Configuracion &gt; Cookies y permisos del sitio</li>
        </ul>

        <h2>5. Actualizaciones</h2>
        <p>
          Esta politica puede ser actualizada periodicamente. La version vigente estara siempre disponible
          en esta pagina con la fecha de la ultima actualizacion.
        </p>

        <h2>6. Contacto</h2>
        <p>
          Para consultas sobre el uso de cookies:
          {" "}<a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a>
        </p>
      </div>
    </div>
  );
}
