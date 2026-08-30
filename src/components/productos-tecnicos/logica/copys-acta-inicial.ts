import { TERMINO_CONCEPTO, TERMINOS_PROHIBIDOS } from "@/lib/documentos/lenguaje";

/**
 * El idioma del acta de estado inicial. Vive aparte —igual que
 * `src/lib/documentos/lenguaje.ts`— porque aquí las palabras son una decisión
 * legal y no de estilo, y conviene poder revisarlas todas de una sentada.
 *
 * Tres reglas gobiernan este archivo, y ninguna es negociable:
 *
 *  1. El documento se llama SIEMPRE «concepto técnico». Las figuras que se le
 *     parecen —las del artículo 226 del Código General del Proceso— traen
 *     deberes procesales, contradicción y acreditación de idoneidad ante un
 *     juez. Prometerlas sería vender algo que no se entrega. La lista de lo
 *     prohibido no se reescribe aquí: se importa de `lenguaje.ts`, que es donde
 *     ya vive, para que no puedan desincronizarse.
 *
 *  2. El acta NUNCA afirma que el inmueble sea seguro ni que se pueda habitar.
 *     Ese pronunciamiento lo hace un profesional con matrícula vigente, en un
 *     documento suyo y asumiendo su responsabilidad — no un formato que llena
 *     una aplicación. Lo que sí puede decir el acta es qué se vio y cuándo.
 *
 *  3. La sección de metodología dice qué NO incluye. Es lo que delimita la
 *     responsabilidad del profesional y, justamente por eso, lo que hace el
 *     documento defendible: un acta que no acota su alcance se lee como si lo
 *     abarcara todo.
 *
 * Módulo puro: solo cadenas y un par de comprobadores. Lo leen el PDF, la
 * pantalla y `scripts/verificar-acta-inicial.ts`.
 */

export const TITULO_ACTA = "Acta de estado inicial";

export const SUBTITULO_ACTA =
  "Registro fotográfico del estado del inmueble antes de iniciar la obra";

/**
 * Qué es este papel, dicho en la primera página y antes que nada.
 *
 * Usa el término correcto de forma explícita. No es un adorno: quien recibe el
 * documento tiene que saber, sin preguntar, qué figura tiene en la mano.
 */
export const NATURALEZA_DOCUMENTO =
  `Este documento es un ${TERMINO_CONCEPTO} de registro: deja constancia del estado ` +
  "visible del inmueble en la fecha indicada, antes de iniciar la obra. Recoge lo que se " +
  "observó a simple vista y lo que muestran las fotografías; nada más.";

/** Qué SÍ hace el acta. Frases cortas: se leen en voz alta ante una contraparte. */
export const ALCANCE: readonly string[] = [
  "Deja registro del estado visible del inmueble en la fecha de las fotografías, antes de iniciar la obra.",
  "Cada fotografía se tomó con la cámara de la aplicación. La fecha, la hora y las coordenadas quedaron impresas dentro de la imagen en el momento de la captura.",
  "Las fotografías se organizan por espacio, siguiendo la estructura del inmueble registrada en la obra, y van numeradas para poder citarlas una por una.",
  "Recoge los datos de identificación del inmueble, incluida su matrícula inmobiliaria.",
];

/**
 * Lo que el acta NO incluye. Esta lista es la mitad importante del documento.
 *
 * Cada línea cierra una puerta concreta por la que después alguien intentaría
 * entrar: «usted vio la casa y no dijo nada del cimiento», «usted certificó que
 * se podía vivir ahí». No se vio el cimiento y no se certificó nada, y aquí
 * queda escrito antes de que la discusión exista.
 */
export const NO_INCLUYE: readonly string[] = [
  "No incluye ensayos de laboratorio ni pruebas sobre los materiales.",
  "No incluye cálculo estructural ni modelación de la estructura.",
  "No incluye inspección de elementos ocultos: no se abrieron muros, cielos rasos, pisos ni instalaciones empotradas. Lo que no estaba a la vista no se observó.",
  "No incluye levantamiento topográfico ni medición instrumentada de fisuras, plomos o niveles.",
  "No incluye revisión de las instalaciones hidráulicas, sanitarias, eléctricas ni de gas.",
  "No se pronuncia sobre la causa de lo observado ni sobre cómo puede evolucionar.",
  "No emite juicio sobre la seguridad estructural, la estabilidad ni la habitabilidad del inmueble. Ese pronunciamiento corresponde a un profesional con matrícula vigente, en un documento propio y con el alcance que el caso exija.",
];

/** Encabezados de las dos mitades de la metodología. */
export const TITULO_ALCANCE = "Qué recoge este documento";
export const TITULO_NO_INCLUYE = "Qué NO incluye este documento";
export const TITULO_METODOLOGIA = "Metodología y alcance";

/** La declaración que el profesional firma. Describe un hecho, no una opinión. */
export const DECLARACION_PROFESIONAL =
  "Declaro que las fotografías de este documento fueron tomadas por mí, o bajo mi dirección, " +
  "con la cámara de la aplicación en el inmueble identificado arriba, y que la fecha, la hora y " +
  "las coordenadas impresas en cada imagen corresponden al momento de la captura. El registro " +
  "recoge lo observado a simple vista, con el alcance descrito en la sección de metodología.";

