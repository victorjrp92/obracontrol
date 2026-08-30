// ─────────────────────────────────────────────────────────────────────────
// Motor de estimación de DURACIÓN (B2C). DETERMINISTA Y PURO: mismas entradas
// → mismas salidas. No toca DB ni IA (la clasificación IA de tareas no
// reconocidas vive en otra capa; aquí solo matchers deterministas).
//
// Modelo:
//  - días por tarea = cantidad ÷ rendimiento (rendimientos.ts, por cuadrilla
//    de 1 oficial + 1 ayudante), SIN piso por tarea: el trabajo es aditivo y
//    fraccionario (cuatro tareas de 0.2 días son 0.8 días, no 2). Un piso por
//    tarea sesga siempre al alza y castiga al usuario que describe bien su
//    obra; el único piso (1 día) se aplica una sola vez sobre el TOTAL. La
//    cantidad REUSA la lógica del estimador de costos (cantidadPorUnidad de
//    estimar-presupuesto.ts): misma área de pared/piso, mismos defaults.
//  - Pintura/sellador son POR MANO: base 1 mano, final 2 manos, sellador 1.
//  - CRONOGRAMA, no suma de fases. El motor construye un GRAFO de nodos
//    (espacio, tarea) y lo programa (`src/lib/cronograma/`). Es el cambio que
//    arregla el error dominante del análisis: antes la duración de una fase
//    era la SUMA de todas sus tareas en todos los espacios, o sea que no
//    empezaba la pintura de NINGÚN espacio hasta que el último estaba
//    estucado. Una obra real es una LÍNEA DE BALANCE: la cuadrilla estuca el
//    espacio 1, pasa al 2, y el 1 ya está fraguando y puede recibir pintura.
//    La precedencia es POR ESPACIO, no global.
//      · E_fase   — dentro de cada espacio, por el orden de FASES_OBRA.
//      · E_expl   — las de `Tarea.depende_de` (las escribe el usuario; son
//                   las únicas que pueden cerrar un ciclo, y se rechazan).
//      · E_secado — las esperas, como LAG de arista con su retardo.
//    Se calculan dos cosas sobre ese grafo, y la respuesta está entre ellas:
//      · CPM (recursos infinitos)  → cota INFERIOR: ES/EF, holguras y ruta
//        crítica. Ninguna asignación de cuadrillas puede bajar de ahí.
//      · SGS serial (cuadrillas finitas) → la programación REAL, con orden
//        de prioridad derivado del grafo (nivel topológico, desempate por
//        camino restante más largo, luego orden de fase, luego id).
//    Invariante que se verifica en cada corrida de la suite:
//        D_CPM  ≤  D_SGS  ≤  Σ D_t
//  - Cuadrillas con RENDIMIENTOS DECRECIENTES y TOPE DE CONGESTIÓN física:
//    la capacidad del scheduler es c^0.85 cuadrillas-equivalente y en cada
//    espacio caben como mucho área ÷ a_min del oficio, nunca menos de 1.
//    Duplicar cuadrillas acelera ×1.80 como techo, no ×2, y cuatro cuadrillas
//    no caben en un baño de 5 m². Ninguna tarea corre a más de una cuadrilla:
//    las que sobran se van a otras tareas o a otros espacios, y eso es lo que
//    hace que el SGS nunca pueda bajar del suelo del CPM.
//  - ECUACIÓN DE CIERRE: D_obra = f · O_0 + D_ms. UN solo factor de
//    productividad real `f` (absorbe el viejo ×1.4 de «cuadrilla única» y el
//    ×1.2 de «imprevistos», que se multiplicaban dando ×1.68 constante) y UN
//    overhead fijo `O_0` en días de cuadrilla (movilización, compras,
//    replanteo, entrega) que NO escala con el tamaño de la obra ni con las
//    cuadrillas. `D_ms` es el makespan del SGS sobre duraciones YA estiradas
//    por `f` y lags de secado SIN estirar: es la misma ecuación de siempre,
//    D = f·(O_0 + D_trabajo) + Λ_ef, con la diferencia de que ahora Λ_ef no
//    es una fórmula cerrada de absorción sino lo que el scheduler MIDE.
//  - Buffers de secado como LAGS DE ARISTA, no como sumandos: el secado no es
//    trabajo de nadie, es una arista con retardo entre dos tareas.
//    Dos consecuencias, y las dos cambian el número:
//      (a) UNIDADES. La espera se mide en días CALENDARIO (el mortero fragua
//          también el domingo y el 25 de diciembre) y el total de la obra en
//          días HÁBILES. Sumarlos crudos cobra cada día de secado como un día
//          de trabajo perdido. La conversión es Λ_hábiles = ρ · Λ_calendario,
//          con ρ = hábiles/365 de `calendario-colombia.ts` (≈0.81 con semana
//          de seis días y los 18 festivos). Corrige un sesgo del ~20%.
//      (b) ABSORCIÓN. Un lag solo empuja la fecha si NADIE puede trabajar
//          mientras tanto. Mientras el estuco del baño 1 fragua, la cuadrilla
//          estuca el baño 2: la espera se tapa con CUALQUIER trabajo que el
//          grafo deje disponible, no solo con el de la misma fase. En una
//          casa de diez espacios el secado desaparece del camino crítico; en
//          un baño único no hay dónde ir y empuja entero. El fragüe de placa
//          es la excepción: es la misma losa en toda la obra, así que su lag
//          va de TODAS las placas a todo lo que se cargue encima —en
//          cualquier espacio— y no lo tapa nadie.
//    pañete→estuco 2–3 días de fragüe, estuco→pintura ~1 día por mano,
//    placa→carga 7–14.
//  - Fases PARALELAS (ramas de la línea de tiempo): eléctricas ∥
//    hidrosanitarias y carpintería ∥ cocina/closets — oficios distintos que en
//    la práctica son personas/talleres distintos. En el grafo comparten NIVEL
//    dentro del espacio (no se preceden) y en el scheduler tienen POOL de
//    recursos propio, así que se solapan aun con una sola cuadrilla general.
//
// CALIBRACIÓN DE CORDURA (verificada contra duraciones típicas Colombia).
// Los CUATRO casos están DENTRO de banda; los corre en cada ejecución
// `npx tsx scripts/verificar-duracion-calibracion.ts`, que además rehace el
// barrido de (O_0, f) y falla si los valores fijados dejan de ser los mejores:
//  - Baño integral (≈5 m²):        7–15 días
//  - Cocina media (≈9 m²):        10–20 días
//  - Apto completo (≈60 m²):      60–70 días
//  - Casa completa (≈120 m²):    100–120 días
// Si el motor devuelve algo absurdo frente a esta tabla, revisar factores.
// ─────────────────────────────────────────────────────────────────────────

