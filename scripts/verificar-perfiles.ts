/**
 * Verifica la capa de perfiles de Seiricon (`src/lib/plan.ts`) contra la sección
 * 1 y la sección 3 del spec del arquitecto: que la matriz de capacidades cubra
 * los CUATRO tipos de cuenta sin huecos, que `ARQUITECTO` sea el único perfil
 * B2C con productos técnicos, que se comporte como cuenta personal, y que los
 * tramos de precio corten por obras ACTIVAS donde dice el spec (1-3 / 4-10 /
 * 11-25 / +25). No hay test runner configurado en el proyecto — este script es
 * la suite de verificación, en asserts planos.
 *
 * La lista de tipos NO se lee de `plan.ts`: se lee del enum generado por Prisma,
 * que es la fuente de verdad. Así, si mañana aparece un quinto tipo y nadie
 * actualiza la matriz, el hueco sale aquí en vez de en producción.
 *
 * Uso: `npx tsx scripts/verificar-perfiles.ts`. Sale con código 1 si algo falla.
 */
import { TipoCuenta } from "@/generated/prisma";
import type { PlanTipo } from "@/generated/prisma";
import {
  CAPACIDADES,
  capacidadesDe,
  esCuentaPersonal,
  limiteObrasActivas,
  modulosVisibles,
  puede,
  puedeGestionarEquipoDirecto,
  tonoPerfil,
  tramoPorObrasActivas,
  TRAMOS_OBRAS_ACTIVAS,
  type TramoObrasKey,
} from "@/lib/plan";

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

