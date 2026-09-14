// ---------------------------------------------------------------------------
// Verificación de `src/lib/avance-programado.ts`: el trío de indicadores del
// informe de interventoría —tiempo transcurrido, avance ejecutado y avance
// programado— y el SPI que sale de dividir los dos últimos.
//
// Lo que este módulo puede romper sin que se note son tres cosas:
//
//  1. LA PONDERACIÓN. El avance de la obra se pondera por TAREA, no por fase.
//     Promediar los porcentajes de las diez fases de Rosas Cali da 55%, no el
//     49% que enseña la app: el bloque 2 lo comprueba con la distribución real
//     de la obra y su control positivo es justo ese 55% equivocado.
//
//  2. NULL CONTRA CERO. Sin cronograma cargado el programado es `null`. Un
//     cero diría «hoy no tocaba haber hecho nada», que es exactamente lo
//     contrario de «no sabemos qué tocaba», y con un cero el SPI se dispara a
//     infinito. Es el caso de TODAS las obras que existen hoy.
//
//  3. EL ALCANCE DEL SPI. Con el cronograma a medias, el programado solo cubre
//     las fases que tienen ventana; compararlo contra el ejecutado de TODA la
//     obra da un índice inventado. El bloque 8 fabrica el caso donde el error
//     cambia el veredicto de «en plazo» a «atrasada».
//
// Con CONTROL POSITIVO en cada bloque que lo permite: no basta afirmar que un
// caso da bien, hay que construir el caso donde el error SÍ saldría y
// comprobar que la comprobación lo distingue.
//
// Sobre la LÓGICA PURA: sin base de datos y sin reloj — `hoy` entra siempre
// por parámetro.
// ---------------------------------------------------------------------------

import {
  avanceAprobado,
  avanceEjecutado,
  compararAvance,
  conteoDesde,
  CONTEO_VACIO,
  creditoAcumulado,
  creditoDeEstado,
  CREDITO_APROBADA,
  CREDITO_NO_APROBADA,
  CREDITO_PENDIENTE,
  CREDITO_REPORTADA,
  diferenciaPuntos,
  estadoDeFase,
  formatearMiles,
  formatearPorcentaje,
  formatearPuntos,
  formatearSPI,
  fraccionProgramada,
  indiceDesempenoPlazo,
  ritmoDeSPI,
  tiempoTranscurrido,
  TOLERANCIA_ATRASO_PUNTOS,
  totalTareas,
  type ConteoEstados,
  type FasePlaneada,
} from "@/lib/avance-programado";

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

/** Conteo con lo justo; el resto se completa en cero. */
function conteo(p: Partial<ConteoEstados>): ConteoEstados {
  return { ...CONTEO_VACIO, ...p };
}

/** Fecha en UTC, para que el resultado no dependa de la zona de la máquina. */
const dia = (anio: number, mes1a12: number, d: number) =>
  new Date(Date.UTC(anio, mes1a12 - 1, d));

/** Fase de mentira con lo justo. */
function fase(p: Partial<FasePlaneada> & { id: string }): FasePlaneada {
  return {
    nombre: p.id,
    orden: 1,
    inicioPlan: null,
    finPlan: null,
    conteos: { ...CONTEO_VACIO },
    ...p,
  };
}

/** Comparación de flotantes: el punto flotante no da igualdades exactas. */
const casi = (a: number | null, b: number, eps = 1e-9) =>
  a !== null && Math.abs(a - b) < eps;

