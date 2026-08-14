import type { Metadata } from "next";
import ReparaHero from "@/components/repara/ReparaHero";
import ReparaFranjaAlerta from "@/components/repara/ReparaFranjaAlerta";
import ReparaMiedo from "@/components/repara/ReparaMiedo";
import ReparaPruebas from "@/components/repara/ReparaPruebas";
import ReparaDosPuertas from "@/components/repara/ReparaDosPuertas";
import ReparaComoFunciona from "@/components/repara/ReparaComoFunciona";
import ReparaOferta from "@/components/repara/ReparaOferta";
import ReparaForm from "@/components/repara/ReparaForm";
import ReparaFaq from "@/components/repara/ReparaFaq";
import ReparaPuenteAlerta from "@/components/repara/ReparaPuenteAlerta";
import ReparaClosing from "@/components/repara/ReparaClosing";
import ReparaStickyCta from "@/components/repara/ReparaStickyCta";

// Landing de campaña de Seiricon Go (reparaciones post-sismo). Pública, sin
// cuenta y sin tenant: vive en el grupo (public) para reutilizar Navbar +
// Footer, pero NO se enlaza desde ninguno de los dos — el tráfico llega por
// fuera (WhatsApp, radio, redes), igual que /alerta. `/go` es alias 308 de
// esta ruta (src/app/go/page.tsx). Cero Prisma, cero Supabase, cero DB:
// la captación es por formulario y el alta la hace el super-admin a mano.
// Ver docs/specs/2026-08-13-seiricon-go-repara.md.
export const metadata: Metadata = {
  title: "Seiricon Go — Repara tu casa con pruebas",
  description:
    "Gratis 6 meses para las reparaciones del sismo en Cali, Pereira y Manizales. Cada avance con foto, hora y ubicación; cada gasto con factura; y un link para ver tu casa desde donde estés.",
  alternates: { canonical: "/repara" },
  openGraph: {
    title: "Seiricon Go — Repara tu casa. Que cada peso quede con prueba.",
    description:
      "Evidencia con foto, hora y ubicación, gastos sustentados con factura y un link para ver el avance. Gratis 6 meses para reparaciones del sismo.",
    type: "website",
  },
};

export default function ReparaPage() {
  return (
    <>
      <ReparaHero />
      <ReparaFranjaAlerta />
      <ReparaMiedo />
      <ReparaPruebas />
      <ReparaDosPuertas />
      <ReparaComoFunciona />
      <ReparaOferta />
      <ReparaForm />
      <ReparaFaq />
      <ReparaPuenteAlerta />
      <ReparaClosing />
      <ReparaStickyCta />
    </>
  );
}
