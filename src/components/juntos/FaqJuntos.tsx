/** FAQ corto de /go/juntos — respuestas honestas, sin promesas técnicas. */
export default function FaqJuntos() {
  return (
    <section>
      <div className="wrap">
        <div className="jt-faq">
          <h2>Preguntas frecuentes</h2>

          <details>
            <summary>¿Esto me dice si puedo volver a entrar a mi casa?</summary>
            <p>
              No. Esa evaluación la hacen los organismos oficiales (Bomberos, Cruz Roja) o un ingeniero
              estructural. Juntos te ayuda a documentar los daños y a saber con qué prioridad deberías
              buscar esa revisión — no la reemplaza.
            </p>
          </details>

          <details>
            <summary>¿Qué pasa con mis fotos y mis datos?</summary>
            <p>
              Las fotos se procesan para generar tu documento y no se guardan en nuestros servidores. La
              cédula y la dirección solo se imprimen en el acta y se descartan. Del formulario guardamos
              únicamente tu nombre, WhatsApp y ciudad, con tu autorización (Ley 1581).
            </p>
          </details>

          <details>
            <summary>¿Cuánto cuesta? ¿Tengo que crear una cuenta?</summary>
            <p>
              Nada, y no. Juntos es gratuito y funciona sin registro. Nadie puede cobrarte por este
              documento ni por inscribirte en el censo de damnificados — si alguien lo intenta, es estafa.
            </p>
          </details>

          <details>
            <summary>¿El acta le sirve a mi aseguradora?</summary>
            <p>
              El acta documenta los hechos: fotos con fecha, hora y ubicación, más tu declaración de lo que
              se dañó. Eso es exactamente lo que necesitas para avisar y sustentar tu reclamación. La
              evaluación técnica, si la piden, la hace un profesional — y el acta le sirve de punto de
              partida.
            </p>
          </details>

          <details>
            <summary>Vivo en arriendo, ¿me sirve?</summary>
            <p>
              Sí. Documentar los daños te sirve para hablar con el propietario, con la administración del
              conjunto y para el registro de damnificados. El documento identifica quién declara y la
              ubicación del daño.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