console.log("Avance ejecutado contra avance programado - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Reglas de credito: APROBADA 100%, REPORTADA 80%, el resto 0%");
{
  verificar(`100 tareas aprobadas dan 100%`, casi(avanceEjecutado(conteo({ aprobadas: 100 })), 1));
  verificar(`100 tareas reportadas dan 80%`, casi(avanceEjecutado(conteo({ reportadas: 100 })), 0.8));
  verificar(`100 tareas pendientes dan 0%`, casi(avanceEjecutado(conteo({ pendientes: 100 })), 0));
  verificar(
    `100 tareas devueltas dan 0% (NO_APROBADA es trabajo por rehacer)`,
    casi(avanceEjecutado(conteo({ devueltas: 100 })), 0),
  );

  // Las constantes existen con nombre, no como numeros sueltos dentro del calculo.
  verificar(`el tope de lo reportado-sin-aprobar es 0,8`, CREDITO_REPORTADA === 0.8);
  verificar(
    `las cuatro constantes valen lo que dicen`,
    CREDITO_APROBADA === 1 &&
      CREDITO_PENDIENTE === 0 &&
      CREDITO_NO_APROBADA === 0 &&
      creditoDeEstado("APROBADA") === 1 &&
      creditoDeEstado("REPORTADA") === 0.8,
  );
  verificar(`un estado desconocido no suma credito`, creditoDeEstado("INVENTADO") === 0);

  // CONTROL: mezclar estados da el promedio PONDERADO, no el simple.
  const mezcla = conteo({ aprobadas: 50, reportadas: 50 });
  verificar(
    `CONTROL: 50 aprobadas + 50 reportadas dan 90%, no 100% ni 80%`,
    casi(avanceEjecutado(mezcla), 0.9),
  );
  const cuatro = conteo({ aprobadas: 25, reportadas: 25, pendientes: 25, devueltas: 25 });
  verificar(
    `CONTROL: 25 de cada estado dan 45% ((25 + 20) / 100)`,
    casi(avanceEjecutado(cuatro), 0.45),
  );
  verificar(`el credito acumulado de esa mezcla es 45 tareas`, creditoAcumulado(cuatro) === 45);
  verificar(`y el total sigue siendo 100 tareas`, totalTareas(cuatro) === 100);
}

// ---------------------------------------------------------------------------
console.log("\n2. CUADRE con Rosas Cali: la app enseña 49% y esto tiene que dar 49%");
{
  // Distribucion REAL de la obra de tres torres, fase por fase (4.110 tareas).
  // Se escribe a mano aqui a proposito: es la unica forma de comprobar la
  // ponderacion sin base de datos.
  const rosas: { nombre: string; a: number; r: number; d: number; p: number }[] = [
    { nombre: "Obra gris / Estructura", a: 60, r: 0, d: 0, p: 0 },
    { nombre: "Mamposteria", a: 368, r: 28, d: 9, p: 0 },
    { nombre: "Instalaciones hidrosanitarias", a: 245, r: 27, d: 14, p: 44 },
    { nombre: "Instalaciones electricas", a: 180, r: 0, d: 0, p: 90 },
    { nombre: "Panete y estuco", a: 302, r: 14, d: 4, p: 160 },
    { nombre: "Enchapes y pisos", a: 422, r: 82, d: 18, p: 348 },
    { nombre: "Carpinteria y closets", a: 159, r: 24, d: 6, p: 216 },
    { nombre: "Pintura", a: 155, r: 0, d: 0, p: 310 },
    { nombre: "Aparatos y acabados", a: 78, r: 18, d: 14, p: 220 },
    { nombre: "Aseo y entrega", a: 32, r: 29, d: 5, p: 429 },
  ];
  const fases = rosas.map((f, i) =>
    fase({
      id: f.nombre,
      orden: i + 1,
      conteos: conteo({ aprobadas: f.a, reportadas: f.r, devueltas: f.d, pendientes: f.p }),
    }),
  );

  const c = compararAvance(fases, dia(2026, 9, 14));
  verificar(`la obra suma 4.110 tareas`, totalTareas(c.conteos) === 4110);
  verificar(`de las cuales 2.001 aprobadas`, c.conteos.aprobadas === 2001);
  verificar(`y 222 esperando revision`, c.conteos.reportadas === 222);

  // El cuadre: la cifra que ya enseña la app es SOLO lo aprobado.
  verificar(
    `2.001 de 4.110 aprobadas redondean al 49% que enseña la app`,
    c.aprobado !== null && Math.round(c.aprobado * 100) === 49,
  );
  // Y el ejecutado con credito nunca es menor: le suma el 80% de lo reportado.
  verificar(
    `el ejecutado con credito da 53% (49% aprobado + las 222 reportadas al 80%)`,
    c.ejecutado !== null && Math.round(c.ejecutado * 100) === 53,
  );
  verificar(
    `la diferencia entre los dos es EXACTAMENTE 222 x 0,8 / 4.110`,
    c.ejecutado !== null && c.aprobado !== null &&
      Math.abs(c.ejecutado - c.aprobado - (222 * 0.8) / 4110) < 1e-12,
  );

  // CONTROL POSITIVO de la ponderacion: promediar los diez porcentajes de fase
  // -que es el error facil- da 55%, no 49%. Si alguna vez el modulo empieza a
  // devolver 55, es que cambio la ponderacion por tarea a ponderacion por fase.
  const promedioDeFases =
    fases.reduce((s, f) => s + (avanceAprobado(f.conteos) ?? 0), 0) / fases.length;
  verificar(
    `CONTROL: promediar las 10 fases da 55%, que NO es el 49% de la obra`,
    Math.round(promedioDeFases * 100) === 55 && Math.round(promedioDeFases * 100) !== 49,
  );
}

