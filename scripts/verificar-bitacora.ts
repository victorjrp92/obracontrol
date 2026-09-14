// ---------------------------------------------------------------------------
// Verificación de `src/lib/bitacora.ts`: la aritmética de la bitácora de obra.
//
// Lo que este módulo puede romper sin que se note NO es el render: es el
// número que el director de obra usa para decirle a alguien que no está
// haciendo su trabajo. Cuatro formas de equivocarse en silencio:
//
//   · Agrupar por NOMBRE en vez de por id: dos personas con el mismo nombre
//     se funden en una fila y las devoluciones de una se le cuelgan a la otra.
//   · Medir la latencia también en los reintentos: como `fecha_inicio` se
//     congela en el primer reporte, el revisor carga con el tiempo que el
//     contratista tardó en rehacer el trabajo.
//   · Restar sin comprobar el signo: una decisión anterior a su reporte da
//     horas negativas, que tiran la media hacia abajo y hacen quedar rapidísimo
//     justo al que tiene los datos peor cargados.
//   · Renumerar los intentos sobre la página filtrada: la segunda devolución de
//     una tarea aparece como «intento 1» y la historia queda al revés.
//
// Con CONTROL POSITIVO en cada bloque: no basta con afirmar que un caso da
// bien, hay que construir el caso donde el error SÍ saldría y comprobar que la
// comprobación lo distingue.
//
// Todo con datos de mentira, sin tocar la base: el módulo es puro a propósito.
// ---------------------------------------------------------------------------

import { extractMotivo } from "@/lib/aprobaciones";
import {
  autorDeEvidencia,
  formatearDuracionHoras,
  formatearPorcentaje,
  horasRevision,
  idsPrimeraDecisionPorTarea,
  media,
  mediana,
  motivoLimpio,
  notaVisible,
  numerarIntentos,
  ordenarSucesos,
  rangoFechas,
  resumenBitacora,
  resumirPorPersona,
  type DecisionResumen,
} from "@/lib/bitacora";

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

/** Fecha corta: `f("2026-03-01 08:00")`. Local, como la pinta la pantalla. */
function f(texto: string): Date {
  const [dia, hora] = texto.split(" ");
  const [a, m, d] = dia.split("-").map(Number);
  const [hh, mm] = (hora ?? "00:00").split(":").map(Number);
  return new Date(a, m - 1, d, hh, mm, 0, 0);
}

let contador = 0;
/** Una decisión con lo justo; el resto se completa con valores neutros. */
function dec(p: Partial<DecisionResumen> & { aprobadorId: string; fechaDecision: Date }): DecisionResumen {
  contador++;
  return {
    decisionId: `d${String(contador).padStart(3, "0")}`,
    tareaId: `t${contador}`,
    aprobadorNombre: p.aprobadorId,
    estado: "APROBADA",
    fechaReporte: null,
    ...p,
  };
}

/** La fila de una persona en el resumen, por id. */
function filaDe(filas: ReturnType<typeof resumirPorPersona>, id: string) {
  return filas.find((x) => x.aprobadorId === id);
}

