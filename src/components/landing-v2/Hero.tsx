import Image from "next/image";
import Link from "next/link";
import { Check, CircleDollarSign, FileSpreadsheet, Plus } from "lucide-react";
import LiveDemo from "./LiveDemo";
import RotadorPalabras from "./RotadorPalabras";

/**
 * Hero: el producto trabajando frente a los ojos. Sin video (LCP): la demo es
 * en código (<LiveDemo/>). Titular rotatorio "Tu {obra|equipo|…} bajo control"
 * (v2.1) con RotadorPalabras. f1 se usa como textura muy sutil de fondo.
 */
export default function Hero() {
  return (
    <header className="hero">
      {/* textura sutil f1 (decorativa) */}
      <div className="hero-tex" aria-hidden="true">
        <Image
          src="/landing/fotos/f1-hero-obra-gris.jpg"
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
      </div>

      <div className="wrap">
        <div
          className="mono"
          style={{
            color: "var(--gris)",
            display: "flex",
            justifyContent: "center",
            gap: 26,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <span>SEIRICON — CONTROL DE OBRA</span>
          <span>COLOMBIA · 2026</span>
        </div>
        <h1>
          Tu <RotadorPalabras />
          <br />
          bajo control
        </h1>
        <p className="sub">
          Así trabaja Seiricon: el avance llega con foto, GPS y hora, tú lo apruebas y el dinero
          queda al día — todo en una pantalla.
        </p>
        {/* flex con gap: en ≤390px los dos botones no caben en una línea y,
            como inline-flex sueltos, el segundo bajaba pegado sin aire */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-azul" href="/registro">
            Empezar gratis →
          </Link>
          <Link className="btn btn-borde" href="/contacto">
            Agendar demo
          </Link>
        </div>
        <p className="micro-cta">14 días gratis · Sin tarjeta de crédito</p>

        <LiveDemo />

        <div className="usos">
          <span className="uso">
            <Plus className="uso-ic" aria-hidden="true" /> Crear un proyecto en minutos
          </span>
          <span className="uso">
            <FileSpreadsheet className="uso-ic" aria-hidden="true" /> Convertir mi presupuesto en
            cronograma
          </span>
          <span className="uso">
            <Check className="uso-ic" aria-hidden="true" /> Aprobar avances con foto y GPS
          </span>
          <span className="uso">
            <CircleDollarSign className="uso-ic" aria-hidden="true" /> Controlar el dinero de la
            obra
          </span>
        </div>
      </div>
    </header>
  );
}