// ---------------------------------------------------------------------------
console.log("\n3. El % programado dentro de una ventana: reparto lineal");
{
  const inicio = dia(2026, 1, 1);
  const fin = dia(2026, 1, 31); // 30 dias de ventana

  verificar(
    `a mitad de la ventana (16 ene) el programado es 50%`,
    casi(fraccionProgramada(dia(2026, 1, 16), inicio, fin), 0.5),
  );
  verificar(
    `a un tercio (11 ene) es 33,3%`,
    casi(fraccionProgramada(dia(2026, 1, 11), inicio, fin), 1 / 3),
  );

  // CONTROL: fuera de la ventana no se interpola, se topa.
  verificar(
    `CONTROL: ANTES de la ventana es 0, no negativo`,
    fraccionProgramada(dia(2025, 12, 20), inicio, fin) === 0,
  );
  verificar(
    `CONTROL: DESPUES de la ventana es 100%, no mas de 100%`,
    fraccionProgramada(dia(2026, 3, 1), inicio, fin) === 1,
  );
  verificar(
    `el dia exacto de inicio es 0%`,
    fraccionProgramada(inicio, inicio, fin) === 0,
  );
  verificar(`el dia exacto de fin es 100%`, fraccionProgramada(fin, inicio, fin) === 1);
}

// ---------------------------------------------------------------------------
console.log("\n4. Ventanas raras: un solo dia, invertida, incompleta");
{
  const d = dia(2026, 5, 10);
  verificar(
    `ventana de UN dia no divide por cero: el dia anterior es 0%`,
    fraccionProgramada(dia(2026, 5, 9), d, d) === 0,
  );
  verificar(
    `ventana de UN dia: ese dia ya es 100%`,
    fraccionProgramada(d, d, d) === 1,
  );
  verificar(
    `ventana INVERTIDA (fin antes que inicio) es null, no un porcentaje negativo`,
    fraccionProgramada(d, dia(2026, 6, 1), dia(2026, 5, 1)) === null,
  );
  verificar(
    `sin fecha de inicio devuelve null`,
    fraccionProgramada(d, null, dia(2026, 6, 1)) === null,
  );
  verificar(`sin fecha de fin devuelve null`, fraccionProgramada(d, dia(2026, 1, 1), null) === null);
}

// ---------------------------------------------------------------------------
console.log("\n5. SPI: se distingue una obra adelantada de una atrasada");
{
  const ventana = { inicioPlan: dia(2026, 1, 1), finPlan: dia(2026, 1, 31) };
  const hoy = dia(2026, 1, 16); // mitad de la ventana: tocaba el 50%

  const adelantada = compararAvance(
    [fase({ id: "f1", ...ventana, conteos: conteo({ aprobadas: 60, pendientes: 40 }) })],
    hoy,
  );
  verificar(`programado al 50% a mitad de la ventana`, casi(adelantada.programado, 0.5));
  verificar(`ejecutado al 60%`, casi(adelantada.ejecutado, 0.6));
  verificar(`SPI = 0,60 / 0,50 = 1,2`, casi(adelantada.spi, 1.2));
  verificar(`y se lee como obra ADELANTADA`, ritmoDeSPI(adelantada.spi) === "ADELANTADA");

  // CONTROL: mismas fechas, menos trabajo hecho -> el veredicto se invierte.
  const atrasada = compararAvance(
    [fase({ id: "f1", ...ventana, conteos: conteo({ aprobadas: 40, pendientes: 60 }) })],
    hoy,
  );
  verificar(`CONTROL: con 40 aprobadas el SPI baja a 0,8`, casi(atrasada.spi, 0.8));
  verificar(`CONTROL: y se lee como obra ATRASADA`, ritmoDeSPI(atrasada.spi) === "ATRASADA");

  const enPlazo = compararAvance(
    [fase({ id: "f1", ...ventana, conteos: conteo({ aprobadas: 51, pendientes: 49 }) })],
    hoy,
  );
  verificar(
    `1,02 cae en la banda muerta y se lee EN_PLAZO, no adelantada`,
    ritmoDeSPI(enPlazo.spi) === "EN_PLAZO",
  );

  // Antes de que arranque la primera fase el programado es 0: dividir por cero
  // no da «infinitamente adelantada», da una pregunta mal planteada.
  const antes = compararAvance(
    [fase({ id: "f1", ...ventana, conteos: conteo({ pendientes: 100 }) })],
    dia(2025, 12, 1),
  );
  verificar(`con programado 0 el SPI es null, no Infinity`, antes.spi === null);
  verificar(`y el programado sigue siendo 0, que ahi si se sabe`, antes.programado === 0);
  verificar(`indiceDesempenoPlazo(0,5 / 0) es null`, indiceDesempenoPlazo(0.5, 0) === null);
}

