import Image from "next/image";
import Link from "next/link";
import LiveDemo from "./LiveDemo";

/**
 * Hero: el producto trabajando frente a los ojos. Sin video (LCP): la demo es
 * en código (<LiveDemo/>). f1 se usa como textura muy sutil de fondo.
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
          El control de obra que
          <br />
          trabaja frente a tus ojos
        </h1>
        <p className="sub">
          Mira cómo Seiricon verifica un avance real: foto con GPS, tu aprobación y la plata al día —
          todo en una pantalla.
        </p>
        <div>
          <Link className="btn btn-azul" href="/registro">
            Empezar gratis →
          </Link>
          <Link className="btn btn-borde" href="/contacto" style={{ marginLeft: 8 }}>
            Agendar demo
          </Link>
        </div>

        <LiveDemo />

        <div className="usos">
          <span className="uso">＋ Crear una obra en minutos</span>
          <span className="uso">⇪ Importar mi Excel</span>
          <span className="uso">✓ Aprobar avances con GPS</span>
          <span className="uso">$ Controlar la plata</span>
        </div>
      </div>
    </header>
  );
}
