/**
 * Arnés de calibración de la lectura de visión de Seiricon Alerta.
 *
 * Mide qué tan bien LEE el modelo (elemento, patrón, ancho, calidad) y qué
 * semáforo sale al final del triage, contra un `esperado` escrito por una
 * persona. NO es una suite de verificación de reglas (para eso están
 * `npm run verify:alerta` y `npm run verify:triage`): es la herramienta para
 * decidir, con datos, si la lectura automática está lista para producción.
 *
 * Dos modos:
 *
 *   1. SIMULADO (por defecto si no hay `ANTHROPIC_API_KEY`) — lee casos con
 *      la observación del modelo YA ESCRITA A MANO en un manifiesto
 *      (`calibracion/manifiesto.simulado.json`). Sin red y sin fotos: sirve
 *      para probar el arnés y el pipeline de triage HOY, antes de tener key
 *      ni fotos reales.
 *   2. REAL (`ANTHROPIC_API_KEY` + `ALERTA_VISION_ENABLED=true`) — lee fotos
 *      de `calibracion/` según `calibracion/manifiesto.json`, las pasa por
 *      `observarGrietaConsenso()` (doble lectura, R1) y luego por
 *      `evaluarTriageGrieta()`. Los casos se corren en serie, no en
 *      paralelo: cada caso ya son dos llamadas al modelo.
 *
 * LA MÉTRICA QUE IMPORTA es la de FALSOS VERDES: un caso cuyo nivel final es
 * verde cuando lo esperado NO era un muro divisorio con craquelado. El resto
 * del reporte (matrices de confusión, error de ancho, distribuciones) es
 * diagnóstico. **El script sale con código distinto de 0 si hay UN SOLO
 * falso verde**, o si algún caso del manifiesto no se pudo leer.
 *
 * Uso:
 *   npm run calibrar:vision                          (modo automático)
 *   npm run calibrar:vision -- --simulado
 *   npm run calibrar:vision -- --real
 *   npm run calibrar:vision -- --manifiesto=calibracion/mi-manifiesto.json
 *
 * Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md y calibracion/README.md.
 */
import { readFileSync, existsSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { normalizarObservacion, observarGrietaConsenso } from "@/lib/alerta/observar-grieta";
import { evaluarTriageGrieta, type EntradaTriage, type FuenteObservacion, type GrietaEvaluada, type RespuestaPasante } from "@/lib/alerta/triage";
import type { CalidadFoto, Elemento, Nivel, ObservacionGrieta, Patron } from "@/lib/alerta/tipos";

// ─── Enums del contrato (copiados acá a propósito: el arnés valida la ────────
// entrada del manifiesto igual de duro que la ruta API valida al modelo).
const ELEMENTOS: Elemento[] = [
  "columna",
  "viga",
  "nudo_viga_columna",
  "muro_carga",
  "muro_divisorio",
  "losa_techo",
  "piso",
  "fachada",
  "no_determinado",
];
const PATRONES: Patron[] = [
  "diagonal",
  "diagonal_x",
  "vertical",
  "horizontal",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];
const CALIDADES: CalidadFoto[] = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];
const NIVELES: Nivel[] = ["rojo", "amarillo", "verde"];
const PASANTES: RespuestaPasante[] = ["si", "no", "no_se"];

const DIR_CALIBRACION = join(process.cwd(), "calibracion");
const MANIFIESTO_SIMULADO = join(DIR_CALIBRACION, "manifiesto.simulado.json");
const MANIFIESTO_REAL = join(DIR_CALIBRACION, "manifiesto.json");

const MIME_POR_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface Esperado {
  elemento: Elemento;
  patron: Patron;
  /** Ancho medido de verdad (regla, calibrador). Opcional: si no está, no entra al error de ancho. */
  ancho_mm_real: number | null;
}

