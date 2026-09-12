/**
 * Regla de metraje por tipo de unidad.
 *
 * Cada tipo de unidad puede llevar un `metraje_total` (m² del apartamento) y,
 * si además se reparte el área por espacio, un `metrajes_espacios` con el m²
 * de cada cuarto. Esos dos números los captura el usuario por separado, así
 * que nada garantiza que cuadren — y el m² de cada espacio alimenta la
 * estimación de duración y presupuesto de sus tareas (ver
 * `src/app/api/proyectos/wizard/route.ts`), así que un reparto inflado infla
 * el plan de TODA la obra que depende de ese tipo.
 *
 * La regla es asimétrica a propósito:
 *   - Que la suma de espacios sea MENOR que el total es lo normal y correcto:
 *     muros, circulaciones y clósets no se listan como espacio propio, así
 *     que siempre queda un remanente sin repartir. Eso NO es un error.
 *   - Que la suma sea MAYOR que el total es imposible en la realidad — un
 *     apartamento no puede tener más área en sus cuartos que la que tiene en
 *     total — así que eso SÍ se bloquea.
 *
 * Este módulo es puro (sin Prisma ni React) porque la interfaz del wizard y
 * las dos rutas de API que crean/editan proyectos necesitan la MISMA
 * definición de "exceso": si cada una la reimplementara por su cuenta,
 * tarde o temprano se desincronizarían y un caso pasaría en un lado y
 * fallaría en otro.
 */

/** Lo mínimo de un tipo de unidad para poder revisarle el metraje. */
export interface TipoMetraje {
  nombre: string;
  espacios: string[];
  metraje_total?: number;
  metrajes_espacios?: Record<string, number>;
}

export interface ExcesoMetraje {
  tipo: string;
  /** Suma de los espacios, en m². */
  suma: number;
  /** m² declarados para el tipo. */
  total: number;
}

/** Tolerancia de comparación: con decimales, 20,1 + 41,9 da 62,000000000000004
 *  en punto flotante, y eso no puede reprobar a un tipo de 62 m². */
const TOLERANCIA_M2 = 0.01;

/** Suma los m² de los espacios que el tipo tiene declarados. */
export function sumaEspacios(t: TipoMetraje): number {
  const espaciosVigentes = new Set(t.espacios);
  let suma = 0;
  for (const [nombreEspacio, metraje] of Object.entries(t.metrajes_espacios ?? {})) {
    // Un espacio borrado del tipo puede dejar su m² huérfano en el objeto
    // (nadie lo limpia al quitar el chip); si ya no está en `espacios`, no cuenta.
    if (!espaciosVigentes.has(nombreEspacio)) continue;
    if (!Number.isFinite(metraje)) continue;
    suma += metraje;
  }
  return suma;
}

/** Devuelve el exceso si la suma se pasa del total; `null` si está bien. */
export function excesoMetraje(t: TipoMetraje): ExcesoMetraje | null {
  const total = t.metraje_total;
  // Sin total definido (o uno inválido/≤0) no hay contra qué comparar: no es
  // exceso, es ausencia de dato.
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  const suma = sumaEspacios(t);
  if (suma > total + TOLERANCIA_M2) {
    return { tipo: t.nombre, suma, total };
  }
  return null;
}

/** Todos los tipos que se pasan. Vacío = todo correcto. */
export function excesosMetraje(tipos: TipoMetraje[]): ExcesoMetraje[] {
  const resultado: ExcesoMetraje[] = [];
  for (const t of tipos) {
    const e = excesoMetraje(t);
    if (e) resultado.push(e);
  }
  return resultado;
}

/**
 * Formatea un m² para el usuario: sin decimales si es entero, con coma
 * decimal si no. Se redondea a 2 decimales antes de decidir para no mostrar
 * residuos de punto flotante (62,000000000000004 → "62").
 * Compartida entre el contador en vivo del wizard y `mensajeExceso` para que
 * no existan dos formateos de m² ligeramente distintos en la interfaz.
 */
export function formatearM2(n: number): string {
  const redondeado = Math.round(n * 100) / 100;
  if (Number.isInteger(redondeado)) return String(redondeado);
  return String(redondeado).replace(".", ",");
}

/** Texto para el usuario, el mismo en la interfaz y en el error de la API. */
export function mensajeExceso(e: ExcesoMetraje): string {
  return `${e.tipo}: los espacios suman ${formatearM2(e.suma)} m² y el tipo tiene ${formatearM2(e.total)} m²`;
}
