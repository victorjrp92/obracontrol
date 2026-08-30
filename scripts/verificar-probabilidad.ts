// ─────────────────────────────────────────────────────────────────────────
// Verificación de la DISTRIBUCIÓN DE PROBABILIDAD de la duración
// (`src/lib/cronograma/probabilidad.ts`, `montecarlo.ts`, `aleatorio.ts`,
// `normal.ts`, `flujo.ts`, `fechas.ts` — leaf-3.5, la última fase del motor).
//
// No hay test runner en el proyecto: este script ES la suite, en asserts
// planos, igual que `verificar-reglas-alerta.ts`.
//
// EL DEFECTO QUE SE VERIFICA CERRADO. El motor devolvía `{min, probable,
// max}` como tres escenarios COMONOTÓNICOS —todas las tareas rápidas a la
// vez, todas lentas a la vez—, o sea correlación perfecta. Se notaba: el
// ancho relativo salía PLANO con 9, 18, 36, 72, 144 y 288 tareas. Con errores
// parcialmente independientes tiene que DECRECER hacia un piso. Y esos tres
// números no eran percentiles de nada, así que era imposible decir «80% de
// probabilidad de terminar antes del…».
//
// Qué verifica:
//   1. Φ (Abramowitz–Stegun 7.1.26) contra valores conocidos de la normal, y
//      `zDe` como su inversa exacta.
//   2. PERT por tarea: μ = (o+4m̃+p)/6, σ = (p−o)/6, y el ensanchado de las
//      tareas sin rendimiento investigado.
//   3. El PRNG xorshift128+: determinista, uniforme, y sin `Math.random` ni
//      reloj en ninguna línea del módulo.
//   4. La forma cerrada del factor común: el piso irreducible es σ_K.
//   5. LA CURVA — la evidencia central: ancho relativo contra 9/18/36/72/
//      144/288 tareas, antes y después.
//   6. Monte Carlo contra forma cerrada, dentro del 8%.
//   7. Monte Carlo DETERMINISTA: dos corridas, misma salida bit a bit.
//   8. Percentiles y `probabilidadFecha`: monótona y 0.80 clavado en el P80, y
//      que los dos componentes enseñan FECHAS y no conteos de días.
//   9. Los cuatro casos patrón, en FECHAS.
//
// Uso: `npx tsx scripts/verificar-probabilidad.ts`. Sale con 1 si algo falla.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  anchoRelativo,
  arcosDeRecurso,
  betaPert,
  calcularCPM,
  construirGrafo,
  distribucionCerrada,
  fechaLarga,
  grafoFijado,
  momentosPert,
  percentil,
  phi,
  probabilidadHasta,
  PRIOR_SIGMA_COMUN,
  programarSerial,
  pronosticoFechas,
  rangoAjustado,
  semillaDesde,
  xorshift128plus,
  zDe,
  type DistribucionDuracion,
  type EntradaNodo,
} from "@/lib/cronograma";
import { estimarDuracion, type EspacioEstim, type ResultadoDuracion } from "@/lib/estimar-duracion";
import { RENDIMIENTOS } from "@/lib/rendimientos";
import { sugerirTareas, type TipoObra } from "@/lib/plantillas-personal";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) {
    console.log(`  OK   ${descripcion}`);
  } else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

/** Iguales dentro de una tolerancia absoluta. */
function cerca(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** Iguales dentro de una tolerancia RELATIVA (fracción, no porcentaje). */
function cercaRel(a: number, b: number, tol: number): boolean {
  const escala = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return Math.abs(a - b) / escala <= tol;
}

function col(texto: string, ancho: number): string {
  return texto.padStart(ancho);
}

console.log("Distribución de probabilidad de la duración (leaf-3.5)\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Φ — Abramowitz & Stegun 7.1.26, error < 1.5e-7");

// Valores de tabla de la normal estándar (7 decimales).
const TABLA_PHI: [number, number][] = [
  [-3, 0.0013499],
  [-2.5758293, 0.005],
  [-1.959964, 0.025],
  [-1.6448536, 0.05],
  [-1, 0.1586553],
  [-0.5, 0.3085375],
  [0, 0.5],
  [0.5, 0.6914625],
  [0.8416212, 0.8],
  [1, 0.8413447],
  [1.6448536, 0.95],
  [1.959964, 0.975],
  [2.5758293, 0.995],
  [3, 0.9986501],
];
let peorPhi = 0;
for (const [z, esperado] of TABLA_PHI) {
  peorPhi = Math.max(peorPhi, Math.abs(phi(z) - esperado));
}
console.log(`       peor error de Φ sobre 14 puntos de tabla: ${peorPhi.toExponential(2)}`);
verificar(`Φ contra 14 valores conocidos, error < 1.5e-7 (peor: ${peorPhi.toExponential(2)})`, peorPhi < 1.5e-7);
verificar(
  `Φ(0) = 0.5 salvo el escalón de 1e-9 del origen (obtenido ${phi(0).toFixed(10)}) — los cinco coeficientes de A&S suman 0.999999999, no 1`,
  cerca(phi(0), 0.5, 1e-9),
);
verificar(
  "simetría Φ(−z) = 1 − Φ(z) en 200 puntos",
  Array.from({ length: 200 }, (_, i) => -5 + i * 0.05).every((z) =>
    cerca(phi(-z), 1 - phi(z), 2e-7),
  ),
);
let monotonaPhi = true;
for (let z = -8; z <= 8; z += 0.001) {
  if (phi(z + 0.001) < phi(z)) monotonaPhi = false;
}
verificar("Φ es monótona no decreciente en [−8, 8] (16 000 pasos)", monotonaPhi);
verificar("Φ(−40) → 0 y Φ(40) → 1 (colas)", phi(-40) >= 0 && phi(-40) < 1e-12 && phi(40) === 1);

console.log("\n   zDe — inversa de Φ por bisección sobre la PROPIA Φ");
verificar(`zDe(0.5) = 0 (obtenido ${zDe(0.5).toExponential(2)})`, cerca(zDe(0.5), 0, 1e-9));
verificar(`zDe(0.80) ≈ 0.8416212 (obtenido ${zDe(0.8).toFixed(7)})`, cerca(zDe(0.8), 0.8416212, 1e-5));
verificar(`zDe(0.95) ≈ 1.6448536 (obtenido ${zDe(0.95).toFixed(7)})`, cerca(zDe(0.95), 1.6448536, 1e-5));
const CUANTILES = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);
const peorVuelta = Math.max(...CUANTILES.map((q) => Math.abs(phi(zDe(q)) - q)));
const peorVueltaLejosDelOrigen = Math.max(
  ...CUANTILES.filter((q) => q !== 0.5).map((q) => Math.abs(phi(zDe(q)) - q)),
);
verificar(
  `Φ(zDe(q)) = q para q = .01 .. .99 — el ida y vuelta cierra (peor: ${peorVuelta.toExponential(1)}, y ${peorVueltaLejosDelOrigen.toExponential(1)} fuera de la mediana)`,
  peorVuelta < 1e-9 && peorVueltaLejosDelOrigen < 1e-15,
);
verificar(
  `en el P80 —el que sostiene la promesa comercial— el ida y vuelta es EXACTO: ${Math.abs(phi(zDe(0.8)) - 0.8).toExponential(1)}`,
  cerca(phi(zDe(0.8)), 0.8, 1e-15),
);
verificar("zDe(0) = −∞ y zDe(1) = +∞", zDe(0) === -Infinity && zDe(1) === Infinity);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. PERT por tarea — μ = (o + 4·m̃ + p)/6 · σ = (p − o)/6");

