"use client";

import Image from "next/image";
import { useLoopGo } from "./useLoopGo";

/**
 * Sección "Así se ve hoy": el chat de siempre con don Álvaro — "Todo va
 * bien", la foto borrosa y el visto sin respuesta. Las burbujas entran en
 * loop infinito (patrón FeedVivo): una a una cada ~600ms, pausa de ~3s en el
 * "Visto — sin respuesta", fade out suave del contenido y reinicia. Se pausa
 * fuera de viewport; con prefers-reduced-motion todas quedan visibles
 * estáticas.
 */
export default function EscenaChat() {
  const chat = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const burs = Array.from(el.querySelectorAll<HTMLElement>(".bur"));
      const cont = el.querySelector(".chat-burs") as HTMLElement;

      // t=0 de cada vuelta: el contenido vuelve (las burbujas ya se
      // escondieron al final de la vuelta anterior, con el fade puesto)
      tl.call(() => cont.classList.remove("fuera"), [], 0.05);
      burs.forEach((b, i) => tl.call(() => b.classList.add("on"), [], 0.55 + i * 0.6));
      // pausa larga en el final incómodo → fade out del contenido → reset
      tl.call(() => cont.classList.add("fuera"), [], 6.4);
      tl.call(() => burs.forEach((b) => b.classList.remove("on")), [], 6.95);
      tl.to({}, { duration: 7.1 }, 0); // duración total del ciclo
    },
    (el) => el.querySelectorAll<HTMLElement>(".bur").forEach((b) => b.classList.add("on")),
    0.5
  );

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
        <div className="chat reveal" ref={chat}>
          <div className="chat-top">
            <span className="chat-ava">A</span>
            <div>
              <b>Don Álvaro — maestro</b>
              <small>en línea hace 3 horas</small>
            </div>
          </div>
          <div className="chat-burs">
            <div className="bur bur-yo">
              Don Álvaro, ¿cómo vamos con el baño?<small>9:12 p. m.</small>
            </div>
            <div className="bur bur-el">
              Todo va bien<small>7:48 a. m.</small>
            </div>
            <div className="bur bur-el bur-foto">
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
            <div className="bur bur-yo">
              ¿Esa foto es de esta semana?<small>8:15 a. m.</small>
            </div>
            <div
              className="bur visto"
              style={{ background: "none", border: "none", maxWidth: "100%" }}
            >
              Visto ✓✓ — sin respuesta
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
