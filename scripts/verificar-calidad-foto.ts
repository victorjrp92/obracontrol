/**
 * Verifica el control de calidad de foto en dispositivo (`src/lib/media/calidad-foto.ts`)
 * contra imágenes sintéticas generadas aquí mismo: uniforme (sin detalle),
 * alto contraste (nítida), casi negra, casi blanca, degradado suave, muro liso
 * con una grieta fina en una esquina, y los casos borde de cada umbral.
 *
 * Sin red, sin navegador, sin archivos: solo el núcleo puro del módulo
 * (`analizarRgba` / `analizarGris`), que es el MISMO código que corre en el
 * celular. Lo único que no se prueba aquí es la decodificación del blob y el
 * submuestreo con canvas, que son del navegador.
 *
 * No hay test runner en el proyecto — este script es la suite, en asserts
 * planos, igual que `verificar-reglas-alerta.ts`.
 *
 * Uso: `npm run verify:calidad`. Sale con código 1 si algo falla.
 */
import {
  aGris,
  analizarRgba,
  APLASTADOS_MAXIMO,
  BRILLO_MAXIMO,
  BRILLO_MINIMO,
  LADO_ANALISIS,
  NITIDEZ_MINIMA,
  QUEMADOS_MAXIMO,
  type ResultadoCalidadFoto,
  type VeredictoCalidad,
} from "@/lib/media/calidad-foto";

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

function assertVeredicto(descripcion: string, r: ResultadoCalidadFoto, esperado: VeredictoCalidad) {
  verificar(
    `${descripcion} → esperado ${esperado}, obtuvo ${r.veredicto} ` +
      `(brillo ${r.brillo}, nitidez ${r.nitidez}, quemados ${r.quemados}, aplastados ${r.aplastados})`,
    r.veredicto === esperado
  );
}

/** Ancho/alto de las pruebas: el mismo tamaño al que el módulo submuestrea en el celular. */
const W = LADO_ANALISIS;
const H = Math.round((LADO_ANALISIS * 3) / 4);

/** Genera un RGBA opaco a partir de una función de gris por píxel. */
function imagen(pintar: (x: number, y: number) => number, ancho = W, alto = H): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0, p = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++, p += 4) {
      const v = pintar(x, y);
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
      rgba[p + 3] = 255;
    }
  }
  return rgba;
}

/** PRNG determinista (LCG de Numerical Recipes) — el ruido tiene que ser reproducible. */
function ruido(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296; // [0, 1)
  };
}

console.log("Seiricon — verificación del control de calidad de foto en dispositivo\n");

console.log("Umbrales publicados (si cambian, este bloque falla y hay que releer el porqué en el módulo)");
verificar("LADO_ANALISIS = 480", LADO_ANALISIS === 480);
verificar("NITIDEZ_MINIMA = 35", NITIDEZ_MINIMA === 35);
verificar("BRILLO_MINIMO = 55", BRILLO_MINIMO === 55);
verificar("BRILLO_MAXIMO = 225", BRILLO_MAXIMO === 225);
verificar("QUEMADOS_MAXIMO = 0.35", QUEMADOS_MAXIMO === 0.35);
verificar("APLASTADOS_MAXIMO = 0.55", APLASTADOS_MAXIMO === 0.55);

console.log("\nConversión a gris — BT.601, la misma de la que salen los umbrales de nitidez");
{
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const g = aGris(rgba, 4, 1);
  verificar(`rojo puro ≈ 76 (obtuvo ${g[0]})`, Math.abs(g[0] - 76) <= 2);
  verificar(`verde puro ≈ 149 (obtuvo ${g[1]})`, Math.abs(g[1] - 149) <= 2);
  verificar(`azul puro ≈ 29 (obtuvo ${g[2]})`, Math.abs(g[2] - 29) <= 2);
  verificar(`blanco = 255 (obtuvo ${g[3]})`, g[3] === 255);
}

console.log("\nImagen uniforme (gris medio) — sin un solo borde: es el caso 'borrosa' extremo");
{
  const r = analizarRgba(imagen(() => 128), W, H);
  verificar(`nitidez = 0 (obtuvo ${r.nitidez})`, r.nitidez === 0);
  verificar(`brillo = 128 (obtuvo ${r.brillo})`, r.brillo === 128);
  assertVeredicto("uniforme 128", r, "movida");
  verificar("trae consejo (no es null)", typeof r.consejo === "string" && r.consejo.length > 0);
}

