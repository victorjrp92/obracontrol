/**
 * Verifica el cliente de visión de Seiricon Alerta
 * (`src/lib/alerta/observar-grieta.ts`) SIN tocar la red ni la base de datos:
 * política de reintento, lectura de `retry-after`, el motivo nuevo
 * "foto_mala" y las invariantes del prompt (D2 y la escala de la moneda).
 *
 * Deliberadamente SEPARADO de `scripts/verificar-reglas-alerta.ts` (43/43) y
 * de `scripts/verificar-triage-alerta.ts` (37/37): esos dos cubren el núcleo
 * de decisión y no se tocan.
 *
 * No hay test runner en el proyecto — este script es la suite, en asserts
 * planos, igual que los otros dos.
 *
 * Uso: `npm run verify:observacion` (o `npm run verify:alerta`, que corre los
 * tres). Sale con código 1 si algo falla.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diagnosticarCalidadFoto,
  esReintentable,
  esperaReintentoMs,
  normalizarObservacion,
} from "@/lib/alerta/observar-grieta";
import { DIAGNOSTICO_FOTO, type CalidadFoto, type ProblemaCalidadFoto } from "@/lib/alerta/tipos";

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

console.log("Seiricon Alerta — verificación del cliente de visión (observar-grieta, sin red)\n");

const FUENTE = readFileSync(join(process.cwd(), "src", "lib", "alerta", "observar-grieta.ts"), "utf8");
// El esquema y los modelos por defecto viven en la capa de proveedores desde
// que hay más de uno. Las invariantes que los tocan se verifican ahí.
const FUENTE_PROVEEDORES = readFileSync(
  join(process.cwd(), "src", "lib", "alerta", "proveedores-vision.ts"),
  "utf8"
);

// ─── 1) diagnosticarCalidadFoto — qué foto se usa y qué foto se repite ─────
console.log("1) diagnosticarCalidadFoto — 'ok' pasa; cualquier otra calidad se convierte en foto_mala");

const CALIDADES: CalidadFoto[] = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];
const PROBLEMAS = CALIDADES.filter((c): c is ProblemaCalidadFoto => c !== "ok");

verificar("calidad 'ok' → null (la observación se usa)", diagnosticarCalidadFoto("ok") === null);

let fallosDiagnostico = 0;
for (const calidad of PROBLEMAS) {
  const d = diagnosticarCalidadFoto(calidad);
  if (!d || d.calidad_foto !== calidad || !d.queFallo.trim() || !d.consejo.trim()) fallosDiagnostico++;
}
verificar(
  `las ${PROBLEMAS.length} calidades problemáticas devuelven diagnóstico con queFallo y consejo no vacíos`,
  fallosDiagnostico === 0
);

verificar(
  "DIAGNOSTICO_FOTO cubre exactamente los enums distintos de 'ok' (sin huecos ni sobrantes)",
  Object.keys(DIAGNOSTICO_FOTO).sort().join(",") === [...PROBLEMAS].sort().join(",")
);

// Mismo criterio de lenguaje que copys.ts: estas frases describen la FOTO,
// nunca la grieta — no pueden adelantar un nivel ni hablar de riesgo.
const LENGUAJE_PROHIBIDO = /segur|peligr|\brojo\b|\bamarillo\b|\bverde\b|evacu|colaps|tranquil|no pasa nada|recomiend/i;
const TEXTOS_DIAGNOSTICO = PROBLEMAS.flatMap((c) => [DIAGNOSTICO_FOTO[c].queFallo, DIAGNOSTICO_FOTO[c].consejo]);
verificar(
  `ningún texto de DIAGNOSTICO_FOTO usa lenguaje de juicio (${TEXTOS_DIAGNOSTICO.length} frases)`,
  TEXTOS_DIAGNOSTICO.every((t) => !LENGUAJE_PROHIBIDO.test(t))
);

// ─── 2) foto_mala no rompe la normalización ────────────────────────────────
console.log("\n2) La observación se sigue normalizando igual — foto_mala decide DESPUÉS, no antes");

const OBSERVACION_BASE = {
  elemento: "muro_carga",
  patron: "vertical",
  escala: "la moneda se ve borrosa",
  ancho_mm: 5,
  banderas: {
    acero_expuesto: false,
    concreto_triturado: false,
    desplazamiento_caras: false,
    elemento_inclinado: false,
    separacion_muro_estructura: false,
  },
  confianza: { elemento: 0.9, patron: 0.9, ancho: 0.9 },
  calidad_foto: "movida",
};

const movida = normalizarObservacion(OBSERVACION_BASE);
verificar(
  "una observación con calidad 'movida' normaliza bien (no se rechaza) pero queda marcada para repetir",
  movida !== null && movida.calidad_foto === "movida" && diagnosticarCalidadFoto(movida.calidad_foto) !== null
);

const sinEscala = normalizarObservacion({ ...OBSERVACION_BASE, calidad_foto: "sin_referencia_escala" });
verificar(
  "'sin_referencia_escala' sigue conservando ancho_mm y bajando confianza.ancho a 0 (invariante de Fase 2 intacta)",
  sinEscala !== null && sinEscala.ancho_mm === 5 && sinEscala.confianza.ancho === 0
);

verificar(
  "el campo nuevo 'escala' del tool es ignorado por normalizarObservacion (no viaja al motor de reglas)",
  movida !== null && !("escala" in movida)
);

// ─── 3) Política de reintento ──────────────────────────────────────────────
console.log("\n3) esReintentable — se reintenta lo que mejora al repetirse, nada más");

verificar("fallo de red / timeout (status null) → se reintenta", esReintentable(null) === true);

const REINTENTABLES = [408, 429, 500, 502, 503, 504, 529];
verificar(
  `408, 429 y 5xx se reintentan (${REINTENTABLES.length} códigos)`,
  REINTENTABLES.every((s) => esReintentable(s) === true)
);

const FATALES = [400, 401, 403, 404, 405, 413, 422];
verificar(
  `el resto de 4xx NO se reintenta — un payload malo no mejora repitiéndose (${FATALES.length} códigos)`,
  FATALES.every((s) => esReintentable(s) === false)
);

// ─── 4) retry-after ────────────────────────────────────────────────────────
console.log("\n4) esperaReintentoMs — respeta retry-after en sus dos formatos y nunca espera de más");

const TOPE_MS = 10_000;

const sinHeader = esperaReintentoMs(null);
verificar(
  "sin header → backoff propio, corto y acotado",
  sinHeader !== null && sinHeader > 0 && sinHeader <= TOPE_MS
);

verificar("retry-after en segundos ('2') → 2000 ms", esperaReintentoMs("2") === 2000);
verificar("retry-after con espacios (' 3 ') → 3000 ms", esperaReintentoMs(" 3 ") === 3000);

const fechaCerca = new Date(Date.now() + 3000).toUTCString();
const esperaFecha = esperaReintentoMs(fechaCerca);
verificar(
  "retry-after como fecha HTTP cercana → espera derivada de la fecha (entre 1s y el tope)",
  esperaFecha !== null && esperaFecha > 1000 && esperaFecha <= TOPE_MS
);

verificar("retry-after enorme ('600' segundos) → null: no se reintenta, se cae a modo manual", esperaReintentoMs("600") === null);
verificar(
  "retry-after como fecha lejana → null: no se reintenta",
  esperaReintentoMs(new Date(Date.now() + 3_600_000).toUTCString()) === null
);

const ILEGIBLES = ["", "   ", "ya mismo", "NaN"];
verificar(
  `retry-after ilegible o vacío → backoff propio, nunca null ni NaN (${ILEGIBLES.length} valores)`,
  ILEGIBLES.every((v) => {
    const ms = esperaReintentoMs(v);
    return ms !== null && Number.isFinite(ms) && ms > 0 && ms <= TOPE_MS;
  })
);

const PASADOS = ["0", "-5", new Date(Date.now() - 60_000).toUTCString()];
verificar(
  `retry-after ya vencido o cero → backoff propio positivo (${PASADOS.length} valores)`,
  PASADOS.every((v) => {
    const ms = esperaReintentoMs(v);
    return ms !== null && ms > 0 && ms <= TOPE_MS;
  })
);

// ─── 5) Invariantes del archivo (D2, escala, presupuesto, modelo) ──────────
console.log("\n5) Invariantes de observar-grieta.ts — leídas del propio archivo fuente");

verificar(
  "D2: el archivo no menciona el elemento declarado por la persona (el prompt nunca puede recibirlo)",
  !/elementoDeclarado/.test(FUENTE)
);

verificar(
  "el prompt razona sobre la moneda de $500 con su diámetro real (23,7 mm) — coherente con MONEDA_REFERENCIA de components/juntos/config.ts",
  /23,7\s*mm/.test(FUENTE)
);

verificar(
  "el prompt manda reportar 'sin_referencia_escala' en vez de adivinar el ancho",
  /NO adivines el ancho[\s\S]{0,200}sin_referencia_escala/.test(FUENTE)
);

// El esquema es uno solo y lo comparten los dos proveedores. `escala` tiene que
// ir antes que `ancho_mm` tanto en properties como en required: el modelo emite
// los campos en ese orden, así que el razonamiento de escala sale antes que el
// número. Al revés sería inventar el ancho y justificarlo después.
verificar(
  "el esquema declara 'escala' antes de 'ancho_mm' en properties",
  /escala:\s*\{[\s\S]{0,200}?\},\s*\n\s*ancho_mm:/.test(FUENTE_PROVEEDORES)
);
verificar(
  "el esquema declara 'escala' antes de 'ancho_mm' en required",
  /"elemento",\s*"patron",\s*"escala",\s*"ancho_mm"/.test(FUENTE_PROVEEDORES)
);
verificar(
  "el esquema es UNO solo para los dos proveedores (dos copias divergen)",
  /input_schema:\s*ESQUEMA_OBSERVACION/.test(FUENTE_PROVEEDORES) &&
    /schema:\s*ESQUEMA_OBSERVACION/.test(FUENTE_PROVEEDORES)
);

verificar(
  "los modelos por defecto son IDs vigentes (claude-haiku-4-5 y gemini-3.7-flash; 2.5 se retira el 16-oct-2026)",
  /anthropic:\s*"claude-haiku-4-5"/.test(FUENTE_PROVEEDORES) &&
    /gemini:\s*"gemini-3\.7-flash"/.test(FUENTE_PROVEEDORES)
);

// Se comprueba la CONSTANTE de la URL, no el archivo entero: el comentario que
// explica por qué se abandonó `:generateContent` la nombra a propósito, y un
// regex sobre todo el texto castigaría justamente la documentación.
const urlGemini = /const GEMINI_URL = "([^"]+)"/.exec(FUENTE_PROVEEDORES)?.[1] ?? "";
verificar(
  "Gemini apunta a la Interactions API, no a la generateContent con esquema retirada en junio de 2026",
  urlGemini.endsWith("/v1beta/interactions") && !/generateContent/.test(urlGemini)
);
verificar(
  "Gemini fija la revisión del contrato con la cabecera Api-Revision",
  /"Api-Revision"/.test(FUENTE_PROVEEDORES)
);
// El fallo que costó tres días: 700 tokens es correcto para un modelo que
// responde directo, y deja sin sitio al JSON de uno que razona antes. Que el
// presupuesto sea por proveedor no es un lujo, es la diferencia entre
// funcionar y devolver un JSON cortado a la mitad.
const presupuestos = [...FUENTE_PROVEEDORES.matchAll(/maxTokens:\s*(\d+)/g)].map((m) => Number(m[1]));
verificar(
  "cada proveedor declara su propio tope de tokens (no hay una constante única compartida)",
  presupuestos.length >= 2 && new Set(presupuestos).size >= 2
);
verificar(
  "el tope de Gemini deja sitio al JSON después del paso de razonamiento (>= 2000, medido)",
  /nombre: "gemini"[\s\S]{0,900}?maxTokens:\s*(\d+)/.exec(FUENTE_PROVEEDORES) !== null &&
    Number(/nombre: "gemini"[\s\S]{0,900}?maxTokens:\s*(\d+)/.exec(FUENTE_PROVEEDORES)![1]) >= 2000
);
verificar(
  "observar-grieta.ts ya no impone un MAX_TOKENS global",
  !/const MAX_TOKENS\s*=/.test(FUENTE)
);

verificar(
  "Gemini pide store:false — las fotos no se guardan del lado de Google, como promete /privacidad",
  /store:\s*false/.test(FUENTE_PROVEEDORES)
);

verificar(
  "el proveedor por defecto es anthropic (usar Gemini tiene que ser explícito y reversible con una variable)",
  /ALERTA_VISION_PROVEEDOR \?\? "anthropic"/.test(FUENTE_PROVEEDORES)
);

verificar(
  "la clave de Gemini viaja en cabecera, nunca como ?key= en la URL (los secretos en URL terminan en logs)",
  /"x-goog-api-key"/.test(FUENTE_PROVEEDORES) && !/[?&]key=\$\{/.test(FUENTE_PROVEEDORES)
);

// El peor caso real es: intento (timeout completo) + espera máxima + reintento
// (timeout completo). Eso tiene que caber en el presupuesto, y el presupuesto
// dentro del maxDuration=60s que declara la ruta.
function constanteMs(nombre: string): number {
  return Number(new RegExp(`${nombre} = ([\\d_]+)`).exec(FUENTE)?.[1]?.replace(/_/g, "") ?? NaN);
}
const timeout = constanteMs("TIMEOUT_INTENTO_MS");
const presupuesto = constanteMs("PRESUPUESTO_TOTAL_MS");
const esperaMax = constanteMs("ESPERA_REINTENTO_MAX_MS");
verificar(
  "el tope de espera del código coincide con el que asume esta suite",
  esperaMax === TOPE_MS
);
verificar(
  "peor caso (intento + espera máxima + reintento) ≤ presupuesto < maxDuration=60s de la ruta",
  [timeout, presupuesto, esperaMax].every(Number.isFinite) &&
    timeout * 2 + esperaMax <= presupuesto &&
    presupuesto < 60_000
);

// ─── Resumen ───────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Cliente de visión de Seiricon Alerta verificado sin errores.");
