import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Hero emocional de /go/juntos (spec-go-juntos.md): foto `juntos-hombros`
 * a sangre con velo de tinta, el H1 EXACTO del spec y el CTA a la revisión.
 * Acompañamiento, nunca catástrofe.
 */
export default function HeroJuntos() {
  return (
    <section className="jt-hero">
      <div className="jt-hero-media" aria-hidden="true">
        <Image
          src="/landing/juntos/juntos-hombros.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "50% 38%" }}
        />
      </div>
      <div className="jt-hero-velo" aria-hidden="true" />
      <div className="wrap">
        <div className="jt-hero-cont">
          <span className="eyebrow">Juntos — línea de ayuda post-sismo</span>
          <h1>No estás solo frente a estas grietas.</h1>
          <p className="sub">
            Te guiamos paso a paso para revisar cómo quedó tu casa y te entregamos un acta con fotos,
            ubicación y fecha — lista para tu aseguradora. Gratis, sin crear cuenta.
          </p>
          <div className="jt-hero-cta">
            <Link href="/go/juntos/revisar" className="btn btn-azul">
              Empezar la revisión <ArrowRight className="ic" aria-hidden="true" />
            </Link>
          </div>
          <p className="micro">Toma 5 minutos · No necesitas saber de construcción</p>
        </div>
      </div>
    </section>
  );
}