import {
  areaTipica,
  cantidadPorUnidad,
  distribuirAreaTotal,
  type EspacioEstim,
} from "./estimar-presupuesto";
import {
  aMinDe,
  buscarRendimiento,
  BUFFER_FRAGUE_PANETE,
  BUFFER_FRAGUE_PLACA,
  BUFFER_SECADO_POR_MANO,
  EXPONENTE_CUADRILLAS,
  FACTOR_PRODUCTIVIDAD_REAL,
  OVERHEAD_FIJO_CD,
  RENDIMIENTOS,
} from "./rendimientos";
import { FASES_OBRA, faseDeTarea, normalizarFase, type FaseObra } from "./fases-obra";
import { DIAS_HABILES_SEMANA_DEFECTO, rho } from "./calendario-colombia";
import {
  calcularCPM,
  construirGrafo,
  distribucionCerrada,
  grafoFijado,
  GREMIO_GENERAL,
  momentosPert,
  PRIOR_SIGMA_COMUN,
  programarSerial,
  rangoAjustado,
  simularDuracion,
  type AristaCronograma,
  type DistribucionDuracion,
  type EntradaNodo,
  type Grafo,
  type NodoCronograma,
  type ResultadoMonteCarlo,
  type ResultadoSGS,
  type TrianguloPERT,
} from "./cronograma";

// Contrato público del motor: se re-exporta lo que el front necesita.
export { faseDeTarea, FASES_OBRA, type FaseObra } from "./fases-obra";
export type { EspacioEstim, TareaEstim } from "./estimar-presupuesto";
export {
  fechaCorta,
  fechaLarga,
  fechaUTCDesde,
  percentil,
  probabilidadHasta,
  pronosticoFechas,
  PRIOR_SIGMA_COMUN,
  type DistribucionDuracion,
  type PronosticoFechas,
  type ResultadoMonteCarlo,
} from "./cronograma";

/** Fase de agrupación: las curadas + "Otros" para lo no clasificable. */
export type FaseDuracionNombre = FaseObra | "Otros";
export const FASE_OTROS = "Otros" as const;

export interface OpcionesDuracion {
  /** Cuadrillas trabajando en paralelo dentro de una fase. Default 1. */
  cuadrillas?: number;
  /**
   * Factor de productividad real `f` (valor PROBABLE). Default
   * `FACTOR_PRODUCTIVIDAD_REAL.probable`. La banda min/max se reescala en la
   * misma proporción. Sustituye al viejo `imprevistosPct`: era el segundo
   * factor de un producto que ya no existe.
   */
  factorProductividad?: number;
  /**
   * Overhead fijo `O_0` en días de cuadrilla (valor PROBABLE). Default
   * `OVERHEAD_FIJO_CD.probable`. Existe para poder BARRER la calibración
   * desde el script de verificación sin tocar las constantes.
   */
  overheadDias?: number;
  /** Incluir buffers de secado/fragüe como esperas. Default true. */
  incluirEsperas?: boolean;
  /**
   * Jornada del proyecto (`dias_habiles_semana`: 1–7). Default 6 — la
   * construcción colombiana trabaja Lu–Sá. Solo entra en el factor ρ, que
   * traduce las esperas de secado de días calendario a días hábiles: con
   * semana de 5 días el calendario gasta hábiles más despacio (ρ ≈ 0.67) y el
   * mismo fragüe cuesta menos días de obra.
   */
  diasHabilesSemana?: number;
  /** m² de toda la obra (se reparte igual que en estimar-presupuesto). */
  areaTotal?: number;
  /**
   * σ_K del factor común de la distribución. Default `PRIOR_SIGMA_COMUN`
   * (0.25). Se expone para poder BARRERLO desde los scripts de verificación
   * —el caso σ_K = 0 aísla el término idiosincrático y deja ver que decae
   * como 1/N— no para que el producto lo toque.
   */
  sigmaComun?: number;
  /**
   * Enciende el MONTE CARLO. `semilla` es el texto del que se deriva el
   * generador (el id del proyecto): misma semilla, misma salida SIEMPRE.
   * Sin esto la distribución sale de la forma cerrada, que es exacta salvo
   * por el sesgo de fusión y cuesta cero.
   */
  montecarlo?: { semilla: string; iteraciones?: number };
}

export interface TareaDuracion {
  /** Id del nodo en el grafo del cronograma. Determinista y estable. */
  id: string;
  nombre: string;
  espacio: string;
  fase: FaseDuracionNombre;
  /** Días de trabajo probables de la tarea, fraccionarios (sin factores
   *  globales y SIN piso: 0.2 días es 0.2 días). */
  dias: number;
  /** Clave de rendimiento usada; null si se cayó a los días acordados. */
  key: string | null;
  /** true si hubo rendimiento investigado; false = fallback (días del usuario). */
  conDato: boolean;
  /** Día de la obra en que arranca, según el SGS (0 = primer día de obra). */
  inicioDias: number;
  /** Día de la obra en que termina, según el SGS. */
  finDias: number;
  /** Holgura total del CPM: días que puede retrasarse sin mover la entrega. */
  holguraDias: number;
  /** true si está en el camino crítico (holgura cero). */
  critico: boolean;
}

