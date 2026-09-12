// ---------------------------------------------------------------------------
// Verificacion de `velocidad.ts`: % a tiempo, dias de mas y matriz de ciclo.
//
// Lo que este modulo puede romper sin que se note es que las dos metricas
// dejen de ser INDEPENDIENTES. Si `diasDeMas` termina siendo una funcion de
// `pctATiempo`, las dos graficas dicen lo mismo y el producto pierde
// exactamente lo que las justifica. La suite lo fija con el caso que motivo
// tenerlas separadas: dos obras con el MISMO porcentaje y desastres de tamano
// opuesto.
//
// Con CONTROL POSITIVO en cada bloque: no basta afirmar que un numero sale
// bien, hay que construir el caso donde el error saldria y comprobar que la
// comprobacion lo distingue.
// ---------------------------------------------------------------------------

import {
  serieVelocidad,
  matrizCiclo,
  medible,
  diasReales,
  MAX_COLUMNAS,
  type TareaVelocidad,
} from "@/lib/velocidad";

let total = 0;
let fallos = 0;

function verificar(d: string, c: boolean) {
  total++;
  if (c) console.log(`  OK   ${d}`);
  else {
    fallos++;
    console.error(`  FAIL ${d}`);
  }
}

const DIA = 86_400_000;
const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

/** Una tarea con lo justo; el resto se completa con valores neutros. */
function t(p: Partial<TareaVelocidad> & { plan: number; real: number; fin: string }): TareaVelocidad {
  const fin = d(p.fin);
  return {
    estado: "APROBADA",
    tiempo_acordado_dias: p.plan,
    fecha_inicio: new Date(fin.getTime() - p.real * DIA),
    fecha_fin_real: fin,
    fase: p.fase ?? "Fase 1",
    faseOrden: p.faseOrden ?? 1,
    unidadId: p.unidadId ?? "u1",
    torre: p.torre ?? "Torre 1",
    piso: p.piso ?? "Piso 1",
    tipologia: p.tipologia ?? "Tipo A",
    responsable: p.responsable ?? "Ana",
  };
}

console.log("Velocidad de obra - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Las dos metricas son INDEPENDIENTES (la razon de que sean dos)");
{
  // Diez tareas de 2 dias. Mismo porcentaje, desastres de tamano opuesto.
  const roce = [
    ...Array(5).fill(0).map(() => t({ plan: 2, real: 2, fin: "2026-03-10" })),
    ...Array(5).fill(0).map(() => t({ plan: 2, real: 2.2, fin: "2026-03-10" })),
  ];
  const desastre = [
    ...Array(5).fill(0).map(() => t({ plan: 2, real: 2, fin: "2026-03-10" })),
    ...Array(5).fill(0).map(() => t({ plan: 2, real: 6, fin: "2026-03-10" })),
  ];
  const a = serieVelocidad(roce, "mes")[0];
  const b = serieVelocidad(desastre, "mes")[0];

  verificar(`ambas dan 50% a tiempo (${a.pctATiempo}% y ${b.pctATiempo}%)`,
    a.pctATiempo === 50 && b.pctATiempo === 50);
  verificar(`pero los dias de mas las separan: +${a.diasDeMas.toFixed(2)} contra +${b.diasDeMas.toFixed(2)}`,
    Math.abs(a.diasDeMas - 0.1) < 1e-9 && Math.abs(b.diasDeMas - 2) < 1e-9);
  verificar(`CONTROL: si fueran la misma metrica, estos dos casos serian iguales`,
    a.diasDeMas !== b.diasDeMas);

  // El reverso: cumplimiento alto escondiendo un desastre.
  const escondido = [
    ...Array(9).fill(0).map(() => t({ plan: 2, real: 2, fin: "2026-03-10" })),
    t({ plan: 2, real: 12, fin: "2026-03-10" }),
  ];
  const e = serieVelocidad(escondido, "mes")[0];
  verificar(`90% a tiempo con +${e.diasDeMas.toFixed(1)} dias: el promedio delata lo que el % esconde`,
    e.pctATiempo === 90 && Math.abs(e.diasDeMas - 1) < 1e-9);
}

