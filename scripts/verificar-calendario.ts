// ─────────────────────────────────────────────────────────────────────────
// Verificación del CALENDARIO LABORAL COLOMBIANO (`src/lib/calendario-colombia.ts`)
// y de las esperas de secado como LAGS dentro del motor de duración.
//
// No hay test runner en el proyecto — este script ES la suite, en asserts
// planos, igual que `verificar-reglas-alerta.ts`.
//
// Qué verifica:
//   1. La Pascua sale del algoritmo gregoriano anónimo (Meeus/Jones/Butcher) y
//      coincide con el calendario litúrgico: 2025 → 20 abr · 2026 → 5 abr ·
//      2027 → 28 mar. Y cumple sus invariantes (siempre domingo, siempre entre
//      el 22 de marzo y el 25 de abril).
//   2. Los 18 festivos de 2025, 2026 y 2027 coinciden UNO A UNO con el
//      calendario oficial colombiano, escrito A MANO abajo. Es la única forma
//      de que este test valga algo: comparar el generador contra sí mismo no
//      demuestra nada.
//   3. La Ley 51 de 1983 («Emiliani») traslada al lunes los 7 fijos que
//      corresponde y los 3 móviles que corresponde, y NO toca los otros 8.
//   4. `esHabil` / `diasHabilesEntre` / `addWorkingDays` descuentan festivos y
//      son consistentes entre sí.
//   5. El factor ρ vale lo que dice la cabecera del módulo y ordena bien las
//      tres jornadas (5 < 6 < 7 días/semana).
//   6. Existe UNA sola definición de día hábil en `src/` — y las duplicadas
//      que quedan fuera del OWNS de este leaf están PINCHADAS: si aparece una
//      nueva, esta verificación falla.
//   7. Las esperas de secado son LAGS, no sumandos: en obra grande las absorbe
//      el trabajo paralelo y en un baño único empujan la fecha.
//   8. El módulo es puro y determinista: no lee el reloj ni el azar.
//
// Uso: `npx tsx scripts/verificar-calendario.ts`. Sale con 1 si algo falla.
// ─────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  addWorkingDays,
  claveDia,
  diasHabilesEnAnio,
  diasHabilesEntre,
  esFestivo,
  esHabil,
  festivosColombia,
  festivoDe,
  pascua,
  rho,
  trasladarALunes,
  VENTANA_RHO,
  type Festivo,
} from "@/lib/calendario-colombia";
import { estimarDuracion, type EspacioEstim } from "@/lib/estimar-duracion";
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

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// ─────────────────────────────────────────────────────────────────────────
console.log("Calendario laboral colombiano — verificación\n");
console.log("1. Pascua — algoritmo gregoriano anónimo (Meeus/Jones/Butcher)");

// Referencia externa: calendario litúrgico. NO se deriva del propio módulo.
const PASCUA_OFICIAL: [number, string][] = [
  [2024, "2024-03-31"],
  [2025, "2025-04-20"],
  [2026, "2026-04-05"],
  [2027, "2027-03-28"],
  [2028, "2028-04-16"],
];
for (const [anio, iso] of PASCUA_OFICIAL) {
  verificar(
    `Pascua ${anio} = ${iso} (obtuvo ${claveDia(pascua(anio))})`,
    claveDia(pascua(anio)) === iso,
  );
}
// Invariantes que ningún año puede violar (muestreo de 200 años).
let noDomingo = 0;
let fueraDeRango = 0;
for (let anio = 1900; anio <= 2100; anio++) {
  const p = pascua(anio);
  if (p.getUTCDay() !== 0) noDomingo++;
  const clave = claveDia(p);
  if (clave < `${anio}-03-22` || clave > `${anio}-04-25`) fueraDeRango++;
}
verificar("la Pascua cae SIEMPRE en domingo (1900–2100)", noDomingo === 0);
verificar("la Pascua cae SIEMPRE entre el 22 de marzo y el 25 de abril (1900–2100)", fueraDeRango === 0);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. Los 18 festivos contra el calendario OFICIAL, escrito a mano");

/**
 * Calendario oficial colombiano, transcrito a mano de la publicación anual.
 * NO se genera: si el generador se equivoca, esta lista lo delata. Cada entrada
 * es [fecha efectiva, nombre].
 *
 * ⚠️ 2025 tiene 18 festivos en 17 FECHAS: el 30 de junio caen a la vez el
 * Sagrado Corazón (Pascua+71) y San Pedro y San Pablo (29 jun, domingo → lunes
 * 30). No es un error de transcripción, es el calendario real de ese año.
 */
