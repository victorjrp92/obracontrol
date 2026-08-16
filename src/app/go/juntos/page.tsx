import NavJuntos from "@/components/juntos/NavJuntos";
import HeroJuntos from "@/components/juntos/HeroJuntos";
import CaminosJuntos from "@/components/juntos/CaminosJuntos";
import AcompanamientoJuntos from "@/components/juntos/AcompanamientoJuntos";
import SeccionActa from "@/components/juntos/SeccionActa";
import PorQueGratis from "@/components/juntos/PorQueGratis";
import FaqJuntos from "@/components/juntos/FaqJuntos";
import CierreJuntos from "@/components/juntos/CierreJuntos";
import FooterJuntos from "@/components/juntos/FooterJuntos";
import CtaPegajoso from "@/components/juntos/CtaPegajoso";
import ClarityJuntos from "@/components/juntos/ClarityJuntos";
import { juntosPausado } from "@/lib/juntos/pausa";
import JuntosPausado from "@/components/juntos/JuntosPausado";

/**
 * Landing emocional de «Juntos» (/go/juntos) — línea de ayuda post-sismo de
 * Seiricon Go. Estructura del spec: hero (H1 exacto) → dos caminos → así te
 * acompañamos → el acta y la prueba → por qué gratis → FAQ → cierre.
 */
export default function JuntosPage() {
  if (juntosPausado()) return <JuntosPausado />;

  return (
    <>
      <NavJuntos />
      <main>
        <HeroJuntos />
        <CaminosJuntos />
        <AcompanamientoJuntos />
        <SeccionActa />
        <PorQueGratis />
        <FaqJuntos />
        <CierreJuntos />
      </main>
      <FooterJuntos />
      <CtaPegajoso />
      <ClarityJuntos />
    </>
  );
}
