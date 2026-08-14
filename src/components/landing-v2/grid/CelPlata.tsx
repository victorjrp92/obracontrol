"use client";

import { useLoopDemo } from "./useLoopDemo";

/**
 * Micro-demo de dinero sustentado: el número cuenta de $0 a $268M
 * (tabular-nums) y al final aparece "/ $310M sustentado". Loop con pausa.
 * El markup por defecto ya es el estado final (sirve para reduced-motion).
 */
export default function CelPlata() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const num = el.querySelector<HTMLElement>(".pl-num")!;
      const sub = el.querySelector<HTMLElement>(".pl-sub")!;
      const val = { v: 0 };

      tl.set(num, { opacity: 1 }, 0);
      tl.set(sub, { opacity: 0 }, 0);
      tl.add(() => {
        val.v = 0;
        num.textContent = "$0M";
      }, 0);

      tl.to(
        val,
        {
          v: 268,
          duration: 1.6,
          ease: "power1.inOut",
          onUpdate: () => {
            num.textContent = "$" + Math.round(val.v) + "M";
          },
        },
        0.25
      );
      tl.fromTo(
        sub,
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out", immediateRender: false },
        1.95
      );
      // pausa leyendo la cifra, luego se recoge
      tl.to([num, sub], { opacity: 0, duration: 0.35, ease: "power1.in" }, 4.5);
    },
    () => {
      /* el markup por defecto ya es el estado final */
    },
    0.4
  );

  return (
    <div className="cel reveal" ref={ref} style={{ transitionDelay: ".12s" }}>
      <div className="vis vis-plata" aria-hidden="true">
        <b className="pl-num">$268M</b>
        <span className="pl-sub">/ $310M sustentado</span>
      </div>
      <h4>Dinero sustentado</h4>
      <p>Anticipos, facturas y presupuesto cruzados. Lo que falta por sustentar, en rojo.</p>
    </div>
  );
}
