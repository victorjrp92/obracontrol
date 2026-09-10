// ─────────────────────────────────────────────────────────────────────────
// Verificación de `avancePorFase` (`src/lib/fases-avance.ts`).
//
// Lo que este módulo tiene que hacer bien es una sola cosa y es fácil de
// romper sin que se note: los cuatro estados tienen que sumar el total, y el
// reparto por edificio tiene que sumar la fase. Un error ahí no rompe la
// pantalla — enseña un porcentaje equivocado, que es peor.
//
// Con CONTROL POSITIVO: se comprueba contra un árbol donde las cuentas se
// saben a mano, y contra el caso que motivó el módulo (tres torres en frentes
// distintos, donde el promedio no describe a ninguna).
// ─────────────────────────────────────────────────────────────────────────

import { avancePorFase, type EdificioConTareas } from "@/lib/fases-avance";

let total = 0, fallos = 0;
function verificar(d: string, c: boolean) {
  total++;
  if (c) console.log(`  OK   ${d}`);
  else { fallos++; console.error(`  FAIL ${d}`); }
}

const FASES = [
  { id: "f1", nombre: "Obra gris", orden: 1 },
  { id: "f2", nombre: "Enchapes", orden: 2 },
  { id: "f3", nombre: "Pintura", orden: 3 },
];

/** Un edificio con `n` tareas por fase, en los estados dados. */
function edificio(nombre: string, porFase: Record<string, string[]>): EdificioConTareas {
  const tareas = Object.entries(porFase).flatMap(([fid, estados]) =>
    estados.map((estado) => ({ estado, fase: { id: fid, nombre: fid, orden: 1 } })));
  return { nombre, pisos: [{ unidades: [{ espacios: [{ tareas }] }] }] };
}

