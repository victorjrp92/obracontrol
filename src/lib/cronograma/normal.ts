// ─────────────────────────────────────────────────────────────────────────
// La NORMAL ESTÁNDAR, en diez líneas y sin dependencias.
//
// Todo el aparato de percentiles del motor se apoya en dos funciones: Φ (la
// acumulada) para responder «¿qué probabilidad hay de terminar antes del 3 de
// noviembre?» y su inversa para responder «¿qué día es el P80?».
//
// Φ se calcula con la aproximación **Abramowitz & Stegun 7.1.26** de la
// función error: error absoluto < 1.5e-7 en todo el eje real. Sobra: la
// diferencia entre 0.80 y 0.8000001 no la ve nadie, y a cambio no entra ni
// una dependencia al proyecto.
//
// La INVERSA no usa una segunda aproximación (Acklam, Moro…) sino BISECCIÓN
// sobre la propia Φ, y eso es deliberado: así `z(q)` y `Φ(z)` son inversas
// EXACTAS la una de la otra hasta el último bit del double. Es lo que hace
// que `probabilidadHasta(dist, dist.p80)` valga 0.80 clavado y no 0.7999998
// — un percentil que no cierra con su propia probabilidad es una promesa
// comercial que no se puede auditar. Cuesta ~60 evaluaciones de Φ, o sea
// nada: se llama cuatro veces por obra.
//
// ⚠️ UN DETALLE MEDIDO: los cinco coeficientes de A&S suman 0.999999999, no 1,
// así que la aproximación deja un escalón de 1e-9 justo en el origen (donde
// `erf` cambia de signo). Se nota SOLO en el ida y vuelta de la mediana:
// Φ(zDe(0.5)) = 0.5 ± 5e-10 en vez de exacto. Es 150 veces menor que la propia
// cota de error de la aproximación y ~7 órdenes por debajo de cualquier cosa
// que importe en una fecha de obra. Se documenta en vez de retocar unos
// coeficientes publicados.
// ─────────────────────────────────────────────────────────────────────────

// Coeficientes de A&S 7.1.26.
const P_AS = 0.3275911;
const A1 = 0.254829592;
const A2 = -0.284496736;
const A3 = 1.421413741;
const A4 = -1.453152027;
const A5 = 1.061405429;

/**
 * Función error. `erf(-x) = -erf(x)`, así que la aproximación se evalúa
 * siempre en el semieje positivo (que es donde A&S la da).
 */
export function erf(x: number): number {
  const signo = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + P_AS * ax);
  const poli = ((((A5 * t + A4) * t + A3) * t + A2) * t + A1) * t;
  return signo * (1 - poli * Math.exp(-ax * ax));
}

/** Φ: P(Z <= z) con Z normal estándar. */
export function phi(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Cuantil normal estándar: el `z` tal que Φ(z) = q. Bisección sobre `phi`,
 * así que es su inversa exacta (ver cabecera). Fuera de (0, 1) devuelve los
 * infinitos, que es lo que valen.
 */
export function zDe(q: number): number {
  if (!(q > 0)) return -Infinity;
  if (!(q < 1)) return Infinity;
  let lo = -40;
  let hi = 40;
  // 200 pasos: la bisección converge a la precisión del double mucho antes
  // (~60), y el tope evita cualquier bucle infinito si `phi` se tocara.
  for (let i = 0; i < 200; i++) {
    const medio = (lo + hi) / 2;
    if (medio === lo || medio === hi) break;
    if (phi(medio) < q) lo = medio;
    else hi = medio;
  }
  return (lo + hi) / 2;
}