export interface FaseDuracion {
  fase: FaseDuracionNombre;
  /**
   * Días hábiles PROBABLES de TRABAJO de la fase (con `f` ya aplicado). Es la
   * carga de trabajo, no la franja de calendario que ocupa: desde que la
   * precedencia es por espacio, dos fases pueden solaparse, así que la suma
   * de estos números YA NO es la duración de la obra. La franja es
   * [`inicioDias`, `finDias`].
   */
  dias: number;
  diasMin: number;
  diasMax: number;
  /** Día de la obra en que arranca la primera tarea de la fase. */
  inicioDias: number;
  /** Día de la obra en que termina la última tarea de la fase. */
  finDias: number;
  /**
   * Espera de secado/fragüe CRUDA (días CALENDARIO, probable) ANTES/DENTRO de
   * la fase. A diferencia de `dias`, va SIN `f`: el secado consume calendario,
   * no cuadrilla, y no lo acelera ni lo frena la productividad del equipo.
   * Es lo que hay que DIBUJAR (la banda de espera de la línea de tiempo); lo
   * que se SUMA al total es `esperaEfectivaDias`.
   */
  esperaDias: number;
  /**
   * Lo que esa espera aporta REALMENTE al total, en días HÁBILES. Ya no es
   * una fórmula cerrada de absorción: es lo que el SGS MIDE, encendiendo las
   * esperas de una en una en orden constructivo y anotando cuánto se alarga
   * el makespan con cada una. Por eso Σ(esperaEfectivaDias) = Λ_ef exacto.
   *
   * Vale 0 en cuanto la obra tiene frente de trabajo suficiente —una casa de
   * diez espacios absorbe sus cuatro días de secado sin mover la fecha— y vale
   * ρ·`esperaDias` en un espacio único, donde no hay a dónde mandar la
   * cuadrilla. `esperaDias` NO suma al total.
   */
  esperaEfectivaDias: number;
  tareas: TareaDuracion[];
  /** Fases presentes que corren en paralelo con esta (ramas de la línea de tiempo). */
  enParaleloCon: FaseDuracionNombre[];
}

/**
 * Las tres cifras del cronograma, en días de obra (con `f` aplicado) y sin el
 * overhead fijo. El invariante `cpmDias ≤ sgsDias ≤ sumaDias` no es un
 * adorno: el CPM solo puede subestimar (cuadrillas infinitas) y la suma solo
 * puede sobreestimar (nada se solapa). Si se rompe, el scheduler está mal.
 */
export interface ResumenCronograma {
  /** Cota INFERIOR: camino crítico con recursos infinitos. */
  cpmDias: number;
  /** La programación REAL con las cuadrillas dadas. Es la que manda. */
  sgsDias: number;
  /** Cota SUPERIOR: Σ de duraciones + Σ de esperas, sin solapar nada. */
  sumaDias: number;
  /** Λ_ef: los días del makespan que son SOLO espera de secado. */
  esperaEfectivaDias: number;
  nodos: number;
  aristas: number;
  /** Aristas explícitas descartadas por cerrar un ciclo. */
  aristasRechazadas: number;
  /** Ids (`TareaDuracion.id`) del camino crítico, en orden de ejecución. */
  rutaCritica: string[];
  /**
   * La CADENA CRÍTICA DE RECURSOS: el camino crítico sobre el grafo con el
   * reparto de cuadrillas ya congelado en arcos (`grafoFijado`). Es más larga
   * que `rutaCritica` —que supone cuadrillas infinitas— y es la que manda para
   * la incertidumbre: con una cuadrilla, 288 tareas se hacen una detrás de
   * otra y las 288 aportan varianza.
   */
  cadenaRecursos: string[];
}

export interface ResultadoDuracion {
  /**
   * ⚠️ CIFRA INTERNA, no contrato de interfaz. `probable` es E[D]: el centro
   * calibrado que validan los cuatro casos patrón, y sigue siendo la entrada
   * de la distribución. `min`/`max` son los dos escenarios COMONOTÓNICOS del
   * motor viejo —todas las tareas rápidas a la vez, todas lentas a la vez— y
   * NO son percentiles de nada: suponen correlación perfecta, por eso su
   * ancho relativo salía plano (~74–100%) tuviera la obra 9 tareas o 288.
   * Se conservan porque son los escenarios que el scheduler corre para medir
   * Λ_ef y porque la suite de calibración los imprime. **Lo que se le enseña
   * al usuario es `probabilidad`, y una FECHA, nunca estos números.**
   */
  totalDias: { probable: number; min: number; max: number };
  /**
   * EL CONTRATO NUEVO: la duración como variable aleatoria, con percentiles
   * de verdad. Sustituye a `totalDias` en toda la interfaz.
   * `pronosticoFechas(probabilidad, { inicio })` la convierte en fechas.
   */
  probabilidad: DistribucionDuracion;
  /**
   * Detalle de la simulación, solo si se pidió `opts.montecarlo`. Trae el
   * sesgo de fusión medido y los percentiles empíricos.
   */
  montecarlo?: ResultadoMonteCarlo;
  /**
   * Overhead fijo de la obra en días PROBABLES (`f · O_0`), ya incluido en
   * `totalDias`: movilización, compras, replanteo y entrega. Va aparte de las
   * fases porque no es trabajo de ninguna — es el costo de abrir y cerrar la
   * obra. Ocupa la franja [0, `overheadDias`) de la línea de tiempo, antes de
   * que arranque la primera tarea.
   */
  overheadDias: number;
  /** Fases en orden constructivo, con lo que el front necesita para el
   *  contra-pronóstico y la línea de balance. */
  fases: FaseDuracion[];
  /** Las tres cifras del cronograma y su camino crítico. */
  cronograma: ResumenCronograma;
  /** Fracción 0–1 de tareas con rendimiento investigado. */
  cobertura: number;
  /** # de tareas estimadas con fallback (días acordados del usuario). */
  sinDato: number;
}

