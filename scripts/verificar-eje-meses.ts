// ─────────────────────────────────────────────────────────────────────────
// Verificación del EJE DE MESES (`src/lib/cronograma/eje-meses.ts`).
//
// El eje solo sirve si dice la verdad sobre las barras que tiene debajo. El
// contrato es uno y es duro: la posición `d` del eje es `addWorkingDays(
// inicio, d)`, la MISMA función con la que el motor fecha las barras. Si eso
// se rompe el eje miente, y un eje que miente es peor que no tener eje.
//
// Qué verifica:
//   1. CONTRATO: fechas[d] === addWorkingDays(inicio, d) para todo d, con
//      jornada de 5 y de 6 días, arrancando en cuatro meses distintos.
//      Con CONTROL POSITIVO: un eje corrido un día tiene que hacer fallar la
//      comparación — si no, la comparación no está midiendo nada.
//   2. Los meses teselan el eje: contiguos, sin huecos, sin solapes, el
//      primero arranca en 0 y entre todos cubren todos los días hábiles.
//   3. Los porcentajes usan el MISMO denominador que las barras (`dia /
//      escala`), son monótonos y suman lo que deben.
//   4. Un mes con festivos es MÁS ANGOSTO en días hábiles que el mismo mes sin
//      ellos. Es la razón de ser del módulo: si el eje fuera lineal en
//      calendario esto no pasaría.
//   5. `posicionDeFecha` es monótona, da 0 en el arranque y null fuera.
//   6. Entradas degeneradas (escala 0, NaN, fecha inválida) → eje vacío, sin
//      excepción.
// ─────────────────────────────────────────────────────────────────────────

import { addWorkingDays, esHabil, festivosColombia } from "@/lib/calendario-colombia";
import { ejeDeMeses, posicionDeFecha } from "@/lib/cronograma/eje-meses";

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

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────
console.log("Eje de meses — verificación\n");
console.log("1. CONTRATO: el eje usa la misma aritmética que las barras");

const ARRANQUES = ["2026-09-01", "2026-01-02", "2026-12-15", "2027-03-29"];
for (const a of ARRANQUES) {
  for (const dhs of [5, 6]) {
    const eje = ejeDeMeses(d(a), 120, dhs);
    let iguales = 0;
    let corridas = 0;
    for (let k = 0; k < eje.fechas.length; k++) {
      const esperado = addWorkingDays(d(a), k, dhs);
      if (eje.fechas[k].getTime() === esperado.getTime()) iguales++;
      // Control positivo: el mismo eje corrido un día NO puede coincidir.
      if (eje.fechas[k].getTime() === addWorkingDays(d(a), k + 1, dhs).getTime()) corridas++;
    }
    verificar(
      `${a} jornada ${dhs}d · ${iguales}/${eje.fechas.length} posiciones = addWorkingDays`,
      iguales === eje.fechas.length && eje.fechas.length === 121,
    );
    verificar(
      `${a} jornada ${dhs}d · CONTROL: un eje corrido +1 día no coincidiría (${corridas} coincidencias espurias)`,
      corridas === 0,
    );
  }
}