console.log("Bitacora de obra - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Agrupacion por persona: cada quien con sus decisiones");
{
  const filas = resumirPorPersona([
    dec({ aprobadorId: "ana", aprobadorNombre: "Ana", estado: "APROBADA", fechaDecision: f("2026-03-01") }),
    dec({ aprobadorId: "ana", aprobadorNombre: "Ana", estado: "APROBADA", fechaDecision: f("2026-03-02") }),
    dec({ aprobadorId: "ana", aprobadorNombre: "Ana", estado: "NO_APROBADA", fechaDecision: f("2026-03-03") }),
    dec({ aprobadorId: "beto", aprobadorNombre: "Beto", estado: "NO_APROBADA", fechaDecision: f("2026-03-04") }),
  ]);

  const ana = filaDe(filas, "ana");
  const beto = filaDe(filas, "beto");
  verificar(`Ana: 2 aprobadas, 1 devuelta, 3 en total`, ana?.aprobadas === 2 && ana?.devueltas === 1 && ana?.total === 3);
  verificar(`Beto: 0 aprobadas, 1 devuelta`, beto?.aprobadas === 0 && beto?.devueltas === 1);
  verificar(`el % devuelto de Ana es 33,3% y no 100%`, ana !== undefined && formatearPorcentaje(ana.pctDevueltas) === "33,3%");
  verificar(`el orden pone primero a quien mas decidio (Ana)`, filas[0]?.aprobadorId === "ana");

  // CONTROL POSITIVO: dos personas DISTINTAS con el MISMO nombre. Si la
  // agrupacion se hiciera por nombre -que es lo que se ve en pantalla- las dos
  // se fundirian en una fila de 2 devoluciones y nadie notaria el cruce.
  const homonimos = resumirPorPersona([
    dec({ aprobadorId: "u1", aprobadorNombre: "Juan Perez", estado: "NO_APROBADA", fechaDecision: f("2026-03-01") }),
    dec({ aprobadorId: "u2", aprobadorNombre: "Juan Perez", estado: "APROBADA", fechaDecision: f("2026-03-02") }),
  ]);
  verificar(`CONTROL: dos «Juan Perez» distintos son DOS filas, no una`, homonimos.length === 2);
  verificar(`CONTROL: y la devolucion se queda en el que la firmo`, filaDe(homonimos, "u1")?.devueltas === 1 && filaDe(homonimos, "u2")?.devueltas === 0);
}

// ---------------------------------------------------------------------------
console.log("\n2. El que no firmo nada tambien sale, con ceros");
{
  const filas = resumirPorPersona(
    [dec({ aprobadorId: "ana", aprobadorNombre: "Ana", fechaDecision: f("2026-03-01") })],
    [
      { id: "ana", nombre: "Ana" },
      { id: "carla", nombre: "Carla" },
    ],
  );
  const carla = filaDe(filas, "carla");
  verificar(`Carla aparece aunque no firmo nada`, carla !== undefined);
  verificar(`Carla sale con 0 decisiones`, carla?.total === 0 && carla?.aprobadas === 0 && carla?.devueltas === 0);
  verificar(`Carla no inventa un % devuelto`, carla?.pctDevueltas === 0);
  verificar(`Carla no inventa un tiempo de revision`, carla?.horasMediana === null && carla?.horasMedia === null);
  verificar(`el que no decidio queda al final de la tabla`, filas[filas.length - 1]?.aprobadorId === "carla");

  // CONTROL POSITIVO: la MISMA Carla, ahora con una decision suya. Si la lista
  // de esperados pisara lo real, seguiria marcando 0 y el director perseguiria
  // a quien si trabajo.
  const conDecision = resumirPorPersona(
    [dec({ aprobadorId: "carla", aprobadorNombre: "Carla", fechaDecision: f("2026-03-05") })],
    [{ id: "carla", nombre: "Carla" }],
  );
  verificar(`CONTROL: si Carla si firmo, NO sale con 0`, filaDe(conDecision, "carla")?.total === 1);
}

// ---------------------------------------------------------------------------
console.log("\n3. Latencia: de cuando quedo reportada a cuando se firmo");
{
  verificar(`de 08:00 a 12:00 son 4 horas`, horasRevision(f("2026-03-01 08:00"), f("2026-03-01 12:00")) === 4);
  verificar(`firmar en el mismo instante son 0 horas, no null`, horasRevision(f("2026-03-01 08:00"), f("2026-03-01 08:00")) === 0);
  verificar(`sin fecha de reporte no es medible (null)`, horasRevision(null, f("2026-03-01 12:00")) === null);

  // CONTROL POSITIVO: decision ANTERIOR a su propio reporte. Una resta a secas
  // daria -5 horas y arrastraria la media de esa persona hacia abajo.
  const alReves = horasRevision(f("2026-03-01 13:00"), f("2026-03-01 08:00"));
  verificar(`CONTROL: una decision anterior a su reporte NO es medible`, alReves === null);
  verificar(`CONTROL: y desde luego no son -5 horas`, alReves !== -5);

  // Y el dato incoherente no puede colarse en el resumen de nadie.
  const filas = resumirPorPersona([
    dec({ aprobadorId: "ana", fechaDecision: f("2026-03-01 08:00"), fechaReporte: f("2026-03-01 13:00") }),
    dec({ aprobadorId: "ana", fechaDecision: f("2026-03-02 12:00"), fechaReporte: f("2026-03-02 08:00") }),
  ]);
  const ana = filaDe(filas, "ana");
  verificar(`con un dato incoherente y uno bueno, la media es la del bueno (4 h)`, ana?.horasMedia === 4);
  verificar(`y se declara que solo 1 de 2 fue medible`, ana?.medibles === 1 && ana?.total === 2);
}

