import type { Metadata } from "next";
import "@/components/landing-go/landing-go.css";

// import AvisoEmergencia from "@/components/juntos/AvisoEmergencia";  // ver "Juntos OCULTO" mas abajo
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

// Landing B2C oficial "Seiricon Go" (Dirección visual «Vivo/Aizome»: papel
// kinari, tinta sumi, índigo estructural y ámbar al 5 %, con marcadores,
// botones pill de sombra dura y tarjetas pastel — mockup aprobado en
// docs/specs/mockups/go-vivo-aizome.html). Vive en la raíz de app (fuera del
// grupo (public)) porque trae su propio chrome, igual que la home con
// landing-v2. Reemplazó a /para-ti (que redirige aquí). CTA: lista de espera
// (ModalCupo → /api/lista-espera-go).
export const metadata: Metadata = {
  title: { absolute: "Seiricon Go — Nadie cuida tu proyecto como tú" },
  description:
    "Cada avance de tu obra te llega con foto, ubicación y hora — y tú lo apruebas desde donde estés. Control de obra para personas y contratistas independientes. Primera obra gratis, sin tarjeta.",
  openGraph: {
    title: "Seiricon Go — Nadie cuida tu proyecto como tú",
    description:
      "Tu obra con pruebas: foto, GPS y hora en cada avance, el dinero con factura y el semáforo que avisa a tiempo. Estés donde estés.",
    locale: "es_CO",
    type: "website",
    images: [
      {
        url: "/og/seiricon-go.jpg",
        width: 1200,
        height: 630,
        alt: "Seiricon Go — Nadie cuida tu proyecto como tú",
      },
    ],
  },
  other: {
    "og:image:secure_url": `https://seiricon.com/og/seiricon-go.jpg`,
    "og:image:type": "image/jpeg",
  },
  twitter: { card: "summary_large_image", images: ["/og/seiricon-go.jpg"] },
};

export default function SeiriconGoPage() {
  return (
    <div className="lgo">
      {/* Juntos OCULTO (2026-09-13). La linea post-sismo fue una respuesta
          puntual a la emergencia y ya paso; la franja era su unica puerta de
          entrada desde el landing. Se oculta, NO se borra: la ruta /go/juntos
          sigue viva porque su URL va impresa en las actas y los informes de
          grietas ya entregados, y romperla dejaria a esa gente sin su
          documento. Para reactivarla, descomentar. Para cerrar tambien la
          herramienta, JUNTOS_PAUSADO=true en Vercel. */}
      {/* <AvisoEmergencia /> */}
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
