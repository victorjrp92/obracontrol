import { Info } from "lucide-react";

// Nota visible y permanente en todo el flujo de /alerta: evita que un
// resultado "verde" (o cualquier resultado) se lea como "tu casa es segura".
// Se usa tal cual en /alerta y en /alerta/documentar — no se parafrasea.
export default function AlertaDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>
        Esta herramienta <strong>no reemplaza una evaluación de un ingeniero estructural</strong>. Te
        ayuda a documentar y a decidir con más información, no a diagnosticar.
      </p>
    </div>
  );
}