// ---------------------------------------------------------------------------
console.log("\n4. Solo la PRIMERA decision de cada tarea mide latencia");
{
  // Una tarea reportada el dia 1, devuelta a las 4 horas y aprobada 10 dias
  // despues. `fecha_inicio` sigue marcando el dia 1: la segunda decision
  // «tardo» 10 dias que son del contratista rehaciendo, no del revisor.
  const filas: DecisionResumen[] = [
    { decisionId: "a", tareaId: "T1", aprobadorId: "ana", aprobadorNombre: "Ana", estado: "NO_APROBADA", fechaDecision: f("2026-03-01 12:00"), fechaReporte: f("2026-03-01 08:00") },
    { decisionId: "b", tareaId: "T1", aprobadorId: "ana", aprobadorNombre: "Ana", estado: "APROBADA", fechaDecision: f("2026-03-11 08:00"), fechaReporte: f("2026-03-01 08:00") },
  ];

  const primeras = idsPrimeraDecisionPorTarea(filas);
  verificar(`la primera decision de T1 es la del dia 1`, primeras.has("a") && !primeras.has("b"));

  const ana = filaDe(resumirPorPersona(filas), "ana");
  verificar(`Ana revisa en 4 h, no en 5 dias`, ana?.horasMediana === 4);
  verificar(`las dos decisiones si se cuentan (2 en total)`, ana?.total === 2);
  verificar(`pero solo 1 de 2 entra en la medicion de tiempo`, ana?.medibles === 1);

  // CONTROL POSITIVO: si el reintento SI contara, la media saldria en 122 h
  // (4 h y 240 h). Se comprueba que ese numero no aparece.
  verificar(`CONTROL: la media NO es la de contar el reintento (122 h)`, ana?.horasMedia !== 122);
  verificar(`CONTROL: la media es 4 h`, ana?.horasMedia === 4);

  // CONTROL POSITIVO del desempate: dos decisiones de la misma tarea en el
  // MISMO instante. El resultado no puede depender del orden de llegada.
  const empate: DecisionResumen[] = [
    { decisionId: "z", tareaId: "T2", aprobadorId: "x", aprobadorNombre: "X", estado: "APROBADA", fechaDecision: f("2026-04-01 09:00"), fechaReporte: null },
    { decisionId: "a", tareaId: "T2", aprobadorId: "x", aprobadorNombre: "X", estado: "APROBADA", fechaDecision: f("2026-04-01 09:00"), fechaReporte: null },
  ];
  const unOrden = [...idsPrimeraDecisionPorTarea(empate)];
  const otroOrden = [...idsPrimeraDecisionPorTarea([...empate].reverse())];
  verificar(`CONTROL: con fechas empatadas la primera es siempre la misma`, unOrden.length === 1 && unOrden[0] === otroOrden[0]);
}