// ---------------------------------------------------------------------------
console.log("\n6. SIN CRONOGRAMA: el programado es null y NO cero");
{
  // El caso de TODAS las obras que existen hoy: fases sin ventana planeada.
  const sinPlan = compararAvance(
    [
      fase({ id: "f1", conteos: conteo({ aprobadas: 300, pendientes: 100 }) }),
      fase({ id: "f2", conteos: conteo({ reportadas: 50, pendientes: 150 }) }),
    ],
    dia(2026, 9, 14),
  );
  verificar(`el programado es null`, sinPlan.programado === null);
  verificar(`CONTROL: y NO es cero — un cero diria «no tocaba nada»`, sinPlan.programado !== 0);
  verificar(`el SPI tambien es null`, sinPlan.spi === null);
  verificar(`el ritmo no se puede nombrar`, ritmoDeSPI(sinPlan.spi) === null);
  verificar(
    `pero el EJECUTADO si se calcula: sin cronograma la obra igual avanza`,
    casi(sinPlan.ejecutado, (300 + 50 * 0.8) / 600),
  );
  verificar(`la cobertura dice que ninguna fase tiene ventana`, sinPlan.cobertura.fasesConVentana === 0);
  verificar(`y que las dos fases estan sin ventana`, sinPlan.cobertura.fasesSinVentana === 2);
  verificar(`la cobertura NO es completa`, sinPlan.cobertura.completa === false);
  verificar(
    `la diferencia en puntos tampoco se inventa`,
    diferenciaPuntos(sinPlan.ejecutado, sinPlan.programado) === null,
  );
}

// ---------------------------------------------------------------------------
console.log("\n7. CRONOGRAMA A MEDIAS: el SPI compara peras con peras");
{
  const hoy = dia(2026, 1, 16);
  const c = compararAvance(
    [
      // Con ventana: a mitad de camino tocaba el 50% y va al 50%.
      fase({
        id: "con-ventana",
        inicioPlan: dia(2026, 1, 1),
        finPlan: dia(2026, 1, 31),
        conteos: conteo({ aprobadas: 50, pendientes: 50 }),
      }),
      // Sin ventana y sin empezar: no entra en la comparacion.
      fase({ id: "sin-ventana", conteos: conteo({ pendientes: 100 }) }),
    ],
    hoy,
  );

  verificar(`el ejecutado de TODA la obra es 25% (50 de 200)`, casi(c.ejecutado, 0.25));
  verificar(`el programado cubre solo las 100 tareas con ventana`, casi(c.programado, 0.5));
  verificar(`el ejecutado COMPARABLE es el de esas mismas 100 tareas: 50%`, casi(c.ejecutadoComparable, 0.5));
  verificar(`por lo tanto el SPI es 1,00: la parte planeada va en plazo`, casi(c.spi, 1));

  // CONTROL: el error que este diseño evita es dividir el ejecutado GLOBAL por
  // el programado PARCIAL, que aqui daria 0,50 y un falso «obra atrasada».
  const spiEquivocado = indiceDesempenoPlazo(c.ejecutado, c.programado);
  verificar(
    `CONTROL: usar el ejecutado global daria SPI 0,50 y un falso «atrasada»`,
    casi(spiEquivocado, 0.5) && ritmoDeSPI(spiEquivocado) === "ATRASADA",
  );
  verificar(`el SPI real no es ese`, !casi(c.spi, 0.5));
  verificar(`la cobertura avisa: 100 tareas fuera del cronograma`, c.cobertura.tareasSinVentana === 100);
  verificar(`y 100 dentro`, c.cobertura.tareasConVentana === 100);
  verificar(`la cobertura NO es completa`, c.cobertura.completa === false);
}

