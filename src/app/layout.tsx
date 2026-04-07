import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ObraControl — Control de Obra Inteligente",
  description:
    "SaaS para constructoras en Colombia. Controla obra blanca, carpintería y madera en tiempo real. Evidencia fotográfica, aprobaciones y métricas de desempeño.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
