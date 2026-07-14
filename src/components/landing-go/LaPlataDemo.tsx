"use client";

import { Camera, Check, TriangleAlert } from "lucide-react";
import CursorGo from "./CursorGo";
import { useLoopGo, moverCursor, tipear } from "./useLoopGo";

/**
 * Visual de "Tu plata": pantalla con proporción móvil (solo la pantalla, sin
 * marco de teléfono) registrando un gasto en loop — monto tipeándose, la
 * miniatura del recibo aparece con flash en "Foto de la factura", el cursor
 * fantasma pulsa "Guardar gasto" — y la fila del gasto APARECE en la lista
 * de gastos de abajo con su check verde. Pausa y reinicia (patrón FeedVivo
 * vía useLoopGo). La alarma roja se conserva siempre visible;
 * reduced-motion = todo pintado estático (monto, recibo y fila puestos).
 */
export default function LaPlataDemo() {
  const root = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as HTMLElement;
      const fonito = q(".fonito");
      const monto = q('[data-g="monto"]');
      const recibo = q(".fo-recibo");
      const flash = q(".fo-flash");
      const btn = q(".fo-btn");
      const cur = q(".mcur");
      const fila = q(".g-demo");

      // t=0 de cada vuelta: formulario limpio, fila fuera de la lista
      tl.set(recibo, { opacity: 0, scale: 0.85 }, 0);
      tl.set(flash, { opacity: 0 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        monto.textContent = "";
        cur.style.left = "78%";
        cur.style.top = "88%";
      }, 0);

      // el monto se tipea
      tipear(tl, monto, "$342.000", 0.5, 0.09);

      // la miniatura del recibo aparece con un flash suave
      tl.to(flash, { opacity: 0.85, duration: 0.12 }, 1.9);
      tl.to(flash, { opacity: 0, duration: 0.35 }, 2.05);
      tl.to(recibo, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.7)" }, 1.95);

      // cursor fantasma → "Guardar gasto"
      tl.to(cur, { opacity: 1, duration: 0.25 }, 2.7);
      tl.add(() => moverCursor(cur, btn, fonito), 2.8);
      tl.to(btn, { scale: 0.96, duration: 0.09, yoyo: true, repeat: 1 }, 3.8);
      tl.to(cur, { opacity: 0, duration: 0.3 }, 4.1);

      // la fila entra a la lista de gastos de al lado, pausa y reinicia
      tl.call(() => fila.classList.add("on"), [], 4.2);
      tl.call(() => fila.classList.remove("on"), [], 7.4);
      tl.to({}, { duration: 7.8 }, 0); // duración total del ciclo
    },
    (el) => {
      el.classList.add("fin");
      const monto = el.querySelector('[data-g="monto"]') as HTMLElement;
      monto.textContent = "$342.000";
      el.querySelector(".g-demo")?.classList.add("on");
    },
    0.6
  );

  return (
    <div className="plata-demo reveal" ref={root}>
      <div className="fonito" aria-hidden="true">
        <div className="fo-cab">Nuevo gasto</div>
        <div className="fo-campo">
          <span data-g="monto"></span>
          <i className="fo-caret"></i>
        </div>
        <div className="fo-zona">
          <span className="fo-hint">
            <Camera className="ic" strokeWidth={2.2} aria-hidden="true" />
            Foto de la factura
          </span>
          <svg className="fo-recibo" viewBox="0 0 44 54" aria-hidden="true">
            <rect x="1.5" y="1.5" width="41" height="51" rx="4" fill="#fff" stroke="#c9d4e3" strokeWidth="2" />
            <line x1="9" y1="13" x2="35" y2="13" stroke="#c9d4e3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="9" y1="21" x2="29" y2="21" stroke="#c9d4e3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="9" y1="29" x2="33" y2="29" stroke="#c9d4e3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="9" y1="41" x2="23" y2="41" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="fo-flash"></span>
        </div>
        <span className="fo-btn">Guardar gasto</span>
        <CursorGo />
      </div>
      <div className="gastos">
        <div className="g-row g-demo">
          <div>
            <b>Bulto de cemento gris x10</b>
          </div>
          <div className="g-fac">
            <span className="g-monto">$342.000</span>
            <br />
            <span className="g-ok">
              <Check
                className="ic"
                strokeWidth={3}
                aria-hidden="true"
                style={{ width: 11, height: 11 }}
              />
              Factura adjunta
            </span>
          </div>
        </div>
        <div className="g-row on">
          <div>
            <b>Viaje de arena de río</b>
          </div>
          <div className="g-fac">
            <span className="g-monto">$220.000</span>
            <br />
            <span className="g-ok">
              <Check
                className="ic"
                strokeWidth={3}
                aria-hidden="true"
                style={{ width: 11, height: 11 }}
              />
              Factura adjunta
            </span>
          </div>
        </div>
        <div className="g-row g-rojo on">
          <div>
            <b>Plata entregada al maestro</b>
          </div>
          <div className="g-fac">
            <span className="g-monto">$800.000</span>
            <br />
            <span className="g-sin">Sin sustentar hace 4 días</span>
          </div>
        </div>
        <div className="alarma">
          <TriangleAlert className="ic" size={16} strokeWidth={2.4} aria-hidden="true" />
          Tienes $800.000 entregados sin factura.
        </div>
      </div>
    </div>
  );
}