// ---------------------------------------------------------------------------
console.log("\n8. Una fase con CERO tareas no revienta ni divide por cero");
{
  verificar(`avanceEjecutado de un conteo vacio es null, no NaN ni 0`, avanceEjecutado(CONTEO_VACIO) === null);
  verificar(`avanceAprobado de un conteo vacio es null`, avanceAprobado(CONTEO_VACIO) === null);

  const hoy = dia(2026, 1, 16);
  const c = compararAvance(
    [
      fase({ id: "vacia", inicioPlan: dia(2026, 1, 1), finPlan: dia(2026, 1, 31) }),
      fase({
        id: "llena",
        inicioPlan: dia(2026, 1, 1),
        finPlan: dia(2026, 1, 31),
        conteos: conteo({ aprobadas: 50, pendientes: 50 }),
      }),
    ],
    hoy,
  );
  verificar(`el programado sale finito`, c.programado !== null && Number.isFinite(c.programado));
  verificar(`la fase vacia pesa 0 y no mueve el programado (50%)`, casi(c.programado, 0.5));
  verificar(`el ejecutado sale finito`, c.ejecutado !== null && Number.isFinite(c.ejecutado));
  verificar(`el SPI sale finito y vale 1,00`, casi(c.spi, 1));
  verificar(`la fase vacia SI cuenta como cronograma cargado`, c.cobertura.fasesConVentana === 2);

  // Obra entera sin una sola tarea: nada de NaN.
  const vacia = compararAvance([fase({ id: "sola" })], hoy);
  verificar(`obra sin tareas: ejecutado null`, vacia.ejecutado === null);
  verificar(`obra sin tareas: programado null`, vacia.programado === null);
  verificar(`obra sin tareas: SPI null`, vacia.spi === null);
  verificar(`obra sin fases: no revienta`, compararAvance([], hoy).ejecutado === null);
}

// ---------------------------------------------------------------------------
console.log("\n9. Tiempo transcurrido, en dias CORRIDOS");
{
  const inicio = dia(2026, 1, 1);
  const fin = dia(2026, 12, 31); // 364 dias corridos de plazo

  const t = tiempoTranscurrido(dia(2026, 7, 1), inicio, fin);
  verificar(`el plazo son 364 dias corridos`, t?.plazoDias === 364);
  verificar(`al 1 de julio han corrido 181 dias`, t?.diasCorridos === 181);
  verificar(`o sea el 50% del plazo`, t !== null && Math.round(t.fraccion * 100) === 50);

  // CONTROL: los dias corridos NO son habiles. 181 dias corridos son ~155
  // habiles en una semana de seis dias; si alguna vez sale eso, se cambio la
  // unidad y el indicador dejo de hablar el idioma del contrato.
  verificar(`CONTROL: 181 corridos, no ~155 habiles`, t?.diasCorridos !== 155);

  const antes = tiempoTranscurrido(dia(2025, 11, 1), inicio, fin);
  verificar(`antes del inicio no hay dias negativos`, antes?.diasCorridos === 0 && antes?.fraccion === 0);

  // Plazo vencido: la fraccion PASA de 1 a proposito. Recortarla al 100%
  // escondería justo lo que hay que ver.
  const vencido = tiempoTranscurrido(dia(2027, 1, 31), inicio, fin);
  verificar(`CONTROL: con el plazo vencido la fraccion pasa de 1`, (vencido?.fraccion ?? 0) > 1);
  verificar(`y son 395 dias corridos sobre 364`, vencido?.diasCorridos === 395);

  verificar(`sin fecha de inicio devuelve null`, tiempoTranscurrido(dia(2026, 7, 1), null, fin) === null);
  verificar(`sin fecha de fin devuelve null`, tiempoTranscurrido(dia(2026, 7, 1), inicio, null) === null);
  verificar(
    `un plazo de cero dias devuelve null en vez de dividir por cero`,
    tiempoTranscurrido(dia(2026, 7, 1), inicio, inicio) === null,
  );
}

