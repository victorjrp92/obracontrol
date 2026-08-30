// ─────────────────────────────────────────────────────────────────────────
// AZAR DETERMINISTA. El único módulo del motor que produce números
// "aleatorios", y lo hace SIN `Math.random`: un PRNG **xorshift128+** con
// semilla derivada de un texto (el id del proyecto).
//
// POR QUÉ NO `Math.random`: el motor de duración es puro y determinista —
// misma entrada, misma salida— y hay un assert que lo vigila. Un Monte Carlo
// con `Math.random` rompería eso: dos cargas de la misma página del proyecto
// darían dos fechas distintas, y el usuario vería bailar su entrega sin haber
// tocado nada. Con semilla derivada del id, la obra 42 tiene SIEMPRE la misma
// simulación, en el servidor y en el navegador, hoy y dentro de un año.
//
// xorshift128+ (Vigna 2016) en JavaScript: no hay enteros de 64 bits nativos
// que sean rápidos (`BigInt` lo es, pero cuesta ~20× y aquí se piden cientos
// de miles de números), así que cada palabra de 64 bits se lleva en DOS
// palabras de 32 (`h` alta, `l` baja) y los desplazamientos, el xor y la suma
// se emulan con aritmética de 32 bits. Es el mismo generador, bit a bit — y
// `scripts/verificar-probabilidad.ts` lo comprueba contra una implementación
// de referencia en `BigInt`, 10 000 números idénticos.
//
// ⚠️ HASTA DÓNDE LLEGA LA PROMESA. El generador es bit a bit idéntico en
// cualquier motor de JS: solo usa enteros de 32 bits, cuya semántica está
// fijada por la norma. Lo que NO está fijado al último bit es `Math.log`,
// `Math.cos` y `Math.exp`, que la norma deja a discreción de la
// implementación: dos motores distintos pueden diferir en ~1e-16 en una
// muestra. A granularidad de DÍA —que es lo que se enseña— eso es
// irrelevante, pero no se promete igualdad binaria de percentiles entre V8 y
// JavaScriptCore: se promete la misma fecha.
//
// Encima del uniforme viven los muestreadores que necesita el Monte Carlo:
//   · `normalEstandar`  — Box–Muller.
//   · `gammaEstandar`   — Marsaglia–Tsang (2000), forma >= 1.
//   · `betaPert`        — Beta-PERT clásica (λ = 4) por cociente de gammas.
//   · `factorComun`     — LogNormal(−σ²/2, σ²), media 1: el factor K.
// ─────────────────────────────────────────────────────────────────────────

/** Fuente de uniformes en [0, 1). */
export interface Aleatorio {
  uniforme(): number;
}

/** 2^21 y 2^53: los dos que hacen falta para armar el double de 53 bits. */
const DOS_21 = 2097152;
const DOS_53 = 9007199254740992;

/**
 * Mezclador splitmix32: de un entero de 32 bits saca el siguiente y una
 * palabra bien difundida. Sirve para expandir un hash corto a las cuatro
 * palabras de estado sin que queden correlacionadas.
 */
function splitmix32(estado: number): { estado: number; palabra: number } {
  const siguiente = (estado + 0x9e3779b9) >>> 0;
  let z = siguiente;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return { estado: siguiente, palabra: (z ^ (z >>> 15)) >>> 0 };
}

/**
 * Semilla de 128 bits (cuatro palabras de 32) a partir de un texto, por
 * FNV-1a + splitmix32. Determinista y estable entre plataformas: no depende
 * del orden de bytes de la máquina ni de la versión del motor de JS.
 *
 * El estado TODO A CERO es el punto fijo de xorshift (generaría ceros para
 * siempre), así que se fuerza un bit si sale.
 */
export function semillaDesde(texto: string): [number, number, number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0;
  }
  let estado = h;
  const palabras: number[] = [];
  for (let i = 0; i < 4; i++) {
    const paso = splitmix32(estado);
    estado = paso.estado;
    palabras.push(paso.palabra);
  }
  const cero = palabras[0] | palabras[1] | palabras[2] | palabras[3];
  if (cero === 0) palabras[0] = 1;
  return [palabras[0], palabras[1], palabras[2], palabras[3]];
}

/**
 * Generador xorshift128+ sembrado con `texto`. Dos llamadas con el mismo
 * texto dan exactamente la misma secuencia.
 */
