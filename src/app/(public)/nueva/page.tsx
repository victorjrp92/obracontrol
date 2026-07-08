import type { Metadata } from "next";
import "@/components/landing-v2/landing-v2.css";

import NavBar from "@/components/landing-v2/NavBar";
import Hero from "@/components/landing-v2/Hero";
import Pasos from "@/components/landing-v2/Pasos";
import Ticker from "@/components/landing-v2/Ticker";
import Cifras from "@/components/landing-v2/Cifras";
import FiguraDashboard from "@/components/landing-v2/FiguraDashboard";
import FiguraObrero from "@/components/landing-v2/FiguraObrero";
import SeccionCrearObra from "@/components/landing-v2/SeccionCrearObra";
import FiguraEquipo from "@/components/landing-v2/FiguraEquipo";
import MapaVivo from "@/components/landing-v2/MapaVivo";
import SeccionGastos from "@/components/landing-v2/SeccionGastos";
import GridDenso from "@/components/landing-v2/GridDenso";
import Precios from "@/components/landing-v2/Precios";
import Testimonio from "@/components/landing-v2/Testimonio";
import Faq from "@/components/landing-v2/Faq";
import Cierre from "@/components/landing-v2/Cierre";
import Footer from "@/components/landing-v2/Footer";
import Reveals from "@/components/landing-v2/Reveals";

// Página OCULTA: no debe indexarse ni seguirse. No se enlaza desde ningún lado.
export const metadata: Metadata = {
  title: "Seiricon — vista previa landing",
  robots: { index: false, follow: false },
};

export default function NuevaLandingPage() {
  return (
    <div className="lv2">
      <NavBar />
      <Hero />
      <Pasos />
      <Ticker />
      <Cifras />
      <FiguraDashboard />
      <FiguraObrero />
      <SeccionCrearObra />
      <FiguraEquipo />
      <MapaVivo />
      <SeccionGastos />
      <GridDenso />
      <Precios />
      <Testimonio />
      <Faq />
      <Cierre />
      <Footer />
      <Reveals />
    </div>
  );
}
