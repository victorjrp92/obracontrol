// ---------------------------------------------------------------------------
// Verificación de `src/lib/reparto-cronograma.ts`: el motor que traduce la
// ventana de la obra (dos fechas que pone el cliente) en una ventana por fase
// y por tarea.
//
// LO QUE ESTE MÓDULO PUEDE ROMPER SIN QUE SE NOTE:
//
//  1. Confundir DURACIÓN con POSICIÓN. `tiempo_acordado_dias` dice cuánto
//     dura; `fecha_*_plan` dice cuándo ocurre. Encadenar duraciones en fila
//     produce fechas que parecen razonables y describen una obra que no
//     existe — la de una sola torre.
//  2. Repartir en días de CALENDARIO en vez de HÁBILES. El plan nace
//     mintiendo: mete domingos y los 18 festivos colombianos como días de
//     trabajo y la obra va «retrasada» desde el primer lunes.
//  3. Pisar lo que el usuario escribió a mano. Es el fallo más silencioso de
//     todos: el usuario pone la ventana de la fase, el sistema la «mejora», y
//     nadie se entera hasta que el cliente pregunta por qué cambió la fecha
//     que él mismo fijó.
//
// Con CONTROL POSITIVO en cada bloque que lo permite: no basta afirmar que un
// caso da bien, hay que construir el caso donde el error SÍ saldría y
// comprobar que la comprobación lo distingue.
// ---------------------------------------------------------------------------

import { esFestivo, esHabil } from "@/lib/calendario-colombia";
import {
  SOLAPE_FASES_AUTOMATICO,
  diasHabilesDeRango,
  diasHabilesVentana,
  fechaISO,
  repartirCronograma,
  repartirEnteros,
  ventanaContenida,
  type EntradaReparto,
  type FaseReparto,
  type ResultadoReparto,
  type TareaReparto,
  type Ventana,
} from "@/lib/reparto-cronograma";

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

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Jornada colombiana de obra: lunes a sábado. */
const SEMANA = 6;

/** La obra de referencia: seis meses de 2026. */
const OBRA = { inicio: "2026-02-02", fin: "2026-07-31" };

function fases(...nombres: string[]): FaseReparto[] {
  return nombres.map((nombre, i) => ({ nombre, orden: i + 1 }));
}

function tarea(id: string, fase: string, dias: number): TareaReparto {
  return { id, fase, dias };
}

/** ¿Alguna ventana del reparto se sale de la ventana de la obra? */
function algunaFaseSeSale(res: ResultadoReparto, obra: Ventana): string | null {
  for (const [nombre, v] of res.fases) {
    if (!ventanaContenida(v, obra)) return nombre;
  }
  return null;
}

/** ¿Alguna tarea se sale de la fase a la que pertenece? */
function algunaTareaSeSale(res: ResultadoReparto, tareas: TareaReparto[]): string | null {
  for (const t of tareas) {
    const vt = res.tareas.get(t.id);
    const vf = res.fases.get(t.fase);
    if (!vt || !vf) return t.id;
    if (!ventanaContenida(vt, vf)) return t.id;
  }
  return null;
}

