/**
 * Verifica la MEDICIÓN de duración (Fase 0 del rediseño del motor): que
 * `RegistroDuracion` capture la predicción del ALGORITMO y la duración REAL, y
 * no —como hasta ahora— el plan del usuario y la latencia de aprobación.
 *
 * SIN BASE DE DATOS: todo se verifica sobre la lógica pura de
 * `src/lib/duraciones-mercado.ts` con datos sintéticos. La captura se prueba
 * inyectando puertos falsos (incluidos puertos que lanzan, para probar que la
 * aprobación de una tarea nunca se rompe). No hay test runner en el proyecto —
 * este script es la suite, en asserts planos.
 *
 * Uso: `npx tsx scripts/verificar-medicion-duracion.ts`. Sale con código 1 si
 * algo falla.
 */
import {
  capturarDuracionAprobada,
  clavePrediccion,
  construirMedicion,
  construirPreRegistro,
  diasDescansoSemana,
  diasHabilesEntre,
  flushPreRegistrosDuracion,
  inicioRealDeTarea,
  predecirDuracionesMotor,
  unidadDeRegistro,
  DIAS_REALES_PENDIENTE,
  type DatosTareaCaptura,
  type MedicionDuracion,
  type PuertosCaptura,
} from "@/lib/duraciones-mercado";
import type { EspacioEstim } from "@/lib/estimar-presupuesto";

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

/** Verifica que una llamada asíncrona NO lance, pase lo que pase. */
async function verificarNoLanza(descripcion: string, fn: () => Promise<unknown>) {
  total++;
  try {
    await fn();
    console.log(`  OK   ${descripcion}`);
  } catch (err) {
    fallos++;
    console.error(`  FAIL ${descripcion} (lanzó: ${String(err)})`);
  }
}

/** Fecha UTC explícita: el cálculo de hábiles es en UTC, así es determinista. */
function utc(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
}

// 2026-01-05 es lunes; 01-10 sábado; 01-11 domingo; 01-12 lunes.
const LUN_5 = utc(2026, 1, 5);
const LUN_12 = utc(2026, 1, 12);
const LUN_19 = utc(2026, 1, 19);
const VIE_9_8AM = utc(2026, 1, 9, 8);
const LUN_12_8AM = utc(2026, 1, 12, 8);
const SAB_10 = utc(2026, 1, 10);

/** Silencia los console.warn defensivos mientras corre `fn`. */
async function sinRuido<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
}

console.log("Medición de duración (Fase 0) — verificación\n");

// ═════════════════════════════════════════════════════════════════════════
console.log("1. La predicción del MOTOR se calcula y llega al registro (dias_motor)");
// ═════════════════════════════════════════════════════════════════════════

// "Pintura de paredes" matchea rendimiento (pintura_final, m2, 38/día, 2 manos);
// "Reunión con el vecino" no matchea ninguno.
const COCINA_10: EspacioEstim = {
  id: "e1",
  nombre: "Cocina",
  metraje: 10,
  tareas: [
    { nombre: "Pintura de paredes", dias: 3, on: true },
    { nombre: "Reunión con el vecino", dias: 4, on: true },
  ],
};
const COCINA_40: EspacioEstim = {
  id: "e2",
  nombre: "Cocina", // MISMO nombre, otro metraje: no deben colapsar
  metraje: 40,
  tareas: [{ nombre: "Pintura de paredes", dias: 3, on: true }],
};

const pred = predecirDuracionesMotor([COCINA_10, COCINA_40]);
const predChica = pred.get(clavePrediccion("e1", "Pintura de paredes"));
const predGrande = pred.get(clavePrediccion("e2", "Pintura de paredes"));
const predSinDato = pred.get(clavePrediccion("e1", "Reunión con el vecino"));

verificar("hay predicción para la tarea con rendimiento", predChica != null);
verificar(
  "dias_motor de la tarea con rendimiento es un número positivo",
  predChica != null && predChica.diasMotor != null && predChica.diasMotor > 0,
);
verificar(
  "la cantidad se guarda en m² de PARED (10 m² de piso × 2.4 = 24)",
  predChica?.cantidad === 24,
);
verificar('la unidad se guarda con el contrato del schema ("m2")', predChica?.unidad === "m2");
verificar('unidadDeRegistro("unidad") → "un"', unidadDeRegistro("unidad") === "un");
verificar('unidadDeRegistro("ml") → "ml"', unidadDeRegistro("ml") === "ml");