// ---------------------------------------------------------------------------
console.log("\n2. Que cuenta como 'a tiempo'");
{
  const justo = serieVelocidad([t({ plan: 2, real: 2, fin: "2026-03-10" })], "mes")[0];
  verificar(`terminar exacto en el plazo cuenta a tiempo`, justo.pctATiempo === 100);

  const antes = serieVelocidad([t({ plan: 3, real: 1, fin: "2026-03-10" })], "mes")[0];
  verificar(`terminar antes cuenta a tiempo y da dias NEGATIVOS (${antes.diasDeMas})`,
    antes.pctATiempo === 100 && antes.diasDeMas === -2);

  const tarde = serieVelocidad([t({ plan: 2, real: 2.5, fin: "2026-03-10" })], "mes")[0];
  verificar(`CONTROL: medio dia de mas SI cuenta como incumplida`, tarde.pctATiempo === 0);

  // La tolerancia existe para que un plazo cumplido no se vuelva incumplido
  // por aritmetica. Un milisegundo de mas sobre dos dias son 1.2e-8 dias: con
  // una comparacion estricta esa tarea contaria como tarde.
  const fin = d("2026-03-10");
  const unMs: TareaVelocidad = {
    ...t({ plan: 2, real: 2, fin: "2026-03-10" }),
    fecha_inicio: new Date(fin.getTime() - 2 * DIA - 1),
  };
  verificar(`una tarea que cierra un milisegundo tarde sigue contando a tiempo`,
    serieVelocidad([unMs], "mes")[0].pctATiempo === 100);
  verificar(`CONTROL: con comparacion estricta esa misma tarea seria incumplida`,
    diasReales(unMs) > 2);

  const piso = diasReales(t({ plan: 1, real: 0.1, fin: "2026-03-10" }));
  verificar(`una tarea instantanea se cuenta como medio dia, no como cero (${piso})`, piso === 0.5);
}

// ---------------------------------------------------------------------------
console.log("\n3. Que tareas entran y cuales no");
{
  const base = t({ plan: 2, real: 2, fin: "2026-03-10" });
  verificar(`una APROBADA con las dos fechas es medible`, medible(base) === true);
  verificar(`CONTROL: una REPORTADA no se mide`, medible({ ...base, estado: "REPORTADA" }) === false);
  verificar(`CONTROL: sin fecha de inicio no se mide`, medible({ ...base, fecha_inicio: null }) === false);
  verificar(`CONTROL: sin fecha de fin no se mide`, medible({ ...base, fecha_fin_real: null }) === false);
  verificar(`CONTROL: con plazo cero no se mide (dividiria por cero)`,
    medible({ ...base, tiempo_acordado_dias: 0 }) === false);
  verificar(`CONTROL: con el fin ANTES del inicio no se mide`,
    medible({ ...base, fecha_fin_real: new Date(base.fecha_inicio!.getTime() - DIA) }) === false);
  verificar(`CONTROL: una fecha invalida no revienta, solo no se mide`,
    medible({ ...base, fecha_fin_real: new Date("no-es-fecha") }) === false);

  const mezcla = serieVelocidad(
    [base, { ...base, estado: "PENDIENTE" }, { ...base, fecha_inicio: null }],
    "mes",
  );
  verificar(`la serie ignora las no medibles y no las cuenta`, mezcla[0].cerradas === 1);
}