console.log("Reparto del cronograma planeado - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Modo AUTOMATICO: todo el reparto cabe dentro de la ventana de la obra");
{
  const fs = fases("Cimentación", "Estructura", "Mampostería", "Obra Blanca", "Acabados");
  const ts: TareaReparto[] = [];
  for (const f of fs) {
    ts.push(tarea(`${f.nombre}-a`, f.nombre, 4));
    ts.push(tarea(`${f.nombre}-b`, f.nombre, 9));
    ts.push(tarea(`${f.nombre}-c`, f.nombre, 2));
  }
  const entrada: EntradaReparto = {
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fs, tareas: ts,
  };
  const res = repartirCronograma(entrada);
  const obra: Ventana = { inicio: dia(OBRA.inicio), fin: dia(OBRA.fin) };

  verificar(`el reparto sale adelante (ok, sin motivos)`, res.ok && res.motivos.length === 0);
  verificar(`las 5 fases reciben ventana`, res.fases.size === 5);
  verificar(`las 15 tareas reciben ventana`, res.tareas.size === 15);
  verificar(`ninguna fase se sale de la obra`, algunaFaseSeSale(res, obra) === null);

  const primera = res.fases.get("Cimentación")!;
  const ultima = res.fases.get("Acabados")!;
  verificar(
    `la primera fase arranca el primer día hábil de la obra (${fechaISO(primera.inicio)})`,
    primera.inicio.getTime() === diasHabilesDeRango(obra.inicio, obra.fin, SEMANA)[0].getTime(),
  );
  const habiles = diasHabilesDeRango(obra.inicio, obra.fin, SEMANA);
  verificar(
    `la última fase cierra el último día hábil de la obra (${fechaISO(ultima.fin)})`,
    ultima.fin.getTime() === habiles[habiles.length - 1].getTime(),
  );

  // CONTROL POSITIVO: si una fase se pasara UN solo día del fin de la obra, el
  // chequeo de arriba tiene que cazarla. Sin este control, `algunaFaseSeSale`
  // podría estar devolviendo siempre null y los OK anteriores no valdrían nada.
  const doctorado: ResultadoReparto = {
    ...res,
    fases: new Map(res.fases),
  };
  doctorado.fases.set("Acabados", {
    inicio: ultima.inicio,
    fin: new Date(ultima.fin.getTime() + 24 * 60 * 60 * 1000),
  });
  verificar(`CONTROL: una fase que termina un día tarde SÍ la caza el chequeo`, algunaFaseSeSale(doctorado, obra) === "Acabados");

  const doctorado2: ResultadoReparto = { ...res, fases: new Map(res.fases) };
  doctorado2.fases.set("Cimentación", {
    inicio: new Date(primera.inicio.getTime() - 24 * 60 * 60 * 1000),
    fin: primera.fin,
  });
  verificar(`CONTROL: una fase que empieza un día antes también la caza`, algunaFaseSeSale(doctorado2, obra) === "Cimentación");
}

// ---------------------------------------------------------------------------
console.log("\n2. Domingos y festivos NO son días de trabajo");
{
  // Semana CON festivo: lunes 20 jul 2026 es Independencia de Colombia.
  const conFestivo = diasHabilesDeRango(dia("2026-07-20"), dia("2026-07-25"), SEMANA);
  // Semana SIN festivo: la siguiente, lunes 27 jul a sábado 1 ago.
  const sinFestivo = diasHabilesDeRango(dia("2026-07-27"), dia("2026-08-01"), SEMANA);

  verificar(`20 jul 2026 (Independencia) es festivo`, esFestivo(dia("2026-07-20")));
  verificar(`la semana CON festivo da 5 días hábiles, no 6`, conFestivo.length === 5);
  verificar(`el lunes festivo NO está en la lista`, !conFestivo.some((d) => fechaISO(d) === "2026-07-20"));

  // CONTROL POSITIVO: la MISMA ventana (6 días de calendario, lunes a sábado)
  // una semana después, sin festivo, da un día hábil MÁS.
  verificar(`CONTROL: la misma ventana sin festivo da 6 días hábiles`, sinFestivo.length === 6);
  verificar(`CONTROL: sin festivo hay estrictamente más días hábiles`, sinFestivo.length > conFestivo.length);

  // Domingos: una ventana de lunes a lunes (8 días de calendario) contiene un
  // domingo que no puede aparecer.
  const conDomingo = diasHabilesDeRango(dia("2026-07-27"), dia("2026-08-03"), SEMANA);
  verificar(`26 jul 2026 es domingo y no es hábil`, !esHabil(dia("2026-07-26"), SEMANA));
  verificar(`el domingo 2 ago NO aparece en la ventana`, !conDomingo.some((d) => fechaISO(d) === "2026-08-02"));
  verificar(`8 días de calendario con un domingo dan 7 hábiles`, conDomingo.length === 7);

  // Y el reparto, que se construye sobre esa lista, tampoco puede poner una
  // fase que empiece o termine en domingo.
  const res = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO",
    fases: fases("A", "B", "C"),
    tareas: [tarea("t1", "A", 5), tarea("t2", "B", 5), tarea("t3", "C", 5)],
  });
  let bordesHabiles = true;
  for (const v of res.fases.values()) {
    if (!esHabil(v.inicio, SEMANA) || !esHabil(v.fin, SEMANA)) bordesHabiles = false;
  }
  for (const v of res.tareas.values()) {
    if (!esHabil(v.inicio, SEMANA) || !esHabil(v.fin, SEMANA)) bordesHabiles = false;
  }
  verificar(`ninguna ventana repartida empieza o termina en domingo o festivo`, bordesHabiles);

  // CONTROL POSITIVO del chequeo anterior: un domingo metido a mano SÍ lo caza.
  verificar(`CONTROL: el chequeo de borde hábil distingue un domingo`, !esHabil(dia("2026-08-02"), SEMANA));
}

