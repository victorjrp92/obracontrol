"use client";

import { useLoopJuntos } from "./useLoopJuntos";

/**
 * Micro-demo de la guía de foto (spec-go-juntos.md, sección Moneda), ~6s en
 * loop: pared con grieta vertical → una mano acerca la moneda ACOSTADA (mal,
 * X ámbar) → la gira y la apoya PLANA CONTRA LA PARED junto a la grieta, en
 * el mismo plano (bien, check índigo) → zoom del encuadre correcto (grieta +
 * moneda nítidas, ~30 cm). prefers-reduced-motion: estado final estático.
 * Patrón useLoopGo copiado/adaptado en useLoopJuntos.ts.
 */
export default function MonedaDemo() {
  const root = useLoopJuntos<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as SVGGElement;
      const escena = q('[data-m="escena"]');
      const mano = q('[data-m="mano"]');
      const monedaMal = q('[data-m="moneda-mal"]');
      const monedaBien = q('[data-m="moneda-bien"]');
      const marcaX = q('[data-m="marca-x"]');
      const marcaOk = q('[data-m="marca-ok"]');
      const encuadre = q('[data-m="encuadre"]');

      // t=0 de cada vuelta: mano fuera de escena, moneda acostada, sin marcas.
      tl.set(escena, { scale: 1, transformOrigin: "42% 55%" }, 0);
      tl.set(mano, { x: 150, y: 70, opacity: 0 }, 0);
      tl.set(monedaMal, { opacity: 1, scaleX: 1, transformOrigin: "50% 50%" }, 0);
      tl.set(monedaBien, { opacity: 0, scaleX: 0.12, transformOrigin: "50% 50%" }, 0);
      tl.set(marcaX, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, 0);
      tl.set(marcaOk, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, 0);
      tl.set(encuadre, { opacity: 0 }, 0);

      // 1) La mano entra con la moneda acostada (se ve de canto: así NO).
      tl.to(mano, { opacity: 1, duration: 0.25 }, 0.4);
      tl.to(mano, { x: 0, y: 0, duration: 0.9, ease: "power2.out" }, 0.45);

      // 2) Mal: X ámbar.
      tl.to(marcaX, { opacity: 1, scale: 1, duration: 0.28, ease: "back.out(2)" }, 1.55);
      tl.to(marcaX, { opacity: 0, duration: 0.3 }, 2.5);

      // 3) La gira: queda PLANA contra la pared, en el mismo plano de la grieta.
      tl.to(monedaMal, { scaleX: 0.12, opacity: 0, duration: 0.26, ease: "power1.in" }, 2.55);
      tl.to(monedaBien, { scaleX: 1, opacity: 1, duration: 0.3, ease: "power1.out" }, 2.8);
      tl.to(marcaOk, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, 3.25);

      // 4) Zoom del encuadre correcto: grieta + moneda nítidas, ~30 cm.
      tl.to(encuadre, { opacity: 1, duration: 0.35 }, 4.0);
      tl.to(escena, { scale: 1.12, duration: 0.7, ease: "power2.inOut" }, 4.0);

      tl.to({}, { duration: 6.2 }, 0); // duración total del ciclo
    },
    (el) => {
      // Estado final estático (reduced-motion): mano puesta, moneda plana,
      // check índigo y encuadre visibles; la moneda acostada y la X, ocultas.
      const pinta = (sel: string, opacidad: string) =>
        (el.querySelector(sel) as SVGGElement | null)?.style.setProperty("opacity", opacidad);
      pinta('[data-m="mano"]', "1");
      pinta('[data-m="moneda-mal"]', "0");
      pinta('[data-m="moneda-bien"]', "1");
      pinta('[data-m="marca-ok"]', "1");
      pinta('[data-m="encuadre"]', "1");
    },
    0.6
  );

  return (
    <div className="moneda-demo" ref={root} aria-hidden="true">
      <svg viewBox="0 0 280 168" className="moneda-escena" focusable="false">
        <g data-m="escena">
          {/* Pared con grieta vertical */}
          <rect x="0" y="0" width="280" height="168" fill="#fff" />
          <line x1="0" y1="34" x2="280" y2="34" stroke="#eef1f6" strokeWidth="1.5" />
          <line x1="0" y1="134" x2="280" y2="134" stroke="#eef1f6" strokeWidth="1.5" />
          <polyline
            points="112,8 108,36 116,62 106,92 114,122 108,150 112,168"
            fill="none"
            stroke="#0b1220"
            strokeWidth="2.2"
          />
          <polyline points="116,62 122,70" fill="none" stroke="#0b1220" strokeWidth="1.4" />
          <polyline points="106,92 99,100" fill="none" stroke="#0b1220" strokeWidth="1.4" />

          {/* Mano esquemática que trae la moneda (se posa junto a la grieta).
              Los opacity:0 del markup evitan el destello antes del primer play
              (un timeline pausado no pinta sus sets de t=0 hasta arrancar). */}
          <g data-m="mano" style={{ opacity: 0 }}>
            <g transform="translate(128,76)">
              {/* antebrazo + puño */}
              <rect
                x="26"
                y="18"
                width="64"
                height="22"
                rx="11"
                transform="rotate(24 26 18)"
                fill="#fbfaf7"
                stroke="#0b1220"
                strokeWidth="2"
              />
              <circle cx="26" cy="22" r="15" fill="#fbfaf7" stroke="#0b1220" strokeWidth="2" />

              {/* Moneda MAL: acostada (se ve de canto, no sirve para medir) */}
              <g data-m="moneda-mal" transform="translate(8,6)">
                <ellipse cx="0" cy="0" rx="15" ry="5.5" fill="#f5d9a8" stroke="#0b1220" strokeWidth="2" />
                <ellipse cx="0" cy="-2" rx="15" ry="5.5" fill="#fff6e8" stroke="#0b1220" strokeWidth="2" />
              </g>

              {/* Moneda BIEN: plana contra la pared, junto a la grieta */}
              <g data-m="moneda-bien" transform="translate(8,4)" style={{ opacity: 0 }}>
                <circle cx="0" cy="0" r="14" fill="#fff6e8" stroke="#0b1220" strokeWidth="2.2" />
                <circle cx="0" cy="0" r="9" fill="none" stroke="#b45309" strokeWidth="1.5" />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  style={{ fontFamily: "inherit", fontWeight: 800, fontSize: 8, fill: "#b45309" }}
                >
                  500
                </text>
              </g>
            </g>
          </g>

          {/* Marca MAL: X ámbar */}
          <g data-m="marca-x" transform="translate(168,54)" style={{ opacity: 0 }}>
            <circle cx="0" cy="0" r="13" fill="#fff6e8" stroke="#b45309" strokeWidth="2.2" />
            <line x1="-5" y1="-5" x2="5" y2="5" stroke="#b45309" strokeWidth="3" strokeLinecap="square" />
            <line x1="5" y1="-5" x2="-5" y2="5" stroke="#b45309" strokeWidth="3" strokeLinecap="square" />
          </g>

          {/* Marca BIEN: check índigo */}
          <g data-m="marca-ok" transform="translate(168,54)" style={{ opacity: 0 }}>
            <circle cx="0" cy="0" r="13" fill="#2563eb" stroke="#0b1220" strokeWidth="2" />
            <polyline
              points="-5.5,0.5 -1.5,4.5 6,-4"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="square"
            />
          </g>

          {/* Encuadre correcto: grieta + moneda nítidas, ~30 cm */}
          <g data-m="encuadre" style={{ opacity: 0 }}>
            <rect
              x="78"
              y="42"
              width="126"
              height="96"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeDasharray="14 8"
            />
            <rect x="78" y="122" width="70" height="16" fill="#2563eb" />
            <text
              x="84"
              y="133"
              style={{ fontFamily: "inherit", fontWeight: 800, fontSize: 9, fill: "#fff" }}
            >
              Nítida · ~30 cm
            </text>
          </g>
        </g>
      </svg>
      <p className="moneda-texto">
        La moneda va pegada a la pared, junto a la grieta — así medimos el ancho real.
      </p>
    </div>
  );
}