verificar(
  "dos espacios HOMÓNIMOS con distinto metraje dan predicciones distintas",
  predGrande != null &&
    predChica != null &&
    predGrande.diasMotor != null &&
    predChica.diasMotor != null &&
    predGrande.diasMotor > predChica.diasMotor,
);
verificar(
  "la cantidad escala con el metraje (40 m² × 2.4 = 96)",
  predGrande?.cantidad === 96,
);

console.log("  Sin rendimiento el motor devuelve los días DEL USUARIO: no es predicción");
verificar(
  "la tarea sin rendimiento tiene dias_motor = null",
  predSinDato != null && predSinDato.diasMotor === null,
);

const preRegistro = construirPreRegistro({
  nombreTarea: "Pintura de paredes",
  faseProyecto: "Reforma",
  diasAcordados: 3,
  metraje: 10,
  ciudad: " Cali ",
  cuadrillas: 1,
  ...(predChica ? { prediccion: predChica } : {}),
});
verificar("construirPreRegistro devuelve una fila con predicción", preRegistro != null);
verificar(
  "dias_motor de la fila === lo que predijo el motor",
  preRegistro?.dias_motor === predChica?.diasMotor,
);
verificar(
  "dias_estimados de la fila === lo que acordó el USUARIO (dato distinto)",
  preRegistro?.dias_estimados === 3,
);
verificar(
  "dias_motor y dias_estimados NO son el mismo número en este caso",
  preRegistro != null && preRegistro.dias_motor !== preRegistro.dias_estimados,
);
verificar("la cantidad viaja a la fila", preRegistro?.cantidad === 24);
verificar("la unidad viaja a la fila", preRegistro?.unidad === "m2");
verificar("las cuadrillas viajan a la fila", preRegistro?.cuadrillas === 1);
verificar("la ciudad se normaliza (trim)", preRegistro?.ciudad === "Cali");
verificar(
  "la fase sale del matcher curado, no de la fase de la obra",
  preRegistro?.fase === "Pintura",
);
verificar(
  "tarea_normalizada es la clave canónica",
  preRegistro?.tarea_normalizada === "pintura de paredes",
);

console.log("  Sin predicción NO se pre-registra (no ensuciar el flywheel)");
verificar(
  "tarea sin rendimiento → construirPreRegistro devuelve null",
  construirPreRegistro({
    nombreTarea: "Reunión con el vecino",
    faseProyecto: "Reforma",
    diasAcordados: 4,
    ...(predSinDato ? { prediccion: predSinDato } : {}),
  }) === null,
);
verificar(
  "sin objeto de predicción → null",
  construirPreRegistro({
    nombreTarea: "Pintura de paredes",
    faseProyecto: "Reforma",
    diasAcordados: 4,
  }) === null,
);
verificar(
  "nombre vacío → null",
  construirPreRegistro({
    nombreTarea: "   ",
    faseProyecto: "Reforma",
    diasAcordados: 4,
    prediccion: { diasMotor: 2, cantidad: 10, unidad: "m2" },
  }) === null,
);
verificar(
  "predicción con dias_motor corrupto (NaN) → null",
  construirPreRegistro({
    nombreTarea: "Pintura de paredes",
    faseProyecto: "Reforma",
    diasAcordados: 4,
    prediccion: { diasMotor: Number.NaN, cantidad: 10, unidad: "m2" },
  }) === null,
);
verificar(
  "predecirDuracionesMotor con lista vacía no lanza y devuelve mapa vacío",
  predecirDuracionesMotor([]).size === 0,
);

console.log("  La clave espacio+tarea es insensible a mayúsculas y tildes");
verificar(
  "clavePrediccion normaliza el nombre de la tarea (misma clave con otra grafía)",
  clavePrediccion("e1", "  PINTURA de Parédes ") === clavePrediccion("e1", "pintura de paredes"),
);
verificar(
  "clavePrediccion distingue espacios distintos",
  clavePrediccion("e1", "Pintura de paredes") !== clavePrediccion("e2", "Pintura de paredes"),
);
verificar(
  "una tarea escrita con otra grafía encuentra su predicción",
  pred.get(clavePrediccion("e1", "PINTURA DE PAREDES")) === predChica,
);

// ═════════════════════════════════════════════════════════════════════════
console.log("\n2. El inicio real sale de la EVIDENCIA; fecha_inicio es respaldo");
// ═════════════════════════════════════════════════════════════════════════

const FIN = utc(2026, 1, 12, 17);
const EV_TEMPRANA = utc(2026, 1, 5, 7, 30);
const EV_TARDIA = utc(2026, 1, 9, 16);

