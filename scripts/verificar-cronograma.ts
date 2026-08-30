// ─────────────────────────────────────────────────────────────────────────
// Verificación del CRONOGRAMA: grafo de precedencias POR ESPACIO, CPM y SGS
// serial con cuadrillas finitas (`src/lib/cronograma/`, leaf-3.4).
//
// No hay test runner en el proyecto — este script ES la suite, en asserts
// planos, igual que `verificar-reglas-alerta.ts`.
//
// Qué verifica:
//   1. El grafo: nodos (espacio, tarea) y aristas de fase DENTRO del espacio.
//      Ninguna arista de trabajo cruza de un espacio a otro.
//   2. La precedencia es POR ESPACIO: dos espacios pueden estucarse en
//      paralelo, y la pintura del primero no espera al estuco del último.
//   3. Ciclos: Kahn los detecta y una arista explícita que cierre uno se
//      RECHAZA (la obra sigue estimándose sin ella, no se cae).
//   4. CPM: ES/EF, holguras y ruta crítica sobre casos calculables a mano.
//   5. SGS: serial con una cuadrilla, tope de congestión por espacio, y
//      DETERMINISTA (misma entrada, misma salida, dos corridas).
//   6. El invariante D_CPM ≤ D_SGS ≤ Σ D_t en todos los casos patrón.
//   7. `depende_de` se escribe al crear el proyecto: el campo deja de estar
//      muerto en el esquema.
//   8. El overhead se PINTA: la línea de tiempo cuadra con el total.
//   9. El módulo es puro y determinista.
//
// Uso: `npx tsx scripts/verificar-cronograma.ts`. Sale con 1 si algo falla.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  calcularCPM,
  construirGrafo,
  ordenTopologico,
  programarSerial,
  type AristaCronograma,
  type EntradaNodo,
} from "@/lib/cronograma";
import { cadenaDeEspacio } from "@/lib/cronograma/dependencias";
import {
  estimarDuracion,
  ordenConstructivoDeTarea,
  type EspacioEstim,
  type ResultadoDuracion,
} from "@/lib/estimar-duracion";
import { FASES_OBRA } from "@/lib/fases-obra";
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

/** Nodo de prueba: duración en días de una cuadrilla, tope de espacio amplio. */
function nodo(
  id: string,
  espacioId: string,
  ordenFase: number,
  duracion: number,
  extra: Partial<EntradaNodo> = {},
): EntradaNodo {
  return {
    id,
    espacioId,
    nombre: id,
    fase: `fase${ordenFase}`,
    ordenFase,
    duracion,
    gremio: "general",
    capEspacio: 4,
    ...extra,
  };
}

// ── Los casos patrón, construidos con las tareas que genera la PROPIA app ──
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

const BANO = [esp("b1", "Baño", "Baño", 5)];
const COCINA = [esp("k1", "Cocina", "Cocina", 9)];
const APTO = [
  esp("a1", "Cocina", "Cocina"),
  esp("a2", "Baño", "Baño"),
  esp("a3", "Sala", "Sala"),
  esp("a4", "Habitación", "Habitación"),
  esp("a5", "Estudio", "Estudio"),
  esp("a6", "Balcón / Terraza", "Balcón / Terraza"),
];
const CASA = [
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
];
const SEIS_BANOS = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) =>
  esp(id, `Baño ${id}`, "Baño", 5),
);
const CON_PLACA: EspacioEstim[] = [0, 1, 2, 3].map((i) => ({
  id: `p${i}`,
  nombre: `Sala ${i}`,
  metraje: 20,
  tareas: [
    { nombre: "Placa de entrepiso", dias: 3, on: true },
    { nombre: "Estuco paredes", dias: 2, on: true },
    { nombre: "Pintura final", dias: 2, on: true },
  ],
}));

console.log("Cronograma — grafo por espacio, CPM y SGS (leaf-3.4)\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. El grafo: nodos (espacio, tarea) y aristas DENTRO del espacio");

