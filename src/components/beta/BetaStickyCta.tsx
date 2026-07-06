"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

// CTA fijo inferior, solo en mobile (sm:hidden). Aparece cuando el usuario ya
// pasó el hero (observamos un centinela colocado al final del hero) y se oculta
// al llegar al formulario, para no tapar el propio formulario.
export default function BetaStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("beta-hero-sentinel");
    const form = document.getElementById("inscribirme");

    let pastHero = false;
    let atForm = false;
    const update = () => setVisible(pastHero && !atForm);

    const observers: IntersectionObserver[] = [];

    if (hero) {
      const io = new IntersectionObserver(
        ([entry]) => {
          // Visible una vez que el final del hero sale por arriba del viewport.
          pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          update();
        },
        { threshold: 0 }
      );
      io.observe(hero);
      observers.push(io);
    } else {
      // Sin centinela (fallback): lo mostramos siempre en mobile.
      pastHero = true;
      update();
    }

    if (form) {
      const io = new IntersectionObserver(
        ([entry]) => {
          atForm = entry.isIntersecting;
          update();
        },
        { threshold: 0 }
      );
      io.observe(form);
      observers.push(io);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur transition-transform duration-300 sm:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <a
        href="#inscribirme"
        tabIndex={visible ? undefined : -1}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700"
      >
        Quiero mi cupo
        <ArrowRight className="h-5 w-5" />
      </a>
    </div>
  );
}
