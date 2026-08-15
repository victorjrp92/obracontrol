import type { NextConfig } from "next";
import path from "node:path";

const enDesarrollo = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy — última línea de defensa si alguna vez se cuela un
 * script ajeno (XSS propio o una dependencia comprometida). Sin ella, ese
 * script puede exfiltrar lo que haya en el DOM: en el gate de «Juntos» eso
 * incluye la cédula y las fotos del interior de una casa.
 *
 * Cada origen externo está aquí porque algo concreto lo necesita:
 *   - *.supabase.co        auth, Storage (fotos de evidencia) y Realtime (wss)
 *   - api/events.mapbox    mapas de ubicación de obra
 *   - *.clarity.ms         mapas de calor, SOLO en la landing de Juntos
 *   - va.vercel-scripts    Vercel Analytics
 *   - blob: / data:        cámara del wizard, previsualizaciones y PDF en el
 *                          navegador, y los workers de Mapbox GL y del PWA
 *
 * `'unsafe-inline'` en script-src es una concesión conocida: Next inyecta su
 * script de arranque inline y Clarity también. La versión estricta usa un
 * nonce generado en `src/proxy.ts`; queda como siguiente paso, no bloquea
 * tener CSP hoy. En dev se añade `'unsafe-eval'` porque el HMR lo necesita.
 *
 * ⚠️ Si se agrega un servicio externo nuevo (chat, píxel, CDN de fuentes),
 * hay que añadirlo aquí o el navegador lo bloqueará en silencio.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ""} https://www.clarity.ms https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co https://api.mapbox.com",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.clarity.ms https://va.vercel-scripts.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
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