// ---------------------------------------------------------------------------
console.log("\n4. Agrupacion por periodo");
{
  const tareas = [
    t({ plan: 2, real: 2, fin: "2026-01-05" }),
    t({ plan: 2, real: 2, fin: "2026-01-20" }),
    t({ plan: 2, real: 2, fin: "2026-02-10" }),
    t({ plan: 2, real: 2, fin: "2026-04-10" }),
  ];
  verificar(`por mes: 3 cubos (ene, feb, abr)`, serieVelocidad(tareas, "mes").length === 3);
  verificar(`por trimestre: 2 cubos (T1, T2)`, serieVelocidad(tareas, "tri").length === 2);
  verificar(`por quincena: 4 cubos (dos de enero son quincenas distintas)`,
    serieVelocidad(tareas, "qui").length === 4);

  const et = serieVelocidad(tareas, "mes").map((p) => p.etiqueta);
  verificar(`las etiquetas de mes salen en orden (${et.join(", ")})`, String(et) === "ene,feb,abr");

  // Semana: dos fechas de la misma semana ISO caen en el mismo cubo aunque
  // sean de meses distintos.
  const cruzando = [t({ plan: 1, real: 1, fin: "2026-04-30" }), t({ plan: 1, real: 1, fin: "2026-05-01" })];
  verificar(`por semana: jueves y viernes de la misma semana van al mismo cubo`,
    serieVelocidad(cruzando, "sem").length === 1);
  verificar(`CONTROL: por mes esas mismas dos caen en cubos distintos`,
    serieVelocidad(cruzando, "mes").length === 2);

  const orden = serieVelocidad(
    [t({ plan: 1, real: 1, fin: "2026-12-10" }), t({ plan: 1, real: 1, fin: "2026-02-10" })],
    "mes",
  ).map((p) => p.etiqueta);
  verificar(`la serie sale ordenada en el tiempo aunque la entrada no lo este (${orden.join(",")})`,
    String(orden) === "feb,dic");
}

// ---------------------------------------------------------------------------
console.log("\n5. Matriz de ciclo");
{
  // Dos apartamentos por torre. La fase ocupa el espacio desde que arranca la
  // primera tarea hasta que cierra la ultima.
  const obra: TareaVelocidad[] = [];
  const add = (torre: string, uid: string, fase: string, orden: number, ini: string, fin: string) => {
    const fi = d(fin);
    obra.push({
      estado: "APROBADA", tiempo_acordado_dias: 2,
      fecha_inicio: d(ini), fecha_fin_real: fi,
      fase, faseOrden: orden, unidadId: uid,
      torre, piso: "Piso 1", tipologia: "Tipo A", responsable: "Ana",
    });
  };
  // Torre 1, apto A: mamposteria del 1 al 11 -> 10 dias.
  add("Torre 1", "t1a", "Mamposteria", 1, "2026-01-01", "2026-01-06");
  add("Torre 1", "t1a", "Mamposteria", 1, "2026-01-06", "2026-01-11");
  // Torre 1, apto B: del 1 al 11 tambien -> 10 dias. Promedio 10.
  add("Torre 1", "t1b", "Mamposteria", 1, "2026-01-01", "2026-01-11");
  // Torre 2, apto A: del 1 al 31 -> 30 dias.
  add("Torre 2", "t2a", "Mamposteria", 1, "2026-01-01", "2026-01-31");

  const m = matrizCiclo(obra, "torre");
  verificar(`la matriz tiene 1 fase y 2 columnas`, m.fases.length === 1 && m.columnas.length === 2);
  const c1 = m.celdas.get("Mamposteria")!.get("Torre 1")!;
  const c2 = m.celdas.get("Mamposteria")!.get("Torre 2")!;
  verificar(`Torre 1: 10 dias promedio sobre 2 apartamentos (${c1.dias} d, ${c1.unidades} u)`,
    c1.dias === 10 && c1.unidades === 2);
  verificar(`Torre 2: 30 dias sobre 1 apartamento`, c2.dias === 30 && c2.unidades === 1);
  verificar(`el ciclo va del PRIMER inicio al ULTIMO fin, no suma tareas sueltas`, c1.dias === 10);
  verificar(`min y max quedan en la matriz para colorear (${m.minDias}-${m.maxDias})`,
    m.minDias === 10 && m.maxDias === 30);

  // Una unidad a medio cerrar no aporta: no tiene "ciclo".
  const conPendiente = [...obra];
  conPendiente.push({
    estado: "PENDIENTE", tiempo_acordado_dias: 2, fecha_inicio: null, fecha_fin_real: null,
    fase: "Mamposteria", faseOrden: 1, unidadId: "t2b",
    torre: "Torre 2", piso: "Piso 1", tipologia: "Tipo A", responsable: "Ana",
  });
  const m2 = matrizCiclo(conPendiente, "torre");
  verificar(`CONTROL: un apartamento con la fase a medias no entra al promedio`,
    m2.celdas.get("Mamposteria")!.get("Torre 2")!.unidades === 1);

  // Ese es el sesgo que la interfaz debe advertir: se mide solo lo terminado.
  verificar(`la celda reporta cuantas unidades la respaldan, para poder advertirlo`,
    m2.celdas.get("Mamposteria")!.get("Torre 2")!.unidades === 1);
}

