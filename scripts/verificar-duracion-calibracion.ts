// ─────────────────────────────────────────────────────────────────────────
// Verificación del motor de DURACIÓN contra su propia tabla de calibración
// (`docs/specs/algoritmo-duracion.md`). Cubre Fase 1 («los tres bugs
// baratos») y Fase 2 («recalibrar factores y escalado de cuadrillas»).
//
// No hay test runner en el proyecto — este script ES la suite, en asserts
// planos, igual que `verificar-reglas-alerta.ts`.
//
// Qué verifica:
//   1. Cobertura del matcher: toda tarea que la app GENERA encuentra
//      rendimiento y fase (cero NULL), incluida la familia «X de Y».
//   2. La fase «Otros» pesa menos del 5% del trabajo en los tres casos patrón.
//   3. No queda piso de 0.5 día por tarea dentro del cálculo (el trabajo es
//      aditivo y fraccionario; el piso se aplica UNA vez sobre el total).
//   4. «Otros» se agenda ANTES de las fases de acabado.
//   5. Los tres casos patrón caen DENTRO de banda (no solo por debajo de un
//      techo), y la obra cuadra consigo misma: Σfases + esperas + overhead
//      = total.
//   6. Cuadrillas: duplicarlas acelera MENOS del doble, sin discontinuidad al
//      pasar de 1 a 2, con rendimientos decrecientes, y `f` NO desaparece.
//   7. Tope de congestión: en un espacio de 5 m² no cabe más de una cuadrilla
//      (y en uno de 100 m² sí caben más — el tope no es un «no hacer nada»).
//   8. La calibración (O_0, f) se REBARRE aquí: los valores fijados en
//      `rendimientos.ts` son los que maximizan el margen a los bordes de
//      banda, y la región factible es ancha (no es una calibración frágil).
//   9. El motor sigue siendo puro: sin DB, sin red, sin reloj, sin azar.
//
// Uso: `npx tsx scripts/verificar-duracion-calibracion.ts`. Sale con 1 si algo
// falla.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { estimarDuracion, type EspacioEstim, type ResultadoDuracion } from "@/lib/estimar-duracion";
import { faseDeTarea, FASES_OBRA, normalizarFase, type FaseObra } from "@/lib/fases-obra";
import {
  buscarRendimiento,
  BUFFER_SECADO_POR_MANO,
  EXPONENTE_CUADRILLAS,
  FACTOR_PRODUCTIVIDAD_REAL,
  OVERHEAD_FIJO_CD,
} from "@/lib/rendimientos";
import { ESPACIOS_PERSONAL, sugerirTareas, type TipoObra } from "@/lib/plantillas-personal";
import { TASK_TEMPLATES } from "@/lib/task-templates";

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

// ── Los tres casos patrón ────────────────────────────────────────────────
// Se construyen con las tareas que genera la PROPIA app (`sugerirTareas`), no
// con una lista inventada: es lo que un usuario B2C ve en el wizard.

const TIPO_OBRA: TipoObra = "REFORMA";

function esp(id: string, nombre: string, plantilla: string, metraje?: number): EspacioEstim {
  return {
    id,
    nombre,
    ...(metraje ? { metraje } : {}),
    tareas: sugerirTareas(plantilla, TIPO_OBRA).map((t) => ({
      nombre: t.nombre,
      dias: t.tiempo_acordado_dias,
      on: true,
    })),
  };
}

interface Caso {
  nombre: string;
  /** Banda de cordura (días PROBABLES), docs/specs/algoritmo-duracion.md. */
  lo: number;
  hi: number;
  /** Medido el 2026-08-30 con el motor pre-fix (los 5 módulos revertidos). */
  antes: number;
  antesOtrosPct: number;
  antesSinRendimiento: number;
  espacios: EspacioEstim[];
  areaTotal?: number;
}