interface CasoManifiesto {
  id: string;
  esperado: Esperado;
  /** Lo que la persona habría marcado en el Paso 1. Por defecto, el elemento esperado. */
  declarado: Elemento;
  fuente: FuenteObservacion;
  pasante: RespuestaPasante;
  /** Patrón que la persona confirma/corrige en el paso R3. Por defecto: el que lea la IA (sin discrepancia). */
  patron_declarado: Patron | null;
  /** Modo simulado: observación del modelo escrita a mano. */
  observacion: ObservacionGrieta | null;
  /** Modo real: rutas de las dos fotos, relativas a calibracion/. */
  foto_cerca: string | null;
  foto_lejos: string | null;
}

interface CasoResuelto {
  caso: CasoManifiesto;
  observacion: ObservacionGrieta;
  evaluada: GrietaEvaluada;
}

interface CasoFallido {
  id: string;
  motivo: string;
}

// ─── Lectura y validación del manifiesto ────────────────────────────────────

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}

function leerEnum<T extends string>(valor: unknown, validos: T[]): T | null {
  return typeof valor === "string" && (validos as string[]).includes(valor) ? (valor as T) : null;
}

/**
 * Valida un caso crudo del manifiesto. Devuelve el caso normalizado o el
 * motivo del rechazo — nunca lanza, para poder reportar TODOS los casos
 * rotos de una sola pasada en vez de morir en el primero.
 */
function validarCaso(raw: unknown, indice: number): { ok: true; caso: CasoManifiesto } | { ok: false; error: CasoFallido } {
  const etiqueta = `caso #${indice + 1}`;
  if (!esObjeto(raw)) return { ok: false, error: { id: etiqueta, motivo: "el caso no es un objeto JSON" } };

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : etiqueta;

  if (!esObjeto(raw.esperado)) return { ok: false, error: { id, motivo: "falta el objeto `esperado`" } };
  const elementoEsperado = leerEnum(raw.esperado.elemento, ELEMENTOS);
  if (!elementoEsperado) return { ok: false, error: { id, motivo: "`esperado.elemento` no es un elemento válido" } };
  const patronEsperado = leerEnum(raw.esperado.patron, PATRONES);
  if (!patronEsperado) return { ok: false, error: { id, motivo: "`esperado.patron` no es un patrón válido" } };

  let ancho_mm_real: number | null = null;
  if (raw.esperado.ancho_mm_real !== undefined && raw.esperado.ancho_mm_real !== null) {
    const n = Number(raw.esperado.ancho_mm_real);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: { id, motivo: "`esperado.ancho_mm_real` no es un número >= 0" } };
    ancho_mm_real = n;
  }

  const declarado = leerEnum(raw.declarado, ELEMENTOS) ?? elementoEsperado;
  const fuente = leerEnum(raw.fuente, ["ia", "manual"] as FuenteObservacion[]) ?? "ia";
  const pasante = leerEnum(raw.pasante, PASANTES) ?? "no_se";
  const patron_declarado = leerEnum(raw.patron_declarado, PATRONES);

  let observacion: ObservacionGrieta | null = null;
  if (raw.observacion !== undefined) {
    observacion = normalizarObservacion(raw.observacion);
    if (!observacion) {
      return { ok: false, error: { id, motivo: "`observacion` no pasa normalizarObservacion (enum desconocido o forma inválida)" } };
    }
  }

  const foto_cerca = typeof raw.foto_cerca === "string" && raw.foto_cerca.trim() ? raw.foto_cerca.trim() : null;
  const foto_lejos = typeof raw.foto_lejos === "string" && raw.foto_lejos.trim() ? raw.foto_lejos.trim() : null;

  return {
    ok: true,
    caso: {
      id,
      esperado: { elemento: elementoEsperado, patron: patronEsperado, ancho_mm_real },
      declarado,
      fuente,
      pasante,
      patron_declarado,
      observacion,
      foto_cerca,
      foto_lejos,
    },
  };
}

function leerManifiesto(ruta: string): { casos: CasoManifiesto[]; fallidos: CasoFallido[] } {
  const crudo = JSON.parse(readFileSync(ruta, "utf8")) as unknown;
  const lista = Array.isArray(crudo) ? crudo : esObjeto(crudo) && Array.isArray(crudo.casos) ? crudo.casos : null;
  if (!lista) {
    throw new Error(`El manifiesto ${ruta} debe ser un arreglo de casos, o un objeto con la propiedad "casos".`);
  }

  const casos: CasoManifiesto[] = [];
  const fallidos: CasoFallido[] = [];
  lista.forEach((raw, i) => {
    const resultado = validarCaso(raw, i);
    if (resultado.ok) casos.push(resultado.caso);
    else fallidos.push(resultado.error);
  });
  return { casos, fallidos };
}