// ---------------------------------------------------------------------------
console.log("\n6. La matriz cambia de dimension sin cambiar los datos");
{
  const obra: TareaVelocidad[] = [
    {
      estado: "APROBADA", tiempo_acordado_dias: 2, fecha_inicio: d("2026-01-01"),
      fecha_fin_real: d("2026-01-11"), fase: "Pintura", faseOrden: 8, unidadId: "a",
      torre: "Torre 1", piso: "Piso 5", tipologia: "Tipo D", responsable: "Ana",
    },
    {
      estado: "APROBADA", tiempo_acordado_dias: 2, fecha_inicio: d("2026-01-01"),
      fecha_fin_real: d("2026-01-21"), fase: "Pintura", faseOrden: 8, unidadId: "b",
      torre: "Torre 2", piso: "Piso 1", tipologia: "Tipo A", responsable: "Beto",
    },
  ];
  for (const dim of ["torre", "piso", "tipologia", "responsable"] as const) {
    const m = matrizCiclo(obra, dim);
    verificar(`por ${dim}: 2 columnas y ambas con dato`,
      m.columnas.length === 2 && m.fases.length === 1 &&
      [...m.celdas.get("Pintura")!.values()].every((c) => c.dias !== null));
  }
}

// ---------------------------------------------------------------------------
console.log("\n7. Bordes");
{
  verificar(`sin tareas: serie vacia`, serieVelocidad([], "mes").length === 0);
  const vacia = matrizCiclo([], "torre");
  verificar(`sin tareas: matriz vacia y sin NaN en min/max`,
    vacia.fases.length === 0 && vacia.columnas.length === 0 &&
    vacia.minDias === 0 && vacia.maxDias === 0);

  const sinDim = matrizCiclo(
    [{ ...t({ plan: 2, real: 2, fin: "2026-03-10" }), torre: "" }],
    "torre",
  );
  verificar(`una tarea sin valor en la dimension se ignora`, sinDim.columnas.length === 0);

  // Muchas columnas: la matriz se corta antes de volverse ilegible.
  const muchas = Array.from({ length: 20 }, (_, i) =>
    t({ plan: 2, real: 2, fin: "2026-03-10", torre: `Torre ${i + 1}`, unidadId: `u${i}` }));
  verificar(`con 20 columnas se recorta a ${MAX_COLUMNAS}`,
    matrizCiclo(muchas, "torre").columnas.length === MAX_COLUMNAS);

  // Orden natural: Torre 10 va despues de Torre 2, no antes.
  const orden = matrizCiclo(
    [
      t({ plan: 2, real: 2, fin: "2026-03-10", torre: "Torre 10", unidadId: "a" }),
      t({ plan: 2, real: 2, fin: "2026-03-10", torre: "Torre 2", unidadId: "b" }),
    ],
    "torre",
  ).columnas;
  verificar(`las columnas ordenan por numero, no alfabeticamente (${orden.join(", ")})`,
    String(orden) === "Torre 2,Torre 10");
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Velocidad de obra verificada sin errores.");
