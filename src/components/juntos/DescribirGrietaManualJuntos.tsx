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

/**
 * Ancho de la grieta, preguntado con la misma moneda de $500 que la persona ya
 * tiene en la mano para la foto.
 *
 * POR QUÉ HACE FALTA: sin esto la observación manual salía con `ancho_mm: null`,
 * y la regla 4 de `reglas.ts` exige `ancho_mm > 3` para marcar ROJO un muro de
 * carga. Con `null` nunca se cumplía, así que caía a la regla 5 → AMARILLO. En
 * la práctica: una grieta de 8 mm en un muro de carga se reportaba como
 * «revisar pronto» en vez de «urgente». Era el ÚNICO punto donde el sistema
 * podía subestimar, y como la IA de visión está apagada, el modo manual es hoy
 * el único camino.
 *
 * Los valores son CONSERVADORES a propósito: se manda el extremo bajo de cada
 * rango, de modo que el veredicto nunca se endurece por redondear hacia arriba.
 * El canto de la moneda de $500 mide ~1,5 mm, y su diámetro 23,7 mm.
 */
const OPCIONES_ANCHO: { valor: number | null; label: string; pista: string }[] = [
  { valor: 1, label: "Más delgada que el canto de la moneda", pista: "casi no entra nada" },
  { valor: 2, label: "Como el canto de la moneda", pista: "el borde entra justo" },
  { valor: 4, label: "Más gruesa que el canto de la moneda", pista: "el borde entra holgado" },
  { valor: null, label: "No sé / no puedo medirla", pista: "seguimos sin ese dato" },
];

interface DescribirGrietaManualJuntosProps {
  onCompletar: (datos: { patron: Patron; banderas: Banderas; ancho_mm: number | null }) => void;
}

export default function DescribirGrietaManualJuntos({ onCompletar }: DescribirGrietaManualJuntosProps) {
  const [patron, setPatron] = useState<Patron | null>(null);
  // Igual que las banderas: sin default. `null` es una respuesta válida
  // («no sé»), así que no sirve para saber si ya contestó.
  const [anchoRespondido, setAnchoRespondido] = useState(false);
  const [anchoMm, setAnchoMm] = useState<number | null>(null);
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
  const puedeContinuar = patron !== null && anchoRespondido && todasRespondidas;

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
        <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>¿Qué tan ancha es?</p>
        <p className="micro" style={{ marginTop: 0, marginBottom: 8 }}>
          Compárala con el <b>canto</b> (el borde) de una moneda de $500 — el mismo que usaste para la foto.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {OPCIONES_ANCHO.map((op) => {
            const sel = anchoRespondido && anchoMm === op.valor;
            return (
              <button
                key={op.label}
                type="button"
                onClick={() => {
                  setAnchoRespondido(true);
                  setAnchoMm(op.valor);
                }}
                aria-pressed={sel}
                className={`opcion opcion-linea ${sel ? "sel" : ""}`}
              >
                {op.label} <span className="micro">· {op.pista}</span>
              </button>
            );
          })}
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
          {patron === null
            ? "Elige cómo se ve la grieta, qué tan ancha es, y responde las 5 preguntas."
            : !anchoRespondido
              ? "Dinos qué tan ancha es para continuar."
              : "Responde las 5 preguntas para continuar."}
        </p>
      )}

      <div className="cta-abajo">
        <button
          type="button"
          onClick={() =>
            patron && anchoRespondido && todasRespondidas && onCompletar({ patron, banderas, ancho_mm: anchoMm })
          }
          disabled={!puedeContinuar}
          className="btn btn-azul"
        >
          Continuar <ArrowRight className="ic" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