// ---------------------------------------------------------------------------
console.log("\n3. Las fases SE SOLAPAN en modo AUTOMATICO (no van en fila india)");
{
  const fs = fases("Mampostería", "Pintura", "Carpintería");
  const ts = [tarea("m", "Mampostería", 10), tarea("p", "Pintura", 10), tarea("c", "Carpintería", 10)];
  const base: EntradaReparto = {
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fs, tareas: ts,
  };

  const conSolape = repartirCronograma(base);
  const m = conSolape.fases.get("Mampostería")!;
  const p = conSolape.fases.get("Pintura")!;
  verificar(
    `Pintura arranca (${fechaISO(p.inicio)}) ANTES de que Mampostería cierre (${fechaISO(m.fin)})`,
    p.inicio.getTime() < m.fin.getTime(),
  );
  verificar(`pero no antes de que Mampostería empiece`, p.inicio.getTime() > m.inicio.getTime());
  verificar(`el solape por defecto es ${SOLAPE_FASES_AUTOMATICO}`, SOLAPE_FASES_AUTOMATICO === 0.25);

  // CONTROL POSITIVO: con solape 0 las fases van en fila y NO se solapan. Si
  // el parámetro no hiciera nada, este caso saldría igual que el de arriba.
  const enFila = repartirCronograma({ ...base, solape: 0 });
  const m0 = enFila.fases.get("Mampostería")!;
  const p0 = enFila.fases.get("Pintura")!;
  verificar(`CONTROL: con solape 0, Pintura empieza después de que cierre Mampostería`, p0.inicio.getTime() > m0.fin.getTime());
  verificar(`CONTROL: y con solape 0 cada fase es más corta que con solape`, diasHabilesVentana(m0, SEMANA) < diasHabilesVentana(m, SEMANA));
}

// ---------------------------------------------------------------------------
console.log("\n4. Las tareas de una fase caen DENTRO de su fase");
{
  const fs = fases("Estructura", "Acabados");
  const ts = [
    tarea("e1", "Estructura", 3), tarea("e2", "Estructura", 7), tarea("e3", "Estructura", 5),
    tarea("a1", "Acabados", 2), tarea("a2", "Acabados", 2),
  ];
  const res = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fs, tareas: ts,
  });
  verificar(`ninguna tarea se sale de su fase`, algunaTareaSeSale(res, ts) === null);

  // CONTROL POSITIVO: una tarea corrida un día más allá del fin de su fase la
  // caza el mismo chequeo.
  const vf = res.fases.get("Acabados")!;
  const doctorado: ResultadoReparto = { ...res, tareas: new Map(res.tareas) };
  doctorado.tareas.set("a2", { inicio: vf.inicio, fin: new Date(vf.fin.getTime() + 24 * 60 * 60 * 1000) });
  verificar(`CONTROL: una tarea un día más allá de su fase SÍ se caza`, algunaTareaSeSale(doctorado, ts) === "a2");
}

