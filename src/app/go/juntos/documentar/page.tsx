import type { Metadata } from "next";
import NavJuntos from "@/components/juntos/NavJuntos";
import FlujoDocumentar from "@/components/juntos/FlujoDocumentar";

export const metadata: Metadata = {
  title: { absolute: "Documentar los daños — Juntos, de Seiricon" },
  description:
    "Acta de documentación de daños con fotos fechadas y ubicadas, espacio por espacio — para tu aseguradora y para pedir ayuda. Gratis, sin crear cuenta.",
};

/**
 * Wizard del acta de Juntos. Server component: lee `?desde=afuera` (llegada
 * desde la pantalla roja de /revisar — el filtro ya dio rojo y la persona va
 * a documentar SOLO fachada/exterior) y monta el flujo cliente.
 * Next 16: searchParams es Promise.
 */
export default async function DocumentarPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const { desde } = await searchParams;
  return (
    <>
      <NavJuntos />
      <main className="jt-shell">
        <div className="jt-shell-cab">
          <h1>Documentar los daños</h1>
          <p className="sub">
            Tu acta de documentación de daños, con fotos fechadas y ubicadas. Gratis, sin crear cuenta.
          </p>
        </div>
        <FlujoDocumentar modoAfueraInicial={desde === "afuera"} />
      </main>
    </>
  );
}
