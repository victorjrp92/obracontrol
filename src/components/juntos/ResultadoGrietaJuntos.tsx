import { ArrowRight } from "lucide-react";
import { ADVERTENCIA_VERDE, COPY_DISCREPANCIA, LABEL_ELEMENTO } from "@/lib/alerta/copys";
import type { GrietaEvaluada } from "@/lib/alerta/triage";
import SemaforoJuntos, { PRIORIDAD_NIVEL } from "./SemaforoJuntos";
import AvisoDocumento from "./AvisoDocumento";

interface ResultadoGrietaJuntosProps {
  grieta: GrietaEvaluada;
  numero: number;
  /** Nota de la IA ya sanitizada (sanitizarNotaVisual) — null en modo manual. */
  notaVisual: string | null;
  onContinuar: () => void;
}

/**
 * Resultado de una grieta como PRIORIDAD DE REVISIÓN (urgente / pronto /
 * cuando puedas) con el porqué en una línea + qué hacer + qué NO hacer
 * (copys de reglas.ts, NUNCA reescritos) + banner de discrepancia si aplica
 * + ADVERTENCIA_VERDE obligatoria en verde + aviso compartido (corrección 5
 * del spec: toda pantalla de resultado lleva AVISO_DOCUMENTO).
 */
export default function ResultadoGrietaJuntos({ grieta, numero, notaVisual, onContinuar }: ResultadoGrietaJuntosProps) {
  const { veredicto, reconciliacion, entrada } = grieta;
  const esVerde = veredicto.nivel === "verde";

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2>Grieta {numero}</h2>
        <SemaforoJuntos nivel={veredicto.nivel} />
      </div>

      <p className="prioridad">{PRIORIDAD_NIVEL[veredicto.nivel]}</p>
      <p className="desc" style={{ marginTop: 0 }}>Por qué: {veredicto.razon}.</p>

      <div className="aviso-azul aviso">
        <p style={{ fontWeight: 800, fontSize: 14 }}>{veredicto.que_hacer}</p>
        {veredicto.que_no_hacer.length > 0 && (
          <ul style={{ listStyle: "none", marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {veredicto.que_no_hacer.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        )}
      </div>

      {reconciliacion.hubo_discrepancia && (
        <div className="aviso">
          <p style={{ fontWeight: 800 }}>
            Marcaste &ldquo;{LABEL_ELEMENTO[entrada.declarado]}&rdquo;; la foto parece mostrar &ldquo;
            {LABEL_ELEMENTO[reconciliacion.elemento]}&rdquo;.
          </p>
          <p style={{ marginTop: 4 }}>{COPY_DISCREPANCIA}</p>
        </div>
      )}

      {notaVisual && (
        <p className="micro" style={{ marginTop: 0 }}>
          <b>Lo que se ve en la foto:</b> {notaVisual}
        </p>
      )}

      {esVerde && <div className="aviso-verde aviso">{ADVERTENCIA_VERDE}</div>}

      <AvisoDocumento />

      <div className="cta-abajo">
        <button type="button" onClick={onContinuar} className="btn btn-azul">
          Continuar <ArrowRight className="ic" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
