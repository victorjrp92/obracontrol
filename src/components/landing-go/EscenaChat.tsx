import Image from "next/image";

/**
 * Sección "Así se ve hoy": el chat de siempre con don Álvaro — "Todo va
 * bien", la foto borrosa y el visto sin respuesta. Las burbujas entran
 * escalonadas (data-escalonar/data-esc, las maneja <RevealsGo/>).
 */
export default function EscenaChat() {
  return (
    <section id="escena">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="eyebrow">Así se ve hoy</span>
          <h2>&ldquo;Todo va bien.&rdquo; ¿Y tú cómo sabes?</h2>
          <p className="txt">
            No es mala fe. Es que un chat no se hizo para llevar una obra: las fotos se pierden,
            nada tiene fecha confiable, y preguntar mucho suena a desconfianza. Mientras tanto, tu
            plata sí se está moviendo.
          </p>
        </div>
        <div className="chat reveal" data-escalonar="520">
          <div className="chat-top">
            <span className="chat-ava">A</span>
            <div>
              <b>Don Álvaro — maestro</b>
              <small>en línea hace 3 horas</small>
            </div>
          </div>
          <div className="bur bur-yo" data-esc>
            Don Álvaro, ¿cómo vamos con el baño?<small>9:12 p. m.</small>
          </div>
          <div className="bur bur-el" data-esc>
            Todo va bien<small>7:48 a. m.</small>
          </div>
          <div className="bur bur-el bur-foto" data-esc>
            <div className="foto-borrosa">
              <Image
                src="/landing/fotos/f2-manos-panete.jpg"
                alt="Foto borrosa de la obra enviada por chat"
                fill
                sizes="190px"
              />
            </div>
            <small>7:49 a. m.</small>
          </div>
          <div className="bur bur-yo" data-esc>
            ¿Esa foto es de esta semana?<small>8:15 a. m.</small>
          </div>
          <div
            className="bur visto"
            data-esc
            style={{ background: "none", border: "none", maxWidth: "100%" }}
          >
            Visto ✓✓ — sin respuesta
          </div>
        </div>
      </div>
    </section>
  );
}
