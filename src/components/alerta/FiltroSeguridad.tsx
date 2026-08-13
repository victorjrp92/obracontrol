"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, TriangleAlert } from "lucide-react";
import { evaluarFiltroSeguridad, type FiltroSeguridadRespuestas } from "@/lib/alerta/filtro-seguridad";
import LineasEmergencia from "./LineasEmergencia";

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

// Filtro de seguridad del Paso 0 (spec A.5 / B.1). Cuatro preguntas sí/no que
// cortan el flujo con CUALQUIER "sí" — sin esperar a que se respondan las
// otras, y antes de tomar cualquier foto.
export default function FiltroSeguridad() {
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
    return (
      <section id="filtro-seguridad" className="scroll-mt-24 rounded-2xl border-2 border-red-200 bg-red-50 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-7 w-7 flex-shrink-0 text-red-600" />
          <div>
            <h2 className="text-xl font-extrabold text-red-800 sm:text-2xl">Salí ahora</h2>
            <p className="mt-1 text-sm text-red-700 sm:text-base">
              Al menos una de tus respuestas es una señal de riesgo inmediato. No te quedes a
              documentar ni a revisar nada más.
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-1.5 text-sm text-red-800">
          <li>• Sal del inmueble con calma, sin correr ni empujar.</li>
          <li>• Aléjate de fachadas, muros y postes que puedan caer.</li>
          <li>• No vuelvas a entrar hasta que un ingeniero o la autoridad local lo autorice.</li>
        </ul>

        <div className="mt-5">
          <LineasEmergencia />
        </div>
      </section>
    );
  }

  return (
    <section id="filtro-seguridad" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
        Antes que nada, responde estas 4 preguntas
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Si respondes “sí” a cualquiera, te decimos que salgas ya — no sigas leyendo, no tomes fotos.
      </p>

      <div className="mt-5 flex flex-col divide-y divide-slate-100">
        {PREGUNTAS.map((p) => (
          <div key={p.clave} className="flex flex-col gap-2.5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              {respondidas[p.clave] ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" />
              )}
              <span className="text-sm font-medium text-slate-800 sm:text-base">{p.texto}</span>
            </div>
            <div className="flex gap-2 pl-7 sm:pl-0">
              <button
                type="button"
                onClick={() => responder(p.clave, true)}
                aria-pressed={respondidas[p.clave] && respuestas[p.clave] === true}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  respondidas[p.clave] && respuestas[p.clave]
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => responder(p.clave, false)}
                aria-pressed={respondidas[p.clave] && respuestas[p.clave] === false}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  respondidas[p.clave] && !respuestas[p.clave]
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      {todasRespondidas ? (
        <div className="mt-6 rounded-xl bg-blue-50 p-4 text-center">
          <p className="text-sm font-medium text-blue-900">
            Ninguna es una señal de riesgo inmediato. Puedes continuar.
          </p>
          <div className="mt-3 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/alerta/grietas"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Revisar una grieta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/alerta/documentar"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-6 py-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Documentar los daños
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-center text-xs text-slate-400">Responde las 4 preguntas para continuar.</p>
      )}
    </section>
  );
}
