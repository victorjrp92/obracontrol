"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { evaluarFiltroSeguridad, type FiltroSeguridadRespuestas } from "@/lib/alerta/filtro-seguridad";
import PantallaRoja from "./PantallaRoja";

type Pregunta = keyof FiltroSeguridadRespuestas;

const PREGUNTAS: { clave: Pregunta; texto: string }[] = [
  { clave: "edificioInclinado", texto: "¿El edificio o la casa se ve claramente inclinado(a)?" },
  {
    clave: "columnaReventadaOVarillaExpuesta",
    texto: "¿Alguna columna está reventada o se le ve la varilla de acero por fuera?",
  },
  { clave: "pisosDesnivelados", texto: "¿Los pisos quedaron desnivelados o se sienten “chuecos” al caminar?" },
  { clave: "olorAGas", texto: "¿Sientes olor a gas?" },
];

const SIN_RESPUESTAS: FiltroSeguridadRespuestas = {
  edificioInclinado: false,
  columnaReventadaOVarillaExpuesta: false,
  pisosDesnivelados: false,
  olorAGas: false,
};

interface FiltroSeguridadJuntosProps {
  /** Se llama cuando las 4 respuestas son "no" y la persona pulsa continuar. */
  onPasar: () => void;
  /** Texto del CTA de continuar (según el wizard que lo monte). */
  etiquetaContinuar: string;
  /** En /documentar: PantallaRoja ofrece seguir documentando desde afuera. */
  onDocumentarAfuera?: () => void;
}

/**
 * Filtro de seguridad — SIEMPRE primero, CERO datos personales, sin
 * consentimiento porque no se recoge nada (spec-go-juntos.md). Las 4
 * respuestas SIN default: estado `respondidas` aparte (patrón FiltroSeguridad
 * de Karen, conservado a propósito) — no se avanza sin responder las 4, y
 * cualquier "sí" corta el flujo de inmediato con la pantalla roja.
 */
export default function FiltroSeguridadJuntos({
  onPasar,
  etiquetaContinuar,
  onDocumentarAfuera,
}: FiltroSeguridadJuntosProps) {
  const [respondidas, setRespondidas] = useState<Record<Pregunta, boolean>>({
    edificioInclinado: false,
    columnaReventadaOVarillaExpuesta: false,
    pisosDesnivelados: false,
    olorAGas: false,
  });
  const [respuestas, setRespuestas] = useState<FiltroSeguridadRespuestas>(SIN_RESPUESTAS);

  const corte = evaluarFiltroSeguridad(respuestas);
  const todasRespondidas = PREGUNTAS.every((p) => respondidas[p.clave]);

  function responder(clave: Pregunta, valor: boolean) {
    setRespondidas((prev) => ({ ...prev, [clave]: true }));
    setRespuestas((prev) => ({ ...prev, [clave]: valor }));
  }

  if (corte) {
    return <PantallaRoja onDocumentarAfuera={onDocumentarAfuera} />;
  }

  return (
    <div className="panel">
      <div>
        <h2>Antes que nada: tu seguridad</h2>
        <p className="desc">
          Responde estas 4 preguntas. Si alguna es &ldquo;sí&rdquo;, te decimos que salgas ya — sin fotos, sin
          datos, sin nada más.
        </p>
      </div>

      <div>
        {PREGUNTAS.map((p) => (
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
                aria-pressed={respondidas[p.clave] && respuestas[p.clave] === true}
                className={`btn-sino ${respondidas[p.clave] && respuestas[p.clave] ? "si-sel" : ""}`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => responder(p.clave, false)}
                aria-pressed={respondidas[p.clave] && respuestas[p.clave] === false}
                className={`btn-sino ${respondidas[p.clave] && !respuestas[p.clave] ? "no-sel" : ""}`}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      {todasRespondidas ? (
        <div className="cta-abajo">
          <div className="aviso-azul aviso" style={{ textAlign: "center" }}>
            Ninguna de tus respuestas es una señal de riesgo inmediato. Puedes continuar.
          </div>
          <button type="button" onClick={onPasar} className="btn btn-azul">
            {etiquetaContinuar} <ArrowRight className="ic" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="micro" style={{ textAlign: "center" }}>
          Responde las 4 preguntas para continuar.
        </p>
      )}
    </div>
  );
}