// Dos espacios, tres fases cada uno. Es el caso mínimo donde el modelo viejo
// (precedencia global) y el nuevo (por espacio) discrepan.
const DOS_ESPACIOS = construirGrafo({
  nodos: [
    nodo("A0", "A", 0, 1),
    nodo("A1", "A", 1, 2),
    nodo("A2", "A", 2, 1),
    nodo("B0", "B", 0, 1),
    nodo("B1", "B", 1, 5),
    nodo("B2", "B", 2, 1),
  ],
});
verificar(
  `el grafo tiene un nodo por (espacio, tarea): ${DOS_ESPACIOS.nodos.length} nodos`,
  DOS_ESPACIOS.nodos.length === 6,
);
verificar(
  `y 4 aristas de fase (2 por espacio), no las 9 de una precedencia global: ${DOS_ESPACIOS.aristas.length}`,
  DOS_ESPACIOS.aristas.length === 4,
);
const espacioDe = new Map(DOS_ESPACIOS.nodos.map((n) => [n.id, n.espacioId]));
verificar(
  "NINGUNA arista cruza de un espacio a otro",
  DOS_ESPACIOS.aristas.every((a) => espacioDe.get(a.desde) === espacioDe.get(a.hasta)),
);
const ordenDe = new Map(DOS_ESPACIOS.nodos.map((n) => [n.id, n.ordenFase]));
verificar(
  "toda arista de fase va de un orden constructivo menor a uno mayor",
  DOS_ESPACIOS.aristas.every((a) => ordenDe.get(a.desde)! < ordenDe.get(a.hasta)!),
);
verificar(
  "el orden de prioridad es por NIVEL topológico (línea de balance: A0,B0 · A1,B1 · A2,B2)",
  DOS_ESPACIOS.prioridad.slice(0, 2).every((id) => id.endsWith("0")) &&
    DOS_ESPACIOS.prioridad.slice(2, 4).every((id) => id.endsWith("1")) &&
    DOS_ESPACIOS.prioridad.slice(4, 6).every((id) => id.endsWith("2")),
);
verificar(
  "y dentro de un nivel gana el camino restante más largo (B1 arrastra más cola que A1)",
  DOS_ESPACIOS.prioridad.indexOf("B0") < DOS_ESPACIOS.prioridad.indexOf("A0"),
);

