/**
 * Verificación de `src/lib/fases-obra.ts` — el mapeo de fases de la importación
 * de presupuestos. TypeScript puro, sin red ni base de datos.
 *
 * POR QUÉ EXISTE: esta función decide en qué fase cae cada partida de un
 * presupuesto importado desde Excel. Equivocarse no es un detalle de UI —
 * mueve plata de capítulo y descuadra el cronograma que sale de ahí.
 *
 * El caso que la motivó: «ACABADOS», un capítulo estándar de cualquier
 * presupuesto colombiano, resolvía a «Pintura». La rama de inclusión inversa
 * aceptaba cualquier fragmento y puntuaba por el largo de la VARIANTE, así que
 * un término genérico y corto se llevaba la variante más larga que lo
 * contuviera. Repello, estuco, pisos, enchapes y grifería terminaban todos
 * clasificados como pintura.
 *
 * Uso: npm run verify:fases
 */
import { FASES_OBRA, normalizarFase, ordenFase, faseDeTarea } from "../src/lib/fases-obra";

let ok = 0;
let fallos = 0;

function comprobar(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    ok++;
    console.log(`  OK   ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

function mapea(entrada: string, esperado: string | null) {
  const r = normalizarFase(entrada);
  comprobar(`"${entrada}" → ${esperado ?? "null (mapeo manual)"}`, r === esperado, `obtuvo ${r ?? "null"}`);
}

// ─── 1. Los capítulos ambiguos NO se adivinan ───────────────────────────────
seccion("1) Términos de CAPÍTULO: ambiguos, van a mapeo manual");

// «Acabados» agrupa repello, estuco, pintura, pisos, enchapes y grifería.
// Elegir una sola de esas fases es clasificar mal el resto.
mapea("ACABADOS", null);
mapea("Acabados", null);
mapea("acabado", null);
// «Instalaciones» puede ser eléctrica o hidrosanitaria. Nadie puede saberlo.
mapea("Instalaciones", null);
mapea("INSTALACIONES", null);
mapea("instalacion", null);
// «Obra» a secas es el proyecto entero.
mapea("Obra", null);

// ─── 2. Los capítulos que SÍ son inequívocos siguen funcionando ─────────────
seccion("2) Capítulos inequívocos: se reconocen igual que antes");

// Los tres capítulos del presupuesto que motivó esto (Juan Carlos Ordóñez).
mapea("PRELIMINARES", "Preliminares/Demolición");
mapea("ESTRUCTURA", "Obra gris/Estructura");
mapea("Preliminares", "Preliminares/Demolición");
mapea("Demolicion", "Preliminares/Demolición");
mapea("Cimentacion", "Obra gris/Estructura");
mapea("Mamposteria", "Obra gris/Estructura");
mapea("Carpinteria", "Carpintería/Madera");
mapea("Cocina", "Cocina/Closets");
mapea("Aparatos", "Aparatos y grifería");
mapea("Enchapes", "Pisos/Enchapes");

// ─── 3. Desambiguación por especificidad ────────────────────────────────────
seccion("3) Cuando el usuario SÍ especifica, se respeta");

mapea("Instalaciones electricas", "Instalaciones eléctricas");
mapea("Instalaciones hidrosanitarias", "Instalaciones hidrosanitarias");
mapea("Acabados de piso", "Pisos/Enchapes");
mapea("Acabados de pintura", "Pintura");
mapea("Red electrica", "Instalaciones eléctricas");
mapea("Plomeria", "Instalaciones hidrosanitarias");

// ─── 4. Tolerancia que no se puede perder ───────────────────────────────────
seccion("4) Mayúsculas, tildes, plurales y sufijos");

mapea("PINTURA", "Pintura");
mapea("Pintúra", "Pintura");
mapea("pisos", "Pisos/Enchapes");
mapea("piso", "Pisos/Enchapes");
mapea("electricas", "Instalaciones eléctricas");
mapea("closets", "Cocina/Closets");
mapea("  Estuco  ", "Repello/Estuco");

// Los 11 nombres curados deben reconocerse a sí mismos, sí o sí.
seccion("5) Toda fase curada se reconoce a sí misma");
for (const fase of FASES_OBRA) {
  const r = normalizarFase(fase);
  comprobar(`"${fase}"`, r === fase, `obtuvo ${r ?? "null"}`);
}
// Y en mayúsculas y sin tildes, como llegan de un Excel.
for (const fase of FASES_OBRA) {
  const crudo = fase.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const r = normalizarFase(crudo);
  comprobar(`"${crudo}" (como viene de Excel)`, r === fase, `obtuvo ${r ?? "null"}`);
}

// ─── 6. Entradas basura ─────────────────────────────────────────────────────
seccion("6) Entradas sin sentido");

mapea("", null);
mapea("   ", null);
mapea("xyz123", null);
mapea("lorem ipsum", null);

// ─── 7. Invariantes del módulo ──────────────────────────────────────────────
seccion("7) Invariantes");

comprobar("hay 11 fases curadas", FASES_OBRA.length === 11, `hay ${FASES_OBRA.length}`);
comprobar(
  "el orden constructivo empieza en Preliminares",
  ordenFase("Preliminares/Demolición") === 0
);
comprobar(
  "y termina en Detalles y aseo",
  ordenFase("Detalles y aseo") === FASES_OBRA.length - 1
);
comprobar("una fase inexistente da orden -1", ordenFase("No existe") === -1);
comprobar(
  "faseDeTarea sigue clasificando por nombre de tarea",
  faseDeTarea("Pintura sobre muros internos") === "Pintura",
  `obtuvo ${faseDeTarea("Pintura sobre muros internos") ?? "null"}`
);


// ─── 8. Presupuesto real: las 21 partidas de Juan Carlos Ordóñez ────────────
// Banco de pruebas con datos de campo, no inventados. La regla que valida:
// en el nombre de una partida, la FASE la marca la ACCIÓN (demoler, estucar,
// pintar), no el ELEMENTO (muros, cielos). Un muro se demuele, se construye,
// se repella, se estuca y se pinta.
//
// Antes de este arreglo: 13 correctas, 2 MAL clasificadas, 6 sin clasificar.
// «Demolición de muros» y «Estuco sobre muros» caían en Obra gris/Estructura
// porque mandaba la tabla de precios, que empareja por elemento.
seccion("8) Presupuesto real: cada partida a su fase");

const PRESUPUESTO_REAL: [string, string | null][] = [
  ["Demolicion de muros de cuarto del servicio, cocina", "Preliminares/Demolición"],
  ["Desmonte de carpinteria de aluminio existente", "Preliminares/Demolición"],
  ["Desmonte de carpinteria madera, cocina", "Preliminares/Demolición"],
  ["Construccion de muro de mamposteria para cerrar vano", "Obra gris/Estructura"],
  ["Construccion de muros y dintel en drywall", "Obra gris/Estructura"],
  ["Estructura en concreto reforzado, vigas de cimentacion, columnas", "Obra gris/Estructura"],
  ["Cubierta en estructura metalica - incluye canal", "Obra gris/Estructura"],
  ["Repello sobre muros", "Repello/Estuco"],
  ["Estuco sobre muros", "Repello/Estuco"],
  ["Estuco para cielos", "Repello/Estuco"],
  ["Pintura sobre muros internos y cubierta", "Pintura"],
  ["Pintura sobre muros externos", "Pintura"],
  ["Desague de lavadero", "Instalaciones hidrosanitarias"],
  ["instalacion griferia lavamanos", "Aparatos y grifería"],
];

for (const [partida, esperada] of PRESUPUESTO_REAL) {
  const r = faseDeTarea(partida);
  comprobar(`${partida.slice(0, 44)} → ${esperada}`, r === esperada, `obtuvo ${r ?? "null"}`);
}

// Lo esencial: NINGUNA partida puede caer en una fase equivocada. Sin
// clasificar es aceptable (va a mapeo manual); mal clasificada, no.
const malClasificadas = PRESUPUESTO_REAL.filter(([p, esp]) => {
  const r = faseDeTarea(p);
  return r !== null && r !== esp;
});
comprobar(
  "ninguna partida del presupuesto real cae en fase equivocada",
  malClasificadas.length === 0,
  malClasificadas.map(([p]) => p).join("; ")
);

// ─── Resultado ──────────────────────────────────────────────────────────────
console.log(`\n${ok}/${ok + fallos} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} FALLARON — la importación de presupuestos clasifica mal.`);
  process.exit(1);
}
console.log("Mapeo de fases verificado sin errores.");
