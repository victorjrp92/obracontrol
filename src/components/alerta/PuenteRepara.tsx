import Link from "next/link";
// Fuente única de la duración de la campaña (repara/config solo reexporta datos
// de contacto de alerta/config, así que no hay ciclo de módulos).
import { MESES_GRATIS } from "@/components/repara/config";

/**
 * Única línea de puente entre /alerta y la campaña /repara (Seiricon Go).
 *
 * REGLA DURA (spec D5): esto SOLO se monta al final de un flujo ya terminado
 * —resultado del triage y resumen del acta— y nunca antes de la ayuda. Está
 * PROHIBIDO enlazar /repara desde AlertaHero, FiltroSeguridad (y sobre todo
 * desde la pantalla roja "Salí ahora"), AlertaDisclaimer, LineasEmergencia,
 * UbicarGrieta, GrietaCameraCapture y ResultadoGrieta. Párrafo apagado,
 * sin banner, sin modal, sin interrumpir.
 */
export default function PuenteRepara() {
  return (
    <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
      Cuando llegue el momento de reparar, Seiricon Go es gratis {MESES_GRATIS} meses para las
      reparaciones del sismo —{" "}
      <Link href="/repara" className="font-medium text-blue-600 hover:text-blue-700">
        así no pagas sin pruebas
      </Link>
      .
    </p>
  );
}
