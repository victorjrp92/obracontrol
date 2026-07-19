"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import CtaCupo from "./CtaCupo";

/**
 * Widget de kilómetros del hero (patrón calculadora): dos selects nativos —
 * dónde vive el dueño y dónde queda su obra — recalculan un número grande de
 * kilómetros y una frase. "Colombia — aquí mismo" da 0 km con una frase
 * distinta. Los km se formatean con separador de miles es-CO. El CTA abre el
 * ModalCupo por el MISMO mecanismo que el resto de CTAs (CtaCupo → origen
 * "hero"). Accesible: labels asociados, selects nativos (teclado), resultado
 * en aria-live.
 */

/** Distancias aproximadas (km) ciudad-donde-vives → ciudad-de-la-obra (tabla D del mockup). */
const D: Record<string, Record<string, number>> = {
  madrid: { cali: 8030, bogota: 8034, medellin: 7980, barranquilla: 7550 },
  ny: { cali: 4080, bogota: 4020, medellin: 3960, barranquilla: 3540 },
  toronto: { cali: 4620, bogota: 4560, medellin: 4490, barranquilla: 4080 },
  miami: { cali: 2440, bogota: 2430, medellin: 2330, barranquilla: 1860 },
  col: { cali: 0, bogota: 0, medellin: 0, barranquilla: 0 },
};

const VIVES: [string, string][] = [
  ["madrid", "Madrid, España"],
  ["ny", "Nueva York, EE. UU."],
  ["toronto", "Toronto, Canadá"],
  ["miami", "Miami, EE. UU."],
  ["col", "Colombia — aquí mismo"],
];

const OBRAS: [string, string][] = [
  ["cali", "Cali"],
  ["bogota", "Bogotá"],
  ["medellin", "Medellín"],
  ["barranquilla", "Barranquilla"],
];

export default function WidgetKm() {
  const [vives, setVives] = useState("madrid");
  const [obra, setObra] = useState("cali");

  const enColombia = vives === "col";
  const num = enColombia ? "0 km" : `${D[vives][obra].toLocaleString("es-CO")} km`;
  const frase = enColombia
    ? "Estás cerca — pero tus ojos no pueden estar ahí todos los días. Seiricon Go sí."
    : "Y aun así vas a verla mejor que si estuvieras al frente.";

  return (
    <div className="km-card">
      <h3>¿Qué tan lejos estás de tu obra?</h3>
      <div className="km-campo">
        <label htmlFor="km-vives">Tú vives en</label>
        <select id="km-vives" value={vives} onChange={(e) => setVives(e.target.value)}>
          {VIVES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="km-campo">
        <label htmlFor="km-obra">Tu obra queda en</label>
        <select id="km-obra" value={obra} onChange={(e) => setObra(e.target.value)}>
          {OBRAS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="km-resultado" aria-live="polite">
        <b className="num">{num}</b>
        <span className="frase">{frase}</span>
      </div>
      <CtaCupo origen="hero" className="btn btn-azul">
        Reserva tu cupo
        <ArrowRight className="ic" strokeWidth={2.6} aria-hidden="true" />
      </CtaCupo>
      <div className="micro">Primera obra gratis · Sin tarjeta</div>
    </div>
  );
}