// Parejas de fases que corren en PARALELO cuando ambas existen: oficios
// distintos (electricista/plomero; taller de carpintería/cocinas) que no
// compiten por la cuadrilla general.
const PARES_PARALELOS: [FaseObra, FaseObra][] = [
  ["Instalaciones eléctricas", "Instalaciones hidrosanitarias"],
  ["Carpintería/Madera", "Cocina/Closets"],
];

interface Escenario {
  min: number;
  probable: number;
  max: number;
}

type ClaveEscenario = keyof Escenario;
const ESCENARIOS: ClaveEscenario[] = ["min", "probable", "max"];

/** Etiqueta de una espera: identifica su lag para encenderlo o apagarlo. */
type EtiquetaEspera = "frague_placa" | "frague_panete" | "secado_pintura";

interface DeclaracionEspera {
  etiqueta: EtiquetaEspera;
  /** Fase a la que se anota (la que ESPERA). */
  fase: FaseDuracionNombre;
  /** Días CALENDARIO: lo que se dibuja. */
  calendario: Escenario;
  /** Días HÁBILES (ρ · calendario): el lag real de la arista. */
  habiles: Escenario;
}

/**
 * Redondeo de presentación (2 decimales). NO lleva piso: un piso por tarea
 * nunca compensa hacia abajo, así que sesga sistemáticamente al alza y crece
 * con el número de tareas. El piso de la obra se aplica UNA sola vez, sobre
 * el total, al final de `estimarDuracion`.
 */
function redondear(d: number): number {
  return Math.round(d * 100) / 100;
}

/**
 * Reescala una banda (min, probable, max) a un nuevo valor probable
 * conservando las proporciones. Sirve para que las opciones de calibración
 * (`factorProductividad`, `overheadDias`) muevan la banda entera y no solo el
 * centro, sin tener que exponer tres números al llamador.
 */
function bandaEn(base: Escenario, probable?: number): Escenario {
  if (!Number.isFinite(probable) || probable! < 0 || base.probable <= 0) return base;
  const k = probable! / base.probable;
  return { min: base.min * k, probable: probable!, max: base.max * k };
}

/** Orden constructivo: 0 = "Otros" (abre la obra), luego FASES_OBRA. */
const ORDEN_FASES: FaseDuracionNombre[] = [FASE_OTROS, ...FASES_OBRA];

/**
 * Orden constructivo de una tarea por su nombre (y por su fase, si el llamador
 * ya la conoce). Es la misma clasificación con la que el motor construye
 * `E_fase`, expuesta para que quien PERSISTE la obra escriba
 * `Tarea.depende_de` con exactamente el mismo criterio.
 */
export function ordenConstructivoDeTarea(nombre: string, fase?: string | null): number {
  const f: FaseDuracionNombre =
    (fase ? normalizarFase(fase) : null) ?? faseDeTarea(nombre) ?? FASE_OTROS;
  const i = ORDEN_FASES.indexOf(f);
  return i >= 0 ? i : 0;
}

/**
 * Estima la duración de la obra a partir de los espacios y sus tareas activas
 * (misma entrada `EspacioEstim` que el estimador de costos).
 */