const OFICIAL: Record<number, string[]> = {
  2025: [
    "2025-01-01", // Año Nuevo (miércoles)
    "2025-01-06", // Reyes Magos — ya era lunes, no se mueve
    "2025-03-24", // San José — 19 mar (miércoles) → lunes 24
    "2025-04-17", // Jueves Santo
    "2025-04-18", // Viernes Santo
    "2025-05-01", // Día del Trabajo (jueves)
    "2025-06-02", // Ascensión — Pascua+43
    "2025-06-23", // Corpus Christi — Pascua+64
    "2025-06-30", // Sagrado Corazón — Pascua+71
    "2025-06-30", // San Pedro y San Pablo — 29 jun (domingo) → lunes 30. MISMO DÍA
    "2025-07-20", // Independencia (domingo, no se mueve)
    "2025-08-07", // Batalla de Boyacá (jueves)
    "2025-08-18", // Asunción — 15 ago (viernes) → lunes 18
    "2025-10-13", // Día de la Raza — 12 oct (domingo) → lunes 13
    "2025-11-03", // Todos los Santos — 1 nov (sábado) → lunes 3
    "2025-11-17", // Independencia de Cartagena — 11 nov (martes) → lunes 17
    "2025-12-08", // Inmaculada (lunes)
    "2025-12-25", // Navidad (jueves)
  ],
  2026: [
    "2026-01-01", // Año Nuevo (jueves)
    "2026-01-12", // Reyes Magos — 6 ene (martes) → lunes 12
    "2026-03-23", // San José — 19 mar (jueves) → lunes 23
    "2026-04-02", // Jueves Santo
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Día del Trabajo (viernes)
    "2026-05-18", // Ascensión — Pascua+43
    "2026-06-08", // Corpus Christi — Pascua+64
    "2026-06-15", // Sagrado Corazón — Pascua+71
    "2026-06-29", // San Pedro y San Pablo — ya era lunes
    "2026-07-20", // Independencia (lunes)
    "2026-08-07", // Batalla de Boyacá (viernes)
    "2026-08-17", // Asunción — 15 ago (sábado) → lunes 17
    "2026-10-12", // Día de la Raza — ya era lunes
    "2026-11-02", // Todos los Santos — 1 nov (domingo) → lunes 2
    "2026-11-16", // Independencia de Cartagena — 11 nov (miércoles) → lunes 16
    "2026-12-08", // Inmaculada (martes)
    "2026-12-25", // Navidad (viernes)
  ],
  2027: [
    "2027-01-01", // Año Nuevo (viernes)
    "2027-01-11", // Reyes Magos — 6 ene (miércoles) → lunes 11
    "2027-03-22", // San José — 19 mar (viernes) → lunes 22
    "2027-03-25", // Jueves Santo
    "2027-03-26", // Viernes Santo
    "2027-05-01", // Día del Trabajo (sábado, no se mueve)
    "2027-05-10", // Ascensión — Pascua+43
    "2027-05-31", // Corpus Christi — Pascua+64
    "2027-06-07", // Sagrado Corazón — Pascua+71
    "2027-07-05", // San Pedro y San Pablo — 29 jun (martes) → lunes 5 jul
    "2027-07-20", // Independencia (martes)
    "2027-08-07", // Batalla de Boyacá (sábado, no se mueve)
    "2027-08-16", // Asunción — 15 ago (domingo) → lunes 16
    "2027-10-18", // Día de la Raza — 12 oct (martes) → lunes 18
    "2027-11-01", // Todos los Santos — ya era lunes
    "2027-11-15", // Independencia de Cartagena — 11 nov (jueves) → lunes 15
    "2027-12-08", // Inmaculada (miércoles)
    "2027-12-25", // Navidad (sábado)
  ],
};

const ANIOS = [2025, 2026, 2027];
for (const anio of ANIOS) {
  const esperado = [...OFICIAL[anio]].sort();
  const obtenido = festivosColombia(anio).map((f) => claveDia(f.fecha)).sort();
  verificar(`${anio}: el generador produce 18 festivos (obtuvo ${obtenido.length})`, obtenido.length === 18);
  verificar(
    `${anio}: la lista oficial transcrita tiene 18 entradas (${esperado.length})`,
    esperado.length === 18,
  );
  const difieren = esperado.filter((x, i) => obtenido[i] !== x);
  if (difieren.length) {
    console.error(`       oficial : ${esperado.join(" ")}`);
    console.error(`       generado: ${obtenido.join(" ")}`);
  }
  verificar(
    `${anio}: las 18 fechas coinciden UNA A UNA con el calendario oficial`,
    JSON.stringify(esperado) === JSON.stringify(obtenido),
  );
  // Reparto por regla: 6 fijos + 7 Emiliani + 2 pascuales + 3 pascual-Emiliani.
  const porRegla = (r: Festivo["regla"]) => festivosColombia(anio).filter((f) => f.regla === r).length;
  verificar(
    `${anio}: reparto por regla 6/7/2/3 (obtuvo ${porRegla("fijo")}/${porRegla("emiliani")}/${porRegla("pascual")}/${porRegla("pascual-emiliani")})`,
    porRegla("fijo") === 6 && porRegla("emiliani") === 7 && porRegla("pascual") === 2 && porRegla("pascual-emiliani") === 3,
  );
  // `esFestivo` tiene que decir que sí a los 18 y que no a los días de al lado.
  const todosSon = OFICIAL[anio].every((iso) => esFestivo(d(iso)));
  verificar(`${anio}: esFestivo() reconoce las 18 fechas oficiales`, todosSon);
}