// Todo día del eje (salvo quizá el 0, que es el arranque tal cual) es hábil.
{
  const eje = ejeDeMeses(d("2026-09-06"), 60, 6); // 6 sep 2026 es domingo
  const noHabiles = eje.fechas.slice(1).filter((f) => !esHabil(f, 6));
  verificar(
    `arrancando en domingo, d=0 conserva el domingo y los ${eje.fechas.length - 1} restantes son hábiles`,
    !esHabil(eje.fechas[0], 6) && noHabiles.length === 0,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. Los meses teselan el eje");

for (const a of ARRANQUES) {
  const eje = ejeDeMeses(d(a), 150, 6);
  const contiguos = eje.meses.every((m, i) => i === 0 || m.desde === eje.meses[i - 1].hasta);
  const cubren = eje.meses.reduce((n, m) => n + (m.hasta - m.desde), 0);
  const mesCorrecto = eje.meses.every((m) =>
    eje.fechas
      .slice(m.desde, m.hasta)
      .every((f) => f.getUTCMonth() === m.mes && f.getUTCFullYear() === m.anio),
  );
  verificar(
    `${a} · ${eje.meses.length} meses contiguos desde 0, cubren ${cubren}/${eje.fechas.length} días`,
    contiguos && eje.meses[0].desde === 0 && cubren === eje.fechas.length,
  );
  verificar(`${a} · cada día cae en el mes que su segmento dice`, mesCorrecto);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. Porcentajes");

{
  const ESCALA = 100;
  const eje = ejeDeMeses(d("2026-09-01"), ESCALA, 6);
  const suma = eje.meses.reduce((s, m) => s + m.anchoPct, 0);

  // EL DENOMINADOR. Las barras se posicionan con `dia / escala * 100` dentro
  // del componente; el eje TIENE que usar exactamente esa fórmula o queda
  // comprimido respecto de lo que rotula. Se escribe aquí a mano, sin leerla
  // del módulo, porque comparar el módulo contra sí mismo no prueba nada:
  // dividir por `fechas.length` (= escala + 1) da 100% redondo y pasa
  // desapercibido, mientras el eje se corre un día entero en el borde derecho.
  const posBarra = (dia: number) => (dia / ESCALA) * 100;
  verificar(
    `el eje divide por la escala, no por el número de días (${eje.meses.length} fronteras)`,
    eje.meses.every(
      (m) =>
        Math.abs(m.desdePct - posBarra(m.desde)) < 1e-9 &&
        Math.abs(m.desdePct + m.anchoPct - posBarra(Math.min(m.hasta, ESCALA))) < 1e-9,
    ),
  );
  verificar(
    `los anchos suman 100% exacto: el último mes se recorta al borde (${suma.toFixed(4)})`,
    Math.abs(suma - 100) < 1e-9,
  );
  verificar(
    `ningún mes pinta fuera del marco`,
    eje.meses.every((m) => m.desdePct + m.anchoPct <= 100 + 1e-9),
  );
  const monotono = eje.meses.every((m, i) => i === 0 || m.desdePct > eje.meses[i - 1].desdePct);
  verificar(`primer mes arranca en 0%`, eje.meses[0].desdePct === 0);
  verificar(`los inicios son estrictamente crecientes`, monotono);

}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. Un mes con festivos es más angosto (la razón de ser del módulo)");

{
  // Enero 2026 tiene festivos; hay que compararlo contra un mes de igual
  // largo en calendario y sin festivos. Se mide desde el propio calendario,
  // no se copia un número.
  const anchoDeMes = (arranque: string, mes: number) => {
    const eje = ejeDeMeses(d(arranque), 200, 6);
    const seg = eje.meses.find((m) => m.mes === mes);
    return seg ? seg.hasta - seg.desde : 0;
  };
  const fest = (anio: number, mes: number) =>
    festivosColombia(anio).filter((f) => f.fecha.getUTCMonth() === mes && f.fecha.getUTCDay() !== 0)
      .length;

  // Ambos son meses de 31 días arrancando el eje bien antes.
  const ene = anchoDeMes("2025-12-01", 0); // enero 2026
  const jul = anchoDeMes("2026-06-01", 6); // julio 2026
  const fEne = fest(2026, 0);
  const fJul = fest(2026, 6);
  console.log(
    `     enero 2026: ${ene} días hábiles (${fEne} festivos) · julio 2026: ${jul} (${fJul} festivos)`,
  );
  verificar(
    `el mes con más festivos es más angosto en la escala de obra`,
    fEne === fJul ? ene === jul : fEne > fJul ? ene < jul : ene > jul,
  );

  const eje5 = ejeDeMeses(d("2026-09-01"), 100, 5);
  const eje6 = ejeDeMeses(d("2026-09-01"), 100, 6);
  verificar(
    `con jornada de 5 días el eje llega más lejos en calendario que con 6 ` +
      `(${iso(eje5.fechas[100])} vs ${iso(eje6.fechas[100])})`,
    eje5.fechas[100].getTime() > eje6.fechas[100].getTime(),
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. posicionDeFecha");

{
  const inicio = d("2026-09-01");
  const eje = ejeDeMeses(inicio, 100, 6);
  const pos = (x: string) => posicionDeFecha(eje, d(x));

  verificar(`el día de arranque cae en 0%`, pos("2026-09-01") === 0);
  verificar(`una fecha anterior al arranque da null`, pos("2026-08-30") === null);
  verificar(`una fecha posterior al eje da null`, pos("2027-06-01") === null);
  verificar(`el último día del eje cae en 100%`, pos(iso(eje.fechas[100])) === 100);

  let monotona = true;
  let previa = -1;
  for (let k = 0; k <= 100; k++) {
    const p = posicionDeFecha(eje, eje.fechas[k]);
    if (p === null || p < previa) monotona = false;
    else previa = p;
  }
  verificar(`es monótona sobre los 101 días del eje`, monotona);

  // Un domingo cae en la posición del sábado anterior, no en la del lunes:
  // el marcador nunca se adelanta a un día que aún no ha empezado.
  const dom = pos("2026-09-06");
  const sab = pos("2026-09-05");
  verificar(`un domingo se ancla en el sábado previo (${dom} === ${sab})`, dom === sab);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. Entradas degeneradas");

const degenerados: [string, ReturnType<typeof ejeDeMeses>][] = [
  ["escala 0", ejeDeMeses(d("2026-09-01"), 0, 6)],
  ["escala negativa", ejeDeMeses(d("2026-09-01"), -5, 6)],
  ["escala NaN", ejeDeMeses(d("2026-09-01"), NaN, 6)],
  ["fecha inválida", ejeDeMeses(new Date("no-es-fecha"), 100, 6)],
];
for (const [nombre, eje] of degenerados) {
  verificar(`${nombre} → eje vacío sin excepción`, eje.escala === 0 && eje.meses.length === 0);
  verificar(`${nombre} → posicionDeFecha devuelve null`, posicionDeFecha(eje, d("2026-09-01")) === null);
}

{
  const eje = ejeDeMeses(d("2026-09-01"), 30.4, 6);
  verificar(`una escala fraccionaria (30.4) se redondea hacia arriba a 31`, eje.escala === 31);
  const eje2 = ejeDeMeses(d("2026-09-01"), 99_999, 6);
  verificar(`una escala absurda se topa en 2600 días sin colgarse`, eje2.escala === 2600);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Eje de meses verificado sin errores.");
