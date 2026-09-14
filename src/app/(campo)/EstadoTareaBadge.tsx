/**
 * El estado de una tarea, en una pastilla. Los cuatro valores de `EstadoTarea`
 * (PENDIENTE, REPORTADA, APROBADA, NO_APROBADA) con los mismos colores que usa
 * el resto de la aplicación, para que quien pase del dashboard a esta pantalla
 * no tenga que reaprender qué significa el verde.
 *
 * Sin `"use client"`: no tiene estado ni eventos, se pinta en el servidor.
 */
const ESTILOS: Record<string, { clase: string; punto: string; texto: string }> = {
  APROBADA: { clase: "bg-green-50 text-green-700 border-green-200", punto: "bg-green-500", texto: "Aprobada" },
  REPORTADA: { clase: "bg-blue-50 text-blue-700 border-blue-200", punto: "bg-blue-500", texto: "Reportada" },
  NO_APROBADA: { clase: "bg-red-50 text-red-700 border-red-200", punto: "bg-red-500", texto: "No aprobada" },
  PENDIENTE: { clase: "bg-slate-50 text-slate-600 border-slate-200", punto: "bg-slate-400", texto: "Pendiente" },
};

export default function EstadoTareaBadge({ estado }: { estado: string }) {
  // Un estado desconocido se pinta con su valor crudo en gris en vez de no
  // pintarse: si un día aparece un estado nuevo, es mejor verlo que perderlo.
  const estilo = ESTILOS[estado] ?? {
    clase: "bg-slate-50 text-slate-600 border-slate-200",
    punto: "bg-slate-400",
    texto: estado,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex-shrink-0 ${estilo.clase}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${estilo.punto}`} />
      {estilo.texto}
    </span>
  );
}
