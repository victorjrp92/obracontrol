import Image from "next/image";

/**
 * Sección del acta: mock del documento + la frase eje del spec — «lo que
 * muchos pierden no es la casa: es la prueba». Papel de notario de los
 * hechos, nunca de experto.
 */
export default function SeccionActa() {
  return (
    <section>
      <div className="wrap">
        <div className="jt-acta-grid">
          <div className="jt-sec-copy">
            <span className="eyebrow">El acta de documentación de daños</span>
            <h2>
              Lo que muchos pierden no es la casa: <span className="jt-frase">es la prueba.</span>
            </h2>
            <p className="txt" style={{ marginTop: 16 }}>
              Una grieta tapada, una foto sin fecha, un daño reparado antes de tiempo — y la aseguradora o
              el censo no tienen nada que mirar. El acta registra los hechos: cada foto con fecha, hora y
              ubicación, más tu declaración de lo que se dañó, espacio por espacio.
            </p>
            <p className="txt" style={{ marginTop: 12 }}>
              Nosotros documentamos los hechos. La evaluación técnica de tu casa la hacen los Bomberos, la
              Cruz Roja o un ingeniero estructural — el acta les sirve a ellos también.
            </p>
          </div>

          <div className="jt-doc" aria-hidden="true">
            <div className="jt-doc-cab">
              <span className="marca">
                <Image src="/seiricon-logo.png" alt="" width={20} height={20} /> SEIRICON · JUNTOS
              </span>
              <small>
                Folio JT-…
                <br />
                Verificación con huella digital
              </small>
            </div>
            <p className="jt-doc-titulo">Acta de documentación de daños</p>
            <div className="jt-doc-linea">
              <span>Declarante</span>
              <b>Nombre y cédula</b>
            </div>
            <div className="jt-doc-linea">
              <span>Ubicación del daño</span>
              <b>Dirección y ciudad</b>
            </div>
            <div className="jt-doc-linea">
              <span>Resumen de daños</span>
              <b>Espacio por espacio</b>
            </div>
            <div className="jt-doc-fotos">
              <span className="jt-doc-foto">
                <Image src="/landing/juntos/juntos-manos-cuidado.jpg" alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                <span className="gps">Fecha · hora · GPS</span>
              </span>
              <span className="jt-doc-foto">
                <Image src="/landing/juntos/juntos-manos-mesa.jpg" alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                <span className="gps">Fecha · hora · GPS</span>
              </span>
              <span className="jt-doc-foto">
                <Image src="/landing/juntos/juntos-barrio.jpg" alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                <span className="gps">Fecha · hora · GPS</span>
              </span>
            </div>
            <p className="jt-doc-pie">
              Registra daños declarados por quien lo genera. No es un peritaje ni un dictamen técnico.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