// ---------------------------------------------------------------------------
console.log("\n5. Mediana y media: la cola de olvidadas no puede esconderse");
{
  verificar(`mediana de [1,2,3] es 2`, mediana([1, 2, 3]) === 2);
  verificar(`mediana de [1,2,3,4] es 2,5`, mediana([1, 2, 3, 4]) === 2.5);
  verificar(`mediana de lista vacia es null`, mediana([]) === null);
  verificar(`media de [1,2,3] es 2`, media([1, 2, 3]) === 2);
  verificar(`media de lista vacia es null`, media([]) === null);

  // CONTROL POSITIVO: tres revisiones de 1 h y una tarea olvidada 1.000 h. La
  // mediana aguanta; la media se dispara. Se comprueba que son distintas, que
  // es justo lo que la pantalla ensena para delatar la bandeja abandonada.
  const filas = [
    dec({ aprobadorId: "ana", fechaDecision: f("2026-03-01 09:00"), fechaReporte: f("2026-03-01 08:00") }),
    dec({ aprobadorId: "ana", fechaDecision: f("2026-03-02 09:00"), fechaReporte: f("2026-03-02 08:00") }),
    dec({ aprobadorId: "ana", fechaDecision: f("2026-03-03 09:00"), fechaReporte: f("2026-03-03 08:00") }),
    dec({ aprobadorId: "ana", fechaDecision: f("2026-05-01 08:00"), fechaReporte: f("2026-03-01 08:00") }),
  ];
  const ana = filaDe(resumirPorPersona(filas), "ana");
  verificar(`CONTROL: la mediana se queda en 1 h pese a la olvidada`, ana?.horasMediana === 1);
  verificar(`CONTROL: la media si se dispara (mas de 100 h)`, (ana?.horasMedia ?? 0) > 100);
  verificar(`CONTROL: mediana y media NO son el mismo numero`, ana?.horasMediana !== ana?.horasMedia);

  // No mutar la entrada: la lista de latencias se ordena para la mediana.
  const original = [3, 1, 2];
  mediana(original);
  verificar(`mediana no reordena la lista que recibe`, original[0] === 3 && original[2] === 2);
}

// ---------------------------------------------------------------------------
console.log("\n6. Totales del periodo");
{
  const r = resumenBitacora([
    dec({ aprobadorId: "ana", estado: "APROBADA", fechaDecision: f("2026-03-01") }),
    dec({ aprobadorId: "ana", estado: "NO_APROBADA", fechaDecision: f("2026-03-02") }),
    dec({ aprobadorId: "beto", estado: "NO_APROBADA", fechaDecision: f("2026-03-03") }),
  ]);
  verificar(`3 decisiones`, r.decisiones === 3);
  verificar(`2 devoluciones`, r.devoluciones === 2);
  verificar(`66,7% de devoluciones`, formatearPorcentaje(r.pctDevoluciones) === "66,7%");

  const vacio = resumenBitacora([]);
  verificar(`sin decisiones no revienta ni divide por cero`, vacio.decisiones === 0 && vacio.pctDevoluciones === 0);
}

// ---------------------------------------------------------------------------
console.log("\n7. Orden cronologico inverso: lo ultimo, arriba");
{
  const entrada = [
    { decisionId: "a", fechaDecision: f("2026-03-01") },
    { decisionId: "c", fechaDecision: f("2026-03-10") },
    { decisionId: "b", fechaDecision: f("2026-03-05") },
  ];
  const salida = ordenarSucesos(entrada);
  verificar(`el mas reciente queda primero`, salida[0]?.decisionId === "c");
  verificar(`el mas antiguo queda ultimo`, salida[2]?.decisionId === "a");

  // CONTROL POSITIVO: la entrada NO puede quedar tocada. `sort` muta, y si esta
  // funcion ordenara en sitio, la lista que el resto del codigo cree tener en
  // orden de consulta ya no lo estaria.
  verificar(`CONTROL: la lista original sigue como estaba`, entrada[0]?.decisionId === "a" && entrada[1]?.decisionId === "c");

  // CONTROL POSITIVO: dos sucesos del mismo instante. Reordenar la entrada no
  // puede cambiar la salida, o la misma pantalla recargada baraja las filas.
  const empate = [
    { decisionId: "m", fechaDecision: f("2026-03-07 10:00") },
    { decisionId: "n", fechaDecision: f("2026-03-07 10:00") },
  ];
  const uno = ordenarSucesos(empate).map((x) => x.decisionId).join();
  const dos = ordenarSucesos([...empate].reverse()).map((x) => x.decisionId).join();
  verificar(`CONTROL: con fechas empatadas el orden es estable`, uno === dos);
}

