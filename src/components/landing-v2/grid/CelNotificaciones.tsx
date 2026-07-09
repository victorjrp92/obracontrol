"use client";

import { Bell } from "lucide-react";
import { useLoopDemo } from "./useLoopDemo";

/**
 * Micro-demo de notificaciones: dos notificaciones estilo app entran apiladas
 * con slide-in, se quedan un momento y se van. Loop.
 */
export default function CelNotificaciones() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const notis = Array.from(el.querySelectorAll<HTMLElement>(".noti"));

      tl.set(notis, { opacity: 0, x: 26 }, 0);
      tl.to(notis[0], { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, 0.3);
      tl.to(notis[1], { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, 1.2);
      tl.to(notis, { opacity: 0, duration: 0.45, ease: "power1.in", stagger: 0.1 }, 4.2);
    },
    (el) => el.querySelector(".vis-noti")?.classList.add("fin"),
    0.6
  );

  return (
    <div className="cel reveal" ref={ref}>
      <div className="vis vis-noti" aria-hidden="true">
        <div className="noti">
          <span className="noti-ic">
            <Bell size={11} />
          </span>
          <span>Tarea aprobada — Enchape baño ppal · T1-504</span>
        </div>
        <div className="noti">
          <span className="noti-ic verde">
            <Bell size={11} />
          </span>
          <span>Obra completada — Casa Pance</span>
        </div>
      </div>
      <h4>Notificaciones al momento</h4>
      <p>Cuando algo necesita tu decisión, te llega — en la plataforma y al correo.</p>
    </div>
  );
}
