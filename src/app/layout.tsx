import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_NAME = "ObraControl";
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
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
