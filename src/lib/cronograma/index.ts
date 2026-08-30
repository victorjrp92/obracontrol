// ─────────────────────────────────────────────────────────────────────────
// Cronograma: grafo de precedencias por ESPACIO, CPM y SGS serial.
//
// Contrato público del módulo. Todo lo de aquí es PURO y DETERMINISTA: sin
// base de datos, sin red, sin reloj y sin azar. El dominio (qué es un estuco,
// cuánto fragua una placa) vive en `estimar-duracion.ts`; aquí solo se
// programa un grafo.
//
// El invariante que gobierna las tres cifras:
//
//     D_CPM  <=  D_SGS  <=  suma de duraciones
//
// El CPM solo puede subestimar (supone cuadrillas infinitas), la suma solo
// puede sobreestimar (supone que nada se solapa) y la respuesta está en
// medio. Si alguna vez se rompe, el scheduler está mal, no la obra.
//
// Encima del scheduler vive la capa de PROBABILIDAD, que es lo que el usuario
// acaba leyendo. El cronograma ya no responde «cuánto dura» con tres números
// sin apellido, responde CUÁNDO se termina y con qué probabilidad:
//
//   · `probabilidad.ts` — PERT por tarea, factor común K y percentiles.
//   · `flujo.ts`        — congela el reparto de cuadrillas en arcos, para que
//                         la cadena crítica sea la de recursos y no la del
//                         CPM con cuadrillas infinitas.
//   · `montecarlo.ts`   — simulación DETERMINISTA (misma semilla, misma
//                         salida) que mide el sesgo de fusión.
//   · `fechas.ts`       — de días hábiles a una FECHA, que es lo único que se
//                         le enseña al usuario.
//   · `aleatorio.ts` / `normal.ts` — xorshift128+ y Φ, sin dependencias.
// ─────────────────────────────────────────────────────────────────────────

export {
  betaPert,
  factorComun,
  gammaEstandar,
  LAMBDA_PERT,
  normalEstandar,
  semillaDesde,
  xorshift128plus,
  type Aleatorio,
} from "./aleatorio";
export { calcularCPM, type NodoCPM, type OpcionesCPM, type ResultadoCPM } from "./cpm";
export { cadenaDeEspacio, type EslabonCadena } from "./dependencias";
export { construirGrafo, type EntradaGrafo, type EntradaNodo } from "./grafo";
export {
  adyacencia,
  alcanzable,
  caminosRestantes,
  niveles,
  ordenPrioridad,
  ordenTopologico,
  type Adyacencia,
} from "./orden";
export {
  fechaCorta,
  fechaLarga,
  fechaUTCDesde,
  pronosticoFechas,
  type OpcionesPronostico,
  type PronosticoFechas,
} from "./fechas";
export { arcosDeRecurso, grafoFijado } from "./flujo";
export {
  ITERACIONES_DEFECTO,
  percentilEmpirico,
  simularDuracion,
  type EntradaMonteCarlo,
  type ResultadoMonteCarlo,
} from "./montecarlo";
export { erf, phi, zDe } from "./normal";
export {
  anchoRelativo,
  distribucionCerrada,
  distribucionDeMuestras,
  FACTOR_SIGMA_SIN_DATO,
  momentosPert,
  percentil,
  probabilidadHasta,
  PRIOR_SIGMA_COMUN,
  rangoAjustado,
  type DistribucionDuracion,
  type EntradaDistribucion,
  type MomentosPERT,
  type OrigenDistribucion,
  type TrianguloPERT,
} from "./probabilidad";
export { programarSerial, type OpcionesSGS, type ResultadoSGS } from "./sgs";
export {
  GREMIO_GENERAL,
  type AristaCronograma,
  type Grafo,
  type NodoCronograma,
  type TipoArista,
} from "./tipos";