// ---------------------------------------------------------------------------
console.log("\n8. Secuencia de intentos: «intento 2 de 3»");
{
  const decisiones = [
    { decisionId: "b", tareaId: "T1", fechaDecision: f("2026-03-05") },
    { decisionId: "c", tareaId: "T1", fechaDecision: f("2026-03-09") },
    { decisionId: "a", tareaId: "T1", fechaDecision: f("2026-03-01") },
    { decisionId: "solo", tareaId: "T2", fechaDecision: f("2026-03-07") },
  ];
  const n = numerarIntentos(decisiones);
  verificar(`la del dia 1 es el intento 1 de 3`, n.get("a")?.intento === 1 && n.get("a")?.total === 3);
  verificar(`la del dia 5 es el intento 2 de 3`, n.get("b")?.intento === 2);
  verificar(`la del dia 9 es el intento 3 de 3`, n.get("c")?.intento === 3);

  // CONTROL POSITIVO: la tarea T2 tiene UNA sola decision. Si la numeracion no
  // separase por tarea, saldria como «intento 4 de 4» —cronologicamente cae
  // entre las de T1— y la pantalla acusaria de tres reintentos a una tarea que
  // se aprobo a la primera.
  verificar(`CONTROL: T2 es intento 1 de 1, no 4 de 4`, n.get("solo")?.intento === 1 && n.get("solo")?.total === 1);

  // CONTROL POSITIVO: numerar sobre una PAGINA FILTRADA. Si se pasa solo la
  // segunda decision de T1 —lo que devolveria un filtro de «solo devoluciones»—
  // sale «1 de 1»: por eso la consulta trae la historia completa de la tarea y
  // no la pagina. Este caso documenta el error que se evita.
  const soloUna = numerarIntentos([{ decisionId: "b", tareaId: "T1", fechaDecision: f("2026-03-05") }]);
  verificar(`CONTROL: con la historia recortada saldria «1 de 1» (por eso no se recorta)`, soloUna.get("b")?.intento === 1 && soloUna.get("b")?.total === 1);

  const empate = numerarIntentos([
    { decisionId: "z", tareaId: "T3", fechaDecision: f("2026-03-01 08:00") },
    { decisionId: "a", tareaId: "T3", fechaDecision: f("2026-03-01 08:00") },
  ]);
  verificar(`CONTROL: con fechas empatadas la numeracion es determinista`, empate.get("a")?.intento === 1 && empate.get("z")?.intento === 2);
}

// ---------------------------------------------------------------------------
console.log("\n9. Un rechazo sin motivo no revienta");
{
  verificar(`justificacion null -> sin motivo`, extractMotivo(null) === null);
  verificar(`justificacion {} -> sin motivo`, extractMotivo({}) === null);
  verificar(`justificacion {motivo:"Falta sellar"} -> el texto`, extractMotivo({ motivo: "Falta sellar" }) === "Falta sellar");

  // CONTROL POSITIVO: el motivo vacio. `extractMotivo` lo devuelve tal cual, y
  // una cadena vacia NO la atrapa un `??`: sin `motivoLimpio` la pantalla
  // pintaria «Motivo: » y nada detras, que se lee como un fallo de la pantalla
  // en vez de como lo que es: una devolucion sin explicar.
  verificar(`CONTROL: extractMotivo con "" devuelve "" (no null)`, extractMotivo({ motivo: "" }) === "");
  verificar(`CONTROL: motivoLimpio si lo convierte en null`, motivoLimpio(extractMotivo({ motivo: "" })) === null);
  verificar(`CONTROL: y con solo espacios, tambien`, motivoLimpio("   ") === null);
  verificar(`un motivo de verdad sobrevive y se recorta`, motivoLimpio("  Falta sellar  ") === "Falta sellar");
  verificar(`motivoLimpio con null no revienta`, motivoLimpio(null) === null);

  // `items_no_aprobados` es campo muerto: el motivo NUNCA vive ahi. Si alguien
  // lo cambiara, esto lo caza.
  verificar(`CONTROL: el motivo no se busca en otras claves del Json`, extractMotivo({ items_no_aprobados: ["ventana"] }) === null);
}