console.log("\nAlto contraste (tablero de 8 px) — el caso 'nítida' extremo");
{
  const r = analizarRgba(imagen((x, y) => ((x >> 3) + (y >> 3)) % 2 === 0 ? 30 : 220), W, H);
  verificar(`nitidez muy por encima del umbral (obtuvo ${r.nitidez})`, r.nitidez > NITIDEZ_MINIMA * 10);
  assertVeredicto("tablero de alto contraste", r, "ok");
  verificar("consejo es null cuando el veredicto es ok", r.consejo === null);
}

console.log("\nCasi negra");
{
  const r = analizarRgba(imagen(() => 4), W, H);
  verificar(`aplastados = 1 (obtuvo ${r.aplastados})`, r.aplastados === 1);
  assertVeredicto("uniforme 4", r, "oscura");
}

console.log("\nCasi blanca");
{
  const r = analizarRgba(imagen(() => 252), W, H);
  verificar(`quemados = 1 (obtuvo ${r.quemados})`, r.quemados === 1);
  assertVeredicto("uniforme 252", r, "muy_clara");
}

console.log("\nDegradado suave — foto desenfocada de verdad (la segunda derivada de una rampa es 0)");
{
  const r = analizarRgba(imagen((x) => 40 + Math.round((x / W) * 170)), W, H);
  verificar(`brillo en rango medio (obtuvo ${r.brillo})`, r.brillo > BRILLO_MINIMO && r.brillo < BRILLO_MAXIMO);
  assertVeredicto("degradado horizontal 40→210", r, "movida");
}

console.log("\nMuro liso con una grieta fina en una esquina — la prueba de que medir por ZONAS importa");
{
  // 40 px de grieta de 1 px sobre 480×360 de pared plana: en el promedio de
  // todo el encuadre eso se diluye hasta desaparecer, pero la foto sirve.
  const r = analizarRgba(
    imagen((x, y) => (x === 60 && y >= 40 && y < 80 ? 60 : 200)),
    W,
    H
  );
  verificar(
    `la varianza GLOBAL cae por debajo del umbral (${r.nitidez_global} < ${NITIDEZ_MINIMA}) — sin zonas la rechazaríamos`,
    r.nitidez_global < NITIDEZ_MINIMA
  );
  verificar(`la mejor zona sí la supera (${r.nitidez} ≥ ${NITIDEZ_MINIMA})`, r.nitidez >= NITIDEZ_MINIMA);
  assertVeredicto("pared lisa con grieta corta y fina", r, "ok");
}

console.log("\nPrioridad: la exposición manda sobre la nitidez");
{
  // Foto de noche: ruido de sensor fuerte sobre casi-negro. El Laplaciano ahí
  // mide grano, no detalle — por eso el veredicto debe ser 'oscura'.
  const rnd = ruido(20260815);
  const r = analizarRgba(imagen(() => Math.round(18 + rnd() * 24)), W, H);
  verificar(`el ruido dispara la nitidez (${r.nitidez} > ${NITIDEZ_MINIMA})`, r.nitidez > NITIDEZ_MINIMA);
  assertVeredicto("casi negra con ruido de sensor", r, "oscura");
}
{
  // Contraluz: la mitad quemada, la otra mitad con detalle nítido.
  const r = analizarRgba(imagen((x, y) => (x < W * 0.5 ? 255 : ((x >> 3) + (y >> 3)) % 2 === 0 ? 40 : 180)), W, H);
  verificar(`quemados por encima del máximo (${r.quemados} > ${QUEMADOS_MAXIMO})`, r.quemados > QUEMADOS_MAXIMO);
  verificar(`hay zonas nítidas (${r.nitidez} > ${NITIDEZ_MINIMA})`, r.nitidez > NITIDEZ_MINIMA);
  assertVeredicto("mitad quemada por contraluz", r, "muy_clara");
}
{
  // Cuarto a oscuras con una lámpara: brillo medio aceptable (80) pero más de
  // la mitad del encuadre es negro sin información.
  const r = analizarRgba(imagen((x) => (x < W * 0.6 ? 0 : 200)), W, H);
  verificar(`brillo medio por encima del mínimo (${r.brillo} ≥ ${BRILLO_MINIMO})`, r.brillo >= BRILLO_MINIMO);
  verificar(`aplastados por encima del máximo (${r.aplastados} > ${APLASTADOS_MAXIMO})`, r.aplastados > APLASTADOS_MAXIMO);
  assertVeredicto("60% del encuadre en negro puro", r, "oscura");
}

