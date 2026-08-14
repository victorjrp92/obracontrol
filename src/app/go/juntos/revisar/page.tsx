import type { Metadata } from "next";
import NavJuntos from "@/components/juntos/NavJuntos";
import FlujoRevisar from "@/components/juntos/FlujoRevisar";

export const metadata: Metadata = {
  title: { absolute: "Revisar una grieta — Juntos, de Seiricon" },
  description:
    "Filtro de seguridad primero y, foto a foto, la prioridad con la que un profesional debería revisar cada grieta. Gratis, sin crear cuenta.",
};

/** Wizard de grietas de Juntos. Server component: todo el estado vive en FlujoRevisar (cliente). */
export default function RevisarPage() {
  return (
    <>
      <NavJuntos />
      <main className="jt-shell">
        <div className="jt-shell-cab">
          <h1>Revisar una grieta</h1>
          <p className="sub">Sin datos personales. Las fotos no se guardan en nuestros servidores.</p>
        </div>
        <FlujoRevisar />
      </main>
    </>
  );
}