/** Carga una foto del disco como data-URI base64 (el formato que espera `observarGrietaConsenso`). */
function fotoADataUrl(rutaRelativa: string): string {
  const ruta = isAbsolute(rutaRelativa) ? rutaRelativa : resolve(DIR_CALIBRACION, rutaRelativa);
  const mime = MIME_POR_EXTENSION[extname(ruta).toLowerCase()];
  if (!mime) throw new Error(`Extensión no soportada en ${basename(ruta)} (usa .jpg, .jpeg, .png o .webp).`);
  return `data:${mime};base64,${readFileSync(ruta).toString("base64")}`;
}

// ─── Reporte ────────────────────────────────────────────────────────────────

function matrizDeConfusion<T extends string>(titulo: string, pares: { esperado: T; leido: T }[]) {
  console.log(`\n${titulo}`);
  if (pares.length === 0) {
    console.log("  (sin casos)");
    return;
  }
  const categorias = Array.from(new Set([...pares.map((p) => p.esperado), ...pares.map((p) => p.leido)])).sort();
  const ancho = Math.max(...categorias.map((c) => c.length), 14);
  const ANCHO_COLUMNA = 11;
  console.log(`  ${"esperado \\ leído".padEnd(ancho)} | ${categorias.map((c) => c.slice(0, ANCHO_COLUMNA).padStart(ANCHO_COLUMNA)).join(" ")}`);
  for (const esperado of categorias) {
    const fila = categorias.map((leido) =>
      String(pares.filter((p) => p.esperado === esperado && p.leido === leido).length).padStart(ANCHO_COLUMNA)
    );
    console.log(`  ${esperado.padEnd(ancho)} | ${fila.join(" ")}`);
  }
  const aciertos = pares.filter((p) => p.esperado === p.leido).length;
  console.log(`  aciertos: ${aciertos}/${pares.length} (${((aciertos / pares.length) * 100).toFixed(1)}%)`);
}

function distribucion<T extends string>(titulo: string, valores: T[], universo: T[]) {
  console.log(`\n${titulo}`);
  if (valores.length === 0) {
    console.log("  (sin casos)");
    return;
  }
  for (const clave of universo) {
    const n = valores.filter((v) => v === clave).length;
    if (n === 0) continue;
    console.log(`  ${clave.padEnd(22)} ${String(n).padStart(3)}  (${((n / valores.length) * 100).toFixed(1)}%)`);
  }
}