// ---------------------------------------------------------------------------
console.log("\n5. Más días acordados = ventana más larga, dentro de la misma fase");
{
  const fs = fases("Obra Blanca");
  const ts = [
    tarea("corta", "Obra Blanca", 2),
    tarea("media", "Obra Blanca", 5),
    tarea("larga", "Obra Blanca", 13),
  ];
  const res = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fs, tareas: ts,
  });
  const corta = diasHabilesVentana(res.tareas.get("corta")!, SEMANA);
  const media = diasHabilesVentana(res.tareas.get("media")!, SEMANA);
  const larga = diasHabilesVentana(res.tareas.get("larga")!, SEMANA);
  verificar(`corta(2d)=${corta} < media(5d)=${media} < larga(13d)=${larga} días hábiles`, corta < media && media < larga);
  verificar(`las tres suman los días hábiles de la fase`, corta + media + larga === diasHabilesVentana(res.fases.get("Obra Blanca")!, SEMANA));
  verificar(`la primera tarea abre la fase`, res.tareas.get("corta")!.inicio.getTime() === res.fases.get("Obra Blanca")!.inicio.getTime());
  verificar(`la última tarea cierra la fase`, res.tareas.get("larga")!.fin.getTime() === res.fases.get("Obra Blanca")!.fin.getTime());

  // CONTROL POSITIVO del reparto proporcional entero: si el reparto ignorara
  // los pesos, las tres saldrían iguales.
  const iguales = repartirEnteros(30, [1, 1, 1]);
  const proporcional = repartirEnteros(30, [2, 5, 13]);
  verificar(`CONTROL: con pesos iguales el reparto da partes iguales`, iguales.join(",") === "10,10,10");
  verificar(`CONTROL: con pesos 2/5/13 el reparto NO da partes iguales`, proporcional.join(",") !== "10,10,10");
  verificar(`el reparto entero suma exactamente el total (30)`, proporcional.reduce((a, b) => a + b, 0) === 30);
}