const m1 = momentosPert({ o: 2, m: 5, p: 14 });
verificar(`μ(2, 5, 14) = 6 (obtenido ${m1.media})`, cerca(m1.media, 6, 1e-12));
verificar(`σ(2, 5, 14) = 2 (obtenido ${m1.sigma})`, cerca(m1.sigma, 2, 1e-12));
const m2 = momentosPert({ o: 4, m: 4, p: 4 });
verificar("un rango degenerado (o = m̃ = p) tiene σ = 0", m2.sigma === 0 && m2.media === 4);
verificar(
  "μ es lineal en el rango: μ(k·o, k·m, k·p) = k·μ",
  cerca(momentosPert({ o: 20, m: 50, p: 140 }).media, 60, 1e-9),
);

console.log("\n   Tareas SIN rendimiento investigado: el rango se ENSANCHA ×1.5");
const base = { o: 0.7, m: 1, p: 1.5 };
const ancho = rangoAjustado(base, false);
verificar(
  `σ sube exactamente ×1.5 (${momentosPert(base).sigma.toFixed(4)} → ${momentosPert(ancho).sigma.toFixed(4)})`,
  cercaRel(momentosPert(ancho).sigma, 1.5 * momentosPert(base).sigma, 1e-12),
);
verificar("la MODA no se mueve al ensanchar (sigue siendo lo más probable)", ancho.m === base.m);
verificar("con dato, el rango se devuelve intacto", rangoAjustado(base, true) === base);
verificar(
  "el optimista nunca baja de 0: una tarea no dura menos que cero",
  rangoAjustado({ o: 0.1, m: 0.2, p: 5 }, false).o >= 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. El azar es DETERMINISTA — xorshift128+ sembrado con el id del proyecto");

const rngA = xorshift128plus("proyecto-42");
const rngB = xorshift128plus("proyecto-42");
const rngC = xorshift128plus("proyecto-43");
const serieA = Array.from({ length: 500 }, () => rngA.uniforme());
const serieB = Array.from({ length: 500 }, () => rngB.uniforme());
const serieC = Array.from({ length: 500 }, () => rngC.uniforme());
verificar(
  "misma semilla → misma secuencia, bit a bit (500 números)",
  serieA.every((x, i) => x === serieB[i]),
);
verificar("otra semilla → otra secuencia", serieA.some((x, i) => x !== serieC[i]));
verificar("todos los uniformes caen en [0, 1)", serieA.every((x) => x >= 0 && x < 1));
verificar(
  "la semilla depende del texto entero (no solo del primer carácter)",
  JSON.stringify(semillaDesde("obra-1")) !== JSON.stringify(semillaDesde("obra-2")),
);
verificar("una semilla es estable entre llamadas", JSON.stringify(semillaDesde("x")) === JSON.stringify(semillaDesde("x")));

// La emulación de 64 bits con dos palabras de 32 es el único trozo del módulo
// donde un desplazamiento mal puesto no da error, solo da OTRO generador. Se
// contrasta contra una implementación de referencia en BigInt —lenta, pero
// literal— y tienen que salir los mismos bits.
// (Sin literales `1n`: el `target` del proyecto es ES2017 y `tsc` los rechaza.
// `BigInt(1)` es lo mismo y compila.)
const UNO = BigInt(1);
const B11 = BigInt(11);
const B17 = BigInt(17);
const B23 = BigInt(23);
const B26 = BigInt(26);
const B32 = BigInt(32);
const MASCARA_64 = (UNO << BigInt(64)) - UNO;
function xorshiftReferencia(texto: string): () => number {
  const [a0, a1, b0, b1] = semillaDesde(texto);
  let A = ((BigInt(a0) << B32) | BigInt(a1)) & MASCARA_64;
  let B = ((BigInt(b0) << B32) | BigInt(b1)) & MASCARA_64;
  return () => {
    let s1 = A;
    const s0 = B;
    const resultado = (s0 + s1) & MASCARA_64;
    A = s0;
    s1 ^= (s1 << B23) & MASCARA_64;
    B = (s1 ^ s0 ^ (s1 >> B17) ^ (s0 >> B26)) & MASCARA_64;
    return Number(resultado >> B11) / 9007199254740992;
  };
}
const rngRapido = xorshift128plus("obra-42");
const rngLento = xorshiftReferencia("obra-42");
let identicos = 0;
for (let i = 0; i < 10000; i++) {
  if (rngRapido.uniforme() === rngLento()) identicos++;
}
verificar(
  `la emulación de 64 bits con palabras de 32 da los MISMOS bits que una referencia en BigInt (${identicos}/10000)`,
  identicos === 10000,
);

const rngU = xorshift128plus("uniformidad");
const N_U = 200000;
const bins = new Array(10).fill(0);
let suma = 0;
let suma2 = 0;
for (let i = 0; i < N_U; i++) {
  const x = rngU.uniforme();
  suma += x;
  suma2 += x * x;
  bins[Math.min(9, Math.floor(x * 10))]++;
}
const mediaU = suma / N_U;
const varU = suma2 / N_U - mediaU * mediaU;
const peorBin = Math.max(...bins.map((b) => Math.abs(b / N_U - 0.1)));
console.log(
  `       ${N_U} números: media ${mediaU.toFixed(5)} (0.5) · varianza ${varU.toFixed(5)} (0.08333) · peor decil ${(peorBin * 100).toFixed(3)} pp`,
);
verificar(`la media tiende a 0.5 (${mediaU.toFixed(5)})`, cerca(mediaU, 0.5, 0.003));
verificar(`la varianza tiende a 1/12 (${varU.toFixed(5)})`, cerca(varU, 1 / 12, 0.002));
verificar(`los 10 deciles pesan ~10% cada uno (peor: ${(peorBin * 100).toFixed(3)} pp)`, peorBin < 0.005);

console.log("\n   Beta-PERT: la media del muestreo es la media PERT");
const rngP = xorshift128plus("beta");
const N_B = 100000;
let sB = 0;
let sB2 = 0;
for (let i = 0; i < N_B; i++) {
  const x = betaPert(rngP, 2, 5, 14);
  sB += x;
  sB2 += x * x;
}
const mediaB = sB / N_B;
const sdB = Math.sqrt(sB2 / N_B - mediaB * mediaB);
// Varianza EXACTA de la Beta-PERT clásica (λ = 4): (μ−o)(p−μ)/(λ+3).
const sdExacta = Math.sqrt(((6 - 2) * (14 - 6)) / 7);
console.log(
  `       ${N_B} muestras de PERT(2, 5, 14): media ${mediaB.toFixed(4)} (6) · sd ${sdB.toFixed(4)} · sd exacta ${sdExacta.toFixed(4)} · σ de libro (p−o)/6 = 2.0000`,
);
verificar(`la media muestral es la media PERT (${mediaB.toFixed(4)} vs 6)`, cerca(mediaB, 6, 0.03));
verificar(
  `la sd muestral es la de la Beta-PERT exacta (${sdB.toFixed(4)} vs ${sdExacta.toFixed(4)})`,
  cercaRel(sdB, sdExacta, 0.02),
);
verificar(
  `la σ de libro (p−o)/6 queda un ~13% por debajo de la exacta — diferencia conocida y acotada`,
  sdExacta / 2 > 1.05 && sdExacta / 2 < 1.2,
);

console.log("\n   El módulo no toca el reloj ni Math.random");
const DIR_CRONOGRAMA = fileURLToPath(new URL("../src/lib/cronograma/", import.meta.url));
const FUENTES = readdirSync(DIR_CRONOGRAMA).filter((f) => f.endsWith(".ts"));
const IMPUROS = [/Math\.random/, /Date\.now/, /new Date\(\s*\)/, /performance\.now/];
const sucios: string[] = [];
for (const f of FUENTES) {
  const texto = readFileSync(DIR_CRONOGRAMA + f, "utf8");
  // Se ignoran los comentarios: el módulo EXPLICA por qué no usa Math.random.
  const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (IMPUROS.some((re) => re.test(codigo))) sucios.push(f);
}
verificar(
  `ninguno de los ${FUENTES.length} módulos de cronograma usa Math.random, Date.now ni new Date() (${sucios.join(", ") || "ninguno"})`,
  sucios.length === 0,
);

console.log("\n   La materia prima: los rangos de la tabla de rendimientos");
const RENDIMIENTOS_ROTOS = Object.values(RENDIMIENTOS).filter(
  (r) => !(r.min <= r.porDia && r.porDia <= r.max) || !(r.min > 0),
);
verificar(
  `las ${Object.keys(RENDIMIENTOS).length} claves cumplen min ≤ porDia ≤ max con min > 0 (si no, la PERT saldría con σ negativa)`,
  RENDIMIENTOS_ROTOS.length === 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. Forma cerrada — CV²[D] = CV_S²·e^{σ_K²} + (e^{σ_K²} − 1)");

verificar(`el prior del factor común es σ_K = 0.25`, PRIOR_SIGMA_COMUN === 0.25);

const soloIdio = distribucionCerrada({
  media: 100,
  sigmaIdiosincratico: 10,
  sigmaComun: 0,
  cobertura: 1,
  tareasEnCadena: 10,
});
verificar(
  `con σ_K = 0 el ancho es solo el idiosincrático (CV = 0.10, σ_ln = ${soloIdio.sigmaLn.toFixed(4)})`,
  cercaRel(soloIdio.cv, 0.1, 1e-9),
);
const soloComun = distribucionCerrada({
  media: 100,
  sigmaIdiosincratico: 0,
  sigmaComun: 0.25,
  cobertura: 1,
  tareasEnCadena: 999,
});
verificar(
  `sin error de tarea, σ_ln = σ_K EXACTO: el piso irreducible (${soloComun.sigmaLn.toFixed(6)})`,
  cerca(soloComun.sigmaLn, 0.25, 1e-9),
);
verificar(
  "la media se conserva: E[K·S] = E[S] porque E[K] = 1",
  cercaRel(soloComun.media, 100, 1e-9) && cercaRel(soloIdio.media, 100, 1e-9),
);
const mezcla = distribucionCerrada({
  media: 100,
  sigmaIdiosincratico: 10,
  sigmaComun: 0.25,
  cobertura: 1,
  tareasEnCadena: 10,
});
const expK = Math.exp(0.25 * 0.25);
verificar(
  "la identidad se cumple término a término: CV² = CV_S²·e^{σ_K²} + (e^{σ_K²} − 1)",
  cercaRel(mezcla.cv ** 2, 0.1 ** 2 * expK + (expK - 1), 1e-9),
);
verificar(
  `el término común NO decae: con σ_S = 0 y un millón de tareas el ancho sigue siendo ${soloComun.sigmaLn.toFixed(3)}`,
  distribucionCerrada({ media: 1e6, sigmaIdiosincratico: 0, sigmaComun: 0.25, cobertura: 1, tareasEnCadena: 1e6 })
    .sigmaLn > 0.249,
);
verificar(
  "más error idiosincrático nunca estrecha el intervalo (monotonía en σ_S)",
  [0, 1, 5, 10, 20, 40].every((s, i, arr) =>
    i === 0
      ? true
      : distribucionCerrada({ media: 100, sigmaIdiosincratico: s, sigmaComun: 0.25, cobertura: 1, tareasEnCadena: 10 })
          .sigmaLn >
        distribucionCerrada({ media: 100, sigmaIdiosincratico: arr[i - 1], sigmaComun: 0.25, cobertura: 1, tareasEnCadena: 10 })
          .sigmaLn,
  ),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. LA CURVA — ancho relativo contra 9 · 18 · 36 · 72 · 144 · 288 tareas");
console.log("   (la evidencia central del leaf: hoy es PLANO, tiene que DECRECER)\n");

// Obra sintética de 9 tareas por espacio, TODAS con rendimiento investigado,
// replicada 1·2·4·8·16·32 veces. Espacios idénticos: lo único que cambia
// entre filas es el NÚMERO DE TAREAS, que es justo lo que se está midiendo.
const TAREAS_9 = [
  "Demolición de enchape",
  "Mampostería de muro",
  "Pañete de paredes",
  "Estuco paredes",
  "Estuco de techo",
  "Pintura base",
  "Pintura final",
  "Enchape de piso",
  "Instalación de puerta",
];
function obraDe(espacios: number): EspacioEstim[] {
  return Array.from({ length: espacios }, (_, i) => ({
    id: `e${i}`,
    nombre: `Espacio ${i}`,
    metraje: 12,
    tareas: TAREAS_9.map((nombre) => ({ nombre, dias: 1, on: true })),
  }));
}

interface Fila {
  n: number;
  viejo: number;
  sigmaLn: number;
  idio: number;
  p10a95: number;
  cadena: number;
  res: ResultadoDuracion;
}
const CURVA: Fila[] = [1, 2, 4, 8, 16, 32].map((k) => {
  const espacios = obraDe(k);
  const res = estimarDuracion(espacios, { cuadrillas: 1 });
  const sinComun = estimarDuracion(espacios, { cuadrillas: 1, sigmaComun: 0 });
  const d = res.probabilidad;
  return {
    n: 9 * k,
    viejo: (res.totalDias.max - res.totalDias.min) / res.totalDias.probable,
    sigmaLn: anchoRelativo(d),
    idio: sinComun.probabilidad.sigmaLn,
    p10a95: (d.p95 - d.p10) / d.p50,
    cadena: res.cronograma.cadenaRecursos.length,
    res,
  };
});

console.log(
  "   " +
    col("tareas", 7) +
    col("ANTES (max−min)/prob", 22) +
    col("AHORA σ_ln", 12) +
    col("idiosincrático", 16) +
    col("(p95−p10)/p50", 15) +
    col("cadena", 8) +
    col("p50 (d)", 9),
);
for (const f of CURVA) {
  console.log(
    "   " +
      col(String(f.n), 7) +
      col(`${(f.viejo * 100).toFixed(1)}%`, 22) +
      col(f.sigmaLn.toFixed(4), 12) +
      col(f.idio.toFixed(4), 16) +
      col(`${(f.p10a95 * 100).toFixed(1)}%`, 15) +
      col(String(f.cadena), 8) +
      col(f.res.probabilidad.p50.toFixed(1), 9),
  );
}
console.log("");

const viejos = CURVA.map((f) => f.viejo);
const rangoViejo = Math.max(...viejos) - Math.min(...viejos);
verificar(
  `ANTES: el ancho es PLANO — varía solo ${(rangoViejo * 100).toFixed(1)} pp entre 9 y 288 tareas (${(Math.min(...viejos) * 100).toFixed(0)}%–${(Math.max(...viejos) * 100).toFixed(0)}%)`,
  rangoViejo < 0.1 && Math.min(...viejos) > 0.7,
);
verificar(
  "ANTES: el ancho ni siquiera es un percentil — min/max suponen correlación perfecta",
  viejos.every((v) => v > 0.7),
);
verificar(
  "AHORA: el ancho relativo DECRECE en cada duplicación del número de tareas",
  CURVA.every((f, i) => i === 0 || f.sigmaLn < CURVA[i - 1].sigmaLn),
);
verificar(
  `AHORA: se estabiliza en σ_K — con 288 tareas σ_ln = ${CURVA[5].sigmaLn.toFixed(4)} contra σ_K = 0.25`,
  cercaRel(CURVA[5].sigmaLn, PRIOR_SIGMA_COMUN, 0.005),
);
verificar(
  `y NO baja de σ_K por muchas tareas que haya: el piso es irreducible (${CURVA[5].sigmaLn.toFixed(4)} ≥ 0.25)`,
  CURVA[5].sigmaLn >= PRIOR_SIGMA_COMUN,
);

console.log("\n   El término idiosincrático AISLADO (σ_K = 0): tiene que decaer como 1/√N");
const idio = CURVA.map((f) => f.idio);
verificar(
  `decrece siempre y cae ×${(idio[0] / idio[5]).toFixed(2)} de 9 a 288 tareas (32× más tareas ⇒ ~√32 = 5.7×)`,
  idio.every((v, i) => i === 0 || v < idio[i - 1]) && idio[0] / idio[5] > 3,
);
const desvios = CURVA.map((f) => f.idio / (idio[0] * Math.sqrt(9 / f.n)));
console.log(
  "   observado/predicho por 1/√N: " + desvios.map((d) => d.toFixed(2)).join(" · "),
);
verificar(
  `el decaimiento sigue 1/√N dentro de ±50% en las seis medidas (peor: ×${Math.max(...desvios).toFixed(2)})`,
  desvios.every((d) => d > 0.66 && d < 1.5),
);
verificar(
  "la cadena crítica DE RECURSOS crece con la obra (con una cuadrilla, todas las tareas cuentan)",
  CURVA.every((f, i) => i === 0 || f.cadena > CURVA[i - 1].cadena) && CURVA[5].cadena >= 0.9 * 288,
);

console.log(
  "\n   Lectura honesta: el ancho TOTAL apenas se mueve (25.2% → 25.0%) porque con σ_K = 0.25",
);
console.log(
  "   el factor común domina en cualquier tamaño de obra. Lo que cambia es que ahora esos",
);
console.log(
  "   números SON percentiles, y que la parte que sí se puede promediar se promedia.",
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. Monte Carlo contra forma cerrada — dentro del 8%");

const TIPO: TipoObra = "REFORMA";
function esp(id: string, nombre: string, plantilla: string, metraje?: number): EspacioEstim {
  return {
    id,
    nombre,
    ...(metraje ? { metraje } : {}),
    tareas: sugerirTareas(plantilla, TIPO).map((t) => ({
      nombre: t.nombre,
      dias: t.tiempo_acordado_dias,
      on: true,
    })),
  };
}
/** Los cuatro casos patrón, IDÉNTICOS a los de `verificar-duracion-calibracion.ts`
 *  (mismos espacios y mismo `areaTotal`), para que las cifras sean comparables:
 *  baño 9 d · cocina 18 d · apto 62 d · casa 116 d. */
interface CasoPatron {
  nombre: string;
  espacios: EspacioEstim[];
  areaTotal?: number;
}
const PATRON: CasoPatron[] = [
  { nombre: "Baño 5 m²", espacios: [esp("b1", "Baño", "Baño", 5)] },
  { nombre: "Cocina 9 m²", espacios: [esp("k1", "Cocina", "Cocina", 9)] },
  {
    nombre: "Apto 60 m²",
    areaTotal: 60,
    espacios: [
      esp("a1", "Cocina", "Cocina"),
      esp("a2", "Baño", "Baño"),
      esp("a3", "Sala", "Sala"),
      esp("a4", "Habitación", "Habitación"),
      esp("a5", "Estudio", "Estudio"),
      esp("a6", "Balcón / Terraza", "Balcón / Terraza"),
    ],
  },
  {
    nombre: "Casa 120 m²",
    areaTotal: 120,
    espacios: [
      esp("c1", "Cocina", "Cocina"),
      esp("c2", "Baño 1", "Baño"),
      esp("c3", "Baño 2", "Baño"),
      esp("c4", "Sala", "Sala"),
      esp("c5", "Comedor", "Comedor"),
      esp("c6", "Habitación 1", "Habitación"),
      esp("c7", "Habitación 2", "Habitación"),
      esp("c8", "Estudio", "Estudio"),
      esp("c9", "Lavandería", "Lavandería"),
      esp("c10", "Balcón / Terraza", "Balcón / Terraza"),
    ],
  },
];

/** Corre el motor sobre un caso patrón conservando su `areaTotal`. */
function correrPatron(
  caso: CasoPatron,
  extra: { montecarlo?: { semilla: string } } = {},
): ResultadoDuracion {
  return estimarDuracion(caso.espacios, {
    cuadrillas: 1,
    ...(caso.areaTotal ? { areaTotal: caso.areaTotal } : {}),
    ...extra,
  });
}

console.log(
  "   " +
    col("caso", 14) +
    col("p50 cerrada", 13) +
    col("p50 MC", 9) +
    col("p80 cerrada", 13) +
    col("p80 MC", 9) +
    col("p95 MC", 9) +
    col("desvío", 9) +
    col("sesgo fusión", 14),
);
let peorDesvio = 0;
for (const caso of PATRON) {
  const nombre = caso.nombre;
  const cerrada = correrPatron(caso).probabilidad;
  const conMC = correrPatron(caso, { montecarlo: { semilla: nombre } });
  const mc = conMC.probabilidad;
  const emp = conMC.montecarlo!.empiricos;
  const desvio = Math.max(
    Math.abs(mc.p10 - cerrada.p10) / cerrada.p10,
    Math.abs(mc.p50 - cerrada.p50) / cerrada.p50,
    Math.abs(mc.p80 - cerrada.p80) / cerrada.p80,
    Math.abs(mc.p95 - cerrada.p95) / cerrada.p95,
    Math.abs(emp.p80 - cerrada.p80) / cerrada.p80,
  );
  peorDesvio = Math.max(peorDesvio, desvio);
  console.log(
    "   " +
      col(nombre, 14) +
      col(cerrada.p50.toFixed(2), 13) +
      col(mc.p50.toFixed(2), 9) +
      col(cerrada.p80.toFixed(2), 13) +
      col(mc.p80.toFixed(2), 9) +
      col(mc.p95.toFixed(2), 9) +
      col(`${(desvio * 100).toFixed(2)}%`, 9) +
      col(`${(conMC.montecarlo!.sesgoFusion * 100).toFixed(2)}%`, 14),
  );
}
verificar(
  `los cuatro casos patrón coinciden dentro del 8% (peor desvío: ${(peorDesvio * 100).toFixed(2)}%)`,
  peorDesvio < 0.08,
);

console.log("\n   Donde el sesgo de fusión SÍ aparece: más cuadrillas = más frentes que se juntan");
console.log(
  "   " + col("cuadrillas", 11) + col("cadena", 8) + col("sesgo fusión", 14) + col("p80 cerrada", 13) + col("p80 MC", 9) + col("desvío", 9),
);
const OBRA_16 = obraDe(16);
let peorDesvioC = 0;
let sesgoMaximo = 0;
for (const c of [1, 2, 4, 8, 16]) {
  const cerrada = estimarDuracion(OBRA_16, { cuadrillas: c }).probabilidad;
  const conMC = estimarDuracion(OBRA_16, { cuadrillas: c, montecarlo: { semilla: `c${c}` } });
  const desvio = Math.abs(conMC.probabilidad.p80 - cerrada.p80) / cerrada.p80;
  peorDesvioC = Math.max(peorDesvioC, desvio);
  sesgoMaximo = Math.max(sesgoMaximo, conMC.montecarlo!.sesgoFusion);
  console.log(
    "   " +
      col(String(c), 11) +
      col(String(estimarDuracion(OBRA_16, { cuadrillas: c }).cronograma.cadenaRecursos.length), 8) +
      col(`${(conMC.montecarlo!.sesgoFusion * 100).toFixed(2)}%`, 14) +
      col(cerrada.p80.toFixed(2), 13) +
      col(conMC.probabilidad.p80.toFixed(2), 9) +
      col(`${(desvio * 100).toFixed(2)}%`, 9),
  );
}
verificar(
  `también con 1–16 cuadrillas coinciden dentro del 8% (peor: ${(peorDesvioC * 100).toFixed(2)}%)`,
  peorDesvioC < 0.08,
);
verificar(
  `el sesgo de fusión E[max] > max E[·] aparece al haber frentes en paralelo (máximo medido ${(sesgoMaximo * 100).toFixed(2)}%) y es POSITIVO`,
  sesgoMaximo > 0.01,
);
verificar(
  "con UNA cuadrilla el sesgo es ~0: la obra es una cadena, y una cadena no tiene confluencias",
  Math.abs(
    estimarDuracion(OBRA_16, { cuadrillas: 1, montecarlo: { semilla: "c1" } }).montecarlo!
      .sesgoFusion,
  ) < 0.005,
);
console.log(
  "   (con 2000 iteraciones el error estándar de la media es ~0.1%, así que un «sesgo» de ±0.1%",
);
console.log("   con una sola cuadrilla es ruido de la simulación, no sesgo de fusión.)");

// ─────────────────────────────────────────────────────────────────────────
console.log("\n7. Monte Carlo DETERMINISTA — misma semilla, misma salida");

const OBRA_MC = obraDe(8);
const corrida1 = estimarDuracion(OBRA_MC, { cuadrillas: 1, montecarlo: { semilla: "proyecto-77" } });
const corrida2 = estimarDuracion(OBRA_MC, { cuadrillas: 1, montecarlo: { semilla: "proyecto-77" } });
const otraSemilla = estimarDuracion(OBRA_MC, {
  cuadrillas: 1,
  montecarlo: { semilla: "proyecto-78" },
});
verificar(
  "dos corridas con la misma semilla dan el MISMO objeto, campo por campo",
  JSON.stringify(corrida1.probabilidad) === JSON.stringify(corrida2.probabilidad),
);
verificar(
  `y el mismo p80 hasta el último bit (${corrida1.probabilidad.p80})`,
  corrida1.probabilidad.p80 === corrida2.probabilidad.p80,
);
verificar(
  "otra semilla da otro resultado (si no, la simulación no estaría simulando)",
  otraSemilla.probabilidad.p80 !== corrida1.probabilidad.p80,
);
verificar(
  `pero muy parecido — dos semillas no pueden discrepar más del 3% con 2000 iteraciones (${(
    (Math.abs(otraSemilla.probabilidad.p80 - corrida1.probabilidad.p80) /
      corrida1.probabilidad.p80) *
    100
  ).toFixed(2)}%)`,
  Math.abs(otraSemilla.probabilidad.p80 - corrida1.probabilidad.p80) / corrida1.probabilidad.p80 <
    0.03,
);
verificar(
  "el motor entero sigue siendo puro: dos llamadas idénticas dan el mismo JSON",
  JSON.stringify(estimarDuracion(OBRA_MC, { cuadrillas: 1 })) ===
    JSON.stringify(estimarDuracion(OBRA_MC, { cuadrillas: 1 })),
);
verificar(
  `2000 iteraciones por defecto (${corrida1.montecarlo!.iteraciones})`,
  corrida1.montecarlo!.iteraciones === 2000,
);
verificar(
  "la simulación converge: 500 y 4000 iteraciones dan el mismo p80 dentro del 3%",
  cercaRel(
    estimarDuracion(OBRA_MC, { cuadrillas: 1, montecarlo: { semilla: "x", iteraciones: 500 } })
      .probabilidad.p80,
    estimarDuracion(OBRA_MC, { cuadrillas: 1, montecarlo: { semilla: "x", iteraciones: 4000 } })
      .probabilidad.p80,
    0.03,
  ),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n8. Percentiles y probabilidad de fecha");

const REF = correrPatron(PATRON[3]).probabilidad;
verificar(
  `los percentiles están ordenados: p10 ${REF.p10.toFixed(1)} < p50 ${REF.p50.toFixed(1)} < p80 ${REF.p80.toFixed(1)} < p95 ${REF.p95.toFixed(1)}`,
  REF.p10 < REF.p50 && REF.p50 < REF.p80 && REF.p80 < REF.p95,
);
verificar(
  `P(D ≤ p80) = 0.80 EXACTO (${Math.abs(probabilidadHasta(REF, REF.p80) - 0.8).toExponential(1)}) — el percentil cierra con su propia probabilidad`,
  cerca(probabilidadHasta(REF, REF.p80), 0.8, 1e-14),
);
verificar(
  "y lo mismo en p10, p50 y p95",
  cerca(probabilidadHasta(REF, REF.p10), 0.1, 1e-9) &&
    cerca(probabilidadHasta(REF, REF.p50), 0.5, 1e-9) &&
    cerca(probabilidadHasta(REF, REF.p95), 0.95, 1e-9),
);
verificar(
  "percentil(d, q) coincide con los cuatro percentiles guardados",
  cerca(percentil(REF, 0.1), REF.p10, 1e-9) &&
    cerca(percentil(REF, 0.8), REF.p80, 1e-9) &&
    cerca(percentil(REF, 0.95), REF.p95, 1e-9),
);
let monotona = true;
for (let x = 0.5; x <= 400; x += 0.25) {
  if (probabilidadHasta(REF, x + 0.25) < probabilidadHasta(REF, x)) monotona = false;
}
verificar("P(D ≤ x) es monótona no decreciente en x (1600 pasos de 0.25 días)", monotona);
verificar(
  "P(D ≤ 0) = 0 y P(D ≤ 10 000 días) = 1 — la probabilidad está acotada",
  probabilidadHasta(REF, 0) === 0 && cerca(probabilidadHasta(REF, 10000), 1, 1e-9),
);
verificar(
  `el p50 queda por DEBAJO de la media (${REF.p50.toFixed(1)} < ${REF.media.toFixed(1)}): la lognormal es asimétrica a la derecha, como una obra`,
  REF.p50 < REF.media,
);

console.log("\n   De días a FECHAS — la interfaz no vuelve a enseñar un conteo de días");
const INICIO = new Date(Date.UTC(2026, 8, 1)); // martes 1 de septiembre de 2026
const pron = pronosticoFechas(REF, { inicio: INICIO, diasHabilesSemana: 6 });
console.log(
  `       arranque 1 de septiembre de 2026 · P50 → ${fechaLarga(pron.fechaP50, INICIO)} · P80 → ${fechaLarga(pron.fechaP80, INICIO)} · P95 → ${fechaLarga(pron.fechaP95, INICIO)}`,
);
verificar(
  "las fechas van en orden: P50 ≤ P80 ≤ P95",
  pron.fechaP50.getTime() <= pron.fechaP80.getTime() &&
    pron.fechaP80.getTime() <= pron.fechaP95.getTime(),
);
verificar(
  `P(terminar el ${fechaLarga(pron.fechaP80, INICIO)}) ≥ 0.80 (${pron.probabilidadFecha(pron.fechaP80).toFixed(4)}) — redondear el percentil hacia arriba nunca incumple la promesa`,
  pron.probabilidadFecha(pron.fechaP80) >= 0.8,
);
verificar(
  `P(fecha P50) ≥ 0.50 (${pron.probabilidadFecha(pron.fechaP50).toFixed(4)}) y P(fecha P95) ≥ 0.95 (${pron.probabilidadFecha(pron.fechaP95).toFixed(4)})`,
  pron.probabilidadFecha(pron.fechaP50) >= 0.5 && pron.probabilidadFecha(pron.fechaP95) >= 0.95,
);
let monotonaFecha = true;
let previa = -1;
for (let d = 0; d < 400; d++) {
  const p = pron.probabilidadFecha(new Date(INICIO.getTime() + d * 86400000));
  if (p < previa) monotonaFecha = false;
  previa = p;
}
verificar("P(terminar antes de la fecha X) es monótona día a día (400 días seguidos)", monotonaFecha);
verificar(
  "el día de arranque tiene probabilidad 0 (no se termina una obra el día que empieza)",
  pron.probabilidadFecha(INICIO) === 0,
);
verificar(
  "una fecha anterior al arranque también da 0, no un negativo",
  pron.probabilidadFecha(new Date(Date.UTC(2026, 0, 1))) === 0,
);
verificar(
  `el año se escribe solo cuando NO es el de referencia ("${fechaLarga(new Date(Date.UTC(2027, 0, 19)), INICIO)}" vs "${fechaLarga(new Date(Date.UTC(2026, 9, 14)), INICIO)}")`,
  fechaLarga(new Date(Date.UTC(2027, 0, 19)), INICIO) === "19 de enero de 2027" &&
    fechaLarga(new Date(Date.UTC(2026, 9, 14)), INICIO) === "14 de octubre",
);

// ── G5: la interfaz enseña FECHAS, no conteos de días ────────────────────
console.log("\n   La interfaz: ni un conteo de días de entrega, ni un min/max sin apellido");
const COMPONENTES = ["ContraPronostico.tsx", "LineaTiempoObra.tsx"];
const DIR_COMPONENTES = fileURLToPath(new URL("../src/components/personal/", import.meta.url));
for (const nombre of COMPONENTES) {
  const texto = readFileSync(DIR_COMPONENTES + nombre, "utf8");
  const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  verificar(
    `${nombre} ya no lee \`totalDias\` — el contrato que consume es \`probabilidad\``,
    !codigo.includes("totalDias") && codigo.includes("probabilidad"),
  );
  verificar(
    `${nombre} enseña la entrega como FECHA (usa pronosticoFechas + fechaLarga)`,
    codigo.includes("pronosticoFechas") && codigo.includes("fechaLarga"),
  );
  verificar(
    `${nombre} no vuelve a escribir «días hábiles» en pantalla (era la ambigüedad de calendario)`,
    !codigo.includes("días hábiles"),
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n9. El grafo FIJADO — la cadena crítica es la de RECURSOS, no la del CPM");

function nodoP(id: string, espacioId: string, ordenFase: number, duracion: number): EntradaNodo {
  return {
    id,
    espacioId,
    nombre: id,
    fase: `f${ordenFase}`,
    ordenFase,
    duracion,
    gremio: "general",
    capEspacio: 1,
  };
}
const NODOS_4x5: EntradaNodo[] = [];
for (let e = 0; e < 4; e++) {
  for (let k = 0; k < 5; k++) NODOS_4x5.push(nodoP(`n${e}_${k}`, `e${e}`, k, 1 + (k % 3)));
}
const G_4x5 = construirGrafo({ nodos: NODOS_4x5 });
const PLAN_1 = programarSerial(G_4x5, { capacidad: 1 });
const FIJADO_1 = grafoFijado(G_4x5, PLAN_1);
const CPM_LIBRE = calcularCPM(G_4x5);
const CPM_FIJO = calcularCPM(FIJADO_1);
console.log(
  `       4 espacios × 5 tareas · CPM con cuadrillas infinitas ${CPM_LIBRE.makespan} d (cadena de ${CPM_LIBRE.rutaCritica.length}) · SGS con una cuadrilla ${PLAN_1.makespan} d (cadena de ${CPM_FIJO.rutaCritica.length})`,
);
verificar(
  `con UNA cuadrilla el CPM sobre el grafo fijado reproduce EXACTAMENTE el makespan del SGS (${CPM_FIJO.makespan} = ${PLAN_1.makespan})`,
  cerca(CPM_FIJO.makespan, PLAN_1.makespan, 1e-9),
);
verificar(
  `y su cadena crítica son las 20 tareas, no las 5 del CPM libre (${CPM_FIJO.rutaCritica.length} vs ${CPM_LIBRE.rutaCritica.length})`,
  CPM_FIJO.rutaCritica.length === 20 && CPM_LIBRE.rutaCritica.length === 5,
);
verificar(
  "los arcos de recurso no inventan precedencias: son 19 (una cadena de 20 nodos)",
  arcosDeRecurso(G_4x5, PLAN_1).length === 19,
);
verificar(
  "el grafo fijado conserva los nodos y solo AÑADE aristas",
  FIJADO_1.nodos.length === G_4x5.nodos.length && FIJADO_1.aristas.length > G_4x5.aristas.length,
);
verificar(
  "el grafo fijado sigue siendo acíclico (si no, `grafoFijado` habría lanzado)",
  FIJADO_1.prioridad.length === G_4x5.nodos.length,
);
verificar(
  "es determinista: dos construcciones dan las mismas aristas en el mismo orden",
  JSON.stringify(grafoFijado(G_4x5, PLAN_1).aristas) === JSON.stringify(FIJADO_1.aristas),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n10. Cobertura — el usuario tiene derecho a saber sobre cuánto dato descansa su fecha");

const CON_INVENTADAS: EspacioEstim[] = [
  {
    id: "x1",
    nombre: "Sala",
    metraje: 20,
    tareas: [
      { nombre: "Estuco paredes", dias: 2, on: true },
      { nombre: "Pintura final", dias: 2, on: true },
      { nombre: "Tratamiento acústico especial", dias: 3, on: true },
      { nombre: "Montaje escenográfico", dias: 3, on: true },
    ],
  },
];
const SIN_DATO = estimarDuracion(CON_INVENTADAS, { cuadrillas: 1 });
console.log(
  `       4 tareas, 2 sin rendimiento investigado → cobertura ${(SIN_DATO.probabilidad.cobertura * 100).toFixed(0)}%`,
);
verificar(
  `la cobertura viaja DENTRO de la distribución (${(SIN_DATO.probabilidad.cobertura * 100).toFixed(0)}%)`,
  SIN_DATO.probabilidad.cobertura === SIN_DATO.cobertura && SIN_DATO.probabilidad.cobertura < 1,
);
verificar(
  "y el σ de esas tareas va inflado: la misma obra con rendimiento sería más estrecha",
  SIN_DATO.probabilidad.cvIdiosincratico > 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n11. Los cuatro casos patrón, en FECHAS — lo que de verdad lee el usuario");
console.log(
  "   " +
    col("caso", 14) +
    col("ANTES min–prob–max", 20) +
    col("p50", 8) +
    col("p80", 8) +
    col("p95", 8) +
    col("fecha P50", 22) +
    col("fecha P80", 22),
);
const distribuciones: DistribucionDuracion[] = [];
for (const caso of PATRON) {
  const r = correrPatron(caso);
  const d = r.probabilidad;
  distribuciones.push(d);
  const p = pronosticoFechas(d, { inicio: INICIO });
  console.log(
    "   " +
      col(caso.nombre, 14) +
      col(`${r.totalDias.min}–${r.totalDias.probable}–${r.totalDias.max}`, 20) +
      col(d.p50.toFixed(1), 8) +
      col(d.p80.toFixed(1), 8) +
      col(d.p95.toFixed(1), 8) +
      col(fechaLarga(p.fechaP50, INICIO), 22) +
      col(fechaLarga(p.fechaP80, INICIO), 22),
  );
}
verificar(
  "el p50 de los cuatro casos sigue dentro de la banda de cordura del motor (±10% del total calibrado)",
  distribuciones.every((d, i) => cercaRel(d.p50, correrPatron(PATRON[i]).totalDias.probable, 0.1)),
);
verificar(
  "el p80 es SIEMPRE mayor que el p50 y menor que el p95 en los cuatro",
  distribuciones.every((d) => d.p80 > d.p50 && d.p80 < d.p95),
);

// ¿A QUÉ PERCENTIL correspondían el `min` y el `max` de antes? Si fueran una
// banda con significado, el mismo par de números tendría la misma cobertura en
// las cuatro obras. No la tiene: es la prueba directa de que no eran
// percentiles de nada.
console.log("\n   Qué percentil eran de verdad el `min` y el `max` de antes:");
const coberturasViejas: number[] = [];
for (let i = 0; i < PATRON.length; i++) {
  const r = correrPatron(PATRON[i]);
  const d = distribuciones[i];
  const qMin = probabilidadHasta(d, r.totalDias.min);
  const qMax = probabilidadHasta(d, r.totalDias.max);
  coberturasViejas.push(qMax - qMin);
  console.log(
    "   " +
      col(PATRON[i].nombre, 14) +
      col(`min = P${(qMin * 100).toFixed(0)}`, 12) +
      col(`max = P${(qMax * 100).toFixed(0)}`, 12) +
      col(`cubre ${((qMax - qMin) * 100).toFixed(0)}%`, 13),
  );
}
verificar(
  `el viejo min/max NO era un intervalo de confianza: su cobertura real varía entre ${(Math.min(...coberturasViejas) * 100).toFixed(0)}% y ${(Math.max(...coberturasViejas) * 100).toFixed(0)}% según el tamaño de la obra`,
  Math.max(...coberturasViejas) - Math.min(...coberturasViejas) > 0.03,
);
verificar(
  "y el viejo `max` no era el P80 que el producto quiere prometer: queda muy por encima en los cuatro",
  distribuciones.every((d, i) => correrPatron(PATRON[i]).totalDias.max > d.p80),
);
verificar(
  "una obra sin tareas no inventa una campana: distribución en cero",
  estimarDuracion([], {}).probabilidad.p80 === 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Distribución de probabilidad de la duración verificada sin errores.");