function verificarLanza(descripcion: string, fn: () => void) {
  total++;
  try {
    fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó error)`);
  } catch {
    console.log(`  OK   ${descripcion}`);
  }
}

/** Los tipos de cuenta tal como los declara el enum de Prisma. */
const TIPOS = Object.values(TipoCuenta);

/** Planes de pago: ninguno lleva tope de obras activas. */
const PLANES_DE_PAGO: PlanTipo[] = ["OBRA", "PROYECTO", "EMPRESA"];

function assertTramo(descripcion: string, obrasActivas: number, esperado: TramoObrasKey) {
  const obtenido = tramoPorObrasActivas(obrasActivas).key;
  verificar(`${descripcion} → esperado ${esperado}, obtuvo ${obtenido}`, obtenido === esperado);
}

console.log("Seiricon — verificación de la capa de perfiles (plan.ts)\n");

console.log("Los cuatro tipos de cuenta existen en el enum");
verificar(`el enum tiene exactamente 4 tipos (tiene ${TIPOS.length})`, TIPOS.length === 4);
for (const tipo of ["CONSTRUCTORA", "CONTRATISTA", "PROPIETARIO", "ARQUITECTO"] as const) {
  verificar(`el enum incluye ${tipo}`, TIPOS.includes(tipo));
}

console.log("\nLa matriz de capacidades cubre los cuatro tipos sin huecos");
for (const tipo of TIPOS) {
  const fila = capacidadesDe(tipo);
  verificar(`${tipo} tiene fila en la matriz`, fila !== undefined && typeof fila === "object");
  if (!fila) continue;

  const faltantes = CAPACIDADES.filter((cap) => typeof fila[cap] !== "boolean");
  verificar(
    `${tipo} declara las ${CAPACIDADES.length} capacidades como booleano${faltantes.length ? ` (faltan: ${faltantes.join(", ")})` : ""}`,
    faltantes.length === 0
  );

  const sobrantes = Object.keys(fila).filter((k) => !CAPACIDADES.includes(k as never));
  verificar(
    `${tipo} no declara capacidades fuera de la lista${sobrantes.length ? ` (sobran: ${sobrantes.join(", ")})` : ""}`,
    sobrantes.length === 0
  );
}

console.log("\nProductos técnicos — solo el arquitecto y la empresa (spec C2)");
verificar("ARQUITECTO tiene productosTecnicos", puede("ARQUITECTO", "productosTecnicos") === true);
verificar("CONSTRUCTORA tiene productosTecnicos", puede("CONSTRUCTORA", "productosTecnicos") === true);
verificar("CONTRATISTA NO tiene productosTecnicos", puede("CONTRATISTA", "productosTecnicos") === false);
verificar("PROPIETARIO NO tiene productosTecnicos", puede("PROPIETARIO", "productosTecnicos") === false);
console.log("  Es lo único que distingue al arquitecto del contratista en la matriz:");
const diferencias = CAPACIDADES.filter(
  (cap) => capacidadesDe("ARQUITECTO")[cap] !== capacidadesDe("CONTRATISTA")[cap]
);
verificar(
  `ARQUITECTO y CONTRATISTA difieren solo en productosTecnicos (difieren en: ${diferencias.join(", ") || "nada"})`,
  diferencias.length === 1 && diferencias[0] === "productosTecnicos"
);

console.log("\nEl arquitecto es una cuenta PERSONAL (modo simple), no una empresa");
verificar('esCuentaPersonal("ARQUITECTO") es true', esCuentaPersonal("ARQUITECTO") === true);
verificar('esCuentaPersonal("CONTRATISTA") es true', esCuentaPersonal("CONTRATISTA") === true);
verificar('esCuentaPersonal("PROPIETARIO") es true', esCuentaPersonal("PROPIETARIO") === true);
verificar('esCuentaPersonal("CONSTRUCTORA") es false', esCuentaPersonal("CONSTRUCTORA") === false);
verificar("ARQUITECTO usa el modo simple", puede("ARQUITECTO", "modoSimple") === true);
verificar(
  "el ADMIN_GENERAL de un ARQUITECTO gestiona equipo directo",
  puedeGestionarEquipoDirecto("ADMIN_GENERAL", "ARQUITECTO") === true
);
verificar(
  "el sidebar del ARQUITECTO no queda vacío y es el mismo de los otros perfiles personales",
  modulosVisibles("ARQUITECTO").length > 0 &&
    JSON.stringify(modulosVisibles("ARQUITECTO")) === JSON.stringify(modulosVisibles("CONTRATISTA"))
);
console.log("  El tono NO puede caer en el de empresa (diría «proyecto» y «Contratistas»):");
const tonoArquitecto = tonoPerfil("ARQUITECTO");
verificar(
  `tonoPerfil("ARQUITECTO") no es el de CONSTRUCTORA (obraSingular = "${tonoArquitecto.obraSingular}")`,
  JSON.stringify(tonoArquitecto) !== JSON.stringify(tonoPerfil("CONSTRUCTORA"))
);
verificar('el arquitecto habla de "obra", no de "proyecto"', tonoArquitecto.obraSingular === "obra");

console.log("\nTope de obras ACTIVAS del plan gratuito (PERSONAL)");
const limiteArquitecto = limiteObrasActivas("PERSONAL", "ARQUITECTO");
verificar(
  `limiteObrasActivas("PERSONAL", "ARQUITECTO") es finito (es ${limiteArquitecto})`,
  Number.isFinite(limiteArquitecto)
);
verificar("es un entero >= 1", Number.isInteger(limiteArquitecto) && limiteArquitecto >= 1);
verificar(
  "deja probar el flujo multi-obra (>= 2, el arquitecto trabaja para varios clientes)",
  limiteArquitecto >= 2
);
verificar(
  "no regala el tramo de entrada entero (< 3, o nadie subiría nunca de tramo)",
  limiteArquitecto < 3
);
verificar('PROPIETARIO gratis se queda en 1 obra', limiteObrasActivas("PERSONAL", "PROPIETARIO") === 1);
verificar('CONTRATISTA gratis llega a 2 obras', limiteObrasActivas("PERSONAL", "CONTRATISTA") === 2);
for (const plan of PLANES_DE_PAGO) {
  verificar(
    `el plan ${plan} no le pone tope al ARQUITECTO`,
    limiteObrasActivas(plan, "ARQUITECTO") === Infinity
  );
}

console.log("\nTramos de precio por obras ACTIVAS — cortes en 3 / 10 / 25 (spec §3)");
verificar("hay exactamente 4 tramos", TRAMOS_OBRAS_ACTIVAS.length === 4);
const LIMITES: { key: TramoObrasKey; min: number; max: number }[] = [
  { key: "ENTRADA", min: 1, max: 3 },
  { key: "OBJETIVO", min: 4, max: 10 },
  { key: "ESTUDIO", min: 11, max: 25 },
  { key: "A_CONVENIR", min: 26, max: Infinity },
];
LIMITES.forEach((esperado, i) => {
  const tramo = TRAMOS_OBRAS_ACTIVAS[i];
  verificar(
    `tramo ${i + 1} es ${esperado.key} y va de ${esperado.min} a ${esperado.max}`,
    tramo !== undefined &&
      tramo.key === esperado.key &&
      tramo.min === esperado.min &&
      tramo.max === esperado.max
  );
});
console.log("  Sin huecos entre tramos: cada uno arranca justo donde acabó el anterior");
for (let i = 1; i < TRAMOS_OBRAS_ACTIVAS.length; i++) {
  const previo = TRAMOS_OBRAS_ACTIVAS[i - 1];
  const actual = TRAMOS_OBRAS_ACTIVAS[i];
  verificar(
    `${actual.key}.min (${actual.min}) === ${previo.key}.max + 1 (${previo.max + 1})`,
    actual.min === previo.max + 1
  );
}
verificar(
  "el último tramo es abierto (max = Infinity)",
  TRAMOS_OBRAS_ACTIVAS[TRAMOS_OBRAS_ACTIVAS.length - 1].max === Infinity
);

console.log("  Bordes exactos de cada corte:");
assertTramo("0 obras activas (cuenta quieta)", 0, "ENTRADA");
assertTramo("1 obra activa", 1, "ENTRADA");
assertTramo("3 obras activas (último del tramo de entrada)", 3, "ENTRADA");
assertTramo("4 obras activas (primero del tramo objetivo)", 4, "OBJETIVO");
assertTramo("10 obras activas (último del tramo objetivo)", 10, "OBJETIVO");
assertTramo("11 obras activas (primero del tramo estudio)", 11, "ESTUDIO");
assertTramo("25 obras activas (último del tramo estudio)", 25, "ESTUDIO");
assertTramo("26 obras activas (+25 → a convenir)", 26, "A_CONVENIR");
assertTramo("500 obras activas", 500, "A_CONVENIR");

console.log("  Un conteo imposible es un defecto, no una tarifa:");
verificarLanza("tramoPorObrasActivas(-1) lanza error", () => tramoPorObrasActivas(-1));
verificarLanza("tramoPorObrasActivas(2.5) lanza error", () => tramoPorObrasActivas(2.5));
verificarLanza("tramoPorObrasActivas(NaN) lanza error", () => tramoPorObrasActivas(NaN));
verificarLanza("tramoPorObrasActivas(Infinity) lanza error", () => tramoPorObrasActivas(Infinity));

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Capa de perfiles de Seiricon verificada sin errores.");