verificar(
  "con evidencias, el inicio es la MÁS ANTIGUA",
  inicioRealDeTarea(LUN_12, [EV_TARDIA, EV_TEMPRANA], FIN)?.getTime() === EV_TEMPRANA.getTime(),
);
verificar(
  "sin evidencias, el inicio es fecha_inicio",
  inicioRealDeTarea(LUN_12, [], FIN)?.getTime() === LUN_12.getTime(),
);
verificar(
  "con evidencias en null/undefined, cae a fecha_inicio",
  inicioRealDeTarea(LUN_12, [null, undefined], FIN)?.getTime() === LUN_12.getTime(),
);
verificar(
  "con la lista de evidencias en null, cae a fecha_inicio",
  inicioRealDeTarea(LUN_12, null, FIN)?.getTime() === LUN_12.getTime(),
);
verificar(
  "sin evidencias y sin fecha_inicio → null",
  inicioRealDeTarea(null, [], FIN) === null,
);
verificar(
  "una fecha inválida en las evidencias se ignora",
  inicioRealDeTarea(LUN_12, [new Date("no-es-fecha"), EV_TARDIA], FIN)?.getTime() ===
    EV_TARDIA.getTime(),
);

console.log("  Relojes de dispositivo corruptos: se descartan, no rompen el registro");
verificar(
  "evidencia POSTERIOR al fin se descarta (reloj adelantado)",
  inicioRealDeTarea(LUN_12, [utc(2027, 5, 1), EV_TARDIA], FIN)?.getTime() === EV_TARDIA.getTime(),
);
verificar(
  "evidencia de hace años se descarta (reloj atrasado)",
  inicioRealDeTarea(LUN_12, [utc(1970, 1, 1), EV_TARDIA], FIN)?.getTime() === EV_TARDIA.getTime(),
);
verificar(
  "si TODAS las evidencias son basura, cae a fecha_inicio",
  inicioRealDeTarea(LUN_12, [utc(1970, 1, 1), utc(2030, 1, 1)], FIN)?.getTime() ===
    LUN_12.getTime(),
);

// ═════════════════════════════════════════════════════════════════════════
console.log("\n3. Días HÁBILES con semana de 6 (Lu–Sá, el default del producto)");
// ═════════════════════════════════════════════════════════════════════════

verificar("semana de 6 → descansa solo el domingo", [...diasDescansoSemana(6)].join() === "0");
verificar(
  "semana de 5 → descansa domingo y sábado",
  [...diasDescansoSemana(5)].sort().join() === "0,6",
);
verificar("semana de 7 → no descansa ningún día", diasDescansoSemana(7).size === 0);
verificar(
  "valores fuera de rango se recortan a [1,7]",
  diasDescansoSemana(0).size === 6 && diasDescansoSemana(99).size === 0,
);
verificar("un dias_habiles_semana corrupto (NaN) cae al default 6", diasDescansoSemana(Number.NaN).size === 1);

verificar("lunes→lunes (7 días calendario) con semana de 6 → 6 hábiles", diasHabilesEntre(LUN_5, LUN_12, 6) === 6);
verificar("lunes→lunes (7 días calendario) con semana de 5 → 5 hábiles", diasHabilesEntre(LUN_5, LUN_12, 5) === 5);
verificar("lunes→lunes (7 días calendario) con semana de 7 → 7 hábiles", diasHabilesEntre(LUN_5, LUN_12, 7) === 7);
// El intervalo 5 → 19 de enero de 2026 contiene el lunes 12: Reyes trasladado
// por la Ley Emiliani. La respuesta de «12 hábiles» era la de un calendario
// ciego a los festivos — el defecto que este módulo existe para no cometer.
// Estos dos asertos ahora PRUEBAN que el festivo se descuenta.
verificar(
  "dos semanas de enero 2026 con semana de 6 → 11 hábiles (lunes 12 es Reyes)",
  diasHabilesEntre(LUN_5, LUN_19, 6) === 11
);
verificar(
  "dos semanas de enero 2026 con semana de 5 → 9 hábiles (lunes 12 es Reyes)",
  diasHabilesEntre(LUN_5, LUN_19, 5) === 9
);
verificar(
  "una semana SIN festivos no cambia: 19 → 26 de enero con semana de 6 → 6 hábiles",
  diasHabilesEntre(LUN_19, utc(2026, 1, 26), 6) === 6
);
verificar(
  "viernes 8am → lunes 8am con semana de 6 → 2 hábiles (se cae el domingo)",
  diasHabilesEntre(VIE_9_8AM, LUN_12_8AM, 6) === 2,
);
verificar(
  "sábado 00:00 → lunes 00:00 con semana de 6 → 1 hábil",
  diasHabilesEntre(SAB_10, LUN_12, 6) === 1,
);
verificar(
  "sábado 00:00 → lunes 00:00 con semana de 5 → 0 hábiles (fin de semana entero)",
  diasHabilesEntre(SAB_10, LUN_12, 5) === 0,
);
verificar("fin anterior al inicio → 0", diasHabilesEntre(LUN_12, LUN_5, 6) === 0);
verificar("mismo instante → 0", diasHabilesEntre(LUN_5, LUN_5, 6) === 0);
verificar(
  "medio día dentro del lunes → 0.5 hábiles",
  diasHabilesEntre(utc(2026, 1, 5, 8), utc(2026, 1, 5, 20), 6) === 0.5,
);
verificar(
  "un domingo entero con semana de 6 → 0 hábiles",
  diasHabilesEntre(utc(2026, 1, 11), utc(2026, 1, 12), 6) === 0,
);