export function estimarDuracion(
  espaciosEntrada: EspacioEstim[],
  opts: OpcionesDuracion = {},
): ResultadoDuracion {
  const cuadrillasPedidas = Math.max(1, Math.round(opts.cuadrillas ?? 1));
  // `f = 0` no es una obra instantánea, es un error de llamador: se ignora.
  // `O_0 = 0` sí es legítimo (obra sin overhead) y el barrido lo usa.
  const fPedido = opts.factorProductividad;
  const f = bandaEn(FACTOR_PRODUCTIVIDAD_REAL, fPedido && fPedido > 0 ? fPedido : undefined);
  const overhead = bandaEn(OVERHEAD_FIJO_CD, opts.overheadDias);
  const conEsperas = opts.incluirEsperas !== false;
  // ρ = días hábiles ÷ días calendario de la jornada del proyecto. Es el único
  // punto donde el motor mira el calendario colombiano, y lo hace a través de
  // una constante derivada (no lee el reloj): sigue siendo puro y determinista.
  const rhoObra = rho(opts.diasHabilesSemana ?? DIAS_HABILES_SEMANA_DEFECTO);

  const espacios =
    opts.areaTotal && opts.areaTotal > 0
      ? distribuirAreaTotal(espaciosEntrada, opts.areaTotal)
      : espaciosEntrada;

  // ── 1. Días por tarea (cantidad ÷ rendimiento; sin piso por tarea) ────────
  interface TareaCalc {
    id: string;
    nombre: string;
    espacio: string;
    fase: FaseDuracionNombre;
    key: string | null;
    conDato: boolean;
    esc: Escenario; // min = cuadrilla rápida, max = cuadrilla lenta
    /** Id del espacio: dos espacios pueden llamarse igual ("Baño"). */
    espacioId: string;
    /** Cuadrillas del oficio que CABEN sobre esta tarea: área ÷ a_min. */
    capTarea: number;
    /** Id que declara el llamador (el que referencia `dependeDe`). */
    idExterno?: string;
    /** `depende_de` del usuario, si lo trae la entrada. */
    dependeDe?: string;
  }
  const tareas: TareaCalc[] = [];
  const keysPresentes = new Set<string>();
  /** Cuadrillas que caben SIMULTÁNEAMENTE en cada espacio (tope de congestión). */
  const capPorEspacio = new Map<string, number>();

  for (const esp of espacios) {
    // Área de piso del espacio: la misma que usa el estimador de cantidades,
    // así que el tope de congestión y el trabajo hablan de la misma obra.
    const areaEsp = esp.metraje && esp.metraje > 0 ? esp.metraje : areaTipica(esp.nombre);
    for (const t of esp.tareas) {
      if (!t.on) continue;
      const fase: FaseDuracionNombre =
        (t.fase ? normalizarFase(t.fase) : null) ?? faseDeTarea(t.nombre) ?? FASE_OTROS;

      const comun = {
        id: `n${tareas.length}`,
        nombre: t.nombre,
        espacio: esp.nombre,
        fase,
        espacioId: esp.id,
        ...(t.id ? { idExterno: t.id } : {}),
        ...(t.dependeDe ? { dependeDe: t.dependeDe } : {}),
      };
      const r = buscarRendimiento(t.nombre);
      if (r) {
        keysPresentes.add(r.key);
        const cantidad = cantidadPorUnidad(r.key, r.unidad, esp);
        const manos = r.porMano ? r.manosDefault ?? 1 : 1;
        const trabajo = cantidad * manos;
        tareas.push({
          ...comun,
          key: r.key,
          conDato: true,
          esc: { min: trabajo / r.max, probable: trabajo / r.porDia, max: trabajo / r.min },
          capTarea: areaEsp / aMinDe(r.key),
        });
      } else {
        // Fallback: sin rendimiento investigado → días acordados del usuario
        // (o 1 día), con rango ±(30/50)% marcado como menos confiable.
        const dias = t.dias > 0 ? t.dias : 1;
        tareas.push({
          ...comun,
          key: null,
          conDato: false,
          esc: { min: dias * 0.7, probable: dias, max: dias * 1.5 },
          capTarea: areaEsp / aMinDe(null),
        });
      }
      // Tope de congestión del ESPACIO: el menos restrictivo de los oficios
      // que trabajan ahí, y nunca por debajo de 1 (en 5 m² siempre cabe una
      // cuadrilla, y nunca una segunda).
      const ultima = tareas[tareas.length - 1];
      capPorEspacio.set(esp.id, Math.max(capPorEspacio.get(esp.id) ?? 1, ultima.capTarea, 1));
    }
  }

  if (tareas.length === 0) {
    // Sin trabajo no hay obra: tampoco se paga el overhead de abrirla.
    return {
      totalDias: { probable: 0, min: 0, max: 0 },
      probabilidad: distribucionCerrada({
        media: 0,
        sigmaIdiosincratico: 0,
        sigmaComun: opts.sigmaComun ?? PRIOR_SIGMA_COMUN,
        cobertura: 0,
        tareasEnCadena: 0,
      }),
      overheadDias: 0,
      fases: [],
      cronograma: {
        cpmDias: 0,
        sgsDias: 0,
        sumaDias: 0,
        esperaEfectivaDias: 0,
        nodos: 0,
        aristas: 0,
        aristasRechazadas: 0,
        rutaCritica: [],
        cadenaRecursos: [],
      },
      cobertura: 0,
      sinDato: 0,
    };
  }

  // ── 2. Agrupar por fase en orden constructivo ("Otros" ABRE la obra) ──────
  // "Otros" es lo que ningún matcher clasificó. En la práctica es trabajo de
  // preparación (retiros, adecuaciones, tareas que el usuario escribe a mano),
  // así que va PRIMERO: agendarlo en posición 10 de 12 programaba la demolición
  // después de instalar la grifería.
  const porFase = new Map<FaseDuracionNombre, TareaCalc[]>();
  for (const t of tareas) {
    const lista = porFase.get(t.fase) ?? [];
    lista.push(t);
    porFase.set(t.fase, lista);
  }
  const fasesPresentes = ORDEN_FASES.filter((fa) => porFase.has(fa));

  // Parejas de fases que se solapan: comparten NIVEL dentro del espacio (no se
  // preceden) y tienen POOL de recursos propio en el scheduler, que es lo que
  // las hace correr a la vez aunque la obra tenga una sola cuadrilla general.
  const paraleloDe = new Map<FaseDuracionNombre, FaseDuracionNombre>();
  for (const [a, b] of PARES_PARALELOS) {
    if (porFase.has(a) && porFase.has(b)) {
      paraleloDe.set(a, b);
      paraleloDe.set(b, a);
    }
  }
  /** Orden constructivo de la fase, con las parejas paralelas fundidas en uno. */
  const ordenDeFase = (fa: FaseDuracionNombre): number => {
    const propio = ORDEN_FASES.indexOf(fa);
    const par = paraleloDe.get(fa);
    return par ? Math.min(propio, ORDEN_FASES.indexOf(par)) : propio;
  };
  /** Pool de recursos: los oficios de una pareja paralela tienen el suyo. */
  const gremioDeFase = (fa: FaseDuracionNombre): string =>
    paraleloDe.has(fa) ? `oficio:${fa}` : GREMIO_GENERAL;

  // ── 3. Esperas de secado/fragüe: DECLARACIONES ───────────────────────────
  // Cada una se anota a la fase que debe ESPERAR (es lo que se dibuja) y se
  // convierte a días hábiles con ρ (es lo que cuesta). Dónde se ENGANCHA cada
  // una en el grafo es dominio puro y se resuelve en el paso 4:
  //  · secado_pintura — entre la fase anterior y la pintura, POR ESPACIO.
  //  · frague_panete  — del pañete al estuco, DENTRO del mismo espacio.
  //  · frague_placa   — de TODAS las placas a todo lo que se cargue encima,
  //    en cualquier espacio: la losa es una sola en toda la obra y no hay
  //    «otro espacio» donde cargar mientras cura. Por eso no la tapa nadie.
  const declaraciones: DeclaracionEspera[] = [];
  const declarar = (
    etiqueta: EtiquetaEspera,
    fase: FaseDuracionNombre,
    calendario: Escenario,
  ): void => {
    declaraciones.push({
      etiqueta,
      fase,
      calendario,
      habiles: {
        min: rhoObra * calendario.min,
        probable: rhoObra * calendario.probable,
        max: rhoObra * calendario.max,
      },
    });
  };

  if (conEsperas) {
    const hayPanete = keysPresentes.has("panete");
    const hayEstuco = keysPresentes.has("estuco_pared") || keysPresentes.has("estuco_techo");

    // Placa → siguiente fase presente: fragüe de 7–14 días antes de cargarla.
    if (keysPresentes.has("placa")) {
      const idxGris = fasesPresentes.indexOf("Obra gris/Estructura");
      const siguiente = idxGris >= 0 ? fasesPresentes[idxGris + 1] : undefined;
      if (siguiente) declarar("frague_placa", siguiente, BUFFER_FRAGUE_PLACA);
    }

    // Pañete → estuco: fragüe de 2–3 días DENTRO de Repello/Estuco.
    if (hayPanete && hayEstuco && porFase.has("Repello/Estuco")) {
      declarar("frague_panete", "Repello/Estuco", BUFFER_FRAGUE_PANETE);
    }

    // Estuco/repello → pintura: ~1 día de secado POR MANO (antes de la primera
    // y entre manos). Manos según las claves de pintura presentes; si la fase
    // Pintura existe sin clave reconocida, asumimos 2 manos.
    if (porFase.has("Pintura") && (hayPanete || hayEstuco)) {
      let manos = 0;
      for (const key of ["pintura_base", "pintura_final", "sellador"]) {
        if (keysPresentes.has(key)) manos += RENDIMIENTOS[key].manosDefault ?? 1;
      }
      if (manos === 0) manos = 2;
      declarar("secado_pintura", "Pintura", {
        min: manos * BUFFER_SECADO_POR_MANO.min,
        probable: manos * BUFFER_SECADO_POR_MANO.probable,
        max: manos * BUFFER_SECADO_POR_MANO.max,
      });
    }
    // En orden constructivo, para que el reparto incremental de Λ_ef entre
    // fases (paso 5) sea el mismo pasada tras pasada.
    declaraciones.sort((a, b) => ordenDeFase(a.fase) - ordenDeFase(b.fase));
  }

  const lagPorEtiqueta = new Map<string, Escenario>(
    declaraciones.map((d) => [d.etiqueta as string, d.habiles]),
  );

  // ── 4. El GRAFO: nodos (espacio, tarea) y las tres familias de aristas ────
  const secadoPintura = declaraciones.find((d) => d.etiqueta === "secado_pintura");
  const nodos: EntradaNodo[] = tareas.map((t) => ({
    id: t.id,
    espacioId: t.espacioId,
    nombre: t.nombre,
    fase: t.fase,
    ordenFase: ordenDeFase(t.fase),
    // La duración del nodo es la PROBABLE cruda: el escenario y `f` entran
    // como función de duración en cada corrida del scheduler, para no tener
    // que reconstruir el grafo una vez por escenario.
    duracion: t.esc.probable,
    gremio: gremioDeFase(t.fase),
    capEspacio: capPorEspacio.get(t.espacioId) ?? 1,
    ...(secadoPintura && t.fase === secadoPintura.fase
      ? { lagEntrada: secadoPintura.habiles.probable, esperaEntrada: "secado_pintura" }
      : {}),
  }));

  const extra: AristaCronograma[] = [];
  // Pañete → estuco, dentro de cada espacio.
  const lagPanete = lagPorEtiqueta.get("frague_panete");
  if (lagPanete) {
    for (const u of tareas) {
      if (u.key !== "panete") continue;
      for (const v of tareas) {
        if (v.espacioId !== u.espacioId) continue;
        if (v.key !== "estuco_pared" && v.key !== "estuco_techo") continue;
        extra.push({
          desde: u.id,
          hasta: v.id,
          lag: lagPanete.probable,
          tipo: "secado",
          espera: "frague_panete",
        });
      }
    }
  }
  // Placa → lo primero que se cargue encima, en CUALQUIER espacio.
  const lagPlaca = lagPorEtiqueta.get("frague_placa");
  if (lagPlaca) {
    const ordenGris = ORDEN_FASES.indexOf("Obra gris/Estructura");
    // Primer nivel posterior a la obra gris, espacio por espacio.
    const primerNivelTrasGris = new Map<string, number>();
    for (const t of tareas) {
      const o = ordenDeFase(t.fase);
      if (o <= ordenGris) continue;
      const previo = primerNivelTrasGris.get(t.espacioId);
      if (previo === undefined || o < previo) primerNivelTrasGris.set(t.espacioId, o);
    }
    for (const u of tareas) {
      if (u.key !== "placa") continue;
      for (const v of tareas) {
        if (ordenDeFase(v.fase) !== primerNivelTrasGris.get(v.espacioId)) continue;
        extra.push({
          desde: u.id,
          hasta: v.id,
          lag: lagPlaca.probable,
          tipo: "secado",
          espera: "frague_placa",
        });
      }
    }
  }

  // `depende_de`: el campo que llevaba meses muerto en el esquema. Se traduce
  // del id EXTERNO del llamador al id de nodo; lo que no se reconoce se ignora
  // y lo que cierra un ciclo lo rechaza el constructor del grafo.
  const porIdExterno = new Map<string, string>();
  for (const t of tareas) if (t.idExterno) porIdExterno.set(t.idExterno, t.id);
  const explicitas: { desde: string; hasta: string }[] = [];
  for (const t of tareas) {
    if (!t.dependeDe) continue;
    const desde = porIdExterno.get(t.dependeDe);
    if (desde) explicitas.push({ desde, hasta: t.id });
  }

  const grafo: Grafo = construirGrafo({ nodos, extra, explicitas });

  // ── 5. CPM (cota inferior) y SGS (la programación real) ──────────────────
  const porNodo = new Map(tareas.map((t) => [t.id, t]));
  const duracionDe =
    (sc: ClaveEscenario) =>
    (n: NodoCronograma): number =>
      f[sc] * (porNodo.get(n.id)?.esc[sc] ?? 0);
  /** Lag de una arista en el escenario `sc`, con solo las esperas `activas`. */
  const lagDe =
    (sc: ClaveEscenario, activas: Set<string>) =>
    (a: AristaCronograma): number =>
      a.espera && activas.has(a.espera) ? lagPorEtiqueta.get(a.espera)?.[sc] ?? 0 : 0;
  const SIN_ESPERAS = new Set<string>();
  const TODAS = new Set<string>(declaraciones.map((d) => d.etiqueta as string));
  // El scheduler reparte c^0.85 cuadrillas-equivalente: continuo en c = 1
  // (vale 1) y sub-lineal (×2 → ×1.80). El tope físico por espacio vive en el
  // nodo (`capEspacio`), no aquí.
  const capacidad = Math.pow(cuadrillasPedidas, EXPONENTE_CUADRILLAS);

  // Λ_ef POR FASE, MEDIDO: se encienden las esperas de una en una en orden
  // constructivo y se anota cuánto se alarga el makespan con cada una. Es lo
  // que sustituye a la vieja fórmula cerrada de absorción, y por construcción
  // Σ(incrementos) = makespan(con todas) − makespan(sin ninguna).
  const incremento = new Map<string, Escenario>();
  for (const d of declaraciones) {
    incremento.set(d.etiqueta as string, { min: 0, probable: 0, max: 0 });
  }
  const makespan: Escenario = { min: 0, probable: 0, max: 0 };
  const makespanSinEsperas: Escenario = { min: 0, probable: 0, max: 0 };
  let programacion: ResultadoSGS | null = null;

  for (const sc of ESCENARIOS) {
    let ultima = programarSerial(grafo, {
      capacidad,
      duracion: duracionDe(sc),
      lag: lagDe(sc, SIN_ESPERAS),
    });
    makespanSinEsperas[sc] = ultima.makespan;
    let previo = ultima.makespan;
    const activas = new Set<string>();
    for (const d of declaraciones) {
      activas.add(d.etiqueta as string);
      ultima = programarSerial(grafo, {
        capacidad,
        duracion: duracionDe(sc),
        lag: lagDe(sc, new Set(activas)),
      });
      // Encender una espera no puede acortar la obra; el `max(0, …)` solo
      // limpia el ruido de coma flotante.
      incremento.get(d.etiqueta as string)![sc] = Math.max(0, ultima.makespan - previo);
      previo = ultima.makespan;
    }
    makespan[sc] = previo;
    if (sc === "probable") programacion = ultima;
  }
  const plan = programacion!;

  const cpm = calcularCPM(grafo, {
    duracion: duracionDe("probable"),
    lag: lagDe("probable", TODAS),
  });

  // ── 6. Cierre: D_obra = f · O_0 + D_ms ───────────────────────────────────
  // `f` estira el TRABAJO (entra en `duracionDe`, dentro del scheduler) y el
  // overhead fijo; los lags de secado van SIN `f`, y no por inercia: un factor
  // de PRODUCTIVIDAD no puede estirar un fragüe — el mortero no fragua un 65%
  // más lento porque la cuadrilla rinda un 65% menos. `O_0` es el sumando que
  // no escala y que hace que un baño de 5 m² no pueda durar 3 días por poco
  // trabajo que tenga; ocupa la franja inicial de la línea de tiempo.
  const overheadDias = redondear(overhead.probable * f.probable);
  const total: Escenario = {
    min: f.min * overhead.min + makespan.min,
    probable: f.probable * overhead.probable + makespan.probable,
    max: f.max * overhead.max + makespan.max,
  };

  // ── 7. LA DISTRIBUCIÓN: percentiles en vez de tres escenarios ────────────
  //
  // El centro NO se recalcula: E[D] es el total calibrado de arriba, el que
  // valida los cuatro casos patrón. Lo que se calcula aquí es la FORMA.
  //
  // Rango PERT de cada tarea, con `f.probable` en los TRES vértices. La banda
  // de `f` (1.40–1.94) NO entra aquí a propósito: un factor de productividad
  // es común a la obra entera —es la misma cuadrilla en todas las tareas— así
  // que su incertidumbre vive en K, no en el término que se promedia. Meterla
  // por tarea sería volver a suponer correlación perfecta, que es el defecto
  // que este bloque existe para borrar.
  const sigmaComun = Math.max(0, opts.sigmaComun ?? PRIOR_SIGMA_COMUN);
  const rangos = new Map<string, TrianguloPERT>();
  for (const t of tareas) {
    rangos.set(
      t.id,
      rangoAjustado(
        {
          o: f.probable * t.esc.min,
          m: f.probable * t.esc.probable,
          p: f.probable * t.esc.max,
        },
        t.conDato,
      ),
    );
  }
  const esperasPert = new Map<string, TrianguloPERT>();
  for (const d of declaraciones) {
    esperasPert.set(d.etiqueta as string, {
      o: d.habiles.min,
      m: d.habiles.probable,
      p: d.habiles.max,
    });
  }
  const overheadPert: TrianguloPERT = {
    o: f.probable * overhead.min,
    m: f.probable * overhead.probable,
    p: f.probable * overhead.max,
  };

  // La cadena crítica DE RECURSOS: CPM sobre el grafo con el reparto de
  // cuadrillas ya congelado. Sobre el CPM puro (cuadrillas infinitas) la
  // cadena de 32 baños idénticos son los 9 pasos de UNO, y el ancho relativo
  // no decrecería nunca con el tamaño de la obra.
  const fijado = grafoFijado(grafo, plan);
  const cpmFijado = calcularCPM(fijado, {
    duracion: duracionDe("probable"),
    lag: lagDe("probable", TODAS),
  });
  const cadena = cpmFijado.rutaCritica;

  // σ² idiosincrático = tareas de la cadena + esperas que atraviesa + overhead.
  let varianza = momentosPert(overheadPert).sigma ** 2;
  for (const id of cadena) {
    const r = rangos.get(id);
    if (r) varianza += momentosPert(r).sigma ** 2;
  }
  // Las esperas se cuentan por VECES que la cadena las cruza y se suman
  // ANTES de elevar al cuadrado: el fragüe del pañete es el mismo mortero en
  // toda la obra, así que sus apariciones están perfectamente correlacionadas
  // y no se promedian entre sí (es el mismo error que este leaf corrige, solo
  // que al revés: aquí la correlación perfecta SÍ es la verdad).
  const arcoEntre = new Map<string, AristaCronograma>();
  for (const a of fijado.aristas) arcoEntre.set(`${a.desde} ${a.hasta}`, a);
  const vecesEspera = new Map<string, number>();
  for (let i = 1; i < cadena.length; i++) {
    const a = arcoEntre.get(`${cadena[i - 1]} ${cadena[i]}`);
    if (!a?.espera) continue;
    vecesEspera.set(a.espera, (vecesEspera.get(a.espera) ?? 0) + 1);
  }
  for (const [etiqueta, veces] of vecesEspera) {
    const r = esperasPert.get(etiqueta);
    if (r) varianza += (veces * momentosPert(r).sigma) ** 2;
  }

  const tareasConDato = tareas.filter((t) => t.conDato).length;
  const cobertura = tareasConDato / tareas.length;
  const centro = Math.max(1, total.probable);
  let probabilidad = distribucionCerrada({
    media: centro,
    sigmaIdiosincratico: Math.sqrt(varianza),
    sigmaComun,
    cobertura,
    tareasEnCadena: cadena.length,
  });
  let montecarlo: ResultadoMonteCarlo | undefined;
  if (opts.montecarlo?.semilla) {
    montecarlo = simularDuracion({
      grafo: fijado,
      rangos,
      esperas: esperasPert,
      overhead: overheadPert,
      centro,
      cobertura,
      semilla: opts.montecarlo.semilla,
      sigmaComun,
      ...(opts.montecarlo.iteraciones ? { iteraciones: opts.montecarlo.iteraciones } : {}),
    });
    probabilidad = montecarlo.distribucion;
  }

  const inicioDe = (id: string): number => overheadDias + (plan.inicio.get(id) ?? 0);
  const finDe = (id: string): number => overheadDias + (plan.fin.get(id) ?? 0);

  const fasesOut: FaseDuracion[] = [];
  for (const fa of fasesPresentes) {
    const lista = porFase.get(fa)!;
    const trabajo = (sc: ClaveEscenario): number =>
      lista.reduce((acc, t) => acc + f[sc] * t.esc[sc], 0);
    const propias = declaraciones.filter((d) => d.fase === fa);
    const par = paraleloDe.get(fa);
    let inicio = Infinity;
    let fin = 0;
    for (const t of lista) {
      inicio = Math.min(inicio, inicioDe(t.id));
      fin = Math.max(fin, finDe(t.id));
    }

    fasesOut.push({
      fase: fa,
      dias: redondear(trabajo("probable")),
      diasMin: redondear(trabajo("min")),
      diasMax: redondear(trabajo("max")),
      inicioDias: redondear(Number.isFinite(inicio) ? inicio : overheadDias),
      finDias: redondear(fin),
      esperaDias: redondear(propias.reduce((a, d) => a + d.calendario.probable, 0)),
      esperaEfectivaDias: redondear(
        propias.reduce((a, d) => a + (incremento.get(d.etiqueta as string)?.probable ?? 0), 0),
      ),
      tareas: lista.map((t) => {
        const c = cpm.nodos.get(t.id);
        return {
          id: t.id,
          nombre: t.nombre,
          espacio: t.espacio,
          fase: t.fase,
          dias: redondear(t.esc.probable),
          key: t.key,
          conDato: t.conDato,
          inicioDias: redondear(inicioDe(t.id)),
          finDias: redondear(finDe(t.id)),
          holguraDias: redondear(c?.holgura ?? 0),
          critico: c?.critico ?? false,
        };
      }),
      enParaleloCon: par ? [par] : [],
    });
  }

  // Cota SUPERIOR: nada se solapa. Σ de duraciones (con `f`) más Σ de esperas,
  // una por espacio y etiqueta — que es el máximo que un camino puede acumular.
  let sumaDias = tareas.reduce((acc, t) => acc + f.probable * t.esc.probable, 0);
  const esperasContadas = new Set<string>();
  for (const a of grafo.aristas) {
    if (!a.espera) continue;
    const clave = `${a.espera}|${porNodo.get(a.hasta)?.espacioId ?? ""}`;
    if (esperasContadas.has(clave)) continue;
    esperasContadas.add(clave);
    sumaDias += lagPorEtiqueta.get(a.espera)?.probable ?? 0;
  }

  return {
    // El ÚNICO piso de todo el motor: una obra con trabajo no puede durar 0
    // días. Se aplica aquí, sobre el total, no tarea por tarea. El total está
    // en días HÁBILES: quien quiera una fecha lo pasa por `addWorkingDays` de
    // `calendario-colombia.ts`, que descuenta domingos y los 18 festivos.
    totalDias: {
      probable: Math.max(1, Math.round(total.probable)),
      min: Math.max(1, Math.round(total.min)),
      max: Math.max(1, Math.round(total.max)),
    },
    probabilidad,
    ...(montecarlo ? { montecarlo } : {}),
    overheadDias,
    fases: fasesOut,
    cronograma: {
      cpmDias: redondear(cpm.makespan),
      sgsDias: redondear(makespan.probable),
      sumaDias: redondear(sumaDias),
      esperaEfectivaDias: redondear(makespan.probable - makespanSinEsperas.probable),
      nodos: grafo.nodos.length,
      aristas: grafo.aristas.length,
      aristasRechazadas: grafo.rechazadas.length,
      rutaCritica: cpm.rutaCritica,
      cadenaRecursos: cadena,
    },
    cobertura,
    sinDato: tareas.length - tareasConDato,
  };
}