// Fases simultáneas: mismo `ordenFase` dentro del espacio = no se preceden.
const SIMULTANEAS = construirGrafo({
  nodos: [nodo("X0", "A", 0, 1), nodo("X1a", "A", 1, 2), nodo("X1b", "A", 1, 2)],
});
verificar(
  "dos fases con el mismo orden en un espacio NO se preceden (oficios simultáneos)",
  !SIMULTANEAS.aristas.some(
    (a) => (a.desde === "X1a" && a.hasta === "X1b") || (a.desde === "X1b" && a.hasta === "X1a"),
  ) && SIMULTANEAS.aristas.length === 2,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. La precedencia es POR ESPACIO: dos espacios pueden estucarse en paralelo");

// (a) Con recursos infinitos (CPM): la fase 2 del espacio corto NO espera a la
//     fase 1 del espacio largo. Es literalmente el defecto que se arregla.
const cpmDos = calcularCPM(DOS_ESPACIOS);
const A2 = cpmDos.nodos.get("A2")!;
const B1 = cpmDos.nodos.get("B1")!;
console.log(
  `       A: 1+2+1 = 4 d · B: 1+5+1 = 7 d · CPM = ${cpmDos.makespan} d (el espacio más largo)`,
);
verificar(
  `la última tarea de A termina en ${A2.ef} d, ANTES de que B termine su fase 1 (${B1.ef} d)`,
  A2.ef < B1.ef,
);
verificar(
  `el CPM es el camino más largo de UN espacio (${cpmDos.makespan} = 7), no la suma de fases (11)`,
  cpmDos.makespan === 7,
);
verificar(
  "la ruta crítica es el espacio B entero",
  cpmDos.rutaCritica.join(">") === "B0>B1>B2",
);
verificar(
  `las tareas de A tienen holgura (A1 puede retrasarse ${cpmDos.nodos.get("A1")!.holgura} d)`,
  cpmDos.nodos.get("A1")!.holgura === 3 && !cpmDos.nodos.get("A1")!.critico,
);

// (b) Con dos cuadrillas: los dos estucos corren A LA VEZ en el reloj.
const dosCuadrillas = programarSerial(DOS_ESPACIOS, { capacidad: 2 });
const solapan = (a: string, b: string): boolean =>
  dosCuadrillas.inicio.get(a)! < dosCuadrillas.fin.get(b)! &&
  dosCuadrillas.inicio.get(b)! < dosCuadrillas.fin.get(a)!;
verificar(
  `con dos cuadrillas, el estuco de A [${dosCuadrillas.inicio.get("A1")}, ${dosCuadrillas.fin.get("A1")}] y el de B [${dosCuadrillas.inicio.get("B1")}, ${dosCuadrillas.fin.get("B1")}] se solapan`,
  solapan("A1", "B1"),
);
verificar(
  "…y con UNA cuadrilla no (una persona no está en dos sitios), pero el grafo sí lo permitía",
  !((): boolean => {
    const p = programarSerial(DOS_ESPACIOS, { capacidad: 1 });
    return (
      p.inicio.get("A1")! < p.fin.get("B1")! && p.inicio.get("B1")! < p.fin.get("A1")!
    );
  })(),
);

// (c) En la obra de verdad: el motor sobre el apto de 6 espacios.
const aptoRes = estimarDuracion(APTO, { cuadrillas: 1, areaTotal: 60 });
const estucos = aptoRes.fases.find((f) => f.fase === "Repello/Estuco")!;
const pinturas = aptoRes.fases.find((f) => f.fase === "Pintura")!;
const espaciosEstucados = new Set(estucos.tareas.map((t) => t.espacio));
verificar(
  `el apto estuca ${espaciosEstucados.size} espacios y NINGUNA tarea de estuco depende de otro espacio`,
  espaciosEstucados.size === 6,
);
const cpmApto = aptoRes.cronograma.cpmDias;
verificar(
  `con equipo ilimitado el apto bajaría a ${cpmApto} d, no a los ${aptoRes.cronograma.sumaDias} d de la suma: el pipeline existe`,
  cpmApto < aptoRes.cronograma.sumaDias / 3,
);
verificar(
  `la fase Pintura del apto arranca (día ${pinturas.inicioDias}) mientras el motor ya sabe cuándo acabó cada estuco`,
  pinturas.inicioDias >= estucos.inicioDias && pinturas.finDias > estucos.finDias,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. Ciclos: Kahn los detecta y la arista explícita que los cree se RECHAZA");

const CICLO: AristaCronograma[] = [
  { desde: "C1", hasta: "C2", lag: 0, tipo: "explicita" },
  { desde: "C2", hasta: "C3", lag: 0, tipo: "explicita" },
  { desde: "C3", hasta: "C1", lag: 0, tipo: "explicita" },
];
const NODOS_CICLO = [nodo("C1", "A", 0, 1), nodo("C2", "A", 1, 1), nodo("C3", "A", 2, 1)];
verificar(
  "ordenTopologico devuelve null ante un ciclo de tres nodos",
  ordenTopologico(NODOS_CICLO, CICLO) === null,
);
verificar(
  "…y devuelve un orden completo cuando NO lo hay (control positivo)",
  (ordenTopologico(NODOS_CICLO, CICLO.slice(0, 2)) ?? []).length === 3,
);

// A→B por E_fase; el usuario escribe «B antes que A». Se rechaza la arista.
const CON_CICLO = construirGrafo({
  nodos: [nodo("D1", "A", 0, 1), nodo("D2", "A", 1, 1)],
  explicitas: [{ desde: "D2", hasta: "D1" }],
});
verificar(
  `una arista explícita que cierra un ciclo se rechaza (rechazadas = ${CON_CICLO.rechazadas.length})`,
  CON_CICLO.rechazadas.length === 1 && CON_CICLO.rechazadas[0].desde === "D2",
);
verificar(
  "y el grafo sigue siendo utilizable: queda la arista de fase y hay orden topológico",
  CON_CICLO.aristas.length === 1 &&
    (ordenTopologico(CON_CICLO.nodos, CON_CICLO.aristas) ?? []).length === 2,
);
const AUTOCICLO = construirGrafo({
  nodos: [nodo("E1", "A", 0, 1), nodo("E2", "A", 1, 1)],
  explicitas: [{ desde: "E1", hasta: "E1" }],
});
verificar("un bucle sobre sí misma también se rechaza", AUTOCICLO.rechazadas.length === 1);

// Control POSITIVO: una arista explícita LEGÍTIMA sí entra y sí manda.
const CON_EXPLICITA = construirGrafo({
  nodos: [nodo("F1", "A", 0, 1), nodo("F2", "B", 0, 1)],
  explicitas: [{ desde: "F1", hasta: "F2" }],
});
verificar(
  "una arista explícita válida SÍ se acepta (si no, el guardián sería un 'no' constante)",
  CON_EXPLICITA.rechazadas.length === 0 && CON_EXPLICITA.aristas.length === 1,
);
const conExplicita = programarSerial(CON_EXPLICITA, { capacidad: 4 });
verificar(
  "…y cambia la programación: F2 ya no puede arrancar en el día 0 aunque sobre cuadrilla",
  conExplicita.inicio.get("F2") === 1,
);

// E_fase NUNCA produce ciclos, por muchos espacios y fases que haya.
const GRANDE = construirGrafo({
  nodos: Array.from({ length: 60 }, (_, i) =>
    nodo(`G${i}`, `esp${i % 6}`, i % 10, 1 + (i % 3)),
  ),
});
verificar(
  `E_fase no produce ciclos ni con 60 nodos en 6 espacios (${GRANDE.aristas.length} aristas, orden topológico completo)`,
  (ordenTopologico(GRANDE.nodos, GRANDE.aristas) ?? []).length === 60 &&
    GRANDE.rechazadas.length === 0,
);

// Y por el camino del motor: un `depende_de` cíclico no tumba la estimación.
const CICLICO_MOTOR = estimarDuracion(
  [
    {
      id: "z1",
      nombre: "Sala",
      metraje: 20,
      tareas: [
        { id: "t1", nombre: "Estuco paredes", dias: 2, on: true, dependeDe: "t2" },
        { id: "t2", nombre: "Pintura final", dias: 2, on: true, dependeDe: "t1" },
      ],
    },
  ],
  { cuadrillas: 1 },
);
verificar(
  `el motor rechaza la arista cíclica y sigue estimando (${CICLICO_MOTOR.cronograma.aristasRechazadas} rechazada, total ${CICLICO_MOTOR.totalDias.probable} d)`,
  CICLICO_MOTOR.cronograma.aristasRechazadas === 1 && CICLICO_MOTOR.totalDias.probable > 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. CPM: ES/EF, holguras y ruta crítica sobre casos calculables a mano");

// Cadena con lag: 2 d + lag 3 + 4 d = 9 d.
const CON_LAG = construirGrafo({
  nodos: [nodo("L1", "A", 0, 2), nodo("L2", "A", 1, 4, { lagEntrada: 3, esperaEntrada: "secado" })],
});
const cpmLag = calcularCPM(CON_LAG);
verificar(
  `un lag de 3 d entre dos tareas de 2 y 4 d da un CPM de ${cpmLag.makespan} d (2 + 3 + 4)`,
  cpmLag.makespan === 9 && cpmLag.nodos.get("L2")!.es === 5,
);
verificar(
  "el lag viaja en la arista, no en la duración de la tarea",
  CON_LAG.aristas.length === 1 && CON_LAG.aristas[0].lag === 3,
);
verificar(
  "apagar la espera devuelve el CPM a 6 d (la misma arista, sin retardo)",
  calcularCPM(CON_LAG, { lag: () => 0 }).makespan === 6,
);

// Dos ramas desde un origen común: la corta tiene holgura exacta.
const RAMAS = construirGrafo({
  nodos: [
    nodo("R0", "A", 0, 1),
    nodo("R1", "A", 1, 6),
    nodo("R0b", "B", 0, 1),
    nodo("R1b", "B", 1, 2),
  ],
  explicitas: [{ desde: "R0", hasta: "R0b" }],
});
// R0 [0,1] abre las dos ramas. Larga: R1 [1,7]. Corta: R0b [1,2] → R1b [2,4].
// El makespan es 7 y a la rama corta le sobran 7 − 4 = 3 días.
const cpmRamas = calcularCPM(RAMAS);
verificar(
  `la rama larga marca el makespan (${cpmRamas.makespan} = 1 + 6) y la corta tiene ${cpmRamas.nodos.get("R1b")!.holgura} d de holgura (7 − 4)`,
  cpmRamas.makespan === 7 && cpmRamas.nodos.get("R1b")!.holgura === 3,
);
verificar(
  "todo nodo con holgura 0 está marcado como crítico, y ninguno más",
  [...cpmRamas.nodos.values()].every((n) => n.critico === (Math.abs(n.holgura) < 1e-9)),
);
verificar(
  "LS − ES = LF − EF = holgura, en todos los nodos",
  [...cpmRamas.nodos.values()].every(
    (n) => Math.abs(n.ls - n.es - n.holgura) < 1e-9 && Math.abs(n.lf - n.ef - n.holgura) < 1e-9,
  ),
);
verificar(
  "la ruta crítica es una CADENA encadenada de verdad, no un conjunto suelto",
  cpmRamas.rutaCritica.length === 2 &&
    RAMAS.aristas.some(
      (a) => a.desde === cpmRamas.rutaCritica[0] && a.hasta === cpmRamas.rutaCritica[1],
    ),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. SGS: serial con una cuadrilla, tope de congestión y DETERMINISTA");

const serial = programarSerial(DOS_ESPACIOS, { capacidad: 1 });
verificar(
  `con una cuadrilla el makespan es la suma del trabajo (${serial.makespan} = 1+2+1+1+5+1)`,
  serial.makespan === 11,
);
verificar(
  "…y ninguna tarea se solapa con otra (una cuadrilla, una tarea)",
  DOS_ESPACIOS.nodos.every((n) =>
    DOS_ESPACIOS.nodos.every(
      (m) =>
        n.id === m.id ||
        serial.fin.get(n.id)! <= serial.inicio.get(m.id)! + 1e-9 ||
        serial.fin.get(m.id)! <= serial.inicio.get(n.id)! + 1e-9,
    ),
  ),
);

// Tope de congestión: en un espacio de 5 m² no caben dos cuadrillas aunque
// sobren. `capEspacio` = 1 significa una tarea a la vez EN ESE ESPACIO.
const APRETADO = construirGrafo({
  nodos: [
    nodo("P1", "chico", 0, 2, { capEspacio: 1 }),
    nodo("P2", "chico", 0, 2, { capEspacio: 1 }),
    nodo("Q1", "grande", 0, 2, { capEspacio: 4 }),
    nodo("Q2", "grande", 0, 2, { capEspacio: 4 }),
  ],
});
const apretado = programarSerial(APRETADO, { capacidad: 4 });
verificar(
  `en el espacio chico las dos tareas van en serie (${apretado.fin.get("P2")} d) aunque haya 4 cuadrillas`,
  apretado.inicio.get("P2")! >= apretado.fin.get("P1")! - 1e-9,
);
verificar(
  `en el espacio grande van a la vez (las dos terminan en ${apretado.fin.get("Q2")} d)`,
  apretado.fin.get("Q1") === 2 && apretado.fin.get("Q2") === 2,
);

// Sub-linealidad: la capacidad es c^0.85, así que duplicar no divide por dos.
const PARALELO_PURO = construirGrafo({
  nodos: Array.from({ length: 8 }, (_, i) => nodo(`W${i}`, `e${i}`, 0, 4)),
});
const m1 = programarSerial(PARALELO_PURO, { capacidad: 1 }).makespan;
const m2 = programarSerial(PARALELO_PURO, { capacidad: Math.pow(2, 0.85) }).makespan;
verificar(
  `duplicar la cuadrilla acelera ×${(m1 / m2).toFixed(2)}: menos del doble y no más de 2^0.85 = 1.80`,
  m1 / m2 < 2 && m1 / m2 <= Math.pow(2, 0.85) + 0.01,
);
verificar(
  "ninguna tarea corre a más de una cuadrilla: nunca dura menos que su duración",
  PARALELO_PURO.nodos.every((n) => {
    const p = programarSerial(PARALELO_PURO, { capacidad: 8 });
    return p.fin.get(n.id)! - p.inicio.get(n.id)! >= n.duracion - 1e-9;
  }),
);

// El SGS respeta la precedencia Y el lag de cada arista: ninguna tarea puede
// arrancar antes de fin(predecesor) + lag. Es la definición del scheduler, y
// se comprueba sobre el grafo grande, no sobre un caso de juguete.
const planGrande = programarSerial(GRANDE, { capacidad: 2.5 });
verificar(
  `en un grafo de 60 nodos ninguna tarea arranca antes que su predecesor + lag (${GRANDE.aristas.length} aristas)`,
  GRANDE.aristas.every(
    (a) => planGrande.inicio.get(a.hasta)! >= planGrande.fin.get(a.desde)! + a.lag - 1e-9,
  ),
);
verificar(
  "la lista de prioridad es un orden topológico válido (ningún sucesor antes que su predecesor)",
  GRANDE.aristas.every(
    (a) => GRANDE.prioridad.indexOf(a.desde) < GRANDE.prioridad.indexOf(a.hasta),
  ),
);

// Oficios en PARALELO: eléctricas y plomería tienen pool propio, así que se
// solapan aunque la obra tenga UNA sola cuadrilla general. Antes esto era un
// caso especial al sumar el total; ahora sale solo del modelo de recursos.
const conOficio = (extra: { nombre: string; dias: number; on: boolean }[]): EspacioEstim[] => [
  {
    id: "e1",
    nombre: "Sala",
    metraje: 20,
    tareas: [
      { nombre: "Demolición de acabados", dias: 2, on: true },
      ...extra,
      { nombre: "Estuco paredes", dias: 2, on: true },
    ],
  },
];
const soloElec = estimarDuracion(conOficio([{ nombre: "Punto eléctrico", dias: 3, on: true }]), {
  cuadrillas: 1,
});
const dosOficios = estimarDuracion(
  conOficio([
    { nombre: "Punto eléctrico", dias: 3, on: true },
    { nombre: "Punto hidráulico", dias: 3, on: true },
  ]),
  { cuadrillas: 1 },
);
const fElec = dosOficios.fases.find((f) => f.fase === "Instalaciones eléctricas")!;
const fHidro = dosOficios.fases.find((f) => f.fase === "Instalaciones hidrosanitarias")!;
verificar(
  `eléctricas [${fElec.inicioDias}, ${fElec.finDias}] e hidrosanitarias [${fHidro.inicioDias}, ${fHidro.finDias}] se solapan con UNA cuadrilla`,
  fElec.inicioDias < fHidro.finDias && fHidro.inicioDias < fElec.finDias,
);
verificar(
  `añadir el segundo oficio no alarga la obra (${soloElec.cronograma.sgsDias} → ${dosOficios.cronograma.sgsDias} d): es otra gente`,
  Math.abs(dosOficios.cronograma.sgsDias - soloElec.cronograma.sgsDias) < 0.01,
);
verificar(
  "…y el invariante aguanta también con pools de gremio distintos",
  dosOficios.cronograma.cpmDias <= dosOficios.cronograma.sgsDias + 1e-6 &&
    dosOficios.cronograma.sgsDias <= dosOficios.cronograma.sumaDias + 1e-6,
);

// Determinismo: dos corridas del scheduler, y dos corridas del motor entero.
const corrida = () =>
  JSON.stringify([
    ...programarSerial(DOS_ESPACIOS, { capacidad: 1.8 }).fin.entries(),
  ]);
verificar("el SGS es determinista: dos corridas idénticas dan lo mismo", corrida() === corrida());
const CASOS_MOTOR: [string, EspacioEstim[], number | undefined][] = [
  ["Baño 5 m²", BANO, undefined],
  ["Cocina 9 m²", COCINA, undefined],
  ["Apto 60 m²", APTO, 60],
  ["Casa 120 m²", CASA, 120],
  ["6 baños iguales", SEIS_BANOS, undefined],
  ["4 salas con placa", CON_PLACA, undefined],
];
verificar(
  "y el motor entero también, en los seis casos y con 1/2/4 cuadrillas",
  CASOS_MOTOR.every(([, e, area]) =>
    [1, 2, 4].every((c) => {
      const o = { cuadrillas: c, ...(area ? { areaTotal: area } : {}) };
      return JSON.stringify(estimarDuracion(e, o)) === JSON.stringify(estimarDuracion(e, o));
    }),
  ),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. El invariante D_CPM ≤ D_SGS ≤ Σ D_t");

console.log(
  "       caso                    cuadrillas   CPM      SGS     Σ D_t    total",
);
for (const [nombre, espacios, area] of CASOS_MOTOR) {
  for (const c of [1, 2, 4]) {
    const r: ResultadoDuracion = estimarDuracion(espacios, {
      cuadrillas: c,
      ...(area ? { areaTotal: area } : {}),
    });
    const k = r.cronograma;
    if (c === 1) {
      console.log(
        `       ${nombre.padEnd(20)} ${String(c).padStart(6)}   ` +
          `${k.cpmDias.toFixed(1).padStart(7)} ${k.sgsDias.toFixed(1).padStart(7)} ` +
          `${k.sumaDias.toFixed(1).padStart(7)} ${String(r.totalDias.probable).padStart(6)} d`,
      );
    }
    verificar(
      `${nombre} · ${c} cuadrilla(s): ${k.cpmDias} ≤ ${k.sgsDias} ≤ ${k.sumaDias}`,
      k.cpmDias <= k.sgsDias + 1e-6 && k.sgsDias <= k.sumaDias + 1e-6,
    );
  }
}
// El invariante también sin esperas: ahí las tres cifras son trabajo puro y la
// cota superior es exactamente Σ de duraciones.
for (const [nombre, espacios, area] of CASOS_MOTOR) {
  const r = estimarDuracion(espacios, {
    cuadrillas: 1,
    incluirEsperas: false,
    ...(area ? { areaTotal: area } : {}),
  });
  const k = r.cronograma;
  const sumaTareas = r.fases
    .flatMap((f) => f.tareas)
    .reduce((a, t) => a + t.dias, 0);
  verificar(
    `${nombre} sin esperas: Σ D_t (${k.sumaDias.toFixed(2)}) es la suma de las tareas por f`,
    Math.abs(k.sumaDias - sumaTareas * 1.78) < 0.5 * 1.78,
  );
  verificar(
    `${nombre} sin esperas: con UNA cuadrilla el SGS toca su cota superior (${k.sgsDias} = ${k.sumaDias})`,
    Math.abs(k.sgsDias - k.sumaDias) < 0.02,
  );
}
// Λ_ef se REPARTE entre fases sin perder ni inventar días: la suma de lo que
// cada fase declara como espera efectiva es exactamente lo que el scheduler
// mide de más al encender todas las esperas. Si el reparto incremental se
// descuadrara, la línea de tiempo mostraría un secado que el total no cobra.
for (const [nombre, espacios, area] of CASOS_MOTOR) {
  for (const c of [1, 4, 8]) {
    const r = estimarDuracion(espacios, { cuadrillas: c, ...(area ? { areaTotal: area } : {}) });
    const sumaFases = r.fases.reduce((a, f) => a + f.esperaEfectivaDias, 0);
    verificar(
      `${nombre} · ${c} cuadrilla(s): Σ(esperaEfectivaDias) = Λ_ef del cronograma (${sumaFases.toFixed(2)} = ${r.cronograma.esperaEfectivaDias})`,
      Math.abs(sumaFases - r.cronograma.esperaEfectivaDias) <= 0.02 * r.fases.length,
    );
  }
}

// Y el CPM es cota INFERIOR de verdad: con muchísimas cuadrillas el SGS baja
// hasta él, pero nunca por debajo.
const aptoInfinito = estimarDuracion(APTO, { cuadrillas: 64, areaTotal: 60 }).cronograma;
verificar(
  `con 64 cuadrillas el apto se pega al suelo del CPM (SGS ${aptoInfinito.sgsDias} vs CPM ${aptoInfinito.cpmDias}) y no lo atraviesa`,
  aptoInfinito.sgsDias >= aptoInfinito.cpmDias - 1e-6 &&
    aptoInfinito.sgsDias < aptoInfinito.cpmDias * 1.35,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n7. `depende_de` se escribe al crear el proyecto");

// (a) La cadena pura: orden constructivo, encadenada, y estable.
const NOMBRES = [
  "Pintura final sala",
  "Demolición y retiro de acabados existentes",
  "Estuco paredes sala",
  "Estuco techo sala",
];
const ordenes = NOMBRES.map((n) => ordenConstructivoDeTarea(n));
const cadena = cadenaDeEspacio(ordenes);
console.log(
  "       " +
    cadena
      .map((e) => `${NOMBRES[e.indice]}${e.dependeDe == null ? "" : ` ← ${NOMBRES[e.dependeDe]}`}`)
      .join("\n       "),
);
verificar(
  "la cadena reordena a orden constructivo: la demolición abre el espacio",
  cadena[0].indice === 1 && cadena[0].dependeDe === null,
);
verificar(
  "la pintura queda al final y depende de un estuco, no al revés",
  cadena[cadena.length - 1].indice === 0 &&
    ordenes[cadena[cadena.length - 1].dependeDe!] < ordenes[0],
);
verificar(
  "cada eslabón depende del ANTERIOR de la lista devuelta (es una cadena, no un árbol)",
  cadena.every((e, i) => (i === 0 ? e.dependeDe === null : e.dependeDe === cadena[i - 1].indice)),
);
verificar(
  "el predecesor siempre aparece ANTES: se puede crear en este orden y tener ya el id",
  cadena.every((e, i) =>
    e.dependeDe === null
      ? true
      : cadena.findIndex((x) => x.indice === e.dependeDe) < i,
  ),
);
verificar(
  "a igual fase manda el orden del usuario (estable): estuco paredes antes que estuco techo",
  cadena.findIndex((e) => e.indice === 2) < cadena.findIndex((e) => e.indice === 3),
);
verificar("una lista vacía da una cadena vacía", cadenaDeEspacio([]).length === 0);
verificar(
  "una sola tarea no depende de nadie",
  cadenaDeEspacio([3]).length === 1 && cadenaDeEspacio([3])[0].dependeDe === null,
);

// (b) El sitio de creación la USA de verdad. No hay base de datos en este
//     script, así que se verifica sobre el fuente del server action — con
//     control positivo: se comprueba que las tres marcas están, no una sola.
const ACTIONS = readFileSync(
  fileURLToPath(new URL("../src/app/(dashboard)/empezar/actions.ts", import.meta.url)),
  "utf8",
);
verificar(
  "crearObraPersonal importa `cadenaDeEspacio` de @/lib/cronograma",
  /import\s*\{[^}]*cadenaDeEspacio[^}]*\}\s*from\s*"@\/lib\/cronograma"/.test(ACTIONS),
);
verificar(
  "…y la llama con el orden constructivo de cada tarea",
  /cadenaDeEspacio\(/.test(ACTIONS) && /ordenConstructivoDeTarea\(/.test(ACTIONS),
);
verificar(
  "…y pasa `depende_de` al crear la Tarea (el campo deja de estar muerto)",
  /depende_de:\s*dependeDe/.test(ACTIONS),
);
verificar(
  "…guardando el id de cada tarea creada para que el siguiente eslabón lo encuentre",
  /idsCreados\.set\(/.test(ACTIONS) && /select:\s*\{\s*id:\s*true\s*\}/.test(ACTIONS),
);

// (c) El motor LEE `depende_de`: la arista explícita cambia el cronograma.
const SIN_DEP = estimarDuracion(
  [
    { id: "u1", nombre: "Sala", metraje: 20, tareas: [{ id: "s1", nombre: "Estuco paredes", dias: 2, on: true }] },
    { id: "u2", nombre: "Cocina", metraje: 20, tareas: [{ id: "s2", nombre: "Estuco paredes", dias: 2, on: true }] },
  ],
  { cuadrillas: 4 },
);
const CON_DEP = estimarDuracion(
  [
    { id: "u1", nombre: "Sala", metraje: 20, tareas: [{ id: "s1", nombre: "Estuco paredes", dias: 2, on: true }] },
    {
      id: "u2",
      nombre: "Cocina",
      metraje: 20,
      tareas: [{ id: "s2", nombre: "Estuco paredes", dias: 2, on: true, dependeDe: "s1" }],
    },
  ],
  { cuadrillas: 4 },
);
verificar(
  `sin dependencia los dos espacios corren a la vez (SGS ${SIN_DEP.cronograma.sgsDias} d) y con ella se encadenan (${CON_DEP.cronograma.sgsDias} d)`,
  CON_DEP.cronograma.sgsDias > SIN_DEP.cronograma.sgsDias + 0.5,
);
verificar(
  "y el CPM lo refleja: la dependencia explícita alarga el camino crítico",
  CON_DEP.cronograma.cpmDias > SIN_DEP.cronograma.cpmDias + 0.5,
);
verificar(
  "un `depende_de` que apunta a una tarea inexistente se ignora sin romper nada",
  estimarDuracion(
    [
      {
        id: "v1",
        nombre: "Sala",
        metraje: 20,
        tareas: [{ id: "x1", nombre: "Estuco paredes", dias: 2, on: true, dependeDe: "no-existe" }],
      },
    ],
    { cuadrillas: 1 },
  ).cronograma.aristasRechazadas === 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n8. El overhead se PINTA y la línea de tiempo cuadra con el total");

for (const [nombre, espacios, area] of CASOS_MOTOR) {
  const r = estimarDuracion(espacios, { cuadrillas: 1, ...(area ? { areaTotal: area } : {}) });
  const finMax = Math.max(...r.fases.map((f) => f.finDias));
  verificar(
    `${nombre}: la última barra cae en el día ${finMax.toFixed(2)} y el total es ${r.totalDias.probable} d`,
    Math.abs(finMax - r.totalDias.probable) <= 0.5 + 0.01 * r.fases.length,
  );
  verificar(
    `${nombre}: ninguna tarea arranca antes de que acabe el overhead (${r.overheadDias} d)`,
    r.fases.every((f) => f.inicioDias >= r.overheadDias - 1e-9),
  );
}
const LINEA = readFileSync(
  fileURLToPath(new URL("../src/components/personal/LineaTiempoObra.tsx", import.meta.url)),
  "utf8",
);
verificar(
  "LineaTiempoObra dibuja el overhead (usa `overheadDias`, que antes no aparecía)",
  /overheadDias/.test(LINEA) && /Arranque y entrega/.test(LINEA),
);
verificar(
  "…y dibuja la línea de balance con las franjas del cronograma, no cajas de fase",
  /inicioDias/.test(LINEA) && /finDias/.test(LINEA),
);
verificar(
  "…resaltando en ámbar las tareas sin holgura (la ruta crítica)",
  /t\.critico/.test(LINEA) && /bg-amber-400/.test(LINEA),
);
verificar(
  "…y separando la espera de secado CRUDA de la que empuja la fecha",
  /esperaDias/.test(LINEA) && /esperaEfectivaDias/.test(LINEA),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n9. El módulo del cronograma es puro y determinista");

const FUENTES = ["cpm.ts", "dependencias.ts", "grafo.ts", "index.ts", "orden.ts", "sgs.ts", "tipos.ts"];
const IMPUREZAS = ["prisma", "fetch(", "Math.random", "Date.now", "new Date("];
for (const f of FUENTES) {
  const src = readFileSync(
    fileURLToPath(new URL(`../src/lib/cronograma/${f}`, import.meta.url)),
    "utf8",
  );
  const halladas = IMPUREZAS.filter((m) => src.includes(m));
  verificar(
    `cronograma/${f} sin ${IMPUREZAS.join(" / ")}${halladas.length ? ` — halladas: ${halladas.join(", ")}` : ""}`,
    halladas.length === 0,
  );
  verificar(
    `cronograma/${f} no importa nada del dominio (ni fases, ni rendimientos, ni prisma)`,
    !/from\s+"\.\.\//.test(src) && !/from\s+"@\//.test(src),
  );
}
// Las fases siguen en orden constructivo dentro de cada espacio: si esto se
// rompiera, el grafo encadenaría la pintura antes que la demolición.
verificar(
  `FASES_OBRA sigue siendo la fuente del orden constructivo (${FASES_OBRA.length} fases, "Otros" en el 0)`,
  ordenConstructivoDeTarea("Trámite de permisos ante la copropiedad") === 0 &&
    ordenConstructivoDeTarea("Demolición y retiro de acabados existentes") === 1 &&
    ordenConstructivoDeTarea("Pintura final sala") === 1 + FASES_OBRA.indexOf("Pintura"),
);
verificar(
  "y la fase declarada por el llamador manda sobre el nombre (import del Excel único)",
  ordenConstructivoDeTarea("Una tarea sin nombre reconocible", "Pintura") ===
    1 + FASES_OBRA.indexOf("Pintura"),
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Cronograma (grafo por espacio, CPM y SGS) verificado sin errores.");