// ---------------------------------------------------------------------------
console.log("\n10. Quien puso la mano: el autor de la evidencia");
{
  const evidencias = [
    { nombre: "Obrero Luis", timestamp: f("2026-03-01 07:00") },
    { nombre: "Residente Ana", timestamp: f("2026-03-01 09:00") },
    { nombre: "Obrero Luis", timestamp: f("2026-03-20 07:00") },
  ];
  const decision = f("2026-03-02 10:00");

  verificar(`se elige la ultima evidencia ANTERIOR a la firma`, autorDeEvidencia(evidencias, decision)?.nombre === "Residente Ana");

  // CONTROL POSITIVO: la ultima evidencia de la tarea es del dia 20, o sea del
  // intento SIGUIENTE. Cogerla «porque es la ultima» pondria en el expediente
  // de una decision de marzo a quien subio la foto tres semanas despues.
  verificar(`CONTROL: NO se elige la evidencia posterior a la firma`, autorDeEvidencia(evidencias, decision)?.nombre !== "Obrero Luis");
  verificar(`CONTROL: para una firma del dia 25 si es Luis`, autorDeEvidencia(evidencias, f("2026-03-25 10:00"))?.nombre === "Obrero Luis");

  verificar(`sin evidencias devuelve null (y la pantalla cae al asignado)`, autorDeEvidencia([], decision) === null);
  verificar(`si todas son posteriores a la firma, tambien null`, autorDeEvidencia([{ nombre: "Tarde", timestamp: f("2026-04-01") }], decision) === null);
}

// ---------------------------------------------------------------------------
console.log("\n11. La nota del reporte solo cuelga del ultimo intento");
{
  verificar(`en el intento 3 de 3 se ve la nota`, notaVisible("Falto material", 3, 3) === "Falto material");

  // CONTROL POSITIVO: `nota_reporte` es UNA columna que se sobreescribe. Pegarla
  // en los intentos viejos pondria en boca del contratista, en marzo, algo que
  // escribio en agosto.
  verificar(`CONTROL: en el intento 1 de 3 NO se ve`, notaVisible("Falto material", 1, 3) === null);
  verificar(`CONTROL: en el intento 2 de 3 tampoco`, notaVisible("Falto material", 2, 3) === null);
  verificar(`una tarea de un solo intento si la ensena`, notaVisible("Listo", 1, 1) === "Listo");
  verificar(`sin nota no inventa texto`, notaVisible(null, 1, 1) === null);
}

// ---------------------------------------------------------------------------
console.log("\n12. Rango de fechas del filtro");
{
  const r = rangoFechas("2026-03-01", "2026-03-31");
  verificar(`«desde» arranca a las 00:00`, r.desde?.getHours() === 0 && r.desde?.getMinutes() === 0);
  verificar(`«desde» es el dia pedido`, r.desde?.getDate() === 1 && r.desde?.getMonth() === 2);

  // CONTROL POSITIVO: «hasta» tiene que cubrir el dia ENTERO. Si se quedara en
  // las 00:00, un filtro «hasta el 31» perderia las decisiones del 31 — el dia
  // que el usuario acaba de pedir.
  verificar(`CONTROL: «hasta» llega al ultimo milisegundo del dia`, r.hasta?.getHours() === 23 && r.hasta?.getMilliseconds() === 999);
  verificar(`CONTROL: «hasta» NO se queda en medianoche`, r.hasta?.getHours() !== 0);

  verificar(`sin parametros, rango abierto`, rangoFechas().desde === null && rangoFechas().hasta === null);
  verificar(`cadena vacia es rango abierto`, rangoFechas("", "").desde === null);
  verificar(`un texto que no es fecha se ignora`, rangoFechas("ayer").desde === null);
  verificar(`formato sin ceros a la izquierda se ignora`, rangoFechas("2026-3-1").desde === null);

  // CONTROL POSITIVO: `new Date(2026, 1, 31)` NO falla, se corre al 3 de marzo.
  // Un filtro que se desplaza solo es peor que uno vacio.
  verificar(`CONTROL: el 31 de febrero se descarta`, rangoFechas("2026-02-31").desde === null);
  verificar(`CONTROL: el 28 de febrero si vale`, rangoFechas("2026-02-28").desde?.getDate() === 28);
  verificar(`el mes 13 se descarta`, rangoFechas("2026-13-01").desde === null);
}

