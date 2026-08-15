import type { NextConfig } from "next";
import path from "node:path";

const enDesarrollo = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy — última línea de defensa si alguna vez se cuela un
 * script ajeno (XSS propio o una dependencia comprometida). Sin ella, ese
 * script puede exfiltrar lo que haya en el DOM: en el gate de «Juntos» eso
 * incluye la cédula y las fotos del interior de una casa.
 *
 * Cada origen externo está aquí porque algo concreto lo necesita. Se obtuvo
 * barriendo todo src/ en busca de referencias externas, no de memoria:
 *   - *.supabase.co          auth, Storage (fotos de evidencia) y Realtime (wss)
 *   - api/events.mapbox      mapas de ubicación de obra
 *   - fonts.googleapis.com   hoja de estilo de Plus Jakarta Sans
 *   - fonts.gstatic.com      los archivos .woff2 de esa fuente
 *   - *.clarity.ms           mapas de calor, SOLO en la landing de Juntos
 *   - va.vercel-scripts      Vercel Analytics
 *   - tally.so               formulario embebido en /beta
 *   - blob: / data:          cámara del wizard, previsualizaciones y PDF en el
 *                            navegador, y los workers de Mapbox GL y del PWA
 *
 * Los enlaces a Google Maps de la galería de evidencias son navegación
 * (`<a href>`), no carga de recursos: la CSP no los toca.
 *
 * `'unsafe-inline'` en script-src es una concesión conocida: Next inyecta su
 * script de arranque inline y Clarity también. La versión estricta usa un
 * nonce generado en `src/proxy.ts`; queda como siguiente paso, no bloquea
 * tener CSP hoy. En dev se añade `'unsafe-eval'` porque el HMR lo necesita.
 *
 * ⚠️ Si se agrega un servicio externo nuevo (chat, píxel, CDN, iframe), hay que
 * añadirlo aquí o el navegador lo bloqueará EN SILENCIO. Para diagnosticarlo:
 * abrir la consola y buscar «Refused to load».
 *
 * ⚠️ Cambiar la fuente de un `@import` en globals.css a otro CDN exige tocar
 * style-src y font-src a la vez: la hoja y los .woff2 salen de hosts distintos.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ""} https://www.clarity.ms https://va.vercel-scripts.com`,
  // globals.css hace @import de fonts.googleapis.com — sin esto, toda la
  // tipografía del producto cae a la fuente del sistema.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' blob: data: https://*.supabase.co https://api.mapbox.com",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.clarity.ms https://va.vercel-scripts.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Formulario de Tally embebido en /beta. Sin esto el iframe queda en blanco.
  "frame-src 'self' https://tally.so",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // El bundle del navegador es público de todas formas, pero publicar los
  // source maps le entrega a cualquiera el código con nombres y comentarios
  // originales. Explícito en vez de confiar en el valor por defecto.
  productionBrowserSourceMaps: false,
  // No anunciar la versión del framework: no es una vulnerabilidad, pero le
  // ahorra el trabajo de reconocimiento a quien busca versiones con CVE.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Redundante con `frame-ancestors`, se conserva para navegadores viejos.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
          // HSTS: obliga a HTTPS durante 2 años. `preload` solo tiene efecto
          // si además se inscribe el dominio en hstspreload.org.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Serwist PWA wrapper — solo en production build (incompatible con Turbopack en dev)
if (process.env.NODE_ENV === "production") {
  const withSerwistInit = require("@serwist/next").default;
  const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    cacheOnNavigation: true,
    reloadOnOnline: true,
  });
  module.exports = withSerwist(nextConfig);
} else {
  module.exports = nextConfig;
}
