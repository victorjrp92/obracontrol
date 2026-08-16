import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
// Analítica agregada de Vercel: sin cookies y sin identificar personas, por eso
// no necesita consentimiento. Nos da el embudo (visitas, rutas, procedencia).
import { Analytics } from "@vercel/analytics/next";

const APP_NAME = "Seiricon";
const APP_DESCRIPTION =
  "SaaS para constructoras en Colombia. Controla obra blanca, carpintería y madera en tiempo real. Evidencia fotográfica, aprobaciones y métricas de desempeño.";

export const metadata: Metadata = {
  // Obligatorio para las tarjetas sociales: og:image tiene que ser una URL
  // absoluta, y sin esto Next deja la ruta relativa y WhatsApp/Facebook no la
  // resuelven. Vercel expone el dominio de producción en VERCEL_PROJECT_
  // PRODUCTION_URL; el fallback cubre local y cualquier otro entorno.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://seiricon.com")
  ),
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} — Control de Obra Inteligente`,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  // Tarjeta por defecto: cualquier ruta sin openGraph propio hereda esta.
  openGraph: {
    siteName: APP_NAME,
    locale: "es_CO",
    type: "website",
    images: [{ url: "/og/seiricon.jpg", width: 1200, height: 630, alt: `${APP_NAME} — control de obra` }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/seiricon.jpg"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full" dir="ltr">
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