// ═════════════════════════════════════════════════════════════════════════
console.log("\n4. construirMedicion: calendario, hábiles y origen del inicio");
// ═════════════════════════════════════════════════════════════════════════

function datos(over: Partial<DatosTareaCaptura> = {}): DatosTareaCaptura {
  return {
    nombre: "Pintura de paredes",
    diasAcordados: 3,
    fechaInicio: LUN_12,
    fechaFinReal: LUN_12,
    timestampsEvidencia: [],
    faseProyecto: "Reforma",
    metraje: 10,
    ciudad: "Cali",
    diasHabilesSemana: 6,
    proyectoId: "p1",
    constructoraId: "c1",
    ...over,
  };
}

const medida = construirMedicion(
  datos({ fechaInicio: LUN_12, fechaFinReal: LUN_12, timestampsEvidencia: [LUN_5] }),
);
verificar("mide desde la evidencia, no desde fecha_inicio", medida?.dias_reales === 7);
verificar("marca el origen del inicio como 'evidencia'", medida?.origenInicio === "evidencia");
verificar("descuenta el domingo: 7 calendario → 6 hábiles", medida?.dias_reales_habiles === 6);
verificar("dias_reales se conserva en CALENDARIO", medida?.dias_reales === 7);
verificar("los hábiles nunca superan al calendario", (medida?.dias_reales_habiles ?? 0) <= (medida?.dias_reales ?? 0));

console.log("  El caso que hoy contamina la tabla: reportar y aprobar el mismo día");
const soloLatencia = construirMedicion(
  datos({ fechaInicio: utc(2026, 1, 12, 9), fechaFinReal: utc(2026, 1, 12, 15), timestampsEvidencia: [] }),
);
verificar(
  "sin evidencias, reportar→aprobar en 6 h da 0.5 días (latencia, no duración)",
  soloLatencia?.dias_reales === 0.5,
);
verificar("y queda marcado con origen 'fecha_inicio'", soloLatencia?.origenInicio === "fecha_inicio");
const conEvidencia = construirMedicion(
  datos({
    fechaInicio: utc(2026, 1, 12, 9),
    fechaFinReal: utc(2026, 1, 12, 15),
    timestampsEvidencia: [utc(2026, 1, 5, 9)],
  }),
);
verificar(
  "la MISMA tarea con evidencias mide 7 días, no 0.5: el fix hace el trabajo",
  conEvidencia?.dias_reales === 7.3,
);

console.log("  Datos corruptos → null, nunca una fila basura");
verificar("sin fecha de fin → null", construirMedicion(datos({ fechaFinReal: null })) === null);
verificar(
  "fechas invertidas → null",
  construirMedicion(
    datos({ fechaInicio: utc(2026, 2, 1), fechaFinReal: LUN_5, timestampsEvidencia: [] }),
  ) === null,
);
verificar(
  "sin inicio de ningún tipo → null",
  construirMedicion(datos({ fechaInicio: null, timestampsEvidencia: [] })) === null,
);
verificar(
  "duración absurda (> 2 años) → null",
  construirMedicion(
    datos({ fechaInicio: utc(2020, 1, 1), fechaFinReal: utc(2026, 1, 1), timestampsEvidencia: [] }),
  ) === null,
);
verificar(
  "fecha de fin inválida → null",
  construirMedicion(datos({ fechaFinReal: new Date("basura") })) === null,
);
verificar("nombre vacío → null", construirMedicion(datos({ nombre: "  " })) === null);
verificar(
  "metraje corrupto (NaN) se guarda como null, no rompe",
  construirMedicion(datos({ metraje: Number.NaN, timestampsEvidencia: [LUN_5] }))?.metraje === null,
);
verificar(
  "fase de la obra como respaldo cuando el matcher no reconoce la tarea",
  construirMedicion(datos({ nombre: "Reunión con el vecino", timestampsEvidencia: [LUN_5] }))?.fase ===
    "Reforma",
);

