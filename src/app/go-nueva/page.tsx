import type { Metadata } from "next";
import "@/components/landing-go/landing-go.css";

import NavBarGo from "@/components/landing-go/NavBarGo";
import HeroGo from "@/components/landing-go/HeroGo";
import Bifurcacion from "@/components/landing-go/Bifurcacion";
import EscenaChat from "@/components/landing-go/EscenaChat";
import LoQueCambia from "@/components/landing-go/LoQueCambia";
import ObjecionMaestro from "@/components/landing-go/ObjecionMaestro";
import LaPlata from "@/components/landing-go/LaPlata";
import Panorama from "@/components/landing-go/Panorama";
import BloqueContratista from "@/components/landing-go/BloqueContratista";
import PrecioGo from "@/components/landing-go/PrecioGo";
import FaqGo from "@/components/landing-go/FaqGo";
import CierreGo from "@/components/landing-go/CierreGo";
import FooterGo from "@/components/landing-go/FooterGo";
import RevealsGo from "@/components/landing-go/RevealsGo";
import ModalCupo from "@/components/landing-go/ModalCupo";

// Vista previa oculta de la landing B2C "Seiricon Go" (Dirección A «Presente»).
// Vive en la raíz de app (fuera del grupo (public)) para no heredar el
// Navbar/Footer viejos: trae su propio chrome, igual que la home con
// landing-v2. No se indexa hasta que Victor la apruebe y reemplace /para-ti.
export const metadata: Metadata = {
  title: { absolute: "Seiricon Go — vista previa" },
  robots: { index: false, follow: false },
};

export default function GoNuevaPage() {
  return (
    <div className="lgo">
      <NavBarGo />
      <HeroGo />
      <Bifurcacion />
      <EscenaChat />
      <LoQueCambia />
      <ObjecionMaestro />
      <LaPlata />
      <Panorama />
      <BloqueContratista />
      <PrecioGo />
      <FaqGo />
      <CierreGo />
      <FooterGo />
      <RevealsGo />
      <ModalCupo />
    </div>
  );
}
