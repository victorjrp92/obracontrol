import { Phone } from "lucide-react";
import { LINEA_EMERGENCIA_NACIONAL, LINEAS_EMERGENCIA_CIUDADES } from "./config";

// Bloque de líneas de emergencia para la pantalla de corte del filtro de
// seguridad. Los números son placeholders TODO(confirmar-telefono) a
// propósito (ver config.ts) — se muestran tal cual, sin disfrazarlos, para
// que sea obvio que faltan por confirmar antes de publicar.
export default function LineasEmergencia() {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
        <Phone className="h-4 w-4" /> Líneas de emergencia
      </p>
      <ul className="flex flex-col gap-1 text-sm text-slate-700">
        <li className="flex items-center justify-between gap-3">
          <span>{LINEA_EMERGENCIA_NACIONAL.ciudad}</span>
          <span className="font-mono text-red-600">{LINEA_EMERGENCIA_NACIONAL.telefono}</span>
        </li>
        {LINEAS_EMERGENCIA_CIUDADES.map((l) => (
          <li key={l.ciudad} className="flex items-center justify-between gap-3">
            <span>{l.ciudad}</span>
            <span className="font-mono text-red-600">{l.telefono}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Números pendientes de confirmar antes de publicar. Si tienes una emergencia médica o de
        riesgo de derrumbe, contacta a las autoridades locales por tus medios habituales.
      </p>
    </div>
  );
}
