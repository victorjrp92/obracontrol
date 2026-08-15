import Image from "next/image";

/** Sección "así te acompañamos": 3 pasos concretos + foto de manos trabajando. */
export default function AcompanamientoJuntos() {
  return (
    <section>
      <div className="wrap">
        <div className="jt-acomp-grid">
          <figure className="jt-acomp-foto">
            <Image
              src="/landing/juntos/juntos-manos-taller.jpg"
              alt="Dos personas revisando juntas un plano de trabajo"
              fill
              sizes="(max-width: 900px) 100vw, 420px"
              style={{ objectFit: "cover" }}
            />
          </figure>
          <div className="jt-sec-copy">
            <span className="eyebrow">Así te acompañamos</span>
            <h2>Paso a paso, sin tecnicismos y sin dejarte solo.</h2>
            <p className="txt">
              No necesitas saber de construcción ni tener los papeles a la mano. Necesitas compañía y un
              método — eso es lo que te damos.
            </p>
            <div className="jt-pasos">
              <div className="jt-paso">
                <span className="n">1</span>
                <div>
                  <b>Primero, tu seguridad</b>
                  <small>
                    Cuatro preguntas antes de cualquier foto. Si algo es señal de riesgo, te decimos que
                    salgas — y te damos las líneas de emergencia.
                  </small>
                </div>
              </div>
              <div className="jt-paso">
                <span className="n">2</span>
                <div>
                  <b>Te guiamos foto a foto</b>
                  <small>
                    Con una moneda de $500 como referencia de escala y el encuadre correcto. Te mostramos
                    cómo, con un ejemplo animado.
                  </small>
                </div>
              </div>
              <div className="jt-paso">
                <span className="n">3</span>
                <div>
                  <b>Te entregamos el documento</b>
                  <small>
                    Un acta de documentación de daños con fotos fechadas, ubicación y tu declaración —
                    lista para tu aseguradora y para solicitar ayudas del Estado.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
