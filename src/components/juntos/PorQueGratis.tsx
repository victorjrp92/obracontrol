import Image from "next/image";

/**
 * ¿Por qué gratis? — la respuesta honesta del spec: somos una empresa
 * colombiana de control de obra; documentar con pruebas es lo que sabemos
 * hacer. Sin venta dura.
 */
export default function PorQueGratis() {
  return (
    <section>
      <div className="wrap">
        <div className="jt-gratis">
          <div className="jt-sec-copy">
            <span className="eyebrow">¿Por qué gratis?</span>
            <h2>Porque esto es lo que sabemos hacer.</h2>
            <p className="txt">
              Somos Seiricon, una empresa colombiana de control de obra. Nuestro trabajo de todos los días
              es documentar el avance de una construcción con fotos, ubicación y fecha — pruebas que
              resisten preguntas.
            </p>
            <p className="txt" style={{ marginTop: 12 }}>
              Después del sismo, esa misma herramienta sirve para algo más urgente: que nadie pierda una
              reclamación o una ayuda por no tener cómo demostrar el daño. Por eso Juntos es gratuito, hoy
              y siempre — sin crear cuenta y sin letra pequeña.
            </p>
          </div>
          <figure className="jt-gratis-foto">
            <Image
              src="/landing/juntos/juntos-manos-calido.jpg"
              alt="Manos que se sostienen con calidez"
              fill
              sizes="(max-width: 900px) 100vw, 420px"
              style={{ objectFit: "cover" }}
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
