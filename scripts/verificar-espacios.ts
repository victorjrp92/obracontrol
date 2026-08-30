/**
 * Verifica leaf-2.2 (`src/lib/plantillas-personal.ts` + `empezar/**`):
 *
 *  1. `LOCAL` tiene un catálogo de espacios de COMERCIO, distinto del
 *     residencial de `CASA`/`APARTAMENTO`, sin la palabra "Habitación(es)".
 *  2. Cada espacio de ese catálogo genera al menos una tarea (para las dos
 *     intenciones, REFORMA/OBRA_NUEVA) y esas tareas resuelven rendimiento
 *     (`buscarRendimiento`) y fase (`faseDeTarea`) — nunca un espacio sin
 *     salida ni una tarea que el motor no sepa estimar.
 *  3. `CASA`/`APARTAMENTO` NO cambiaron (control de no regresión): mismo
 *     catálogo, mismas claves, mismo comportamiento de `sugerirTareas()`.
 *  4. Cada piso admite un "uso" nombrable y opcional (p.ej. "Farmacia") y se
 *     persiste — sin tocar `prisma/schema.prisma` (no hay columna `nombre`
 *     en `Piso`): vive en `Unidad.nombre_personalizado`, un campo que ya
 *     existe y que ningún otro flujo de la obra personal CASA/LOCAL/APTO usa
 *     (1 unidad por piso en ese modo). Como no hay test runner ni forma de
 *     invocar server actions con DB/auth desde un script suelto, esta parte
 *     se verifica leyendo el CÓDIGO FUENTE como texto — mismo patrón que ya
 *     usa `verificar-duracion-calibracion.ts` (§3 y §9) para propiedades que
 *     no son de una función pura.
 *
 * No hay test runner configurado en el proyecto — este script es la suite de
 * verificación, en asserts planos (mismo patrón que verificar-reglas-alerta.ts).
 *
 * Uso: `npx tsx scripts/verificar-espacios.ts`. Sale con código 1 si algo falla.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ESPACIOS_PERSONAL,
  ESPACIOS_LOCAL,
  espaciosParaTipo,
  sugerirTareas,
  type TipoObra,
} from "@/lib/plantillas-personal";
import { buscarRendimiento } from "@/lib/rendimientos";
import { faseDeTarea } from "@/lib/fases-obra";

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

/** Quita tildes/mayúsculas para comparar texto sin depender del acento exacto. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("Seiricon — verificación de espacios por tipo de propiedad (leaf-2.2)\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("G1 — LOCAL tiene un catálogo de comercio, distinto del residencial y sin \"Habitación(es)\"");

verificar("ESPACIOS_LOCAL es un catálogo propio (no el mismo array que ESPACIOS_PERSONAL)", (ESPACIOS_LOCAL as unknown) !== (ESPACIOS_PERSONAL as unknown));
verificar("ESPACIOS_LOCAL no está vacío ni es trivial (≥ 6 espacios)", ESPACIOS_LOCAL.length >= 6);

verificar(
  "ningún key/label de ESPACIOS_LOCAL contiene \"habitac\" (sin tildes/mayúsculas)",
  ESPACIOS_LOCAL.every((e) => !normalizar(e.key).includes("habitac") && !normalizar(e.label).includes("habitac")),
);
verificar(
  "ESPACIOS_LOCAL no reutiliza las keys de conteo residenciales (\"bano\"/\"habitacion\")",
  !ESPACIOS_LOCAL.some((e) => e.key === "bano" || e.key === "habitacion"),
);

verificar("las keys de ESPACIOS_LOCAL son únicas", new Set(ESPACIOS_LOCAL.map((e) => e.key)).size === ESPACIOS_LOCAL.length);
verificar("los labels de ESPACIOS_LOCAL son únicos", new Set(ESPACIOS_LOCAL.map((e) => e.label)).size === ESPACIOS_LOCAL.length);

console.log("\nG1 — espaciosParaTipo() enruta al catálogo correcto");
verificar('espaciosParaTipo("LOCAL") === ESPACIOS_LOCAL', espaciosParaTipo("LOCAL") === ESPACIOS_LOCAL);
verificar('espaciosParaTipo("CASA") === ESPACIOS_PERSONAL', espaciosParaTipo("CASA") === ESPACIOS_PERSONAL);
verificar('espaciosParaTipo("APARTAMENTO") === ESPACIOS_PERSONAL', espaciosParaTipo("APARTAMENTO") === ESPACIOS_PERSONAL);
verificar('espaciosParaTipo("EDIFICIO") === ESPACIOS_PERSONAL (un edificio nunca es LOCAL)', espaciosParaTipo("EDIFICIO") === ESPACIOS_PERSONAL);
verificar("espaciosParaTipo(null) === ESPACIOS_PERSONAL (default seguro)", espaciosParaTipo(null) === ESPACIOS_PERSONAL);

console.log("\nG1 — los dos catálogos son disjuntos, salvo \"Otro espacio\" (comparten ese catch-all a propósito)");
const keysLocal = new Set(ESPACIOS_LOCAL.map((e) => e.key));
const keysResidencial = new Set(ESPACIOS_PERSONAL.map((e) => e.key));
const keysCompartidas = [...keysLocal].filter((k) => keysResidencial.has(k));
verificar(
  `solo "otro" se comparte entre catálogos (compartidas: ${keysCompartidas.join(", ") || "ninguna"})`,
  keysCompartidas.length === 1 && keysCompartidas[0] === "otro",
);
const labelsLocal = new Set(ESPACIOS_LOCAL.map((e) => e.label));
const labelsResidencial = new Set(ESPACIOS_PERSONAL.map((e) => e.label));
const labelsCompartidos = [...labelsLocal].filter((l) => labelsResidencial.has(l));
verificar(
  `solo "Otro espacio" se comparte entre catálogos por label (compartidos: ${labelsCompartidos.join(", ") || "ninguno"})`,
  labelsCompartidos.length === 1 && labelsCompartidos[0] === "Otro espacio",
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nG2 — todo espacio de comercio genera al menos una tarea, y esas tareas resuelven rendimiento y fase");

const TIPOS: TipoObra[] = ["REFORMA", "OBRA_NUEVA"];
let tareasComercioRevisadas = 0;
for (const tipoObra of TIPOS) {
  for (const espacio of ESPACIOS_LOCAL) {
    const tareas = sugerirTareas(espacio.label, tipoObra);
    verificar(`sugerirTareas("${espacio.label}", "${tipoObra}") no queda vacío (espacio de comercio sin callejón sin salida)`, tareas.length > 0);
    for (const t of tareas) {
      tareasComercioRevisadas++;
      verificar(`[${tipoObra}/${espacio.label}] "${t.nombre}" resuelve rendimiento`, buscarRendimiento(t.nombre) !== null);
      verificar(`[${tipoObra}/${espacio.label}] "${t.nombre}" resuelve fase`, faseDeTarea(t.nombre) !== null);
      verificar(`[${tipoObra}/${espacio.label}] "${t.nombre}" tiene duración > 0`, t.tiempo_acordado_dias > 0);
    }
  }
}
verificar("se revisó al menos una tarea por cada espacio de comercio × intención", tareasComercioRevisadas > 0);

console.log("\nG2 — los dos espacios con plantilla propia (\"Cocina\"/\"Baño social\") la resuelven de verdad, no caen a genéricas por accidente");
const conCocina = sugerirTareas("Cocina / zona de preparación", "REFORMA");
verificar(
  '"Cocina / zona de preparación" trae tareas de la plantilla "Cocina" (p.ej. "Estuco paredes cocina")',
  conCocina.some((t) => t.nombre === "Estuco paredes cocina"),
);
const conBanoClientes = sugerirTareas("Baño de clientes", "REFORMA");
verificar(
  '"Baño de clientes" trae tareas de la plantilla "Baño social" (p.ej. "Pintura baño social")',
  conBanoClientes.some((t) => t.nombre === "Pintura baño social"),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nG3 — CASA/APARTAMENTO no cambiaron (control de no regresión)");

const KEYS_RESIDENCIAL_ESPERADAS = [
  "cocina", "bano", "sala", "comedor", "habitacion", "estudio",
  "lavanderia", "balcon", "garaje", "fachada", "pasillo", "otro",
];
verificar(
  `ESPACIOS_PERSONAL sigue teniendo exactamente ${KEYS_RESIDENCIAL_ESPERADAS.length} espacios`,
  ESPACIOS_PERSONAL.length === KEYS_RESIDENCIAL_ESPERADAS.length,
);
verificar(
  "ESPACIOS_PERSONAL tiene EXACTAMENTE las mismas keys, en el mismo orden, que antes de este leaf",
  JSON.stringify(ESPACIOS_PERSONAL.map((e) => e.key)) === JSON.stringify(KEYS_RESIDENCIAL_ESPERADAS),
);
verificar("ESPACIOS_PERSONAL no incluye ningún espacio de comercio (p.ej. \"caja\"/\"vitrina\"/\"oficina\")", !ESPACIOS_PERSONAL.some((e) => ["caja", "vitrina", "oficina", "bodega", "zona_atencion"].includes(e.key)));

const cocinaReforma = sugerirTareas("Cocina", "REFORMA");
verificar(
  '"Cocina" (residencial) sigue anteponiendo la demolición en REFORMA',
  cocinaReforma[0]?.nombre === "Demolición y retiro de acabados existentes",
);
verificar(
  '"Cocina" (residencial) sigue trayendo "Mueble bajo cocina" (plantilla Madera)',
  cocinaReforma.some((t) => t.nombre === "Mueble bajo cocina"),
);
const garajeObraNueva = sugerirTareas("Garaje", "OBRA_NUEVA");
verificar(
  '"Garaje" (sin plantilla) sigue anteponiendo "Levantar muros y obra gruesa" en OBRA_NUEVA',
  garajeObraNueva[0]?.nombre === "Levantar muros y obra gruesa",
);

// ─────────────────────────────────────────────────────────────────────────
console.log('\nG4 — cada piso admite un uso nombrable y opcional, y se persiste (sin tocar prisma/)');

function leerFuente(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const FUENTE_TYPES = leerFuente("../src/app/(dashboard)/empezar/types.ts");
const FUENTE_ACTIONS = leerFuente("../src/app/(dashboard)/empezar/actions.ts");
const FUENTE_WIZARD = leerFuente("../src/app/(dashboard)/empezar/IntentWizard.tsx");
const FUENTE_SCHEMA = leerFuente("../prisma/schema.prisma");

verificar(
  "PisoInput (types.ts) declara `usoNombre?: string` — el contrato acepta un uso opcional por piso",
  /usoNombre\?:\s*string/.test(FUENTE_TYPES),
);

verificar(
  "prisma/schema.prisma NO tiene columna `nombre` en `model Piso` (no se tocó el schema)",
  !/model Piso \{[^}]*\n\s*nombre\s+String/.test(FUENTE_SCHEMA),
);
verificar(
  "`Unidad.nombre_personalizado` (String?) existe en el schema — es donde vive el uso, sin migración",
  /model Unidad \{[\s\S]*?nombre_personalizado\s+String\?/.test(FUENTE_SCHEMA),
);

verificar(
  "crearObraPersonal() persiste el uso al crear la unidad del piso (nombre_personalizado: usoNombreValido(pisoInput.usoNombre))",
  (FUENTE_ACTIONS.match(/nombre_personalizado:\s*usoNombreValido\(pisoInput\.usoNombre\)/g) ?? []).length >= 2,
);
verificar(
  "editarObraPersonal() también lo persiste al crear un piso NUEVO durante la edición (misma expresión, segunda vez)",
  (FUENTE_ACTIONS.match(/nombre_personalizado:\s*usoNombreValido\(pisoInput\.usoNombre\)/g) ?? []).length === 2,
);
verificar(
  "sincronizarUnidad() actualiza el uso de un piso YA EXISTENTE al editar (tx.unidad.update con nombre_personalizado)",
  /tx\.unidad\.update\(\{\s*where:\s*\{\s*id:\s*unidad\.id\s*\},\s*data:\s*\{\s*nombre_personalizado:\s*usoNombreValido\(args\.usoNombre\)/.test(
    FUENTE_ACTIONS,
  ),
);
verificar(
  "cargarObraParaEditar() lee el uso guardado de vuelta al precargar el wizard de edición",
  /usoNombre:\s*unidad\.nombre_personalizado/.test(FUENTE_ACTIONS),
);
verificar(
  "usoNombreValido() recorta y limpia el valor (nunca guarda solo espacios en blanco)",
  /function usoNombreValido[\s\S]{0,200}?\.trim\(\)/.test(FUENTE_ACTIONS),
);

verificar(
  "el wizard (PisoW) guarda el uso por piso en su estado (usoNombre?: string)",
  /usoNombre\?:\s*string/.test(FUENTE_WIZARD),
);
verificar(
  "el wizard tiene un mutador propio para el uso del piso (setUsoPiso)",
  /function setUsoPiso\(/.test(FUENTE_WIZARD),
);
verificar(
  "el input de uso solo se muestra en LOCAL (gate `esLocal &&` antes del campo)",
  /esLocal &&[\s\S]{0,120}?Uso de este piso/.test(FUENTE_WIZARD),
);
verificar(
  "el payload que se envía a crear/editar la obra incluye usoNombre por piso",
  /usoNombre:\s*p\.usoNombre\?\.trim\(\)\s*\|\|\s*undefined/.test(FUENTE_WIZARD),
);
verificar(
  "\"copiar espacios del piso anterior\" NO copia el uso del piso anterior (cada piso es un negocio distinto)",
  /Preserva el uso propio de ESTE piso/.test(FUENTE_WIZARD),
);

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Espacios por tipo de propiedad y uso por piso verificados sin errores.");
