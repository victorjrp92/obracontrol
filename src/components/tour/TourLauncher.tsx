"use client";

import { useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useTour } from "./TourProvider";
import type { TourDef } from "./tours";

/**
 * Inicia el tour automáticamente UNA sola vez (si no se ha visto) y deja un
 * botón flotante para reabrirlo en cualquier momento. Poco intrusivo: el
 * usuario puede saltarlo y no vuelve a aparecer solo.
 */
export default function TourLauncher({
  tour,
  autostart = true,
}: {
  tour: TourDef;
  autostart?: boolean;
}) {
  const { start, isDone } = useTour();

  useEffect(() => {
    if (!autostart) return;
    if (isDone(tour.id)) return;
    // Pequeño retraso para que el layout/sidebar terminen de pintarse.
    const t = setTimeout(() => start(tour), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      onClick={() => start(tour)}
      title="¿Cómo funciona?"
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 bg-white border border-slate-200 shadow-lg text-slate-700 hover:text-blue-600 hover:border-blue-300 text-xs font-semibold pl-2.5 pr-3.5 py-2 rounded-full transition-colors cursor-pointer"
    >
      <HelpCircle className="w-4 h-4 text-blue-600" />
      <span className="hidden sm:inline">¿Cómo funciona?</span>
    </button>
  );
}