console.log("\nCasos borde de los umbrales — comparaciones estrictas");
{
  const justo = analizarRgba(imagen(() => BRILLO_MINIMO), W, H);
  verificar(`brillo exactamente ${BRILLO_MINIMO} NO es 'oscura' (obtuvo ${justo.veredicto})`, justo.veredicto !== "oscura");
  const debajo = analizarRgba(imagen(() => BRILLO_MINIMO - 1), W, H);
  assertVeredicto(`brillo ${BRILLO_MINIMO - 1}, un punto por debajo`, debajo, "oscura");
}
{
  const justo = analizarRgba(imagen(() => BRILLO_MAXIMO), W, H);
  verificar(
    `brillo exactamente ${BRILLO_MAXIMO} NO es 'muy_clara' (obtuvo ${justo.veredicto})`,
    justo.veredicto !== "muy_clara"
  );
  const arriba = analizarRgba(imagen(() => BRILLO_MAXIMO + 1), W, H);
  assertVeredicto(`brillo ${BRILLO_MAXIMO + 1}, un punto por encima`, arriba, "muy_clara");
}

console.log("\nSesgo del producto: ante la duda, 'ok'");
{
  // Textura fina de pared real (ruido de ±6 sobre gris medio): a ojo se ve
  // aceptable y debe pasar, aunque no tenga bordes marcados.
  const rnd = ruido(7);
  const r = analizarRgba(imagen(() => Math.round(140 + (rnd() - 0.5) * 12)), W, H);
  assertVeredicto("textura fina de pared, sin bordes marcados", r, "ok");
}
{
  // Imagen degenerada (1×1): no hay Laplaciano posible. Jamás debe salir un
  // veredicto negativo de una medición que no se pudo hacer.
  const r = analizarRgba(imagen(() => 10, 1, 1), 1, 1);
  assertVeredicto("imagen 1×1 (no medible)", r, "ok");
  verificar("consejo null en imagen no medible", r.consejo === null);
}
{
  // Mismo buffer, dos llamadas: la medida no puede bailar entre capturas.
  const buf = imagen((x, y) => ((x >> 4) + (y >> 4)) % 2 === 0 ? 90 : 160);
  const a = analizarRgba(buf, W, H);
  const b = analizarRgba(buf, W, H);
  verificar("el análisis es determinista", JSON.stringify(a) === JSON.stringify(b));
}

console.log("\nConsejos — tuteo, sin voseo, y siempre con una acción concreta");
{
  // Se compara palabra por palabra y no con \b: en JS los acentos no son
  // caracteres de palabra, así que /\bsalí\b/ marcaría "salió" como voseo.
  const VOSEO = new Set([
    "vos",
    "salí",
    "andá",
    "tomá",
    "apoyate",
    "poné",
    "hacé",
    "mirá",
    "tenés",
    "podés",
    "querés",
    "prendé",
    "encendé",
    "volvé",
    "intentá",
  ]);
  const palabras = (texto: string) => texto.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];

  const veredictos: VeredictoCalidad[] = ["oscura", "muy_clara", "movida"];
  const muestras: Record<string, ResultadoCalidadFoto> = {
    oscura: analizarRgba(imagen(() => 4), W, H),
    muy_clara: analizarRgba(imagen(() => 252), W, H),
    movida: analizarRgba(imagen(() => 128), W, H),
  };
  for (const v of veredictos) {
    const c = muestras[v].consejo ?? "";
    verificar(`${v}: hay consejo`, c.length > 0);
    verificar(`${v}: termina invitando a repetir`, /vuelve a intentar/i.test(c));
    verificar(`${v}: sin voseo (vos/salí/andá/apoyate/poné…)`, !palabras(c).some((p) => VOSEO.has(p)));
    verificar(`${v}: no promete un diagnóstico ni usa 'seguro'`, !/\bseguro\b|\bperitaje\b|\bdictamen\b/i.test(c));
  }
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Control de calidad de foto verificado sin errores.");
