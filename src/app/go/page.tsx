import type { Metadata } from "next";
import "@/components/landing-go/landing-go.css";

import PromoBarGo from "@/components/landing-go/PromoBarGo";
import NavBarGo from "@/components/landing-go/NavBarGo";
import HeroGo from "@/components/landing-go/HeroGo";
import ConfianzaGo from "@/components/landing-go/ConfianzaGo";
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

// Landing B2C oficial "Seiricon Go" (Dirección A «Presente», aprobada por
// Victor). Vive en la raíz de app (fuera del grupo (public)) porque trae su
// propio chrome, igual que la home con landing-v2. Reemplazó a /para-ti
// (que redirige aquí). CTA: lista de espera (ModalCupo → /api/lista-espera-go).
export const metadata: Metadata = {
  title: { absolute: "Seiricon Go — Nadie cuida tu proyecto como tú" },
  description:
    "Cada avance de tu obra te llega con foto, ubicación y hora — y tú lo apruebas desde donde estés. Control de obra para personas y contratistas independientes. Primera obra gratis, sin tarjeta.",
  openGraph: {
    title: "Seiricon Go — Nadie cuida tu proyecto como tú",
    description:
      "Tu obra con pruebas: foto, GPS y hora en cada avance, la plata con factura y el semáforo que avisa a tiempo. Estés donde estés.",
    locale: "es_CO",
    type: "website",
  },
};

export default function SeiriconGoPage() {
  return (
    <div className="lgo">
      <PromoBarGo />
      <NavBarGo />
      <HeroGo />
      <ConfianzaGo />
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