// El caso raro de 2025: dos festivos, una sola fecha.
const f2025 = festivosColombia(2025);
const distintas2025 = new Set(f2025.map((f) => claveDia(f.fecha)));
verificar(
  `2025: 18 festivos en 17 fechas distintas (obtuvo ${f2025.length} en ${distintas2025.size})`,
  f2025.length === 18 && distintas2025.size === 17,
);
const del30jun = f2025.filter((f) => claveDia(f.fecha) === "2025-06-30").map((f) => f.nombre);
verificar(
  `2025: el 30 de junio caen DOS festivos (${del30jun.join(" + ")})`,
  del30jun.length === 2 &&
    del30jun.includes("Sagrado Corazón de Jesús") &&
    del30jun.includes("San Pedro y San Pablo"),
);
verificar(
  "2026 y 2027 sí tienen 18 fechas distintas (la coincidencia es cosa de 2025)",
  new Set(festivosColombia(2026).map((f) => claveDia(f.fecha))).size === 18 &&
    new Set(festivosColombia(2027).map((f) => claveDia(f.fecha))).size === 18,
);

// Un no-festivo cualquiera no puede colarse.
for (const iso of ["2026-01-06", "2026-03-19", "2026-11-11", "2026-04-05", "2026-12-24"]) {
  verificar(`${iso} NO es festivo (es la fecha base, o víspera, no la efectiva)`, !esFestivo(d(iso)));
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. Ley 51 de 1983 («Emiliani») — traslada 10, deja quietos 8");

const NOMBRES_TRASLADABLES = [
  "Reyes Magos",
  "San José",
  "San Pedro y San Pablo",
  "Asunción de la Virgen",
  "Día de la Raza",
  "Todos los Santos",
  "Independencia de Cartagena",
];
const NOMBRES_FIJOS = [
  "Año Nuevo",
  "Día del Trabajo",
  "Independencia de Colombia",
  "Batalla de Boyacá",
  "Inmaculada Concepción",
  "Navidad",
];
const NOMBRES_MOVILES_TRASLADABLES = ["Ascensión del Señor", "Corpus Christi", "Sagrado Corazón de Jesús"];
const NOMBRES_MOVILES_FIJOS = ["Jueves Santo", "Viernes Santo"];

// Muestreo ancho: 51 años, no tres. Un traslado mal hecho se ve en algún año.
const MUESTRA = Array.from({ length: 51 }, (_, i) => 2000 + i);
const buscar = (anio: number, nombre: string) => festivosColombia(anio).find((f) => f.nombre === nombre)!;

let trasladablesNoLunes = 0;
for (const anio of MUESTRA) {
  for (const nombre of [...NOMBRES_TRASLADABLES, ...NOMBRES_MOVILES_TRASLADABLES]) {
    if (buscar(anio, nombre).fecha.getUTCDay() !== 1) trasladablesNoLunes++;
  }
}
verificar(
  `los 7 fijos trasladables + los 3 móviles trasladables caen SIEMPRE en lunes (2000–2050, ${MUESTRA.length * 10} casos)`,
  trasladablesNoLunes === 0,
);

let fijosMovidos = 0;
const diasSemanaVistos = new Set<number>();
for (const anio of MUESTRA) {
  for (const nombre of [...NOMBRES_FIJOS, ...NOMBRES_MOVILES_FIJOS]) {
    const f = buscar(anio, nombre);
    if (f.trasladado || f.fecha.getTime() !== f.base.getTime()) fijosMovidos++;
    diasSemanaVistos.add(f.fecha.getUTCDay());
  }
}
verificar(
  `los 6 fijos + Jueves y Viernes Santo NO se trasladan NUNCA (2000–2050, ${MUESTRA.length * 8} casos)`,
  fijosMovidos === 0,
);
verificar(
  `…y por eso caen en cualquier día de la semana (vistos ${diasSemanaVistos.size} de 7)`,
  diasSemanaVistos.size === 7,
);

// El traslado es «al lunes SIGUIENTE»: si ya es lunes, se queda.
const YA_ERA_LUNES: [number, string, string][] = [
  [2025, "Reyes Magos", "2025-01-06"],
  [2026, "San Pedro y San Pablo", "2026-06-29"],
  [2026, "Día de la Raza", "2026-10-12"],
  [2027, "Todos los Santos", "2027-11-01"],
];
for (const [anio, nombre, iso] of YA_ERA_LUNES) {
  const f = buscar(anio, nombre);
  verificar(
    `${nombre} ${anio}: la base ya era lunes → se queda en ${iso} (obtuvo ${claveDia(f.fecha)}), sin correr otra semana`,
    claveDia(f.fecha) === iso && !f.trasladado,
  );
}
// Y la función de traslado, aislada: domingo → +1, martes → +6, sábado → +2.
verificar("trasladarALunes(domingo) suma 1 día", claveDia(trasladarALunes(d("2026-11-01"))) === "2026-11-02");
verificar("trasladarALunes(martes) suma 6 días", claveDia(trasladarALunes(d("2026-01-06"))) === "2026-01-12");
verificar("trasladarALunes(sábado) suma 2 días", claveDia(trasladarALunes(d("2026-08-15"))) === "2026-08-17");
verificar("trasladarALunes(lunes) no suma nada", claveDia(trasladarALunes(d("2026-06-29"))) === "2026-06-29");

// Los offsets pascuales del enunciado, comprobados sobre el resultado.
for (const anio of ANIOS) {
  const p = pascua(anio).getTime();
  const off = (nombre: string) => Math.round((buscar(anio, nombre).fecha.getTime() - p) / 86400000);
  verificar(
    `${anio}: offsets pascuales −3 / −2 / +43 / +64 / +71 (obtuvo ${off("Jueves Santo")} / ${off("Viernes Santo")} / ${off("Ascensión del Señor")} / ${off("Corpus Christi")} / ${off("Sagrado Corazón de Jesús")})`,
    off("Jueves Santo") === -3 &&
      off("Viernes Santo") === -2 &&
      off("Ascensión del Señor") === 43 &&
      off("Corpus Christi") === 64 &&
      off("Sagrado Corazón de Jesús") === 71,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. esHabil / diasHabilesEntre / addWorkingDays descuentan festivos");

// 12 de enero de 2026 es LUNES y es Reyes Magos trasladado.
verificar("2026-01-12 es lunes", d("2026-01-12").getUTCDay() === 1);
verificar("…y NO es hábil, porque es Reyes Magos trasladado", !esHabil(d("2026-01-12"), 6));
verificar("2026-01-13 (martes) sí es hábil", esHabil(d("2026-01-13"), 6));
verificar("el festivo tampoco es hábil con jornada de 7 días (manda la ley, no la jornada)", !esHabil(d("2026-01-12"), 7));
verificar("un domingo cualquiera no es hábil con jornada de 6", !esHabil(d("2026-01-11"), 6));
verificar("un sábado sí es hábil con jornada de 6", esHabil(d("2026-01-10"), 6));
verificar("…y no lo es con jornada de 5", !esHabil(d("2026-01-10"), 5));
verificar(
  `festivoDe(2026-01-12) lo identifica (${festivoDe(d("2026-01-12"))?.nombre ?? "NULL"})`,
  festivoDe(d("2026-01-12"))?.nombre === "Reyes Magos",
);

// La semana de Reyes 2026: lunes 12 festivo. Lu–Sá deja 5 hábiles, no 6.
verificar(
  `semana del 12 al 18 de enero de 2026 con jornada de 6: 5 hábiles, no 6 (obtuvo ${diasHabilesEntre(d("2026-01-12"), d("2026-01-19"), 6)})`,
  diasHabilesEntre(d("2026-01-12"), d("2026-01-19"), 6) === 5,
);
// Semana Santa 2026: Jueves Santo el 2 y Viernes Santo el 3 de abril. Con
// jornada Lu–Sá quedan lunes, martes, miércoles y sábado = 4 (sin los dos
// festivos serían 6). Con jornada Lu–Vi quedan 3.
verificar(
  `Semana Santa 2026 (30 mar – 5 abr) con jornada de 6: 4 hábiles, no 6 (obtuvo ${diasHabilesEntre(d("2026-03-30"), d("2026-04-06"), 6)})`,
  diasHabilesEntre(d("2026-03-30"), d("2026-04-06"), 6) === 4,
);
verificar(
  `…y con jornada de 5: 3 hábiles (obtuvo ${diasHabilesEntre(d("2026-03-30"), d("2026-04-06"), 5)})`,
  diasHabilesEntre(d("2026-03-30"), d("2026-04-06"), 5) === 3,
);
verificar("fin anterior al inicio → 0", diasHabilesEntre(d("2026-04-10"), d("2026-04-01"), 6) === 0);
verificar("mismo día → 0", diasHabilesEntre(d("2026-04-01"), d("2026-04-01"), 6) === 0);
verificar(
  "el intervalo es [inicio, fin): el propio día de `fin` no cuenta",
  diasHabilesEntre(d("2026-01-13"), d("2026-01-14"), 6) === 1,
);

// addWorkingDays salta festivos igual que salta domingos.
verificar(
  `addWorkingDays(2026-01-09, 1, 6) → sábado 10 (obtuvo ${claveDia(addWorkingDays(d("2026-01-09"), 1, 6))})`,
  claveDia(addWorkingDays(d("2026-01-09"), 1, 6)) === "2026-01-10",
);
verificar(
  `addWorkingDays(2026-01-10, 1, 6) salta el domingo 11 Y el festivo del lunes 12 → martes 13 (obtuvo ${claveDia(addWorkingDays(d("2026-01-10"), 1, 6))})`,
  claveDia(addWorkingDays(d("2026-01-10"), 1, 6)) === "2026-01-13",
);
verificar(
  `addWorkingDays(2026-04-01, 1, 6) salta Jueves y Viernes Santo → sábado 4 (obtuvo ${claveDia(addWorkingDays(d("2026-04-01"), 1, 6))})`,
  claveDia(addWorkingDays(d("2026-04-01"), 1, 6)) === "2026-04-04",
);
verificar(
  `addWorkingDays(2026-04-01, 2, 6) salta además el domingo 5 → lunes 6 (obtuvo ${claveDia(addWorkingDays(d("2026-04-01"), 2, 6))})`,
  claveDia(addWorkingDays(d("2026-04-01"), 2, 6)) === "2026-04-06",
);
verificar("addWorkingDays(d, 0) devuelve el mismo día", claveDia(addWorkingDays(d("2026-04-01"), 0, 6)) === "2026-04-01");
verificar(
  "addWorkingDays con n negativo camina hacia atrás y también salta festivos",
  claveDia(addWorkingDays(d("2026-01-13"), -1, 6)) === "2026-01-10",
);

// Las dos operaciones encajan, y la relación exacta importa porque las dos
// convenciones son distintas a propósito:
//   · `addWorkingDays(i, n)` cuenta a partir del día SIGUIENTE a `i`.
//   · `diasHabilesEntre(i, f)` cuenta el intervalo [i, f) — incluye `i`, no `f`.
// Así que sumar n hábiles desde un día HÁBIL deja n en el intervalo (el propio
// `i` más los n−1 primeros), y desde un día NO hábil deja n−1.
let inconsistentes = 0;
let casos = 0;
for (let k = 0; k < 120; k++) {
  const inicio = new Date(d("2026-01-01").getTime() + k * 3 * 86400000);
  for (const s of [5, 6]) {
    for (const n of [1, 3, 7, 20]) {
      casos++;
      const fin = addWorkingDays(inicio, n, s);
      const esperado = esHabil(inicio, s) ? n : n - 1;
      if (diasHabilesEntre(inicio, fin, s) !== esperado) inconsistentes++;
    }
  }
}
verificar(
  `addWorkingDays y diasHabilesEntre encajan en las ${casos} combinaciones (fallos: ${inconsistentes})`,
  inconsistentes === 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. El factor ρ = días hábiles ÷ días calendario");

const r5 = rho(5);
const r6 = rho(6);
const r7 = rho(7);
console.log(
  `       ρ(5) = ${r5.toFixed(4)} · ρ(6) = ${r6.toFixed(4)} · ρ(7) = ${r7.toFixed(4)}   ` +
    `(promedio ${VENTANA_RHO[0]}–${VENTANA_RHO[1]}; hábiles en 2026: ${diasHabilesEnAnio(2026, 5)} / ${diasHabilesEnAnio(2026, 6)} / ${diasHabilesEnAnio(2026, 7)})`,
);
verificar(`ρ(6) ≈ 0.81 (obtuvo ${r6.toFixed(4)})`, Math.abs(r6 - 0.81) < 0.01);
verificar(`ρ(5) ≈ 0.67 (obtuvo ${r5.toFixed(4)})`, Math.abs(r5 - 0.67) < 0.01);
verificar(`ρ(7) ≈ 0.95 (obtuvo ${r7.toFixed(4)})`, Math.abs(r7 - 0.95) < 0.01);
verificar("ρ crece con la jornada: ρ(5) < ρ(6) < ρ(7) < 1", r5 < r6 && r6 < r7 && r7 < 1);
// Sin festivos, ρ(6) sería exactamente 6/7 = 0.857. La diferencia es su precio.
const costeFestivos = 6 / 7 - r6;
verificar(
  `los 18 festivos cuestan ${(costeFestivos * 100).toFixed(1)} puntos de ρ(6) — entre 4 y 5, o sea ~17 días hábiles al año`,
  costeFestivos > 0.04 && costeFestivos < 0.05,
);
verificar(
  "ρ es determinista: no depende del año en curso (ventana fija)",
  rho(6) === r6 && rho(6) === rho(6),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. UNA sola definición de día hábil en src/");

/** Ficheros .ts/.tsx bajo src/, sin el cliente Prisma generado. */
function fuentes(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "generated" || nombre === "node_modules") continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) fuentes(ruta, acc);
    else if (/\.tsx?$/.test(nombre)) acc.push(ruta);
  }
  return acc;
}
const ARCHIVOS = fuentes(join(RAIZ, "src"));
const RE_DEFINICION = /function\s+(diasHabilesEntre|calcularDiasHabiles|esHabil)\b/;
const definidores = ARCHIVOS.filter((f) => RE_DEFINICION.test(readFileSync(f, "utf8")))
  .map((f) => f.slice(RAIZ.length))
  .sort();

const CANONICO = "src/lib/calendario-colombia.ts";
/**
 * Duplicadas que quedan, con dueño y motivo. Están FUERA del OWNS de leaf-3.3
 * y las dos pertenecen a leaves ya verificados, así que se PINCHAN aquí en vez
 * de tocarlas: esta lista no puede crecer sin que la suite falle.
 */
const DEUDA_CONOCIDA: [string, string][] = [
  [
    "src/lib/duraciones-mercado.ts",
    "leaf-3.0 · `diasHabilesEntre` FRACCIONARIA (mide duración real transcurrida, devuelve 0.5 para media jornada). " +
      "Semántica distinta a la canónica, y añadirle festivos rompe 2 asserts de verificar-medicion-duracion.ts",
  ],
  [
    "src/app/(dashboard)/empezar/IntentWizard.tsx",
    "leaf-2.1 (VERIFIED) · `diasHabilesEntre` propia, inclusiva en los dos extremos y con la semana de 5 días cableada",
  ],
];
const CONOCIDOS = new Set(DEUDA_CONOCIDA.map(([f]) => f));

verificar(
  `la definición canónica vive en ${CANONICO}`,
  definidores.includes(CANONICO),
);
verificar(
  "src/lib/scoring.ts ya NO define la suya (ahora es un alias del canónico)",
  !definidores.includes("src/lib/scoring.ts") &&
    /export \{ diasHabilesEntre as calcularDiasHabiles \}/.test(
      readFileSync(join(RAIZ, "src/lib/scoring.ts"), "utf8"),
    ),
);
const inesperados = definidores.filter((f) => f !== CANONICO && !CONOCIDOS.has(f));
if (inesperados.length) console.error(`       definiciones nuevas: ${inesperados.join(" · ")}`);
verificar(
  `no hay NINGUNA definición de día hábil nueva fuera de las ${DEUDA_CONOCIDA.length} conocidas (halladas: ${inesperados.length})`,
  inesperados.length === 0,
);
const deudaViva = DEUDA_CONOCIDA.filter(([f]) => definidores.includes(f));
verificar(
  `las ${DEUDA_CONOCIDA.length} duplicadas pinchadas siguen siendo exactamente esas (vivas: ${deudaViva.length})`,
  deudaViva.length === DEUDA_CONOCIDA.length,
);
console.log(
  `       ⚠️ PENDIENTE — ${deudaViva.length} definiciones fuera del OWNS de leaf-3.3, sin festivos:`,
);
for (const [f, motivo] of deudaViva) console.log(`          · ${f}\n            ${motivo}`);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n7. Esperas como LAGS: en obra grande se absorben, en un baño único empujan");

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
const BANO_SOLO = [esp("b1", "Baño", "Baño", 5)];
const APTO = [
  esp("a1", "Cocina", "Cocina"),
  esp("a2", "Baño", "Baño"),
  esp("a3", "Sala", "Sala"),
  esp("a4", "Habitación", "Habitación"),
  esp("a5", "Estudio", "Estudio"),
  esp("a6", "Balcón / Terraza", "Balcón / Terraza"),
];
const bano = estimarDuracion(BANO_SOLO, { cuadrillas: 1 });
const apto = estimarDuracion(APTO, { cuadrillas: 1, areaTotal: 60 });
const suma = (r: ReturnType<typeof estimarDuracion>, campo: "esperaDias" | "esperaEfectivaDias") =>
  r.fases.reduce((a, f) => a + f[campo], 0);

const crudaBano = suma(bano, "esperaDias");
const lagBano = suma(bano, "esperaEfectivaDias");
const crudaApto = suma(apto, "esperaDias");
const lagApto = suma(apto, "esperaEfectivaDias");
console.log(
  `       baño 5 m² (1 espacio):  espera cruda ${crudaBano.toFixed(2)} d calendario → lag efectivo ${lagBano.toFixed(2)} d hábiles\n` +
    `       apto 60 m² (6 espacios): espera cruda ${crudaApto.toFixed(2)} d calendario → lag efectivo ${lagApto.toFixed(2)} d hábiles`,
);

verificar("las dos obras tienen secado que esperar (espera cruda > 0)", crudaBano > 0 && crudaApto > 0);
verificar(
  `en el apto de 6 espacios el secado se ABSORBE con el trabajo paralelo (lag ${lagApto.toFixed(2)} = 0)`,
  lagApto === 0,
);
verificar(
  `en el baño único el secado EMPUJA la fecha (lag ${lagBano.toFixed(2)} > 0)`,
  lagBano > 0,
);
verificar(
  `y lo que empuja es ρ·espera, no la espera cruda: ${lagBano.toFixed(2)} ≈ ${(r6 * crudaBano).toFixed(2)} (era ${crudaBano.toFixed(2)})`,
  Math.abs(lagBano - r6 * crudaBano) < 0.02,
);
verificar(
  `la conversión de unidades recorta ${(100 * (1 - r6)).toFixed(0)}% de la espera del baño: cobrar calendario como hábiles la inflaba`,
  lagBano < crudaBano && crudaBano - lagBano > 0.3,
);

// Apagar las esperas cambia el baño y NO cambia el apto: la prueba de que en el
// apto ya no estaban en el camino crítico.
const banoSin = estimarDuracion(BANO_SOLO, { cuadrillas: 1, incluirEsperas: false });
const aptoSin = estimarDuracion(APTO, { cuadrillas: 1, areaTotal: 60, incluirEsperas: false });
verificar(
  `apagar las esperas NO mueve el apto (${apto.totalDias.probable} = ${aptoSin.totalDias.probable} d): ya estaban absorbidas`,
  apto.totalDias.probable === aptoSin.totalDias.probable,
);
verificar(
  `apagar las esperas SÍ acorta el baño (${bano.totalDias.probable} → ${banoSin.totalDias.probable} d)`,
  banoSin.totalDias.probable < bano.totalDias.probable,
);

// La absorción es cuestión de FRENTE DE TRABAJO, no de metros: el mismo baño
// repetido seis veces absorbe, el baño solo no.
const seisBanos = estimarDuracion(
  ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => esp(id, `Baño ${id}`, "Baño", 5)),
  { cuadrillas: 1 },
);
verificar(
  `seis baños iguales absorben el secado (lag ${suma(seisBanos, "esperaEfectivaDias").toFixed(2)} = 0) aunque cada uno mida lo mismo que el baño solo`,
  suma(seisBanos, "esperaEfectivaDias") === 0 && suma(seisBanos, "esperaDias") > 0,
);
// …y por eso seis baños no cuestan seis veces un baño.
verificar(
  `y por eso 6 baños (${seisBanos.totalDias.probable} d) cuestan menos que 6 × un baño (${6 * bano.totalDias.probable} d)`,
  seisBanos.totalDias.probable < 6 * bano.totalDias.probable,
);

// La absorción es una VENTANA de tiempo, no un stock de trabajo: con muchas
// cuadrillas los otros espacios se despachan antes de que seque el primero, y
// el lag vuelve a asomar.
//
// leaf-3.4 cambió QUIÉN mide esa ventana: ya no es la fórmula cerrada
// «(trabajo de la fase − trabajo del espacio más cargado) ÷ cuadrillas», es el
// SGS sobre el grafo por espacio. El comportamiento cualitativo es el mismo
// —con una cuadrilla el secado desaparece y con doce vuelve casi entero— pero
// el umbral se corrió: la fórmula cerrada daba exactamente 0 hasta 4
// cuadrillas y el scheduler encuentra ya 0.83 d de cola ahí, porque con 3.48
// cuadrillas-equivalente el último espacio SÍ llega a la pintura antes de que
// su propio estuco haya fraguado. El scheduler MIDE la obra; la fórmula la
// aproximaba, y ella misma se declaraba «cota de primer orden». Por eso el
// assert pasa a exigir la FORMA de la curva (0 con una cuadrilla, monótona
// creciente, y pegada al tope con doce) en vez de un umbral concreto.
const lagPorCuadrillas = [1, 2, 4, 8, 12].map((c) =>
  suma(estimarDuracion(APTO, { cuadrillas: c, areaTotal: 60 }), "esperaEfectivaDias"),
);
console.log(`       apto con 1/2/4/8/12 cuadrillas: lag ${lagPorCuadrillas.map((x) => x.toFixed(2)).join(" / ")} d`);
verificar(
  `con UNA cuadrilla el secado del apto se absorbe entero (lag ${lagPorCuadrillas[0].toFixed(2)} = 0): hay frente de trabajo de sobra`,
  lagPorCuadrillas[0] === 0,
);
verificar(
  `con 8 y 12 cuadrillas el secado REAPARECE (${lagPorCuadrillas[3].toFixed(2)} y ${lagPorCuadrillas[4].toFixed(2)} d): las cuadrillas adelantan al mortero`,
  lagPorCuadrillas[3] > 0 && lagPorCuadrillas[4] > 0,
);
verificar(
  `y con 12 ya casi no se absorbe nada (${lagPorCuadrillas[4].toFixed(2)} de los ${(r6 * crudaApto).toFixed(2)} d que puede costar el secado)`,
  lagPorCuadrillas[4] > 0.8 * r6 * crudaApto,
);
verificar(
  "el lag nunca decrece al añadir cuadrillas (la ventana de absorción solo se encoge)",
  lagPorCuadrillas.every((x, i) => i === 0 || x >= lagPorCuadrillas[i - 1] - 1e-9),
);

// La jornada del proyecto entra por ρ y solo por ρ: la misma espera cruda de
// calendario cuesta más días HÁBILES cuanto más se trabaja a la semana.
const lagPorJornada = [5, 6, 7].map((s) =>
  suma(estimarDuracion(BANO_SOLO, { cuadrillas: 1, diasHabilesSemana: s }), "esperaEfectivaDias"),
);
console.log(`       baño con jornada 5/6/7: lag ${lagPorJornada.map((x) => x.toFixed(2)).join(" / ")} d hábiles sobre ${crudaBano.toFixed(2)} d calendario`);
verificar(
  "la misma espera cuesta más días hábiles cuanto más larga es la jornada (ρ(5) < ρ(6) < ρ(7))",
  lagPorJornada[0] < lagPorJornada[1] && lagPorJornada[1] < lagPorJornada[2],
);
verificar(
  `y cada uno vale exactamente ρ(jornada)·espera (${lagPorJornada.map((x) => x.toFixed(2)).join(" / ")} vs ${[r5, r6, r7].map((r) => (r * crudaBano).toFixed(2)).join(" / ")})`,
  [r5, r6, r7].every((r, i) => Math.abs(lagPorJornada[i] - r * crudaBano) < 0.02),
);

// El fragüe de PLACA es rígido: es la misma losa en toda la obra, no lo absorbe
// nadie por muchos espacios que haya.
const conPlaca = (n: number) =>
  estimarDuracion(
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      nombre: `Sala ${i}`,
      metraje: 20,
      tareas: [
        { nombre: "Placa de entrepiso", dias: 3, on: true },
        { nombre: "Estuco paredes", dias: 2, on: true },
        { nombre: "Pintura final", dias: 2, on: true },
      ],
    })),
    { cuadrillas: 1 },
  );