export function xorshift128plus(texto: string): Aleatorio {
  const [a0, a1, b0, b1] = semillaDesde(texto);
  // s[0] = A (alta, baja) · s[1] = B (alta, baja)
  let ah = a0 >>> 0;
  let al = a1 >>> 0;
  let bh = b0 >>> 0;
  let bl = b1 >>> 0;

  return {
    uniforme(): number {
      // s1 = s[0] · s0 = s[1] · resultado = s0 + s1
      let x1h = ah;
      let x1l = al;
      const x0h = bh;
      const x0l = bl;

      const suma = x0l + x1l; // < 2^33: exacto en un double
      const rl = suma >>> 0;
      const rh = (x0h + x1h + (suma > 0xffffffff ? 1 : 0)) >>> 0;

      ah = x0h;
      al = x0l;

      // s1 ^= s1 << 23
      const dh = ((x1h << 23) | (x1l >>> 9)) >>> 0;
      const dl = (x1l << 23) >>> 0;
      x1h = (x1h ^ dh) >>> 0;
      x1l = (x1l ^ dl) >>> 0;

      // s[1] = s1 ^ s0 ^ (s1 >> 17) ^ (s0 >> 26)
      const p17h = x1h >>> 17;
      const p17l = ((x1l >>> 17) | (x1h << 15)) >>> 0;
      const p26h = x0h >>> 26;
      const p26l = ((x0l >>> 26) | (x0h << 6)) >>> 0;
      bh = (x1h ^ x0h ^ p17h ^ p26h) >>> 0;
      bl = (x1l ^ x0l ^ p17l ^ p26l) >>> 0;

      // Los 53 bits ALTOS del entero de 64 —toda la mantisa que un double
      // puede llevar— sin saltarse ninguno por el camino: el valor completo es
      // rh·2^32 + rl, y sus 53 bits altos son rh·2^21 + (rl >>> 11). Ambos
      // sumandos y su suma caben exactos en un double.
      return ((rh >>> 0) * DOS_21 + (rl >>> 11)) / DOS_53;
    },
  };
}

/** Normal estándar por Box–Muller. Dos uniformes por número. */
export function normalEstandar(rng: Aleatorio): number {
  // `1 - u` para que el argumento del logaritmo nunca sea 0.
  const u1 = 1 - rng.uniforme();
  const u2 = rng.uniforme();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Gamma(forma, 1) por Marsaglia–Tsang (2000). Solo se usa con forma >= 1,
 * que es lo único que produce la Beta-PERT (sus dos parámetros valen 1 + algo
 * no negativo), así que no hace falta el arranque de Johnk para forma < 1.
 *
 * Es RECHAZO: el número de uniformes consumidos varía. Sigue siendo
 * determinista porque la secuencia de llamadas es siempre la misma.
 */
export function gammaEstandar(rng: Aleatorio, forma: number): number {
  const a = Math.max(1, forma);
  const d = a - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Guarda de cordura: con forma >= 1 la aceptación es > 95% por vuelta, así
  // que 1000 intentos es imposible salvo que el generador esté roto.
  for (let intento = 0; intento < 1000; intento++) {
    let x = 0;
    let v = 0;
    do {
      x = normalEstandar(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.uniforme();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // inalcanzable en la práctica; devuelve la moda antes que colgarse
}

/** Peso de la moda en la PERT clásica. Con λ = 4, media = (o + 4m̃ + p)/6. */
export const LAMBDA_PERT = 4;

/**
 * Muestra de una Beta-PERT en [o, p] con moda m̃.
 *
 * Beta(α₁, α₂) reescalada, con α₁ = 1 + λ(m̃−o)/(p−o) y α₂ = 1 + λ(p−m̃)/(p−o).
 * Se genera como cociente de dos gammas, que es exacto (no aproximado).
 *
 * ⚠️ La varianza REAL de esta Beta es (μ−o)(p−μ)/(λ+3), un ~13% mayor que la
 * σ = (p−o)/6 que usa la forma cerrada. Las dos son la PERT clásica; la
 * segunda es la aproximación de libro de texto. La diferencia se MIDE en
 * `scripts/verificar-probabilidad.ts` y queda muy por debajo del 8% que se
 * exige entre Monte Carlo y forma cerrada, porque el ancho total lo domina el
 * factor común σ_K.
 */
export function betaPert(rng: Aleatorio, o: number, m: number, p: number): number {
  const rango = p - o;
  if (!(rango > 0)) return m;
  const moda = Math.min(Math.max(m, o), p);
  const a1 = 1 + (LAMBDA_PERT * (moda - o)) / rango;
  const a2 = 1 + (LAMBDA_PERT * (p - moda)) / rango;
  const g1 = gammaEstandar(rng, a1);
  const g2 = gammaEstandar(rng, a2);
  const suma = g1 + g2;
  if (!(suma > 0)) return moda;
  return o + (rango * g1) / suma;
}

/**
 * Factor común K ~ LogNormal(−σ²/2, σ²): media EXACTAMENTE 1, para que
 * multiplicar por él no mueva el centro de la obra, solo la abra.
 *
 * Es el clima, la caja del cliente y esta cuadrilla en concreto: causas que
 * afectan a TODAS las tareas a la vez y que por eso no se promedian.
 */
export function factorComun(rng: Aleatorio, sigma: number): number {
  if (!(sigma > 0)) return 1;
  return Math.exp(sigma * normalEstandar(rng) - (sigma * sigma) / 2);
}