// El resto de la verificación es asíncrona. Va dentro de `main()` porque
// tsx compila estos scripts a CJS y ahí no hay top-level await.
async function main() {
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. capturarDuracionAprobada NUNCA lanza (no puede romper la aprobación)");
  // ═════════════════════════════════════════════════════════════════════════

  function puertos(over: Partial<PuertosCaptura> = {}): PuertosCaptura {
    return {
      async leerTarea() {
        return datos({ timestampsEvidencia: [LUN_5] });
      },
      async completarPreRegistro() {
        return true;
      },
      async crearRegistro() {},
      ...over,
    };
  }

  let completados: MedicionDuracion[] = [];
  let creados: MedicionDuracion[] = [];
  const puertosContadores = puertos({
    async completarPreRegistro(_d, m) {
      completados.push(m);
      return true;
    },
    async crearRegistro(_d, m) {
      creados.push(m);
    },
  });

  await capturarDuracionAprobada("t1", puertosContadores);
  verificar("camino feliz: completa el pre-registro existente", completados.length === 1);
  verificar("y NO crea una fila duplicada", creados.length === 0);
  verificar(
    "la medición que se persiste lleva dias_reales_habiles",
    completados[0]?.dias_reales_habiles === 6,
  );

  completados = [];
  creados = [];
  await capturarDuracionAprobada(
    "t1",
    puertos({
      async completarPreRegistro() {
        return false; // obra vieja: no hay pre-registro
      },
      async crearRegistro(_d, m) {
        creados.push(m);
      },
    }),
  );
  verificar("sin pre-registro (obra vieja) crea la fila completa: retrocompatible", creados.length === 1);

  creados = [];
  await capturarDuracionAprobada(
    "t1",
    puertos({
      async leerTarea() {
        return datos({ fechaFinReal: null }); // nada medible
      },
      async crearRegistro(_d, m) {
        creados.push(m);
      },
    }),
  );
  verificar("sin nada medible no escribe ninguna fila", creados.length === 0);

  await sinRuido(async () => {
    await verificarNoLanza("la tabla no existe (leerTarea lanza)", () =>
      capturarDuracionAprobada(
        "t1",
        puertos({
          async leerTarea() {
            throw new Error('relation "registros_duracion" does not exist');
          },
        }),
      ),
    );
    await verificarNoLanza("la escritura del pre-registro lanza", () =>
      capturarDuracionAprobada(
        "t1",
        puertos({
          async completarPreRegistro() {
            throw new Error("connection terminated unexpectedly");
          },
        }),
      ),
    );
    await verificarNoLanza("la creación de la fila lanza", () =>
      capturarDuracionAprobada(
        "t1",
        puertos({
          async completarPreRegistro() {
            return false;
          },
          async crearRegistro() {
            throw new Error("column dias_motor does not exist");
          },
        }),
      ),
    );
    await verificarNoLanza("la tarea no existe (leerTarea devuelve null)", () =>
      capturarDuracionAprobada("t1", puertos({ async leerTarea() { return null; } })),
    );
    await verificarNoLanza("fechas invertidas", () =>
      capturarDuracionAprobada(
        "t1",
        puertos({
          async leerTarea() {
            return datos({
              fechaInicio: utc(2026, 3, 1),
              fechaFinReal: LUN_5,
              timestampsEvidencia: [],
            });
          },
        }),
      ),
    );
    await verificarNoLanza("datos corruptos (fechas y metraje inválidos)", () =>
      capturarDuracionAprobada(
        "t1",
        puertos({
          async leerTarea() {
            return datos({
              fechaInicio: new Date("x"),
              fechaFinReal: new Date("y"),
              timestampsEvidencia: [new Date("z")],
              metraje: Number.NaN,
              diasHabilesSemana: Number.NaN,
            });
          },
        }),
      ),
    );
    await verificarNoLanza("flushPreRegistrosDuracion con lista vacía no toca la base", () =>
      flushPreRegistrosDuracion([], "p1", "c1"),
    );
  });

  verificar(
    "el centinela de fila pendiente es 0 (una duración negativa parecería corrupción)",
    DIAS_REALES_PENDIENTE === 0,
  );

  console.log(`\n${total - fallos}/${total} verificaciones OK`);
  if (fallos > 0) {
    console.error(`${fallos} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log("Medición de duración verificada sin errores.");
}

main().catch((err) => {
  console.error("La verificación falló inesperadamente:", err);
  process.exit(1);
});