const placa1 = suma(conPlaca(1), "esperaEfectivaDias");
const placa8 = suma(conPlaca(8), "esperaEfectivaDias");
verificar(
  `el fragüe de placa NO se absorbe ni con 8 espacios (lag ${placa8.toFixed(2)} d > 0; con 1 espacio ${placa1.toFixed(2)} d)`,
  placa8 > 0,
);
verificar(
  "…porque la losa es una sola: es un lag RÍGIDO, no un secado por espacio",
  Math.abs(placa8 - r6 * 10) < 0.02,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n8. El módulo es puro y determinista");

// Se miran solo las líneas de CÓDIGO: la cabecera del módulo menciona
// `Date.now` justamente para decir que no lo usa, y un buscador ingenuo de
// subcadenas se tropezaría con su propia documentación.
const CODIGO = readFileSync(join(RAIZ, CANONICO), "utf8")
  .split("\n")
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");
const IMPUREZAS = ["prisma", "fetch(", "Math.random", "Date.now", "import "];
const halladas = IMPUREZAS.filter((m) => CODIGO.includes(m));
verificar(
  `${CANONICO} sin ${IMPUREZAS.join(" / ")}${halladas.length ? ` — halladas: ${halladas.join(", ")}` : ""}`,
  halladas.length === 0,
);
verificar(
  "…y sin una sola dependencia: el módulo no importa nada, ni siquiera del repo",
  !/^\s*import\b/m.test(CODIGO),
);
verificar(
  "dos llamadas idénticas devuelven lo mismo (el caché no ensucia el resultado)",
  JSON.stringify(festivosColombia(2026)) === JSON.stringify(festivosColombia(2026)) &&
    claveDia(addWorkingDays(d("2026-01-10"), 5, 6)) === claveDia(addWorkingDays(d("2026-01-10"), 5, 6)),
);
// El caché es del módulo, no del llamador: si `festivosColombia` devolviera el
// array interno, un `.push()` de cualquiera envenenaría el calendario de todo
// el proceso. Se comprueba de verdad — mutando y volviendo a pedirlo.
const antesMut = festivosColombia(2027).length;
festivosColombia(2027).push({
  fecha: d("2027-02-10"),
  nombre: "festivo inventado",
  base: d("2027-02-10"),
  trasladado: false,
  regla: "fijo",
});
verificar(
  `festivosColombia() devuelve una COPIA: mutarla no toca el caché (${antesMut} → ${festivosColombia(2027).length})`,
  festivosColombia(2027).length === antesMut,
);
verificar(
  "…y el festivo inventado no se coló en esFestivo()",
  !esFestivo(d("2027-02-10")),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n── Calendario 2026, el año en curso ────────────────────────────");
for (const f of festivosColombia(2026)) {
  console.log(
    `   ${claveDia(f.fecha)} ${DOW[f.fecha.getUTCDay()]}  ` +
      `${f.trasladado ? `← ${claveDia(f.base)}` : "          "}  ${f.nombre}`,
  );
}
console.log(
  `\n   ${diasHabilesEnAnio(2026, 6)} días hábiles en 2026 con jornada Lu–Sá ` +
    `(365 − 52 domingos − ${365 - 52 - diasHabilesEnAnio(2026, 6)} festivos que no cayeron en domingo).`,
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Calendario colombiano y esperas como lags verificados sin errores.");
