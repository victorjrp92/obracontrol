/**
 * Guardia: ninguna definición de «día hábil» puede decidir por su cuenta.
 *
 * La compuerta original pedía «una sola función». Era un proxy: lo que de
 * verdad importa no es cuántas hay, sino que **ninguna cuente un festivo como
 * día trabajado**. Dos adaptadores con firmas distintas —uno para entradas de
 * texto de la UI, otro con días fraccionarios— son legítimos mientras los dos
 * deleguen en el calendario canónico.
 *
 * ── Por qué se reescribió (leaf-6.1) ────────────────────────────────────────
 * La versión anterior tenía tres agujeros, los tres comprobados con un control
 * positivo que NO la hizo fallar:
 *
 *   1. Solo reconocía `function nombre(`. Una copia ciega escrita como
 *      `const esHabil = (d) => d.getDay() !== 0` era invisible.
 *   2. Daba por buena cualquier definición en un fichero que IMPORTARA
 *      `@/lib/calendario-colombia`, aunque el import fuera para otra cosa. Un
 *      fichero con un `esHabil` ciego y un `rho(6)` decorativo pasaba.
 *   3. Solo recorría `src/`, así que la tercera copia real
 *      (`scripts/seed-demo-camara.ts`) llevaba semanas fuera de radar.
 *
 * La regla de ahora es conductual, no de conteo: **si el cuerpo de una función
 * de la familia mira el día de la semana (`getDay`/`getUTCDay`), tiene que
 * consultar también el calendario canónico en ese mismo cuerpo**. Eso es
 * exactamente la diferencia entre «descuento domingos» y «descuento domingos y
 * los 18 festivos». Las tres fixtures del control positivo de abajo la prueban.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const CANONICO = "src/lib/calendario-colombia.ts";
const RAICES = ["src", "scripts"];
/** Este mismo fichero: sus fixtures de control son código ciego a propósito. */
const ESTE = "scripts/verificar-dias-habiles-unico.ts";

/** Nombres que prometen «día hábil». Definirlos obliga a respetar los festivos. */
const NOMBRES = ["esHabil", "esDiaHabil", "diasHabilesEntre", "calcularDiasHabiles", "addWorkingDays"];

/**
 * Cualquier forma de definir uno de esos nombres: `function N(`, `const N =`,
 * `let N =`, `var N =`, `N: (` (método de objeto o propiedad de clase) y
 * `N(` como método abreviado. Es lo que cerraba el agujero 1.
 */
function reDefinicion(nombre: string): RegExp {
  return new RegExp(
    `(?:^|[\\s;{(])(?:export\\s+)?(?:async\\s+)?(?:function\\s+${nombre}\\b` +
      `|(?:const|let|var)\\s+${nombre}\\s*(?::[^=]*)?=` +
      `|${nombre}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\()` +
      `|${nombre}\\s*\\([^)]*\\)\\s*(?::[^={]*)?\\{)`,
    "m",
  );
}

