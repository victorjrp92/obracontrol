"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Barra de acción pegajosa de la landing de Juntos.
 *
 * La página tiene UN propósito: que la persona empiece su revisión y termine
 * con sus documentos. El CTA del hero se pierde en cuanto baja, así que a
 * partir de ahí la acción viaja con ella, anclada abajo. Se oculta mientras el
 * hero está a la vista (ahí ya hay un CTA grande) y también en el cierre, para
 * no tapar el CTA final con el que se duplicaría.
 *
 * Respeta el área segura del iPhone y `prefers-reduced-motion` (sin deslizar).
 */
export default function CtaPegajoso() {
  const [visible, setVisible] = useState(false);
  const anclas = useRef<Element[]>([]);

  useEffect(() => {
    const hero = document.querySelector(".jt-hero");
    const cierre = document.querySelector(".jt-cierre");
    anclas.current = [hero, cierre].filter(Boolean) as Element[];
    if (anclas.current.length === 0) return;

    // Visible solo cuando NI el hero NI el cierre están en pantalla.
    const enPantalla = new Set<Element>();
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) enPantalla.add(e.target);
          else enPantalla.delete(e.target);
        });
        setVisible(enPantalla.size === 0);
      },
      { threshold: 0.15 }
    );
    anclas.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={`jt-cta-pegajoso ${visible ? "on" : ""}`} aria-hidden={!visible}>
      <div className="jt-cta-pegajoso-in">
        <span className="jt-cta-texto">
          <b>Revisa cómo quedó tu casa</b>
          <small>Gratis · 5 minutos · sin crear cuenta</small>
        </span>
        <Link
          href="/go/juntos/revisar"
          className="btn btn-azul"
          tabIndex={visible ? 0 : -1}
        >
          Empezar <ArrowRight className="ic" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
