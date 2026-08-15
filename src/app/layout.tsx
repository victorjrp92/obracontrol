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
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} — Control de Obra Inteligente`,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
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