function reportar(resueltos: CasoResuelto[], fallidos: CasoFallido[]): number {
  console.log(`\n─── Detalle por caso (${resueltos.length}) ───`);
  for (const r of resueltos) {
    const { esperado } = r.caso;
    const aciertoElemento = esperado.elemento === r.observacion.elemento ? " " : "!";
    const aciertoPatron = esperado.patron === r.observacion.patron ? " " : "!";
    console.log(
      `  ${r.evaluada.veredicto.nivel.toUpperCase().padEnd(8)} ${r.caso.id.padEnd(38)} ` +
        `elemento ${aciertoElemento}${esperado.elemento}→${r.observacion.elemento}  ` +
        `patrón ${aciertoPatron}${esperado.patron}→${r.observacion.patron}  ` +
        `ancho ${r.observacion.ancho_mm ?? "—"}  calidad ${r.observacion.calidad_foto}`
    );
  }

  matrizDeConfusion(
    "─── Matriz de confusión — ELEMENTO (esperado vs. leído) ───",
    resueltos.map((r) => ({ esperado: r.caso.esperado.elemento, leido: r.observacion.elemento }))
  );
  matrizDeConfusion(
    "─── Matriz de confusión — PATRÓN (esperado vs. leído) ───",
    resueltos.map((r) => ({ esperado: r.caso.esperado.patron, leido: r.observacion.patron }))
  );

  console.log("\n─── Error del ancho (mm) ───");
  const conAnchoReal = resueltos.filter((r) => r.caso.esperado.ancho_mm_real !== null);
  const medibles = conAnchoReal.filter((r) => r.observacion.ancho_mm !== null);
  if (medibles.length === 0) {
    console.log("  (ningún caso tiene ancho_mm_real y lectura de ancho a la vez)");
  } else {
    const errores = medibles.map((r) => Math.abs((r.observacion.ancho_mm as number) - (r.caso.esperado.ancho_mm_real as number)));
    const mae = errores.reduce((a, b) => a + b, 0) / errores.length;
    console.log(`  error absoluto medio: ${mae.toFixed(2)} mm sobre ${medibles.length} caso(s)`);
    console.log(`  error máximo:         ${Math.max(...errores).toFixed(2)} mm`);
  }
  const sinLectura = conAnchoReal.length - medibles.length;
  if (sinLectura > 0) console.log(`  ${sinLectura} caso(s) con ancho real conocido que el modelo no estimó (ancho_mm null)`);

  const noDeterminado = resueltos.filter((r) => r.observacion.elemento === "no_determinado").length;
  console.log("\n─── Cobertura de la lectura ───");
  console.log(
    `  elemento "no_determinado": ${noDeterminado}/${resueltos.length}` +
      (resueltos.length ? ` (${((noDeterminado / resueltos.length) * 100).toFixed(1)}%)` : "")
  );

  distribucion(
    "─── Distribución de calidad_foto ───",
    resueltos.map((r) => r.observacion.calidad_foto),
    CALIDADES
  );
  distribucion(
    "─── Distribución de niveles finales ───",
    resueltos.map((r) => r.evaluada.veredicto.nivel),
    NIVELES
  );

  // ── LA métrica: falsos verdes ────────────────────────────────────────────
  const falsosVerdes = resueltos.filter(
    (r) =>
      r.evaluada.veredicto.nivel === "verde" &&
      !(r.caso.esperado.elemento === "muro_divisorio" && r.caso.esperado.patron === "craquelado")
  );
  console.log("\n═══ FALSOS VERDES ═══");
  if (falsosVerdes.length === 0) {
    console.log("  0 — ningún caso resolvió en verde sin ser un craquelado en muro divisorio.");
  } else {
    for (const r of falsosVerdes) {
      console.log(
        `  ${r.caso.id}: esperado ${r.caso.esperado.elemento}/${r.caso.esperado.patron}, ` +
          `leído ${r.observacion.elemento}/${r.observacion.patron}, razón: "${r.evaluada.veredicto.razon}"`
      );
    }
    console.log(`  ${falsosVerdes.length} falso(s) verde(s).`);
  }

  if (fallidos.length > 0) {
    console.log("\n─── Casos que no se pudieron evaluar ───");
    for (const f of fallidos) console.log(`  ${f.id}: ${f.motivo}`);
  }

  console.log(
    `\nResumen: ${resueltos.length} caso(s) evaluado(s), ${fallidos.length} con error, ${falsosVerdes.length} falso(s) verde(s).`
  );
  return falsosVerdes.length > 0 || fallidos.length > 0 ? 1 : 0;
}

// ─── Modos ──────────────────────────────────────────────────────────────────

function entradaDe(caso: CasoManifiesto, observacion: ObservacionGrieta): EntradaTriage {
  return {
    declarado: caso.declarado,
    observacion,
    fuente: caso.fuente,
    pasante: caso.pasante,
    // Sin `patron_declarado` explícito se asume que la persona confirmó lo que
    // leyó la IA (el camino más benévolo — si igual no hay falsos verdes, mejor).
    patron_declarado: caso.patron_declarado ?? observacion.patron,
  };
}

function correrSimulado(casos: CasoManifiesto[]): { resueltos: CasoResuelto[]; fallidos: CasoFallido[] } {
  const resueltos: CasoResuelto[] = [];
  const fallidos: CasoFallido[] = [];
  for (const caso of casos) {
    if (!caso.observacion) {
      fallidos.push({ id: caso.id, motivo: "modo simulado: el caso no trae `observacion` escrita a mano" });
      continue;
    }
    resueltos.push({ caso, observacion: caso.observacion, evaluada: evaluarTriageGrieta(entradaDe(caso, caso.observacion)) });
  }
  return { resueltos, fallidos };
}