// ---------------------------------------------------------------------------
console.log("\n6. Modo FASES: la ventana que puso el usuario NO se modifica");
{
  const fs: FaseReparto[] = [
    { nombre: "Estructura", orden: 1, ventana: { inicio: "2026-02-09", fin: "2026-04-18" } },
    { nombre: "Obra Blanca", orden: 2, ventana: { inicio: "2026-03-30", fin: "2026-07-25" } },
  ];
  const ts = [
    tarea("e1", "Estructura", 4), tarea("e2", "Estructura", 8),
    tarea("o1", "Obra Blanca", 6), tarea("o2", "Obra Blanca", 6),
  ];
  const res = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "FASES", fases: fs, tareas: ts,
  });
  verificar(`el reparto sale adelante`, res.ok);
  const e = res.fases.get("Estructura")!;
  const o = res.fases.get("Obra Blanca")!;
  verificar(`Estructura sale TAL CUAL entró (2026-02-09 → 2026-04-18)`, fechaISO(e.inicio) === "2026-02-09" && fechaISO(e.fin) === "2026-04-18");
  verificar(`Obra Blanca sale TAL CUAL entró (2026-03-30 → 2026-07-25)`, fechaISO(o.inicio) === "2026-03-30" && fechaISO(o.fin) === "2026-07-25");
  verificar(`las dos fases del usuario SE SOLAPAN y el sistema las respeta`, o.inicio.getTime() < e.fin.getTime());
  verificar(`las tareas sí las reparte el sistema, dentro de la fase`, algunaTareaSeSale(res, ts) === null);

  // 2026-04-18 es sábado y 2026-03-30 lunes: ninguno es festivo, pero el punto
  // es que el sistema NO los mueve al día hábil "bonito" más cercano.
  // CONTROL POSITIVO: con OTRAS fechas de usuario la salida cambia — si el
  // módulo estuviera devolviendo constantes, este caso no se distinguiría.
  const otras = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "FASES",
    fases: [
      { nombre: "Estructura", orden: 1, ventana: { inicio: "2026-02-16", fin: "2026-04-11" } },
      { nombre: "Obra Blanca", orden: 2, ventana: { inicio: "2026-03-30", fin: "2026-07-25" } },
    ],
    tareas: ts,
  });
  const e2 = otras.fases.get("Estructura")!;
  verificar(`CONTROL: con otra ventana de usuario la salida cambia (${fechaISO(e2.inicio)})`, fechaISO(e2.inicio) === "2026-02-16" && fechaISO(e2.fin) === "2026-04-11");

  // Y una fase fuera de la obra se rechaza: no se recorta, se rechaza.
  const fuera = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "FASES",
    fases: [{ nombre: "Estructura", orden: 1, ventana: { inicio: "2026-02-09", fin: "2026-08-30" } }],
    tareas: [tarea("e1", "Estructura", 4)],
  });
  verificar(`una fase que se sale de la obra se RECHAZA`, !fuera.ok);
  verificar(`y el motivo nombra la fase`, fuera.motivos.some((m) => m.includes("Estructura") && m.includes("se sale")));
  verificar(`y no devuelve ninguna fecha`, fuera.fases.size === 0 && fuera.tareas.size === 0);

  // Falta la ventana en modo FASES: también se rechaza, nombrando la fase.
  const sinVentana = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "FASES", fases: fases("Estructura"), tareas: [tarea("e1", "Estructura", 4)],
  });
  verificar(`sin ventana de fase en modo FASES se rechaza`, !sinVentana.ok && sinVentana.motivos.some((m) => m.includes("Estructura")));
}

// ---------------------------------------------------------------------------
console.log("\n7. Modo MANUAL: ni las ventanas de fase ni las de tarea se modifican");
{
  const fs: FaseReparto[] = [
    { nombre: "Estructura", orden: 1, ventana: { inicio: "2026-02-09", fin: "2026-04-18" } },
  ];
  const ts: TareaReparto[] = [
    { id: "e1", fase: "Estructura", dias: 4, ventana: { inicio: "2026-02-09", fin: "2026-03-07" } },
    { id: "e2", fase: "Estructura", dias: 30, ventana: { inicio: "2026-03-02", fin: "2026-04-18" } },
  ];
  const res = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "MANUAL", fases: fs, tareas: ts,
  });
  verificar(`el reparto sale adelante`, res.ok);
  const f = res.fases.get("Estructura")!;
  verificar(`la fase sale tal cual entró`, fechaISO(f.inicio) === "2026-02-09" && fechaISO(f.fin) === "2026-04-18");
  verificar(`e1 sale tal cual entró`, fechaISO(res.tareas.get("e1")!.inicio) === "2026-02-09" && fechaISO(res.tareas.get("e1")!.fin) === "2026-03-07");
  verificar(`e2 sale tal cual entró`, fechaISO(res.tareas.get("e2")!.inicio) === "2026-03-02" && fechaISO(res.tareas.get("e2")!.fin) === "2026-04-18");
  verificar(`las dos tareas del usuario se solapan y el sistema las respeta`, res.tareas.get("e2")!.inicio.getTime() < res.tareas.get("e1")!.fin.getTime());

  // CONTROL POSITIVO: e1 tiene 4 días y e2 tiene 30, pero e1 recibió la
  // ventana MÁS LARGA porque así lo puso el usuario. Si el sistema hubiera
  // repartido proporcionalmente (modo AUTOMATICO), e2 tendría la más larga.
  const auto = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("Estructura"),
    tareas: [tarea("e1", "Estructura", 4), tarea("e2", "Estructura", 30)],
  });
  verificar(
    `CONTROL: en AUTOMATICO e2 (30 días) recibe más ventana que e1 (4 días)`,
    diasHabilesVentana(auto.tareas.get("e2")!, SEMANA) > diasHabilesVentana(auto.tareas.get("e1")!, SEMANA),
  );
  verificar(
    `CONTROL: en MANUAL e1 conserva SU ventana, distinta de la que le daria el sistema (${diasHabilesVentana(res.tareas.get("e1")!, SEMANA)} vs ${diasHabilesVentana(auto.tareas.get("e1")!, SEMANA)} dias habiles)`,
    diasHabilesVentana(res.tareas.get("e1")!, SEMANA) !== diasHabilesVentana(auto.tareas.get("e1")!, SEMANA),
  );

  // Una tarea fuera de su fase se rechaza.
  const fuera = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "MANUAL", fases: fs,
    tareas: [{ id: "e1", fase: "Estructura", dias: 4, ventana: { inicio: "2026-02-09", fin: "2026-05-30" } }],
  });
  verificar(`una tarea que se sale de su fase se RECHAZA`, !fuera.ok);
  verificar(`y el motivo nombra la tarea y la fase`, fuera.motivos.some((m) => m.includes("e1") && m.includes("Estructura")));

  // Falta la ventana de una tarea en modo MANUAL: se rechaza, no se inventa.
  const sinVentana = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "MANUAL", fases: fs, tareas: [tarea("e1", "Estructura", 4)],
  });
  verificar(`sin ventana de tarea en modo MANUAL se rechaza`, !sinVentana.ok && sinVentana.motivos.some((m) => m.includes("e1")));
}

