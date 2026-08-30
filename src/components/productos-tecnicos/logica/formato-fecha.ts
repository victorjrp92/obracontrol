/** Fecha corta legible en es-CO: "29 ago 2026". Para las tarjetas de listado. */
export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/** Fecha + hora — para cuando importa el detalle exacto de quién subió qué y cuándo. */
export function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