async function correrReal(casos: CasoManifiesto[]): Promise<{ resueltos: CasoResuelto[]; fallidos: CasoFallido[] }> {
  const resueltos: CasoResuelto[] = [];
  const fallidos: CasoFallido[] = [];
  for (const caso of casos) {
    if (!caso.foto_cerca || !caso.foto_lejos) {
      fallidos.push({ id: caso.id, motivo: "modo real: faltan `foto_cerca` y/o `foto_lejos`" });
      continue;
    }
    let fotoCercaDataUrl: string;
    let fotoLejosDataUrl: string;
    try {
      fotoCercaDataUrl = fotoADataUrl(caso.foto_cerca);
      fotoLejosDataUrl = fotoADataUrl(caso.foto_lejos);
    } catch (error) {
      fallidos.push({ id: caso.id, motivo: `no se pudo leer la foto: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }

    process.stdout.write(`  leyendo ${caso.id}... `);
    const resultado = await observarGrietaConsenso({ fotoCercaDataUrl, fotoLejosDataUrl });
    if (!resultado.ok) {
      console.log(`falló (${resultado.motivo})`);
      fallidos.push({ id: caso.id, motivo: `observarGrietaConsenso devolvió ${resultado.motivo}` });
      continue;
    }
    console.log("ok");
    resueltos.push({
      caso,
      observacion: resultado.observacion,
      evaluada: evaluarTriageGrieta(entradaDe(caso, resultado.observacion)),
    });
  }
  return { resueltos, fallidos };
}

// ─── Punto de entrada ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const forzarSimulado = args.includes("--simulado");
  const forzarReal = args.includes("--real");
  const manifiestoArg = args.find((a) => a.startsWith("--manifiesto="))?.split("=").slice(1).join("=");

  const hayKey = !!process.env.ANTHROPIC_API_KEY && process.env.ALERTA_VISION_ENABLED === "true";
  const modoReal = forzarReal || (!forzarSimulado && hayKey && existsSync(MANIFIESTO_REAL));

  if (modoReal && !hayKey) {
    console.error("Modo real: hacen falta ANTHROPIC_API_KEY y ALERTA_VISION_ENABLED=true.");
    process.exit(1);
  }

  const ruta = manifiestoArg
    ? isAbsolute(manifiestoArg)
      ? manifiestoArg
      : resolve(process.cwd(), manifiestoArg)
    : modoReal
      ? MANIFIESTO_REAL
      : MANIFIESTO_SIMULADO;

  console.log("Seiricon Alerta — calibración de la lectura de visión");
  console.log(`Modo: ${modoReal ? "REAL (con fotos y modelo)" : "SIMULADO (observaciones escritas a mano, sin red)"}`);
  console.log(`Manifiesto: ${ruta}`);
  if (!modoReal && !hayKey) {
    console.log("(sin ANTHROPIC_API_KEY / ALERTA_VISION_ENABLED — ver calibracion/README.md para el modo real)");
  }

  if (!existsSync(ruta)) {
    console.error(`\nNo existe el manifiesto ${ruta}. Ver calibracion/README.md.`);
    process.exit(1);
  }

  const { casos, fallidos: fallidosDeLectura } = leerManifiesto(ruta);
  if (casos.length === 0 && fallidosDeLectura.length === 0) {
    console.error("\nEl manifiesto no tiene casos.");
    process.exit(1);
  }

  const { resueltos, fallidos } = modoReal ? await correrReal(casos) : correrSimulado(casos);
  const codigo = reportar(resueltos, [...fallidosDeLectura, ...fallidos]);
  if (codigo !== 0) {
    console.error("\nCalibración FALLIDA: hay falsos verdes o casos que no se pudieron evaluar.");
    process.exit(codigo);
  }
  console.log("\nCalibración sin falsos verdes.");
}

main().catch((error) => {
  console.error("calibrar-vision:", error);
  process.exit(1);
});
