import type { Metadata } from "next";
import BetaHero from "@/components/beta/BetaHero";
import BetaAudience from "@/components/beta/BetaAudience";
import BetaPillars from "@/components/beta/BetaPillars";
import BetaHowItWorks from "@/components/beta/BetaHowItWorks";
import BetaOffer from "@/components/beta/BetaOffer";
import BetaFundador from "@/components/beta/BetaFundador";
import BetaForm from "@/components/beta/BetaForm";
import BetaFaq from "@/components/beta/BetaFaq";
import BetaClosing from "@/components/beta/BetaClosing";
import BetaStickyCta from "@/components/beta/BetaStickyCta";

// Página pública de marketing del beta B2C. Vive dentro del grupo (public), así
// reutiliza Navbar + Footer del layout del grupo y NO redirige a usuarios logueados
// (a diferencia del landing raíz): es para prospectos que llegan desde redes.
export const metadata: Metadata = {
  title: "Beta gratis — Controla tu obra sin ir todos los días",
  description:
    "Ve el avance de tu obra con foto, ubicación y hora, y controla tu plata, desde el celular. Beta gratis de Seiricon: solo 16 cupos (8 propietarios + 8 contratistas).",
  openGraph: {
    title: "Seiricon Beta — Controla tu obra sin ir todos los días",
    description:
      "Evidencia con foto + GPS + hora y control de tu plata, desde el celular. Beta gratis: solo 16 cupos.",
    type: "website",
  },
};

export default function BetaPage() {
  return (
    <>
      <BetaHero />
      <BetaAudience />
      <BetaPillars />
      <BetaHowItWorks />
      <BetaOffer />
      <BetaFundador />
      <BetaForm />
      <BetaFaq />
      <BetaClosing />
      <BetaStickyCta />
    </>
  );
}