/** El bloque de «recibido conforme» impreso, para firmar en papel si hace falta. */
export const TITULO_RECIBIDO = "Recibido conforme del cliente";

export const ACLARACION_RECIBIDO =
  "«Recibido conforme» quiere decir que el documento se recibió completo y legible en esa fecha. " +
  "NO es una aprobación de su contenido: se puede dejar la constancia y no estar de acuerdo con lo que dice.";

/** Una línea, al pie de CADA página. Es lo único que se lee si nadie lee nada más. */
export const PIE_ALCANCE =
  `${TERMINO_CONCEPTO.charAt(0).toUpperCase()}${TERMINO_CONCEPTO.slice(1)} de registro del estado inicial. ` +
  "Recoge lo observado a simple vista en la fecha indicada; no incluye ensayos, cálculo estructural " +
  "ni inspección de elementos ocultos.";

/** Dónde se comprueba el folio. Va impreso junto al folio y a la huella. */
export const RUTA_VERIFICACION = "/verificar";
export const TEXTO_VERIFICACION = "Verifica este documento en seiricon.com/verificar";

/** Cómo se cita una foto en una discusión: «la foto 3». */
export function etiquetaFoto(numero: number): string {
  return `Foto ${numero}`;
}

/**
 * Los rótulos del documento y de la pantalla, TODOS aquí.
 *
 * No es manía de centralizar: la compuerta de lenguaje barre este archivo y el
 * del PDF, y solo puede prometer que el acta no dice nada prohibido si el acta
 * no tiene prosa suelta repartida por otros archivos. Un rótulo escrito a mano
 * dentro del componente del PDF sería precisamente el que se escapa de la
 * revisión.
 */
export const ETIQUETAS_ACTA = {
  identificacion: "Identificación del inmueble",
  obra: "Obra",
  profesional: "Profesional que registra",
  matriculaProfesional: "Matrícula profesional",
  emitida: "Emitida el",
  folio: "Folio",
  resumen: "Resumen del registro",
  espacios: "Espacios registrados",
  fotos: "Fotografías",
  primeraCaptura: "Primera captura",
  ultimaCaptura: "Última captura",
  registroFotografico: "Registro fotográfico por espacio",
  ubicacionEnInmueble: "Ubicación en el inmueble",
  coordenadas: "Coordenadas",
  tomadaEl: "Tomada el",
  observacion: "Observación",
  firmaProfesional: "Firma del profesional",
  nombreQuienRecibe: "Nombre de quien recibe",
  documentoQuienRecibe: "Documento de identidad",
  fechaRecibido: "Fecha",
  firmaQuienRecibe: "Firma",
  sinNota: "Sin observación escrita.",
} as const;

/**
 * Colocaciones que este documento no puede contener NUNCA.
 *
 * Son cadenas literales y no expresiones regulares a propósito. Una regex que
 * intentara distinguir «el inmueble es seguro» de «no se afirma que el inmueble
 * sea seguro» tendría que entender la negación, y una comprobación legal que
 * depende de acertar con una negación no es una comprobación. Aquí la regla es
 * de otro tipo y no admite interpretación: estas construcciones no aparecen, ni
 * afirmadas ni negadas. Todo lo que hay que decir se puede decir sin ellas —y
 * `NO_INCLUYE` lo demuestra: dice exactamente eso, con otras palabras.
 */
export const COLOCACIONES_PROHIBIDAS: readonly string[] = [
  "es seguro",
  "es segura",
  "está seguro",
  "es habitable",
  "es inhabitable",
  "es estable",
  "apto para habitar",
  "apta para habitar",
  "apto para ser habitado",
  "puede habitarse",
  "puede ser habitado",
  "sin riesgo",
  "libre de riesgo",
  "no presenta riesgo",
  "en buen estado estructural",
  "garantiza la seguridad",
  "certifica la seguridad",
  "certifica la habitabilidad",
  "declara habitable",
];

/**
 * ¿Este texto promete una figura que el producto no entrega, o afirma algo
 * sobre la seguridad o la habitabilidad del inmueble? Devuelve la primera
 * expresión encontrada, o `null` si el texto está limpio.
 */
export function expresionProhibida(texto: string): string | null {
  const limpio = texto.toLowerCase();
  return (
    TERMINOS_PROHIBIDOS.find((t) => limpio.includes(t)) ??
    COLOCACIONES_PROHIBIDAS.find((c) => limpio.includes(c)) ??
    null
  );
}

/** Todos los textos del acta, en una lista, para poder barrerlos de una pasada. */
export const TEXTOS_DEL_ACTA: readonly string[] = [
  TITULO_ACTA,
  SUBTITULO_ACTA,
  NATURALEZA_DOCUMENTO,
  TITULO_METODOLOGIA,
  TITULO_ALCANCE,
  TITULO_NO_INCLUYE,
  ...ALCANCE,
  ...NO_INCLUYE,
  DECLARACION_PROFESIONAL,
  TITULO_RECIBIDO,
  ACLARACION_RECIBIDO,
  PIE_ALCANCE,
  TEXTO_VERIFICACION,
  ...Object.values(ETIQUETAS_ACTA),
];
