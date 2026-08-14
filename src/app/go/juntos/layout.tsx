import type { Metadata, Viewport } from "next";
import "@/components/juntos/landing-juntos.css";

/**
 * Layout propio de la línea «Juntos» (/go/juntos y sus wizards): sin el
 * chrome de (public) — vive bajo /go, fuera de ese grupo, igual que la
 * landing Go. Carga el sistema visual .ljt (Aizome) una sola vez para las
 * tres páginas. Ver docs/specs/spec-go-juntos.md.
 */
export const metadata: Metadata = {
  title: { absolute: "Juntos, de Seiricon — No estás solo frente a estas grietas" },
  description:
    "Te guiamos paso a paso para revisar cómo quedó tu casa tras el sismo y te entregamos un acta de documentación de daños con fotos, ubicación y fecha. Gratis, sin crear cuenta.",
  openGraph: {
    title: "Juntos, de Seiricon — No estás solo frente a estas grietas",
    description:
      "Revisa tu casa acompañado y documenta los daños con fotos fechadas y ubicadas — lista para tu aseguradora y para pedir ayuda. Gratis, sin crear cuenta.",
    locale: "es_CO",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function JuntosLayout({ children }: { children: React.ReactNode }) {
  return <div className="ljt">{children}</div>;
}