// ---------------------------------------------------------------------------
console.log("\n8. Obra sin fases, fase sin tareas y proyecto sin tareas: no revientan");
{
  const sinFases = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: [], tareas: [],
  });
  verificar(`obra sin fases: ok, sin fechas y sin motivos`, sinFases.ok && sinFases.fases.size === 0 && sinFases.tareas.size === 0);

  const sinTareas = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A", "B"), tareas: [],
  });
  verificar(`fases sin tareas: las fases sí reciben ventana`, sinTareas.ok && sinTareas.fases.size === 2 && sinTareas.tareas.size === 0);
  const obra: Ventana = { inicio: dia(OBRA.inicio), fin: dia(OBRA.fin) };
  verificar(`y esas ventanas siguen dentro de la obra`, algunaFaseSeSale(sinTareas, obra) === null);

  const unaVacia = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("Con tareas", "Vacía"),
    tareas: [tarea("t1", "Con tareas", 5)],
  });
  verificar(`una fase vacía junto a una con tareas: las dos reciben ventana`, unaVacia.ok && unaVacia.fases.size === 2);
  verificar(`la fase vacía no colapsa a cero días`, diasHabilesVentana(unaVacia.fases.get("Vacía")!, SEMANA) >= 1);

  const diasCero = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"),
    tareas: [tarea("t1", "A", 0), tarea("t2", "A", 0)],
  });
  verificar(`tareas con 0 días: reparto a partes iguales, sin reventar`, diasCero.ok && diasCero.tareas.size === 2);

  const unaTarea = repartirCronograma({
    inicio: "2026-07-27", fin: "2026-07-27", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "A", 5), tarea("t2", "A", 5)],
  });
  verificar(`obra de UN día hábil con dos tareas: ok, con aviso de día compartido`, unaTarea.ok && unaTarea.avisos.length > 0);
  verificar(`y las dos tareas caben en ese único día`, fechaISO(unaTarea.tareas.get("t1")!.inicio) === "2026-07-27" && fechaISO(unaTarea.tareas.get("t2")!.fin) === "2026-07-27");
}

