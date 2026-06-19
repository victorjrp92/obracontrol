// ─────────────────────────────────────────────────────────────────────────
// Capa de lectura del flywheel de precios (RegistroPrecio).
//
// Lee los rastros de precio que dejan las obras al fijar/editar tareas y
// devuelve un precio de mercado para una tarea (normalizada) en una ciudad.
// Pondera por `peso` (confianza por fuente): pago_confirmado > factura >
// editado > sugerido > semilla. Usa una MEDIANA PONDERADA (robusta a outliers)
// y reporta cuántos registros la respaldan + un nivel de confianza grueso.
//
// Determinista respecto a la DB. NO conectado a la UI todavía — lo consumirá
// la capa de sugerencias más adelante.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

export type ConfianzaMercado = "alta" | "media" | "baja";

export interface PrecioMercado {
  /** Precio sugerido (mediana ponderada, COP). */
  precio: number;
  /** # de registros que respaldan el precio. */
  n: number;
  /** Confianza gruesa según volumen y peso acumulado. */
  confianza: ConfianzaMercado;
}

// Cuántos registros traer como máximo (defensivo; el índice ya filtra).
const MAX_MUESTRA = 500;

/**
 * Mediana ponderada de una lista de (valor, peso). Ordena por valor y avanza
 * acumulando peso hasta cruzar la mitad del peso total.
 */
function medianaPonderada(muestras: { valor: number; peso: number }[]): number {
  const ordenadas = [...muestras].sort((a, b) => a.valor - b.valor);
  const pesoTotal = ordenadas.reduce((acc, m) => acc + m.peso, 0);
  if (pesoTotal <= 0) {
    // Sin pesos válidos: promedio simple como fallback.
    return Math.round(ordenadas.reduce((acc, m) => acc + m.valor, 0) / ordenadas.length);
  }
  const mitad = pesoTotal / 2;
  let acumulado = 0;
  for (const m of ordenadas) {
    acumulado += m.peso;
    if (acumulado >= mitad) return Math.round(m.valor);
  }
  return Math.round(ordenadas[ordenadas.length - 1].valor);
}

/**
 * Devuelve el precio de mercado para una tarea (ya normalizada con
 * `normalizarTarea`) en una ciudad opcional. Si hay ciudad e información
 * suficiente, prioriza la ciudad; si no, cae al agregado global de la tarea.
 *
 * @returns `{ precio, n, confianza }` o `null` si no hay datos.
 */
export async function getPrecioMercado(
  tareaNormalizada: string,
  ciudad?: string | null,
): Promise<PrecioMercado | null> {
  const clave = tareaNormalizada.trim();
  if (!clave) return null;

  const ciudadNorm = ciudad?.trim() || null;

  // 1) Intentar con ciudad (si se pidió). 2) Caer a global de la tarea.
  const wheres = ciudadNorm
    ? [{ tarea_normalizada: clave, ciudad: ciudadNorm }, { tarea_normalizada: clave }]
    : [{ tarea_normalizada: clave }];

  for (const where of wheres) {
    let registros;
    try {
      registros = await prisma.registroPrecio.findMany({
        where,
        select: { precio: true, peso: true },
        take: MAX_MUESTRA,
        orderBy: { created_at: "desc" },
      });
    } catch {
      // Tabla aún no migrada u otro fallo de lectura: no es crítico.
      return null;
    }

    if (registros.length === 0) continue;

    const muestras = registros
      .filter((r) => Number.isFinite(r.precio) && r.precio > 0)
      .map((r) => ({ valor: r.precio, peso: r.peso > 0 ? r.peso : 1 }));

    if (muestras.length === 0) continue;

    const precio = medianaPonderada(muestras);
    const n = muestras.length;
    const pesoTotal = muestras.reduce((acc, m) => acc + m.peso, 0);

    // Confianza gruesa: combina volumen y peso acumulado.
    let confianza: ConfianzaMercado = "baja";
    if (n >= 8 && pesoTotal >= 12) confianza = "alta";
    else if (n >= 3 && pesoTotal >= 4) confianza = "media";

    return { precio, n, confianza };
  }

  return null;
}
