"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { Banderas, Patron } from "@/lib/alerta/tipos";

/**
 * Modo manual del wizard de grietas — adaptado de DescribirGrietaManual de
 * Karen con la CORRECCIÓN OBLIGATORIA del spec (spec-go-juntos.md): las 5
 * banderas de peligro van SIN default. Estado `respondidas` aparte (patrón
 * FiltroSeguridad) y no se avanza sin responder las 5: un "no" implícito en
 * una bandera crítica podía ablandar el resultado.
 *
 * NO pregunta por el elemento: eso ya se respondió en el Paso 1
 * (UbicarGrietaJuntos) y el wizard lo reusa como `elemento` de la
 * ObservacionGrieta manual (fuente "manual" → T4 de triage.ts).
 */

const OPCIONES_PATRON: { patron: Patron; label: string }[] = [
  { patron: "vertical", label: "En línea recta, de arriba hacia abajo" },
  { patron: "horizontal", label: "En línea recta, de lado a lado" },
  { patron: "diagonal", label: "Inclinada (en diagonal)" },
  { patron: "diagonal_x", label: "En forma de X" },
  { patron: "escalonada", label: "En escalones (sigue los bloques o ladrillos)" },
  { patron: "craquelado", label: "Como telaraña, muchas líneas finas" },
  { patron: "esquina_vano", label: "Sale de la esquina de una puerta o ventana" },
  { patron: "junta_entre_elementos", label: "Donde se juntan dos materiales distintos (ej. columna y muro)" },
];

type ClaveBandera = keyof Banderas;

const PREGUNTAS_BANDERAS: { clave: ClaveBandera; texto: string }[] = [
  { clave: "acero_expuesto", texto: "¿Se ve el hierro (varilla) por dentro de la grieta?" },
  { clave: "concreto_triturado", texto: "¿El concreto se ve triturado o desmoronado ahí?" },
  { clave: "desplazamiento_caras", texto: "¿Un lado de la grieta quedó más alto o más adelante que el otro, como un escalón?" },
  { clave: "elemento_inclinado", texto: "¿El elemento (columna, muro) se ve inclinado?" },
  { clave: "separacion_muro_estructura", texto: "¿El muro se separó de la columna o viga (se ve un hueco entre los dos)?" },
];

const SIN_RESPONDER: Record<ClaveBandera, boolean> = {
  acero_expuesto: false,
  concreto_triturado: false,
  desplazamiento_caras: false,
  elemento_inclinado: false,
  separacion_muro_estructura: false,
};

interface DescribirGrietaManualJuntosProps {
  onCompletar: (datos: { patron: Patron; banderas: Banderas }) => void;
}

export default function DescribirGrietaManualJuntos({ onCompletar }: DescribirGrietaManualJuntosProps) {
  const [patron, setPatron] = useState<Patron | null>(null);
  // SIN default: `respondidas` aparte de los valores (corrección del spec).
  const [respondidas, setRespondidas] = useState<Record<ClaveBandera, boolean>>(SIN_RESPONDER);
  const [banderas, setBanderas] = useState<Banderas>({
    acero_expuesto: false,
    concreto_triturado: false,
    desplazamiento_caras: false,
    elemento_inclinado: false,
    separacion_muro_estructura: false,
  });

  const todasRespondidas = PREGUNTAS_BANDERAS.every((p) => respondidas[p.clave]);
  const puedeContinuar = patron !== null && todasRespondidas;

  function responder(clave: ClaveBandera, valor: boolean) {
    setRespondidas((prev) => ({ ...prev, [clave]: true }));
    setBanderas((prev) => ({ ...prev, [clave]: valor }));
  }

  return (
    <div className="panel">
      <div>
        <h2>Descríbenos la grieta</h2>
        <p className="desc">Cuéntanos lo que ves tú. Con esto clasificamos la prioridad de revisión.</p>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>¿Cómo se ve la grieta?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {OPCIONES_PATRON.map((op) => (
            <button
              key={op.patron}
              type="button"
              onClick={() => setPatron(op.patron)}
              aria-pressed={patron === op.patron}
              className={`opcion opcion-linea ${patron === op.patron ? "sel" : ""}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 800 }}>Responde sí o no — las 5:</p>
        {PREGUNTAS_BANDERAS.map((p) => (
          <div key={p.clave} className="fila-sino">
            <span className="preg">
              {respondidas[p.clave] ? (
                <CheckCircle2 className="ic ok" aria-hidden="true" />
              ) : (
                <Circle className="ic" aria-hidden="true" />
              )}
              {p.texto}
            </span>
            <div className="par-sino">
              <button
                type="button"
                onClick={() => responder(p.clave, true)}
                aria-pressed={respondidas[p.clave] && banderas[p.clave] === true}
                className={`btn-sino ${respondidas[p.clave] && banderas[p.clave] ? "si-sel" : ""}`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => responder(p.clave, false)}
                aria-pressed={respondidas[p.clave] && banderas[p.clave] === false}
                className={`btn-sino ${respondidas[p.clave] && !banderas[p.clave] ? "no-sel" : ""}`}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      {!puedeContinuar && (
        <p className="micro" style={{ textAlign: "center" }}>
          {patron === null ? "Elige cómo se ve la grieta y responde las 5 preguntas." : "Responde las 5 preguntas para continuar."}
        </p>
      )}

      <div className="cta-abajo">
        <button
          type="button"
          onClick={() => patron && todasRespondidas && onCompletar({ patron, banderas })}
          disabled={!puedeContinuar}
          className="btn btn-azul"
        >
          Continuar <ArrowRight className="ic" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
