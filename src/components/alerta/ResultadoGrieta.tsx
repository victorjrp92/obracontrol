import { ArrowRight } from "lucide-react";
import { ADVERTENCIA_VERDE, COPY_DISCREPANCIA, LABEL_ELEMENTO } from "@/lib/alerta/copys";
import type { GrietaEvaluada } from "@/lib/alerta/triage";
import SemaforoNivel from "./SemaforoNivel";

interface ResultadoGrietaProps {
  grieta: GrietaEvaluada;
  numero: number;
  /** Nota de la IA ya sanitizada (sanitizarNotaVisual) — null en modo manual. */
  notaVisual: string | null;
  onContinuar: () => void;
}

/**
 * Paso 3 del triage: semáforo + razón + qué hacer/qué no hacer (copys de
 * reglas.ts, NUNCA reescritos) + nota visual etiquetada + banner de
 * discrepancia si aplica + ADVERTENCIA_VERDE obligatoria en verde + CTA a
 * evaluación profesional.
 */
export default function ResultadoGrieta({ grieta, numero, notaVisual, onContinuar }: ResultadoGrietaProps) {
  const { veredicto, reconciliacion, entrada } = grieta;
  const esVerde = veredicto.nivel === "verde";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900">Resultado — Grieta {numero}</h2>
        <SemaforoNivel nivel={veredicto.nivel} />
      </div>

      <p className="text-sm text-slate-700">{veredicto.razon}</p>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">{veredicto.que_hacer}</p>
        {veredicto.que_no_hacer.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
            {veredicto.que_no_hacer.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}
      </div>

      {reconciliacion.hubo_discrepancia && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            Marcaste &ldquo;{LABEL_ELEMENTO[entrada.declarado]}&rdquo;, la foto parece mostrar &ldquo;
            {LABEL_ELEMENTO[reconciliacion.elemento]}&rdquo;.
          </p>
          <p className="mt-1">{COPY_DISCREPANCIA}</p>
        </div>
      )}

      {notaVisual && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Lo que se ve en la foto: </span>
          {notaVisual}
        </p>
      )}

      {esVerde && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
          {ADVERTENCIA_VERDE}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Esto no reemplaza a un ingeniero estructural. Si tienes dudas, sigue documentando otras grietas o
        busca una evaluación profesional — al terminar te mostramos cómo.
      </div>

      <button
        type="button"
        onClick={onContinuar}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        Continuar <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
