"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Check, Clock, MapPin } from "lucide-react";

/** Tareas que rotan en el feed (banco de tareas del copy aprobado). */
const TAREAS = [
  { n: "Enchape baño social", a: "Reportó: don Álvaro (maestro)", h: "Hoy, 4:02 p. m." },
  { n: "Pañete y estuco de fachada", a: "Reportó: don Álvaro (maestro)", h: "Hoy, 10:37 a. m." },
  { n: "Pintura habitación principal", a: "Reportó: Norbey (oficial)", h: "Hoy, 2:20 p. m." },
];

/**
 * El teléfono del hero con el feed EN VIVO: llega un avance → los chips de
 * GPS y hora se estampan → tap fantasma sobre "Aprobar" → queda Aprobado →
 * aparece la nota de registro → entra la siguiente tarea (3 rotando en loop,
 * como el mockup). GSAP con useGSAP; se pausa fuera de viewport; con
 * prefers-reduced-motion pinta el estado final estático (chips puestos,
 * botón Aprobado en verde y nota visible), sin ciclo.
 */
export default function FeedVivo() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = (sel: string) => el.querySelector(sel) as HTMLElement;

      const gps = q('[data-f="gps"]');
      const hora = q('[data-f="hora"]');
      const horaTxt = q('[data-f="horaTxt"]');
      const bAp = q('[data-f="bAp"]');
      const bApTxt = q('[data-f="bApTxt"]');
      const tap = q('[data-f="tap"]');
      const nota = q('[data-f="nota"]');
      const nombre = q('[data-f="nombre"]');
      const autor = q('[data-f="autor"]');

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        // Estado final estático: avance ya aprobado, chips estampados, nota visible
        gps.classList.add("on");
        hora.classList.add("on");
        bAp.classList.add("ok");
        bApTxt.textContent = "Aprobado";
        nota.classList.add("on");
        return;
      }

      gsap.set(tap, { xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 });

      let i = 0;
      /** Estado base del ciclo: entra la tarea `i` sin chips ni aprobación. */
      const reset = () => {
        const T = TAREAS[i];
        i = (i + 1) % TAREAS.length;
        nombre.textContent = T.n;
        autor.textContent = T.a;
        horaTxt.textContent = T.h;
        gps.classList.remove("on");
        hora.classList.remove("on");
        bAp.classList.remove("ok");
        bApTxt.textContent = "Aprobar";
        nota.classList.remove("on");
      };
      reset();

      // Mismos tiempos del mockup: chips 0.7/1.15 → tap 2.5 → aprobado 2.95 →
      // nota 3.25 → ciclo completo 6.4s
      const tl = gsap.timeline({ repeat: -1, onRepeat: reset });
      tl.call(() => gps.classList.add("on"), [], 0.7);
      tl.call(() => hora.classList.add("on"), [], 1.15);
      tl.fromTo(
        tap,
        { opacity: 0, scale: 0.4 },
        { opacity: 0.9, scale: 0.95, duration: 0.28, ease: "power2.out", immediateRender: false },
        2.5
      );
      tl.to(tap, { opacity: 0, scale: 1.5, duration: 0.42, ease: "power1.in" }, 2.78);
      tl.call(
        () => {
          bAp.classList.add("ok");
          bApTxt.textContent = "Aprobado";
        },
        [],
        2.95
      );
      tl.call(() => nota.classList.add("on"), [], 3.25);
      tl.to({}, { duration: 6.4 }, 0); // duración total del ciclo

      // Pausa fuera de viewport (ahorra CPU y batería)
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) tl.play();
          else tl.pause();
        },
        { threshold: 0.2 }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    { scope: root }
  );

  return (
    <div className="fono" ref={root}>
      <div className="fono-top">
        <div>
          <b>Casa familiar</b>
          <small>Cali, La Buitrera</small>
        </div>
        <span className="led-vivo">
          <i></i> EN VIVO
        </span>
      </div>
      <div className="avance">
        <div className="avance-foto">
          <Image
            src="/landing/fotos/f2-manos-panete.jpg"
            alt="Avance de obra reportado con foto"
            fill
            sizes="340px"
          />
          <span className="chip chip-gps" data-f="gps">
            <MapPin className="ic" strokeWidth={2.4} aria-hidden="true" />
            GPS: Cali — La Buitrera
          </span>
          <span className="chip chip-hora" data-f="hora">
            <Clock className="ic" strokeWidth={2.4} aria-hidden="true" />
            <span data-f="horaTxt">Hoy, 4:02 p. m.</span>
          </span>
        </div>
        <div className="avance-body">
          <b data-f="nombre">Enchape baño social</b>
          <small data-f="autor">Reportó: don Álvaro (maestro)</small>
          <div className="avance-cta">
            <span className="b-ap" data-f="bAp">
              <span data-f="bApTxt">Aprobar</span>
              <span className="tap" data-f="tap" aria-hidden="true"></span>
            </span>
            <span className="b-re">Rechazar</span>
          </div>
          <div className="aprobado-nota" data-f="nota">
            <Check className="ic" strokeWidth={3} aria-hidden="true" />
            Aprobado por ti — 4:04 p. m. Quedó en el registro de la obra.
          </div>
        </div>
      </div>
      <div className="estado-obra">
        <span>Estado de la obra</span>
        <span className="pill-tiempo">
          <i></i> A tiempo
        </span>
      </div>
    </div>
  );
}