// ---------------------------------------------------------------------------
console.log("\n9. Entradas imposibles: se rechazan con un motivo, no con fechas absurdas");
{
  const alReves = repartirCronograma({
    inicio: "2026-07-31", fin: "2026-02-02", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "A", 5)],
  });
  verificar(`fin anterior al inicio se RECHAZA`, !alReves.ok);
  verificar(`el motivo lo explica con las dos fechas`, alReves.motivos.some((m) => m.includes("2026-02-02") && m.includes("2026-07-31")));
  verificar(`y NO devuelve ninguna fecha`, alReves.fases.size === 0 && alReves.tareas.size === 0);

  // CONTROL POSITIVO: las MISMAS dos fechas en el orden correcto sí reparten.
  const alDerecho = repartirCronograma({
    inicio: "2026-02-02", fin: "2026-07-31", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "A", 5)],
  });
  verificar(`CONTROL: las mismas fechas en orden correcto SÍ reparten`, alDerecho.ok && alDerecho.fases.size === 1);

  const sinFechas = repartirCronograma({
    inicio: "", fin: "", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "A", 5)],
  });
  verificar(`sin fechas de obra se rechaza con dos motivos`, !sinFechas.ok && sinFechas.motivos.length === 2);

  const soloInicio = repartirCronograma({
    inicio: "2026-02-02", fin: null, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [],
  });
  verificar(`solo con inicio se rechaza y el motivo pide el fin`, !soloInicio.ok && soloInicio.motivos.some((m) => m.includes("fin")));

  const basura = repartirCronograma({
    inicio: "no-es-una-fecha", fin: "2026-07-31", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [],
  });
  verificar(`una fecha ilegible se trata como ausente, no revienta`, !basura.ok && basura.motivos.length > 0);

  // Ventana de obra sin ni un día hábil: domingo a domingo con semana de 6.
  const soloDomingo = repartirCronograma({
    inicio: "2026-07-26", fin: "2026-07-26", diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "A", 5)],
  });
  verificar(`una obra que solo abarca un domingo se rechaza`, !soloDomingo.ok && soloDomingo.motivos.some((m) => m.includes("día hábil")));

  const tareaHuerfana = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "AUTOMATICO", fases: fases("A"), tareas: [tarea("t1", "Fase que no existe", 5)],
  });
  verificar(`una tarea que apunta a una fase inexistente se rechaza`, !tareaHuerfana.ok);

  const modoRaro = repartirCronograma({
    inicio: OBRA.inicio, fin: OBRA.fin, diasHabilesSemana: SEMANA,
    modo: "INVENTADO" as unknown as EntradaReparto["modo"], fases: fases("A"), tareas: [],
  });
  verificar(`un modo desconocido se rechaza`, !modoRaro.ok);
}

// ---------------------------------------------------------------------------
console.log("\n10. La jornada del proyecto cambia el reparto");
{
  const entrada = {
    inicio: OBRA.inicio, fin: OBRA.fin,
    modo: "AUTOMATICO" as const, fases: fases("A"), tareas: [tarea("t1", "A", 5)],
  };
  const seis = repartirCronograma({ ...entrada, diasHabilesSemana: 6 });
  const cinco = repartirCronograma({ ...entrada, diasHabilesSemana: 5 });
  const habiles6 = diasHabilesVentana(seis.fases.get("A")!, 6);
  const habiles5 = diasHabilesVentana(cinco.fases.get("A")!, 5);
  verificar(`la misma obra tiene más días hábiles con semana de 6 que de 5 (${habiles6} vs ${habiles5})`, habiles6 > habiles5);
  verificar(`con semana de 5 ninguna ventana cae en sábado`, esHabil(cinco.fases.get("A")!.fin, 5) && cinco.fases.get("A")!.fin.getUTCDay() !== 6);
  // CONTROL POSITIVO: con semana de 6 el sábado SÍ es hábil.
  verificar(`CONTROL: el sábado 1 ago 2026 es hábil con semana de 6 y no con 5`, esHabil(dia("2026-08-01"), 6) && !esHabil(dia("2026-08-01"), 5));
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Reparto del cronograma planeado verificado sin errores.");
