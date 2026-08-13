import type { Metadata } from "next";
import AlertaHero from "@/components/alerta/AlertaHero";
import AlertaDisclaimer from "@/components/alerta/AlertaDisclaimer";
import FiltroSeguridad from "@/components/alerta/FiltroSeguridad";

// Página pública de Seiricon Alerta. Vive en el grupo (public), así reutiliza
// Navbar + Footer del sitio, pero NO se enlaza desde ninguno de los dos (el
// tráfico llega por fuera: redes, WhatsApp). Sin cuenta, sin tenant, sin
// Prisma/Supabase — ver docs/specs/2026-08-13-seiricon-alerta-fase1.md.
export const metadata: Metadata = {
  title: "Seiricon Alerta — ¿Es peligrosa esa grieta?",
  description:
    "Guía gratuita para saber si debes salir de tu casa o edificio después de un sismo, y para documentar los daños con evidencia fotográfica.",
  openGraph: {
    title: "Seiricon Alerta — Guía de habitabilidad post-sismo",
    description:
      "Filtro de seguridad de 4 preguntas y acta de daños con fotos con fecha, hora y ubicación. Gratis, sin registro.",
    type: "website",
  },
};

export default function AlertaPage() {
  return (
    <>
      <AlertaHero />
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 sm:px-6">
          <AlertaDisclaimer />
          <FiltroSeguridad />
        </div>
      </section>
    </>
  );
}
