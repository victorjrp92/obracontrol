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

          {/* El sello de verificación es el argumento de venta del producto —
              «evidencia verificable»— y hasta ahora no se lo estábamos dando a
              la persona en ningún lado. Va antes que la pregunta de los datos
              porque es lo que convierte el documento en algo que su aseguradora
              se puede tomar en serio. */}
          <details>
            <summary>¿Mi aseguradora puede comprobar que este documento es real?</summary>
            <p>
              Sí. Cada documento lleva en el pie un folio y una huella. Con esos dos datos, cualquiera
              puede entrar a{" "}
              <a href="/go/juntos/verificar">seiricon.com/go/juntos/verificar</a> y confirmar que se
              generó aquí y que nadie lo modificó — sin cuenta y sin costo. El registro no caduca: tu
              folio se va a poder comprobar dentro de cinco años igual que hoy.
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