const CASOS: Caso[] = [
  {
    nombre: "Baño 5 m²",
    lo: 7,
    hi: 15,
    antes: 11,
    antesOtrosPct: 40.0,
    antesSinRendimiento: 2,
    espacios: [esp("b1", "Baño", "Baño", 5)],
  },
  {
    nombre: "Apto 60 m² (6 espacios)",
    lo: 60,
    hi: 70,
    antes: 87,
    antesOtrosPct: 39.2,
    antesSinRendimiento: 10,
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
    nombre: "Casa 120 m² (10 espacios)",
    lo: 100,
    hi: 120,
    antes: 154,
    antesOtrosPct: 37.3,
    antesSinRendimiento: 18,
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

/**
 * Suma lo que la línea de tiempo MUESTRA: días de fase por un lado y esperas
 * de secado por otro, contando una sola vez cada pareja de fases paralelas
 * (igual que el motor al cerrar el total).
 *
 * Dos columnas de espera, y la distinción es el entregable de leaf-3.3:
 *  · `esperas` — la espera CRUDA en días calendario. Es lo que se DIBUJA.
 *  · `lags` — lo que esa espera aporta al TOTAL en días hábiles, después de
 *    absorberla con el trabajo paralelo y convertirla con ρ. Es lo que SUMA.
 * En un baño único los dos números casi coinciden (no hay dónde absorber); en
 * un apto de seis espacios el segundo es 0 y el primero no.
 */
function sumaVisible(r: ResultadoDuracion): { fases: number; esperas: number; lags: number } {
  const vistas = new Set<string>();
  let fases = 0;
  let esperas = 0;
  let lags = 0;
  for (const f of r.fases) {
    if (vistas.has(f.fase)) continue;
    const parNombre = f.enParaleloCon[0];
    const par = parNombre ? r.fases.find((x) => x.fase === parNombre) : undefined;
    fases += par ? Math.max(f.dias, par.dias) : f.dias;
    esperas += par ? Math.max(f.esperaDias, par.esperaDias) : f.esperaDias;
    lags += par ? Math.max(f.esperaEfectivaDias, par.esperaEfectivaDias) : f.esperaEfectivaDias;
    vistas.add(f.fase);
    if (parNombre) vistas.add(parNombre);
  }
  return { fases, esperas, lags };
}

function correr(c: Caso) {
  const res = estimarDuracion(c.espacios, {
    cuadrillas: 1,
    ...(c.areaTotal ? { areaTotal: c.areaTotal } : {}),
  });
  const tareas = res.fases.flatMap((f) => f.tareas);
  const trabajo = tareas.reduce((a, t) => a + t.dias, 0);
  const trabajoOtros = tareas.filter((t) => t.fase === "Otros").reduce((a, t) => a + t.dias, 0);
  return {
    res,
    tareas,
    sinRendimiento: tareas.filter((t) => t.key === null).length,
    sinFase: tareas.filter((t) => t.fase === "Otros").length,
    otrosPct: trabajo > 0 ? (trabajoOtros / trabajo) * 100 : 0,
  };
}

console.log("Motor de duración — verificación de calibración (Fase 1)\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Matcher — toda tarea que GENERA la app encuentra rendimiento y fase");

const nombresApp = new Set<string>();
for (const e of ESPACIOS_PERSONAL) {
  for (const tipo of ["REFORMA", "MODIFICACION", "OBRA_NUEVA"] as TipoObra[]) {
    for (const t of sugerirTareas(e.label, tipo)) nombresApp.add(t.nombre);
  }
}
const sinRend = [...nombresApp].filter((n) => !buscarRendimiento(n));
const sinFase = [...nombresApp].filter((n) => !faseDeTarea(n));
if (sinRend.length) console.error("       sin rendimiento: " + sinRend.join(" · "));
if (sinFase.length) console.error("       sin fase: " + sinFase.join(" · "));
verificar(
  `las ${nombresApp.size} tareas distintas de sugerirTareas() tienen rendimiento`,
  sinRend.length === 0,
);
verificar(
  `las ${nombresApp.size} tareas distintas de sugerirTareas() tienen fase`,
  sinFase.length === 0,
);

// La familia «X de Y»: el bug que el `includes` literal no podía resolver.
const ESPERADO_MATCHER: [string, string, FaseObra][] = [
  ["Retiro de acabados existentes", "demolicion", "Preliminares/Demolición"],
  ["Resanar y alisar paredes", "resane", "Repello/Estuco"],
  ["Acabado de piso", "enchape_piso", "Pisos/Enchapes"],
  ["Enchape de pared", "enchape_pared", "Pisos/Enchapes"],
  ["Cielo raso en drywall", "drywall", "Obra gris/Estructura"],
  ["Impermeabilizar terraza", "impermeabilizacion", "Obra gris/Estructura"],
  ["Mesón de cocina", "meson", "Cocina/Closets"],
  ["Ventana en aluminio", "ventana", "Carpintería/Madera"],
];
for (const [nombre, key, fase] of ESPERADO_MATCHER) {
  const r = buscarRendimiento(nombre);
  const f = faseDeTarea(nombre);
  verificar(
    `"${nombre}" → ${key} / ${fase} (obtuvo ${r?.key ?? "NULL"} / ${f ?? "NULL"})`,
    r?.key === key && f === fase,
  );
}

// Y lo que ya funcionaba sigue funcionando (el matcher se amplió, no se movió).
const NO_REGRESION: [string, string][] = [
  ["Estuco paredes cocina", "estuco_pared"],
  ["Estuco techo baño principal", "estuco_techo"],
  ["Pintura final habitación principal", "pintura_final"],
  ["Pintura base sala-comedor", "pintura_base"],
  ["Sellador cocina", "sellador"],
  ["Mueble bajo cocina", "mueble_bajo_cocina"],
  ["Mueble alto cocina", "mueble_alto_cocina"],
  ["Mueble flotante lavamanos", "aparato_sanitario"],
  ["Closet habitación principal", "closet"],
  ["Punto eléctrico sala", "punto_electrico"],
  ["Porcelanato cocina", "porcelanato"],
  ["Sellador de paredes", "sellador"],
];
for (const [nombre, key] of NO_REGRESION) {
  const r = buscarRendimiento(nombre);
  verificar(`sin regresión: "${nombre}" → ${key} (obtuvo ${r?.key ?? "NULL"})`, r?.key === key);
}

// Precedencia: gana el término más largo, venga de la semilla de precios o de
// la de rendimientos. Sin esto, "Demolición de muro" se estimaba con el
// rendimiento de LEVANTAR el muro por contener "muro" (4 letras).
const PRECEDENCIA: [string, string, FaseObra][] = [
  ["Demolición de muro", "demolicion", "Preliminares/Demolición"],
  ["Demolición de estuco", "demolicion", "Preliminares/Demolición"],
  ["Desmantelamiento de closet", "demolicion", "Preliminares/Demolición"],
  ["Retiro de escombros", "demolicion", "Preliminares/Demolición"],
];
for (const [nombre, key, fase] of PRECEDENCIA) {
  const r = buscarRendimiento(nombre);
  const f = faseDeTarea(nombre);
  verificar(
    `precedencia por largo: "${nombre}" → ${key} / ${fase} (obtuvo ${r?.key ?? "NULL"} / ${f ?? "NULL"})`,
    r?.key === key && f === fase,
  );
}

// La normalización nueva se aplica a los DOS lados: las fases curadas y sus
// variantes tienen que seguir reconociéndose igual que antes.
verificar(
  "normalizarFase() devuelve cada fase curada a sí misma",
  FASES_OBRA.every((f) => normalizarFase(f) === f),
);
const VARIANTES: [string, FaseObra][] = [
  ["obra gris", "Obra gris/Estructura"],
  ["plomería", "Instalaciones hidrosanitarias"],
  ["eléctricos", "Instalaciones eléctricas"],
  ["Pisos y enchapes", "Pisos/Enchapes"],
  ["carpintería", "Carpintería/Madera"],
  ["preliminares", "Preliminares/Demolición"],
];
for (const [texto, fase] of VARIANTES) {
  verificar(
    `normalizarFase("${texto}") → ${fase} (obtuvo ${normalizarFase(texto) ?? "NULL"})`,
    normalizarFase(texto) === fase,
  );
}

// Cobertura de las plantillas B2B (informativo: no todas son estimables).
const nombresB2B = new Set<string>();
for (const fase of Object.keys(TASK_TEMPLATES)) {
  for (const espacio of Object.keys(TASK_TEMPLATES[fase])) {
    for (const t of TASK_TEMPLATES[fase][espacio]) nombresB2B.add(t.nombre);
  }
}
const b2bSinDato = [...nombresB2B].filter((n) => !buscarRendimiento(n) || !faseDeTarea(n));
console.log(
  `       (informativo) TASK_TEMPLATES B2B: ${nombresB2B.size - b2bSinDato.length}/${nombresB2B.size} con dato. ` +
    `Sin clasificar: ${b2bSinDato.length ? b2bSinDato.join(" · ") : "ninguna"}`,
);

// ─────────────────────────────────────────────────────────────────────────
console.log('\n2. La fase «Otros» pesa < 5% del trabajo en los tres casos patrón');

const RESULTADOS = CASOS.map((c) => ({ caso: c, out: correr(c) }));
for (const { caso, out } of RESULTADOS) {
  verificar(
    `${caso.nombre}: cero tareas sin rendimiento (obtuvo ${out.sinRendimiento} de ${out.tareas.length})`,
    out.sinRendimiento === 0,
  );
  verificar(
    `${caso.nombre}: «Otros» pesa ${out.otrosPct.toFixed(1)}% del trabajo (< 5%)`,
    out.otrosPct < 5,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. Sin piso de 0.5 día por tarea (el trabajo es aditivo y fraccionario)");

const FUENTE_MOTOR = readFileSync(
  fileURLToPath(new URL("../src/lib/estimar-duracion.ts", import.meta.url)),
  "utf8",
);
const pisos = FUENTE_MOTOR.split("\n")
  .map((l, i) => [i + 1, l] as const)
  .filter(([, l]) => /Math\.max\(\s*0\.5/.test(l) && !l.trimStart().startsWith("*"));
if (pisos.length) console.error("       " + pisos.map(([i, l]) => `L${i}: ${l.trim()}`).join("\n       "));
verificar("estimar-duracion.ts no contiene ningún Math.max(0.5, …)", pisos.length === 0);

/** Una tarea deliberadamente chica: 1 aparato ÷ 5 aparatos/día = 0.2 días. */
function espUnaTarea(id: string): EspacioEstim {
  return {
    id,
    nombre: `Baño ${id}`,
    metraje: 5,
    tareas: [{ nombre: "Instalación de aparatos y grifería", dias: 1, on: true }],
  };
}
const chica = estimarDuracion([espUnaTarea("x1")], { cuadrillas: 1 });
const tareaChica = chica.fases.flatMap((f) => f.tareas)[0];
verificar(
  `una tarea de 0.2 días se reporta como ${tareaChica.dias} d, no se sube a 0.5`,
  tareaChica.dias > 0 && tareaChica.dias < 0.5,
);

const una = estimarDuracion([espUnaTarea("y1")], { cuadrillas: 1 });
const cuatro = estimarDuracion(
  ["z1", "z2", "z3", "z4"].map(espUnaTarea),
  { cuadrillas: 1 },
);
const faseUna = una.fases.find((f) => f.fase === "Aparatos y grifería")!;
const faseCuatro = cuatro.fases.find((f) => f.fase === "Aparatos y grifería")!;
verificar(
  `4 tareas iguales cuestan 4× una (${faseCuatro.dias} ≈ 4 × ${faseUna.dias}), no 4 pisos de 0.5`,
  Math.abs(faseCuatro.dias - 4 * faseUna.dias) <= 0.05,
);
verificar(
  "el ÚNICO piso sobrevive sobre el TOTAL: una obra mínima nunca dura 0 días",
  una.totalDias.probable >= 1 && una.totalDias.min >= 1,
);

// ─────────────────────────────────────────────────────────────────────────
console.log('\n4. «Otros» abre la obra, no la cierra');

const TAREA_RARA = "Trámite de permisos ante la copropiedad";
verificar(
  `"${TAREA_RARA}" no la clasifica ningún matcher (cae en Otros, como debe)`,
  faseDeTarea(TAREA_RARA) === null && buscarRendimiento(TAREA_RARA) === null,
);
const conOtros = estimarDuracion(
  [
    {
      id: "o1",
      nombre: "Sala",
      metraje: 18,
      tareas: [
        { nombre: TAREA_RARA, dias: 2, on: true },
        { nombre: "Estuco paredes sala", dias: 2, on: true },
        { nombre: "Pintura final sala", dias: 2, on: true },
        { nombre: "Acabado de piso", dias: 2, on: true },
        { nombre: "Instalación de aparatos y grifería", dias: 1, on: true },
        { nombre: "Detalles finales y limpieza", dias: 1, on: true },
      ],
    },
  ],
  { cuadrillas: 1 },
);
const orden = conOtros.fases.map((f) => f.fase);
const iOtros = orden.indexOf("Otros");
verificar(`la fase «Otros» existe en el caso de control (orden: ${orden.join(" → ")})`, iOtros >= 0);
const ACABADO: FaseObra[] = ["Repello/Estuco", "Pintura", "Pisos/Enchapes", "Aparatos y grifería", "Detalles y aseo"];
for (const f of ACABADO) {
  const i = orden.indexOf(f);
  verificar(`«Otros» se agenda antes que «${f}» (${iOtros} < ${i})`, i >= 0 && iOtros < i);
}
verificar(
  "«Otros» es la PRIMERA fase de la obra, no la penúltima",
  iOtros === 0,
);
verificar(
  "las fases curadas conservan su orden constructivo",
  orden
    .filter((f): f is FaseObra => f !== "Otros")
    .every((f, i, arr) => i === 0 || FASES_OBRA.indexOf(arr[i - 1]) < FASES_OBRA.indexOf(f)),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. Los tres casos patrón caen DENTRO de banda (no bajo un techo)");

// Fase 1 solo exigía «bajó de forma clara» (un techo). Fase 2 exige la banda
// entera: quedar CORTO también es fallar. El baño SUBE aquí respecto a Fase 1
// (6 → 12 d) y eso es el entregable, no una regresión: es el overhead fijo
// `O_0` entrando donde antes no había nada.
for (const { caso, out } of RESULTADOS) {
  const d = out.res.totalDias.probable;
  verificar(
    `${caso.nombre}: ${d} d dentro de [${caso.lo}, ${caso.hi}] d`,
    d >= caso.lo && d <= caso.hi,
  );
  const t = out.res.totalDias;
  verificar(
    `${caso.nombre}: la banda es coherente (${t.min} ≤ ${t.probable} ≤ ${t.max})`,
    t.min <= t.probable && t.probable <= t.max,
  );
}

// La obra cuadra consigo misma: lo que muestra la línea de tiempo suma lo que
// muestra el total. Si no, el usuario ve barras que no dan la cifra de arriba.
for (const { caso, out } of RESULTADOS) {
  const r = out.res;
  const v = sumaVisible(r);
  const suma = v.fases + v.lags + r.overheadDias;
  // Tolerancia: el total redondea a día entero (±0.5) y cada fase a 2
  // decimales (±0.005 × nº de fases). Nada más puede separarlos.
  verificar(
    `${caso.nombre}: Σfases + lags + overhead (${suma.toFixed(2)}) = total (${r.totalDias.probable})`,
    Math.abs(suma - r.totalDias.probable) <= 0.5 + 0.005 * r.fases.length,
  );
}

// El overhead fijo NO escala con el tamaño: es el mismo en un baño y en una casa.
const overheads = RESULTADOS.map((r) => r.out.res.overheadDias);
verificar(
  `el overhead fijo vale lo mismo en los tres casos (${overheads.join(" · ")} d)`,
  overheads.every((o) => o > 0 && Math.abs(o - overheads[0]) < 0.01),
);
verificar(
  `el overhead es f·O_0 = ${(FACTOR_PRODUCTIVIDAD_REAL.probable * OVERHEAD_FIJO_CD.probable).toFixed(2)} d`,
  Math.abs(overheads[0] - FACTOR_PRODUCTIVIDAD_REAL.probable * OVERHEAD_FIJO_CD.probable) < 0.01,
);
// Y pesa lo que tiene que pesar: mucho en el baño, casi nada en la casa. Es la
// razón de que un solo factor multiplicativo no pudiera ajustar los tres.
const pesoOverhead = RESULTADOS.map(
  ({ caso, out }) => `${caso.nombre.split(" ")[0]} ${((out.res.overheadDias / out.res.totalDias.probable) * 100).toFixed(0)}%`,
);
verificar(
  `el overhead se amortiza con el tamaño (${pesoOverhead.join(" · ")})`,
  RESULTADOS[0].out.res.overheadDias / RESULTADOS[0].out.res.totalDias.probable >
    3 * (RESULTADOS[2].out.res.overheadDias / RESULTADOS[2].out.res.totalDias.probable),
);

// CUARTO caso de cordura: la cocina media. No está en la tabla ANTES/DESPUÉS
// porque nadie midió su valor pre-fix con los 5 módulos revertidos, pero su
// banda SÍ está publicada (cabecera de estimar-duracion.ts y §0 del documento)
// y es la que más aprieta por arriba: poco trabajo (≈7 cd) y mucho secado
// (4 manos). Si el overhead se pasa de la raya, la cocina es la primera que
// se sale.
const COCINA: Caso = {
  nombre: "Cocina 9 m²",
  lo: 10,
  hi: 20,
  antes: 0,
  antesOtrosPct: 0,
  antesSinRendimiento: 0,
  espacios: [esp("k1", "Cocina", "Cocina", 9)],
};
const cocinaRes = estimarDuracion(COCINA.espacios, { cuadrillas: 1 });
verificar(
  `${COCINA.nombre}: ${cocinaRes.totalDias.probable} d dentro de [${COCINA.lo}, ${COCINA.hi}] d`,
  cocinaRes.totalDias.probable >= COCINA.lo && cocinaRes.totalDias.probable <= COCINA.hi,
);

// Las esperas de secado NO llevan `f`: consumen calendario, no cuadrilla (el
// mortero no fragua más lento porque la cuadrilla rinda menos). Se comprueba
// contra el buffer crudo: 4 manos (sellador 1 + base 1 + final 2) × 1 d.
const esperaPintura = cocinaRes.fases.find((f) => f.fase === "Pintura")?.esperaDias ?? 0;
verificar(
  `las esperas de secado van sin factor (cocina: ${esperaPintura} d = 4 manos × ${BUFFER_SECADO_POR_MANO.probable} d)`,
  Math.abs(esperaPintura - 4 * BUFFER_SECADO_POR_MANO.probable) < 0.01,
);

// Sin trabajo no hay obra: el overhead no se cobra sobre la nada.
const vacia = estimarDuracion([{ id: "v", nombre: "Sala", metraje: 10, tareas: [] }], { cuadrillas: 1 });
verificar(
  "una obra sin tareas activas da 0 días (el overhead no se cobra solo)",
  vacia.totalDias.probable === 0 && vacia.overheadDias === 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. Cuadrillas: sub-lineal, continuo en c = 1 y con `f` vivo");

const CS = [1, 2, 3, 4, 6, 8];
const APTO = CASOS[1];
const diasCon = (c: Caso, cuadrillas: number, extra: Record<string, number> = {}) =>
  estimarDuracion(c.espacios, {
    cuadrillas,
    ...(c.areaTotal ? { areaTotal: c.areaTotal } : {}),
    ...extra,
  }).totalDias.probable;

const curva = CS.map((c) => diasCon(APTO, c));
console.log(`       apto 60 m² con ${CS.join("/")} cuadrillas: ${curva.join(" / ")} d`);

const TOPE_TEORICO = Math.pow(2, EXPONENTE_CUADRILLAS); // 1.80
verificar(
  `duplicar cuadrillas acelera ×${(curva[0] / curva[1]).toFixed(2)} — menos del doble`,
  curva[0] / curva[1] < 2,
);
verificar(
  `y no más de lo que promete c^${EXPONENTE_CUADRILLAS} (×${(curva[0] / curva[1]).toFixed(2)} ≤ ×${TOPE_TEORICO.toFixed(2)})`,
  curva[0] / curva[1] <= TOPE_TEORICO + 0.01,
);
// El defecto viejo: al pasar de 1 a 2 desaparecía el ×1.4 Y se dividía por 2,
// un salto medido de ×2.7. La discontinuidad se mata en la RAÍZ: el motor ya
// no tiene ningún caso especial para `cuadrillas === 1`. c^0.85 vale 1 en
// c = 1 por construcción, así que no hay nada que empalmar.
const casosEspeciales = FUENTE_MOTOR.split("\n")
  .map((l, i) => [i + 1, l] as const)
  .filter(([, l]) => /cuadrillas\s*===\s*1|cuadrillas\s*>\s*1|cuadrillas\s*!==\s*1/.test(l));
if (casosEspeciales.length) {
  console.error("       " + casosEspeciales.map(([i, l]) => `L${i}: ${l.trim()}`).join("\n       "));
}
verificar(
  "el motor no tiene ningún caso especial para `cuadrillas === 1` (no hay dónde saltar)",
  casosEspeciales.length === 0,
);
verificar(
  `rendimientos decrecientes: 1→2 (×${(curva[0] / curva[1]).toFixed(2)}) rinde más que 2→4 (×${(curva[1] / curva[3]).toFixed(2)})`,
  curva[0] / curva[1] >= curva[1] / curva[3] - 0.01,
);
verificar(
  "más cuadrillas nunca alarga la obra (curva monótona no creciente)",
  curva.every((d, i) => i === 0 || d <= curva[i - 1]),
);
verificar(
  `4 cuadrillas no hacen un apto (${curva[3]} d) más rápido que un baño con una (${RESULTADOS[0].out.res.totalDias.probable} d)`,
  curva[3] > RESULTADOS[0].out.res.totalDias.probable,
);

// `f` no puede evaporarse con más de una cuadrilla — ese era el defecto §4.3.
for (const c of [1, 2, 4]) {
  const con = diasCon(APTO, c);
  const crudo = diasCon(APTO, c, { factorProductividad: 1, overheadDias: 0 });
  verificar(
    `con ${c} cuadrilla(s) el factor sigue aplicado (${con} d vs ${crudo} d crudo, ×${(con / crudo).toFixed(2)})`,
    con / crudo >= FACTOR_PRODUCTIVIDAD_REAL.probable - 0.01,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n7. Tope de congestión: en 5 m² no cabe una segunda cuadrilla");

const BANO = CASOS[0];
const curvaBano = CS.map((c) => diasCon(BANO, c));
console.log(`       baño 5 m² con ${CS.join("/")} cuadrillas: ${curvaBano.join(" / ")} d`);
verificar(
  `el baño de 5 m² dura lo mismo con 1 que con 8 cuadrillas (${curvaBano[0]} d = ${curvaBano[5]} d)`,
  curvaBano.every((d) => d === curvaBano[0]),
);

// Control: el tope es FÍSICO, no un «las cuadrillas no hacen nada». En un
// espacio grande, las cuadrillas extra sí aceleran.
// (No tiene banda de cordura publicada: `lo`/`hi` no se usan para este caso,
// solo se reutiliza la forma de `Caso` para poder llamar a `diasCon`.)
const SALON: Caso = {
  nombre: "Salón 100 m²",
  lo: 0,
  hi: 0,
  antes: 0,
  antesOtrosPct: 0,
  antesSinRendimiento: 0,
  espacios: [esp("s1", "Sala", "Sala", 100)],
};
const curvaSalon = CS.map((c) => diasCon(SALON, c));
console.log(`       salón 100 m² con ${CS.join("/")} cuadrillas: ${curvaSalon.join(" / ")} d`);
verificar(
  `en 100 m² sí caben más cuadrillas y aceleran (${curvaSalon[0]} → ${curvaSalon[1]} d con 2)`,
  curvaSalon[1] < curvaSalon[0],
);
verificar(
  "…pero tampoco al doble (el tope no es el único freno: c^0.85 también)",
  curvaSalon[0] / curvaSalon[1] < 2,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n8. Barrido (O_0, f) — la calibración se rehace aquí, no se hereda");

/** Margen a los bordes de banda, normalizado a media banda: 1 = centro, 0 = borde. */
function margen(c: Caso, d: number): number {
  return Math.min(d - c.lo, c.hi - d) / ((c.hi - c.lo) / 2);
}

// Criterio: entre los puntos que dejan los TRES casos patrón dentro de banda
// (y la cocina también, que es restricción, no objetivo), gana el que deja el
// mayor margen mínimo a los bordes. Un punto que ajusta pero pegado al borde
// es una calibración que se rompe con el siguiente cambio del motor.
interface Punto { o0: number; f: number; m3: number; m4: number; dias: number[] }
let mejor: Punto | null = null;
let enBanda3 = 0;
let enBanda4 = 0;
let combinaciones = 0;
for (let o0 = 0; o0 <= 6.001; o0 += 0.5) {
  for (let paso = 20; paso <= 40; paso++) {
    const f = paso / 20; // 1.00 … 2.00 en pasos de 0.05
    combinaciones++;
    const extra = { overheadDias: o0, factorProductividad: f };
    const dias = CASOS.map((c) => diasCon(c, 1, extra));
    const m3 = Math.min(...CASOS.map((c, i) => margen(c, dias[i])));
    const m4 = Math.min(m3, margen(COCINA, diasCon(COCINA, 1, extra)));
    if (m3 >= 0) enBanda3++;
    if (m4 >= 0) enBanda4++;
    if (m4 >= 0 && (!mejor || m3 > mejor.m3)) mejor = { o0, f, m3, m4, dias };
  }
}
const M = mejor!;
// Margen del punto que está fijado HOY en rendimientos.ts.
const diasFijados = CASOS.map((c) => diasCon(c, 1));
const mFijado = Math.min(...CASOS.map((c, i) => margen(c, diasFijados[i])));
console.log(
  `       ${enBanda3}/${combinaciones} combinaciones meten los tres casos patrón en banda ` +
    `(${enBanda4} también la cocina). Mejor del barrido: O_0=${M.o0} f=${M.f.toFixed(2)} → ` +
    `${M.dias.join(" / ")} d (margen ${M.m3.toFixed(2)}; con cocina ${M.m4.toFixed(2)}).` +
    `\n       Fijado en rendimientos.ts: O_0=${OVERHEAD_FIJO_CD.probable} f=${FACTOR_PRODUCTIVIDAD_REAL.probable} → ` +
    `${diasFijados.join(" / ")} d (margen ${mFijado.toFixed(2)})`,
);
verificar(
  `la calibración no es frágil: ${enBanda3} combinaciones válidas (≥ 20)`,
  enBanda3 >= 20,
);
verificar(
  `el punto fijado no está en el borde (margen ${mFijado.toFixed(2)} ≥ 0.30 de media banda)`,
  mFijado >= 0.3,
);
// No se exige que el punto fijado sea el argmax exacto de la rejilla: un cambio
// mínimo en otro módulo movería el óptimo a la casilla de al lado y este script
// fallaría sin que la calibración se haya estropeado. Lo que sí se exige es que
// no se quede lejos: si otro leaf cambia el motor y la calibración se degrada,
// aquí salta y hay que rebarrer.
verificar(
  `y sigue siendo tan bueno como el mejor de la rejilla (${mFijado.toFixed(2)} ≥ 0.8 × ${M.m3.toFixed(2)})`,
  mFijado >= 0.8 * M.m3,
);
// El documento propone (2, 1.40). Con el matcher arreglado ya no ajusta: los
// números de HOY mandan sobre los de ayer, y esto lo deja escrito.
const docDias = CASOS.map((c) => diasCon(c, 1, { overheadDias: 2, factorProductividad: 1.4 }));
console.log(`       (O_0=2, f=1.40) del documento, con el motor de hoy: ${docDias.join(" / ")} d`);
verificar(
  "la propuesta del documento (2, 1.40) ya NO ajusta — se rebarrió por eso",
  CASOS.some((c, i) => docDias[i] < c.lo || docDias[i] > c.hi),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n9. El motor sigue siendo puro y determinista");

const FUENTES_PURAS = ["../src/lib/estimar-duracion.ts", "../src/lib/rendimientos.ts"];
const IMPUREZAS = ["prisma", "fetch(", "Math.random", "Date.now", "new Date("];
for (const rel of FUENTES_PURAS) {
  const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const halladas = IMPUREZAS.filter((m) => src.includes(m));
  verificar(
    `${rel.replace("../", "")} sin ${IMPUREZAS.join(" / ")}${halladas.length ? ` — halladas: ${halladas.join(", ")}` : ""}`,
    halladas.length === 0,
  );
}

// El motor es puro: mismas entradas → mismas salidas.
verificar(
  "el motor es determinista (dos corridas idénticas devuelven lo mismo)",
  CASOS.every((c) => {
    const opts = { cuadrillas: 1, ...(c.areaTotal ? { areaTotal: c.areaTotal } : {}) };
    return JSON.stringify(estimarDuracion(c.espacios, opts)) === JSON.stringify(estimarDuracion(c.espacios, opts));
  }),
);
verificar(
  "…también con varias cuadrillas (el escalado no introduce estado)",
  CS.every((n) => {
    const opts = { cuadrillas: n, areaTotal: 60 };
    return (
      JSON.stringify(estimarDuracion(APTO.espacios, opts)) ===
      JSON.stringify(estimarDuracion(APTO.espacios, opts))
    );
  }),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n── Tabla comparativa ANTES / DESPUÉS ──────────────────────────");
console.log("   ANTES = motor previo a leaf-3.1, medido el 2026-08-30 revirtiendo");
console.log("   normalizar-tarea · precios-semilla · rendimientos · fases-obra · estimar-duracion");
console.log("   sobre EXACTAMENTE estos mismos casos.\n");

const col = (s: string | number, n: number) => String(s).padStart(n);
console.log(
  "   " +
    "Caso".padEnd(26) +
    col("Banda", 10) +
    col("Antes", 8) +
    col("Después", 9) +
    col("Δ", 8) +
    col("Otros antes", 13) +
    col("Otros hoy", 11) +
    col("sinRend antes", 15) +
    col("hoy", 6),
);
console.log("   " + "─".repeat(106));
for (const { caso, out } of RESULTADOS) {
  const d = out.res.totalDias.probable;
  const delta = ((d - caso.antes) / caso.antes) * 100;
  console.log(
    "   " +
      caso.nombre.padEnd(26) +
      col(`${caso.lo}–${caso.hi} d`, 10) +
      col(`${caso.antes} d`, 8) +
      col(`${d} d`, 9) +
      col(`${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`, 8) +
      col(`${caso.antesOtrosPct.toFixed(1)}%`, 13) +
      col(`${out.otrosPct.toFixed(1)}%`, 11) +
      col(`${caso.antesSinRendimiento}/${out.tareas.length}`, 15) +
      col(`${out.sinRendimiento}/${out.tareas.length}`, 6),
  );
}
console.log("\n   Rango (min–probable–max) hoy:");
for (const { caso, out } of RESULTADOS) {
  const t = out.res.totalDias;
  console.log(
    `   ${caso.nombre.padEnd(26)} ${t.min}–${t.probable}–${t.max} d · cobertura ${(out.res.cobertura * 100).toFixed(0)}%`,
  );
  console.log("      " + out.res.fases.map((f) => `${f.fase} ${f.dias}`).join(" · "));
}

// Descomposición de la ecuación de cierre: D = f · (O_0 + D_trabajo) + Λ.
console.log(
  `\n   Ecuación de cierre  D = f · (O_0 + D_trabajo) + Λ_ef  con f = ${FACTOR_PRODUCTIVIDAD_REAL.probable} · O_0 = ${OVERHEAD_FIJO_CD.probable} cd:`,
);
console.log(
  "   " +
    "Caso".padEnd(26) +
    col("trabajo", 10) +
    col("O_0·f", 8) +
    col("Λ cruda", 10) +
    col("Λ_ef", 8) +
    col("total", 8) +
    col("banda", 12),
);
console.log("   " + "─".repeat(82));
for (const { caso, out } of RESULTADOS.concat([{ caso: COCINA, out: correr(COCINA) }])) {
  const v = sumaVisible(out.res);
  // Los días de fase que se muestran ya llevan `f`; el trabajo crudo es Σfases/f.
  const trabajo = v.fases / FACTOR_PRODUCTIVIDAD_REAL.probable;
  const d = out.res.totalDias.probable;
  console.log(
    "   " +
      caso.nombre.padEnd(26) +
      col(`${trabajo.toFixed(1)} cd`, 10) +
      col(`${out.res.overheadDias} d`, 8) +
      col(`${v.esperas.toFixed(1)} d`, 10) +
      col(`${v.lags.toFixed(1)} d`, 8) +
      col(`${d} d`, 8) +
      col(`${caso.lo}–${caso.hi} d ${d >= caso.lo && d <= caso.hi ? "✓" : "✗"}`, 12),
  );
}
console.log(
  "\n   El baño SUBE respecto a Fase 1 y eso es el entregable: el overhead fijo\n" +
    "   pesa mucho más en un baño que en una casa. Un factor multiplicativo\n" +
    "   constante no puede hacer eso — por eso hacían falta dos parámetros, no\n" +
    "   uno más grande.\n" +
    "   Λ va FUERA de f: consume calendario, no cuadrilla. Con f dentro, la\n" +
    "   cocina de 9 m² se salía a 22 d (banda 10–20) y el barrido empujaba O_0\n" +
    "   a 0 para volver a meterla — o sea, borraba el entregable de la Fase 2.\n" +
    "   Λ_ef (leaf-3.3) es lo que de la espera CRUDA sobrevive a dos filtros:\n" +
    "   la absorbe el trabajo de la misma fase en los otros espacios, y lo que\n" +
    "   queda se convierte de calendario a hábiles con ρ. Por eso el apto y la\n" +
    "   casa muestran Λ cruda > 0 y Λ_ef = 0, y el baño y la cocina no: en un\n" +
    "   espacio único no hay a dónde mandar la cuadrilla mientras seca.",
);

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Motor de duración verificado sin errores.");
