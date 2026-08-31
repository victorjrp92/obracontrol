// ─────────────────────────────────────────────────────────────────────────
// Verificación del PREPROYECTO: el estado en el que se cotiza.
//
// Tres decisiones de diseño se sostienen sobre invariantes que un refactor
// distraído rompe sin que nada se queje, y por eso están aquí:
//
//   1. Cotizar NO consume cupo del plan. El cobro mira `estado = ACTIVO`, así
//      que `PREPROYECTO` tiene que ser un valor DISTINTO. Si alguien lo
//      colapsara con ACTIVO, cotizar empezaría a costar plata en silencio.
//   2. El levantamiento NO es una evidencia. `Evidencia.tarea_id` es
//      obligatorio a propósito: es la cadena que respalda las aprobaciones y
//      con ellas los pagos. Aquí se comprueba que nadie lo aflojó a opcional
//      «para poder guardar las fotos del levantamiento».
//   3. La cotización es un documento firmable con folio propio. Si `CZ` se
//      solapara con otro tipo, dos documentos distintos compartirían familia
//      de folio y el cotejo dejaría de identificar cuál es cuál.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CAPACIDADES, capacidadesDe, limitePreproyectos, puede } from "@/lib/plan";
import { ETIQUETA_TIPO } from "@/lib/documentos/lenguaje";
import { PREFIJO_POR_TIPO } from "@/lib/documentos/versiones";
import { PATRON_FOLIO, PREFIJOS, generarFolio, prefijoDeFolio } from "@/lib/documentos/folio";
import type { TipoCuenta, PlanTipo } from "@/generated/prisma";

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

const PERFILES: TipoCuenta[] = ["CONSTRUCTORA", "CONTRATISTA", "PROPIETARIO", "ARQUITECTO"];
const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");

/** El bloque de un modelo del schema, sin el resto del archivo. */
function modelo(nombre: string): string {
  const ini = SCHEMA.indexOf(`model ${nombre} {`);
  if (ini < 0) return "";
  return SCHEMA.slice(ini, SCHEMA.indexOf("\n}", ini));
}

/** El bloque de un enum del schema. */
function enumerado(nombre: string): string {
  const ini = SCHEMA.indexOf(`enum ${nombre} {`);
  if (ini < 0) return "";
  return SCHEMA.slice(ini, SCHEMA.indexOf("\n}", ini));
}

/**
 * Los VALORES de un enum, en orden y sin comentarios.
 *
 * Buscar el nombre de un valor con `indexOf` sobre el bloque crudo no sirve:
 * los comentarios `///` del propio enum mencionan otros valores por su nombre,
 * y la primera coincidencia cae dentro de un comentario. Una comprobación de
 * ORDEN se hace sobre la lista de valores, no sobre el texto que los rodea.
 */
function valoresDeEnum(nombre: string): string[] {
  return [...enumerado(nombre).matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*$/gm)].map((m) => m[1]);
}

console.log("Preproyecto — verificación\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Cotizar no consume cupo: PREPROYECTO es un estado aparte");