/** Símbolos que SOLO puede dar el calendario canónico. */
const RE_CONSULTA_CANONICA = /\b(esFestivo|festivosDe|esHabil|addWorkingDays|diasHabilesCalendario|diasHabilesEntre)\s*\(/;
const RE_MIRA_DIA_SEMANA = /\.get(UTC)?Day\s*\(/;

/**
 * Cuerpo de la definición que empieza en `desde`: de su llave de apertura a la
 * que la cierra. Para una arrow sin llaves («=> expr»), lo que va tras la
 * flecha hasta el fin de línea.
 *
 * La CABECERA se excluye a propósito. Dejarla dentro hacía que el propio
 * nombre de la función (`function esHabil(`) contara como «consulta al
 * canónico» y el detector se declaraba satisfecho consigo mismo: la copia ciega
 * de `seed-demo-camara.ts` salía marcada como que delega.
 *
 * Es un recorte por conteo de llaves, no un parser — suficiente para decidir si
 * el cuerpo mira `getDay()` sin consultar el calendario.
 */
function cuerpoDesde(fuente: string, desde: number): string {
  const abre = fuente.indexOf("{", desde);
  const flecha = fuente.indexOf("=>", desde);
  const finLinea = fuente.indexOf("\n", desde);
  const hasta = finLinea === -1 ? fuente.length : finLinea;

  // Arrow sin cuerpo de bloque: la flecha llega antes que cualquier llave.
  if (flecha !== -1 && flecha < hasta && (abre === -1 || flecha < abre)) {
    return fuente.slice(flecha + 2, hasta);
  }
  if (abre === -1) return fuente.slice(desde, hasta);

  let nivel = 0;
  for (let i = abre; i < fuente.length; i++) {
    if (fuente[i] === "{") nivel++;
    else if (fuente[i] === "}" && --nivel === 0) return fuente.slice(abre, i + 1);
  }
  return fuente.slice(abre);
}

/** ¿Esta definición decide por su cuenta qué día es hábil? */
export function decideAsuAire(cuerpo: string): boolean {
  return RE_MIRA_DIA_SEMANA.test(cuerpo) && !RE_CONSULTA_CANONICA.test(cuerpo);
}

interface Hallazgo {
  archivo: string;
  nombre: string;
  ciega: boolean;
}

function analizar(archivo: string, fuente: string): Hallazgo[] {
  const out: Hallazgo[] = [];
  for (const nombre of NOMBRES) {
    const m = reDefinicion(nombre).exec(fuente);
    if (!m) continue;
    out.push({ archivo, nombre, ciega: decideAsuAire(cuerpoDesde(fuente, m.index)) });
  }
  return out;
}

function recorrer(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    // Normalizado a `/`: en Windows `join` devuelve `scripts\x.ts` y las
    // comparaciones contra CANONICO y ESTE —escritas con `/`— no casaban nunca,
    // así que la guardia se marcaba a sí misma.
    const p = join(dir, e).split(sep).join("/");
    if (statSync(p).isDirectory()) return recorrer(p);
    return /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

let total = 0;
let fallos = 0;
function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) console.log(`  OK   ${descripcion}`);
  else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

console.log("Guardia de días hábiles\n");
console.log(`  canónico: ${CANONICO}`);

const archivos = RAICES.flatMap(recorrer).filter((f) => f !== CANONICO && f !== ESTE);
const hallazgos = archivos.flatMap((f) => analizar(f, readFileSync(f, "utf8")));
console.log(`  otras definiciones: ${hallazgos.length} (en ${RAICES.join(" y ")}/)\n`);

for (const h of hallazgos) {
  console.log(
    `  ${h.ciega ? "FAIL" : "OK  "} ${h.archivo} → ${h.nombre}()` +
      (h.ciega ? "  ← DECIDE POR SU CUENTA (ciega a festivos)" : "  delega en el canónico"),
  );
}
verificar(
  `ninguna de las ${hallazgos.length} definiciones decide por su cuenta`,
  hallazgos.every((h) => !h.ciega),
);

// ── Control positivo: el detector TIENE que marcar estas tres ───────────────
// Las tres pasaban la versión anterior del guardia. Si alguna deja de marcarse,
// es que el detector volvió a quedarse ciego y esta compuerta no vale nada.
console.log("\nControl positivo — copias ciegas que el detector DEBE marcar");
const CIEGAS: [string, string][] = [
  ["arrow", `export const esHabil = (d: Date): boolean => d.getDay() !== 0;`],
  ["function", `export function esHabil(d: Date): boolean { return d.getDay() !== 0; }`],
  [
    "function + import decorativo",
    `import { rho } from "@/lib/calendario-colombia";\nexport const factor = rho(6);\nfunction esHabil(d: Date) { return d.getDay() !== 0; }`,
  ],
  [
    "método de objeto",
    `export const reglas = {\n  esHabil(d: Date) { return d.getUTCDay() !== 0; },\n};`,
  ],
];
for (const [forma, fuente] of CIEGAS) {
  const r = analizar("fixture.ts", fuente);
  verificar(`marca la copia ciega escrita como ${forma}`, r.length === 1 && r[0].ciega);
}

// ── Control negativo: no puede marcar a quien sí delega ─────────────────────
console.log("\nControl negativo — el detector NO puede marcar a quien delega");
const LIMPIAS: [string, string][] = [
  [
    "descuenta domingos Y festivos",
    `import { esFestivo } from "@/lib/calendario-colombia";\nexport function diasHabilesEntre(a: Date, b: Date) {\n  let n = 0;\n  const c = new Date(a);\n  while (c < b) { if (c.getUTCDay() !== 0 && !esFestivo(c)) n++; c.setUTCDate(c.getUTCDate() + 1); }\n  return n;\n}`,
  ],
  [
    "envoltorio puro sobre el canónico",
    `import { diasHabilesEntre as canon } from "@/lib/calendario-colombia";\nfunction diasHabilesEntre(a?: string, b?: string) {\n  if (!a || !b) return null;\n  return canon(new Date(a), new Date(b));\n}`,
  ],
];
for (const [forma, fuente] of LIMPIAS) {
  const r = analizar("fixture.ts", fuente);
  verificar(`no marca la definición que ${forma}`, r.length === 1 && !r[0].ciega);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Ninguna definición de día hábil ignora los festivos.");