// ---------------------------------------------------------------------------
console.log("\n13. Formato de duraciones y porcentajes");
{
  verificar(`null se pinta como raya`, formatearDuracionHoras(null) === "—");
  verificar(`media hora -> «<1 h»`, formatearDuracionHoras(0.5) === "<1 h");
  verificar(`4 horas -> «4 h»`, formatearDuracionHoras(4) === "4 h");
  verificar(`36 horas siguen en horas`, formatearDuracionHoras(36) === "36 h");
  verificar(`60 horas pasan a dias con coma`, formatearDuracionHoras(60) === "2,5 d");
  verificar(`400 horas -> «17 d» sin decimal`, formatearDuracionHoras(400) === "17 d");
  verificar(`CONTROL: los dias NO se escriben con punto decimal`, !formatearDuracionHoras(60).includes("."));
  verificar(`33,333% -> «33,3%»`, formatearPorcentaje(33.3333) === "33,3%");
  verificar(`CONTROL: el porcentaje NO usa punto`, !formatearPorcentaje(33.3333).includes("."));
}

// ---------------------------------------------------------------------------
// 14. EL FILTRO NO PUEDE CAMBIAR LA LATENCIA DE NADIE
//
// Fallo real encontrado en revision: «la primera decision de cada tarea» se
// calculaba sobre las filas YA FILTRADAS. Si el filtro -por persona, por
// «desde» o por «hasta»- dejaba fuera la decision 1, la decision 2 ascendia a
// «primera» y se medía contra `fecha_inicio`, congelada en el primer reporte.
// Al revisor que aprobo un reintento se le cargaban los meses que el
// contratista tardo en rehacer el trabajo: la misma persona salia «—» sin
// filtro y «172 dias» con filtro, en la misma pantalla.
// ---------------------------------------------------------------------------
{
  console.log("\n14. El filtro no puede cambiar la latencia de nadie");

  const d = (iso: string) => new Date(iso);
  // T1: Ana la devuelve a las 4 h. El contratista tarda cinco meses. Beto
  // aprueba el reintento.
  const historia: DecisionResumen[] = [
    {
      decisionId: "d1", tareaId: "T1", aprobadorId: "ana", aprobadorNombre: "Ana",
      estado: "NO_APROBADA", fechaDecision: d("2026-03-01T12:00:00Z"),
      fechaReporte: d("2026-03-01T08:00:00Z"),
    },
    {
      decisionId: "d2", tareaId: "T1", aprobadorId: "beto", aprobadorNombre: "Beto",
      estado: "APROBADA", fechaDecision: d("2026-08-20T10:00:00Z"),
      fechaReporte: d("2026-03-01T08:00:00Z"),
    },
  ];

  const primeras = idsPrimeraDecisionPorTarea(historia);
  const soloBeto = historia.filter((f) => f.aprobadorId === "beto");

  const conHistoria = resumirPorPersona(soloBeto, [], primeras);
  const betoBien = conHistoria.find((f) => f.nombre === "Beto")!;
  verificar(`filtrando por Beto, su tiempo de revision NO es medible (${betoBien.horasMediana ?? "null"})`,
    betoBien.horasMediana === null);

  // CONTROL POSITIVO: sin pasarle la historia, el modulo reproduce el fallo
  // viejo. Si este caso dejara de fallar, la proteccion se habria caido.
  const sinHistoria = resumirPorPersona(soloBeto, []);
  const betoMal = sinHistoria.find((f) => f.nombre === "Beto")!;
  verificar("CONTROL: sin la historia completa saldria un numero (el fallo viejo)",
    betoMal.horasMediana !== null && betoMal.horasMediana > 4000);

  // Y sin filtro, Ana conserva sus 4 horas con historia o sin ella.
  const anaConHistoria = resumirPorPersona(historia, [], primeras)
    .find((f) => f.nombre === "Ana")!;
  const anaSinHistoria = resumirPorPersona(historia, []).find((f) => f.nombre === "Ana")!;
  verificar(`Ana revisa en 4 h con filtro y sin el (${anaConHistoria.horasMediana} / ${anaSinHistoria.horasMediana})`,
    anaConHistoria.horasMediana === 4 && anaSinHistoria.horasMediana === 4);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Bitacora de obra verificada sin errores.");