const estados = enumerado("EstadoProyecto");
verificar("`PREPROYECTO` existe en EstadoProyecto", /^\s*PREPROYECTO\s*$/m.test(estados));
verificar("`ACTIVO` sigue existiendo y es otro valor", /^\s*ACTIVO\s*$/m.test(estados));
{
  const valores = valoresDeEnum("EstadoProyecto");
  verificar(
    `PREPROYECTO va antes que ACTIVO en el enum (${valores.join(" → ")})`,
    valores.indexOf("PREPROYECTO") === 0 && valores.indexOf("ACTIVO") === 1,
  );
}
// El invariante que hace gratis al preproyecto: los conteos que ENFORZAN el
// tope del plan filtran por `estado: "ACTIVO"`, así que un PREPROYECTO no
// consume cupo. Se mide sobre el código que cuenta, no sobre un comentario:
// la primera versión buscaba una frase en `plan.ts` y se rompió sola cuando
// los topes se mudaron a `suscripcion.ts` — un oráculo que falla porque
// alguien movió un comentario no está midiendo nada.
//
// Solo cuentan los conteos de CUPO (`const activas = …`). El de `actions.ts`
// que cuenta TODOS los proyectos es el que arma el número de registro
// (`OB-001`) y debe contarlos todos, incluidos los preproyectos, o dos obras
// terminarían con el mismo número. La segunda versión de este check no hacía
// esa distinción y acusaba a esa línea sana.
{
  const archivos = [
    "src/app/(dashboard)/empezar/actions.ts",
    "src/app/(dashboard)/dashboard/empresa/page.tsx",
  ];
  let cupos = 0;
  let conFiltro = 0;
  for (const f of archivos) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/const activas = await [\s\S]{0,220}?\}\);/g)) {
      cupos++;
      if (/estado:\s*"ACTIVO"/.test(m[0])) conFiltro++;
    }
  }
  verificar(
    `los ${cupos} conteos de CUPO filtran por ACTIVO (${conFiltro}), así que un preproyecto no gasta plan`,
    cupos >= 2 && conFiltro === cupos,
  );
  // CONTROL POSITIVO: el mismo patrón sin el filtro tiene que fallar la prueba.
  const sinFiltro = 'const activas = await tx.proyecto.count({ where: { constructora_id: x } });';
  verificar(
    "CONTROL: un conteo de cupo sin filtro de estado NO pasaría",
    /const activas = await [\s\S]{0,220}?\}\);/.test(sinFiltro) &&
      !/estado:\s*"ACTIVO"/.test(sinFiltro),
  );
  // Y el conteo del número de registro sigue contándolos TODOS, a propósito.
  const acciones = readFileSync(archivos[0], "utf8");
  verificar(
    "el número de registro sigue contando todos los proyectos (si no, se repetiría)",
    /const totalProyectos = await prisma\.proyecto\.count\(\{ where: \{ constructora_id: constructoraId \} \}\)/.test(acciones),
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. El levantamiento NO debilita la cadena de evidencia");

const evidencia = modelo("Evidencia");
verificar(
  "`Evidencia.tarea_id` sigue siendo OBLIGATORIO (sin `?`)",
  /^\s*tarea_id\s+String\s*$/m.test(evidencia) || /^\s*tarea_id\s+String\s+[^?]/m.test(evidencia),
);
verificar("`Evidencia.tarea_id` NO es opcional", !/^\s*tarea_id\s+String\?/m.test(evidencia));

const foto = modelo("FotoLevantamiento");
verificar("existe el modelo FotoLevantamiento", foto.length > 0);
verificar("cuelga del proyecto de forma obligatoria", /^\s*proyecto_id\s+String\s*$/m.test(foto));
verificar(
  "el espacio es OPCIONAL (se asocia después, no en obra)",
  /^\s*espacio_id\s+String\?/m.test(foto),
);
verificar("guarda la marca de captura del dispositivo", /timestamp_captura\s+DateTime/.test(foto));
verificar("guarda GPS opcional", /gps_lat\s+Float\?/.test(foto) && /gps_lng\s+Float\?/.test(foto));
verificar(
  "borrar el proyecto se lleva sus fotos (Cascade)",
  /proyecto\s+Proyecto\s+@relation\([^)]*onDelete:\s*Cascade/.test(foto),
);
verificar(
  "reorganizar espacios NO borra el levantamiento (SetNull)",
  /espacio\s+Espacio\?\s+@relation\([^)]*onDelete:\s*SetNull/.test(foto),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. La cotización como documento firmable");

verificar(
  "COTIZACION existe en TipoDocumentoFirmable",
  /^\s*COTIZACION\s*$/m.test(enumerado("TipoDocumentoFirmable")),
);
verificar("tiene etiqueta legible", ETIQUETA_TIPO.COTIZACION === "Cotización");
verificar("su prefijo de folio es CZ", PREFIJO_POR_TIPO.COTIZACION === "CZ");
verificar("CZ está declarado en PREFIJOS", PREFIJOS.includes("CZ"));

const conCz = Object.entries(PREFIJO_POR_TIPO).filter(([, p]) => p === "CZ");
verificar(
  `CZ lo usa un solo tipo de documento (${conCz.map(([t]) => t).join(", ")})`,
  conCz.length === 1 && conCz[0][0] === "COTIZACION",
);

{
  const folio = generarFolio("CZ", new Date(2026, 8, 15));
  verificar(`el folio de cotización cumple el patrón (${folio})`, PATRON_FOLIO.test(folio));
  verificar("y se reconoce como CZ al leerlo de vuelta", prefijoDeFolio(folio) === "CZ");
  verificar("lleva la fecha local del día de emisión", folio.startsWith("CZ-20260915-"));

  // Dos folios seguidos no pueden coincidir: la parte aleatoria es lo que
  // impide adivinar el folio de un documento ajeno a partir del propio.
  const muchos = new Set(Array.from({ length: 500 }, () => generarFolio("CZ")));
  verificar(`500 folios seguidos dan 500 distintos (${muchos.size})`, muchos.size === 500);
}

// Todos los tipos tienen etiqueta y prefijo: si mañana entra otro y alguien
// olvida uno de los dos mapas, esto lo dice.
{
  const tipos = valoresDeEnum("TipoDocumentoFirmable");
  verificar(
    `los ${tipos.length} tipos del enum tienen etiqueta`,
    tipos.length >= 6 && tipos.every((t) => typeof ETIQUETA_TIPO[t as never] === "string"),
  );
  verificar(
    `los ${tipos.length} tipos del enum tienen prefijo de folio`,
    tipos.every((t) => PREFIJOS.includes(PREFIJO_POR_TIPO[t as never])),
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. Capacidades");

verificar("`preproyectos` y `cotizacionFormal` están en CAPACIDADES",
  CAPACIDADES.includes("preproyectos") && CAPACIDADES.includes("cotizacionFormal"));

for (const tipo of PERFILES) {
  const fila = capacidadesDe(tipo);
  verificar(`${tipo} declara ambas capacidades como booleano`,
    typeof fila.preproyectos === "boolean" && typeof fila.cotizacionFormal === "boolean");
}

verificar("los cuatro perfiles pueden levantar fotos previas",
  PERFILES.every((t) => puede(t, "preproyectos")));
verificar("el PROPIETARIO no emite cotización formal (nadie se cotiza a sí mismo)",
  !puede("PROPIETARIO", "cotizacionFormal"));
verificar("los otros tres sí la emiten",
  (["CONSTRUCTORA", "CONTRATISTA", "ARQUITECTO"] as TipoCuenta[]).every((t) =>
    puede(t, "cotizacionFormal")));
verificar("quien puede cotizar puede preproyectar (no hay cotización sin preproyecto)",
  PERFILES.every((t) => !puede(t, "cotizacionFormal") || puede(t, "preproyectos")));

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. El tope de preproyectos abiertos");

const ESPERADO_GRATIS: Record<TipoCuenta, number> = {
  PROPIETARIO: 1,
  CONTRATISTA: 3,
  ARQUITECTO: 6,
  CONSTRUCTORA: 10,
};
for (const tipo of PERFILES) {
  verificar(
    `plan gratis · ${tipo} → ${ESPERADO_GRATIS[tipo]} preproyectos`,
    limitePreproyectos("PERSONAL", tipo) === ESPERADO_GRATIS[tipo],
  );
}

verificar(
  "el arquitecto cotiza más que el contratista (su levantamiento es parte del servicio)",
  limitePreproyectos("PERSONAL", "ARQUITECTO") > limitePreproyectos("PERSONAL", "CONTRATISTA"),
);
verificar(
  "el propietario es el más bajo: tiene una casa, no le cotiza a nadie",
  PERFILES.filter((t) => t !== "PROPIETARIO").every(
    (t) => limitePreproyectos("PERSONAL", t) > limitePreproyectos("PERSONAL", "PROPIETARIO"),
  ),
);

// El plan gratis NO escala: el tope es la tabla, pase lo que pase con las obras.
verificar(
  "en plan gratis el tope no se mueve con las obras activas",
  [0, 1, 5, 40].every((n) => limitePreproyectos("PERSONAL", "ARQUITECTO", n) === 6),
);

// En plan de pago sí escala, a razón de tres por obra activa.
const PAGOS: PlanTipo[] = ["OBRA", "PROYECTO", "EMPRESA"];
for (const plan of PAGOS) {
  verificar(
    `plan ${plan} · con 0 obras se respeta el piso del perfil (6)`,
    limitePreproyectos(plan, "ARQUITECTO", 0) === 6,
  );
  verificar(
    `plan ${plan} · con 20 obras escala a 60 (tres cotizaciones por obra)`,
    limitePreproyectos(plan, "ARQUITECTO", 20) === 60,
  );
  verificar(
    `plan ${plan} · nunca baja del piso del perfil`,
    [0, 1, 2].every((n) => limitePreproyectos(plan, "ARQUITECTO", n) >= 6),
  );
}
verificar(
  "el escalado es monótono: más obras nunca dan menos cupo",
  Array.from({ length: 30 }, (_, n) => limitePreproyectos("EMPRESA", "CONSTRUCTORA", n)).every(
    (v, i, a) => i === 0 || v >= a[i - 1],
  ),
);

// Invariante que sobrevive a cualquier cambio de la matriz.
verificar(
  "el tope es > 0 exactamente cuando el perfil tiene la capacidad",
  PERFILES.every((t) => (limitePreproyectos("PERSONAL", t) > 0) === puede(t, "preproyectos")),
);

// Un conteo corrupto llegando a una guarda de límite es un defecto que hay que
// VER, no algo que deba tarifarse en silencio.
for (const malo of [-1, 1.5, NaN, Infinity]) {
  let lanzo = false;
  try {
    limitePreproyectos("EMPRESA", "ARQUITECTO", malo);
  } catch {
    lanzo = true;
  }
  verificar(`obrasActivas = ${malo} lanza en vez de devolver un número`, lanzo);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. La migración");

const DIR = "prisma/migrations";
const MIG = readdirSync(DIR)
  .filter((n) => n.includes("preproyecto_levantamiento"))
  .map((n) => readFileSync(join(DIR, n, "migration.sql"), "utf8"))
  .join("\n");

verificar("existe la migración del preproyecto", MIG.length > 0);
verificar("añade PREPROYECTO al enum de estado", /ADD VALUE IF NOT EXISTS 'PREPROYECTO'/.test(MIG));
verificar("añade COTIZACION al enum de documentos", /ADD VALUE IF NOT EXISTS 'COTIZACION'/.test(MIG));
verificar("crea la tabla fotos_levantamiento", /CREATE TABLE IF NOT EXISTS "fotos_levantamiento"/.test(MIG));
verificar("la deja con RLS activo", /ALTER TABLE "fotos_levantamiento" ENABLE ROW LEVEL SECURITY/.test(MIG));
verificar(
  "y sin privilegios para anon ni authenticated",
  /REVOKE ALL ON TABLE "fotos_levantamiento" FROM anon/.test(MIG) &&
    /REVOKE ALL ON TABLE "fotos_levantamiento" FROM authenticated/.test(MIG),
);
verificar(
  "el FK del proyecto cascadea y el del espacio no",
  /proyecto_id_fkey"[\s\S]{0,200}?ON DELETE CASCADE/.test(MIG) &&
    /espacio_id_fkey"[\s\S]{0,200}?ON DELETE SET NULL/.test(MIG),
);
verificar(
  "indexa por proyecto y por espacio (son las dos consultas del flujo)",
  /fotos_levantamiento_proyecto_id_idx/.test(MIG) && /fotos_levantamiento_espacio_id_idx/.test(MIG),
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Preproyecto, levantamiento y cotización verificados sin errores.");
