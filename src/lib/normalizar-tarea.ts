// Normalización canónica del nombre de una tarea, para indexar precios.
// Misma transformación que usa `buscarPrecioSemilla` en precios-semilla.ts:
// minúsculas + sin tildes (NFD + quita marcas diacríticas) + colapsa espacios.
// Mantener UNA sola definición para que la captura (RegistroPrecio) y la lectura
// (getPrecioMercado) compartan exactamente la misma clave.
export function normalizarTarea(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
