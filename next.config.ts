import type { NextConfig } from "next";
import path from "node:path";
import withSerwistInit from "@serwist/next";

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
  // Clarity se inyecta desde subdominios (no solo www), y vercel.live es la
  // barra de comentarios de los despliegues preview.
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ""} https://*.clarity.ms https://va.vercel-scripts.com https://vercel.live`,
  // globals.css hace @import de fonts.googleapis.com — sin esto, toda la
  // tipografía del producto cae a la fuente del sistema.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' blob: data: https://*.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com",
  "media-src 'self' blob: https://*.supabase.co",
  // *.tiles.mapbox.com: los TileJSON que devuelve api.mapbox.com pueden apuntar
  // ahí, y el fallo sería un mapa en gris sin error de servidor. c.bing.com es
  // el destino de telemetría de Clarity.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.clarity.ms https://c.bing.com https://va.vercel-scripts.com https://vercel.live",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  // Formulario de Tally embebido en /beta. Sin esto el iframe queda en blanco.
  "frame-src 'self' https://tally.so https://vercel.live",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // `<form action={loginConGoogle}>` es una Server Action que redirige a
  // Supabase Auth. Con JS hidratado el envío es mismo origen, pero sin hidratar
  // el navegador hace un POST nativo y Chrome aplica form-action al 3xx que le
  // sigue: sin este origen, «entrar con Google» no haría nada y sería
  // irreproducible para quien lo reporte.
  "form-action 'self' https://*.supabase.co",
  "object-src 'none'",
  // Solo en producción: en desarrollo se prueba el flujo del obrero desde un
  // celular contra la IP de la LAN (http://192.168.x.x), que no es un origen
  // «potentially trustworthy» — la directiva sí aplicaría y no cargaría nada.
  ...(enDesarrollo ? [] : ["upgrade-insecure-requests"]),
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

/**
 * Serwist (PWA) solo en el build de producción.
 *
 * El import va arriba, con los demás, y la condición envuelve la LLAMADA — no
 * el import. Antes esto era un `require()` dentro de un `if`, lo que además
 * obligaba a cerrar el archivo con `module.exports`: CommonJS y ESM mezclados
 * en un archivo que ya empezaba con `import`. Importar el módulo no tiene
 * efectos secundarios; invocarlo sí (avisa por consola), y por eso la llamada
 * queda dentro de la condición y dev sigue silencioso.
 *
 * ⚠️ HOY EL SERVICE WORKER NO SE GENERA. Next 16 compila con Turbopack por
 * defecto —también en `build`— y `@serwist/next` no lo soporta: avisa por
 * consola y no emite `public/sw.js`. Comprobado con este archivo y con el
 * anterior: no es una regresión de este cambio, viene de la migración a Next 16.
 *
 * Consecuencia real: no hay modo offline para los obreros en campo ni la app es
 * instalable, aunque `docs/manual-de-usuario.md` (sección 17) lo documente y
 * exista `src/lib/offline-queue.ts`. Para arreglarlo hay que migrar a
 * `@serwist/turbopack` (experimental) o al modo configurador de Serwist, que sí
 * soporta Turbopack. Ver https://github.com/serwist/serwist/issues/54.
 */
export default enDesarrollo
  ? nextConfig
  : withSerwistInit({
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      cacheOnNavigation: true,
      reloadOnOnline: true,
    })(nextConfig);