console.log("Avance por fase — verificación\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Los cuatro estados suman el total");
{
  const r = avancePorFase(FASES, [edificio("T1", {
    f1: ["APROBADA", "APROBADA", "REPORTADA", "NO_APROBADA", "PENDIENTE"],
    f2: ["PENDIENTE", "PENDIENTE"],
    f3: [],
  })]);
  const f1 = r.fases[0];
  verificar(`f1 total = 5`, f1.total === 5);
  verificar(`2 aprobadas · 1 reportada · 1 devuelta · 1 pendiente`,
    f1.aprobadas === 2 && f1.reportadas === 1 && f1.devueltas === 1 && f1.pendientes === 1);
  verificar(`los cuatro suman el total`,
    f1.aprobadas + f1.reportadas + f1.devueltas + f1.pendientes === f1.total);
  verificar(`porcentaje aprobado = 40% (2 de 5)`, f1.porcentajeAprobado === 40);
  verificar(`REPORTADA no cuenta como aprobada`, f1.aprobadas === 2);
  verificar(`una fase sin tareas queda en 0 y no en NaN`,
    r.fases[2].total === 0 && r.fases[2].porcentajeAprobado === 0);
  verificar(`una fase sin tareas no se marca completa`, r.fases[2].completa === false);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. `completa` solo con TODO aprobado");
{
  const r = avancePorFase(FASES, [edificio("T1", {
    f1: ["APROBADA", "APROBADA"],
    f2: ["APROBADA", "REPORTADA"],
    f3: ["APROBADA", "NO_APROBADA"],
  })]);
  verificar(`todo aprobado → completa`, r.fases[0].completa === true);
  verificar(`CONTROL: una reportada pendiente NO la completa`, r.fases[1].completa === false);
  verificar(`CONTROL: una devuelta NO la completa`, r.fases[2].completa === false);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. El reparto por edificio suma la fase (el caso que motivó el módulo)");
{
  // Tres torres en frentes distintos: el promedio no describe a ninguna.
  const r = avancePorFase(FASES, [
    edificio("Torre 1", { f2: Array(10).fill("APROBADA") }),
    edificio("Torre 2", { f2: [...Array(4).fill("APROBADA"), ...Array(3).fill("REPORTADA"), ...Array(3).fill("PENDIENTE")] }),
    edificio("Torre 3", { f2: Array(10).fill("PENDIENTE") }),
  ]);
  const f2 = r.fases[1];
  verificar(`la fase suma 30 tareas de las tres torres`, f2.total === 30);
  verificar(`14 aprobadas → 47% de promedio`, f2.aprobadas === 14 && f2.porcentajeAprobado === 47);
  verificar(`hay reparto para las tres torres`, f2.reparto.length === 3);
  const suma = f2.reparto.reduce((a, x) => a + x.total, 0);
  const sumaAp = f2.reparto.reduce((a, x) => a + x.aprobadas, 0);
  verificar(`el reparto suma el total de la fase (${suma})`, suma === f2.total);
  verificar(`el reparto suma las aprobadas de la fase (${sumaAp})`, sumaAp === f2.aprobadas);
  const [t1, t2, t3] = f2.reparto;
  verificar(`Torre 1 al 100%, Torre 2 al 40%, Torre 3 en 0 — ninguna se parece al 47%`,
    t1.aprobadas === 10 && t2.aprobadas === 4 && t3.aprobadas === 0);
  verificar(`el reparto conserva el nombre del edificio`,
    t1.nombre === "Torre 1" && t3.nombre === "Torre 3");
  verificar(`una torre sin tocar la fase igual aparece con su total`, t3.total === 10);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. El frente: dónde se acumula trabajo sin aprobar");
{
  const r = avancePorFase(FASES, [edificio("T1", {
    // f1 casi terminada pero con 2 esperando; f2 con 9 esperando.
    f1: [...Array(90).fill("APROBADA"), "REPORTADA", "REPORTADA"],
    f2: [...Array(20).fill("APROBADA"), ...Array(9).fill("REPORTADA")],
    f3: Array(10).fill("PENDIENTE"),
  })]);
  verificar(`el frente es f2 (9 esperando), no f1 (2) aunque f1 va primero`,
    r.frente === 1);
  verificar(`CONTROL: f1 está al 98% — «la primera sin terminar» habría fallado`,
    r.fases[0].porcentajeAprobado === 98);
  verificar(`totalReportadas suma las de todas las fases`, r.totalReportadas === 11);
}
{
  const r = avancePorFase(FASES, [edificio("T1", { f1: ["APROBADA"], f2: ["PENDIENTE"], f3: [] })]);
  verificar(`sin nada reportado, frente = -1`, r.frente === -1);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. Bordes");
{
  verificar(`sin edificios: las fases salen en cero`,
    avancePorFase(FASES, []).fases.every((f) => f.total === 0));
  verificar(`sin fases: lista vacía y frente -1`,
    avancePorFase([], [edificio("T1", { f1: ["APROBADA"] })]).fases.length === 0);

  // Una tarea que apunta a una fase borrada no debe contarse ni reventar.
  const r = avancePorFase(FASES, [edificio("T1", { f1: ["APROBADA"], fX: ["APROBADA", "APROBADA"] })]);
  verificar(`una tarea de una fase inexistente se ignora sin reventar`,
    r.fases.reduce((a, f) => a + f.total, 0) === 1);

  // Orden: la lista sale por `orden`, no por el orden de entrada.
  const desordenadas = [
    { id: "f3", nombre: "Pintura", orden: 3 },
    { id: "f1", nombre: "Obra gris", orden: 1 },
    { id: "f2", nombre: "Enchapes", orden: 2 },
  ];
  const ord = avancePorFase(desordenadas, []).fases.map((f) => f.orden);
  verificar(`la lista sale ordenada por \`orden\` (${ord.join(",")})`, String(ord) === "1,2,3");

  verificar(`un estado desconocido cae en pendientes, no se pierde`,
    avancePorFase(FASES, [edificio("T1", { f1: ["EN_MARTE"] })]).fases[0].pendientes === 1);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) { console.error(`${fallos} fallaron.`); process.exit(1); }
console.log("Avance por fase verificado sin errores.");