// ---------------------------------------------------------------------------
console.log("\n10. Estado de una fase: cerrada / en curso / atrasada");
{
  const todas = conteo({ aprobadas: 100 });
  verificar(`todas aprobadas -> CERRADA`, estadoDeFase(todas, 1, 0.5) === "CERRADA");
  verificar(
    `cerrada aunque no tenga ventana: terminar no depende del plan`,
    estadoDeFase(todas, 1, null) === "CERRADA",
  );

  const aMedias = conteo({ aprobadas: 20, pendientes: 80 });
  verificar(`20% ejecutado contra 80% programado -> ATRASADA`, estadoDeFase(aMedias, 0.2, 0.8) === "ATRASADA");

  // CONTROL de la banda de tolerancia: 2 puntos por debajo NO es atraso,
  // 6 puntos SI. Sin banda, el rojo dejaria de significar algo.
  verificar(`la tolerancia son ${TOLERANCIA_ATRASO_PUNTOS} puntos`, TOLERANCIA_ATRASO_PUNTOS === 5);
  verificar(
    `78% contra 80% (2 pts) sigue siendo EN_CURSO`,
    estadoDeFase(conteo({ aprobadas: 78, pendientes: 22 }), 0.78, 0.8) === "EN_CURSO",
  );
  verificar(
    `CONTROL: 74% contra 80% (6 pts) ya es ATRASADA`,
    estadoDeFase(conteo({ aprobadas: 74, pendientes: 26 }), 0.74, 0.8) === "ATRASADA",
  );

  verificar(
    `sin empezar y sin que tocara empezar -> SIN_EMPEZAR, no ATRASADA`,
    estadoDeFase(conteo({ pendientes: 100 }), 0, 0) === "SIN_EMPEZAR",
  );
  verificar(
    `sin ventana planeada no hay veredicto -> SIN_MEDIDA`,
    estadoDeFase(conteo({ aprobadas: 10, pendientes: 90 }), 0.1, null) === "SIN_MEDIDA",
  );
  verificar(`una fase sin tareas tampoco tiene veredicto`, estadoDeFase(CONTEO_VACIO, null, 0.5) === "SIN_MEDIDA");
}

// ---------------------------------------------------------------------------
console.log("\n11. conteoDesde: lo que devuelve el groupBy por estado");
{
  const c = conteoDesde([
    { estado: "APROBADA", cantidad: 2001 },
    { estado: "REPORTADA", cantidad: 222 },
    { estado: "NO_APROBADA", cantidad: 70 },
    { estado: "PENDIENTE", cantidad: 1817 },
  ]);
  verificar(`reparte los cuatro estados`, c.aprobadas === 2001 && c.reportadas === 222 && c.devueltas === 70 && c.pendientes === 1817);
  verificar(`y suma 4.110`, totalTareas(c) === 4110);
  verificar(`una lista vacia da el conteo vacio`, totalTareas(conteoDesde([])) === 0);
  verificar(
    `CONTROL: las reportadas NO incluyen a las aprobadas`,
    c.reportadas !== c.aprobadas + 222 && c.reportadas === 222,
  );
}

// ---------------------------------------------------------------------------
console.log("\n12. Formato para el informe colombiano");
{
  verificar(`0,4868 -> "49%"`, formatearPorcentaje(0.4868) === "49%");
  verificar(`1 -> "100%"`, formatearPorcentaje(1) === "100%");
  verificar(`1,0812 -> "1,08" (coma decimal)`, formatearSPI(1.0812) === "1,08");
  verificar(`CONTROL: el SPI NO se muestra con punto`, !formatearSPI(1.0812).includes("."));
  verificar(`4110 -> "4.110" (punto de miles)`, formatearMiles(4110) === "4.110");
  verificar(`222 -> "222" (sin separador)`, formatearMiles(222) === "222");
  verificar(`-4,3 puntos -> "−4,3 pts"`, formatearPuntos(-4.3) === "−4,3 pts");
  verificar(`+4,3 puntos -> "+4,3 pts"`, formatearPuntos(4.3) === "+4,3 pts");
  verificar(`0 puntos -> "igual al plan"`, formatearPuntos(0) === "igual al plan");
  verificar(
    `la diferencia se redondea a un decimal`,
    diferenciaPuntos(0.53, 0.612345) === -8.2,
  );
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Avance programado verificado sin errores.");
