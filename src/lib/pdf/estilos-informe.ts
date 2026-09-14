// ---------------------------------------------------------------------------
// EL FORMATO del informe de avance: identidad, tipografia y aritmetica de
// presentacion. Sin React y sin datos — solo el envase.
//
// == POR QUE UN FORMATO Y NO UN TABLERO =====================================
//
// El PDF anterior era un tablero impreso: cinco tarjetas redondeadas, numeros
// de 24pt en azul, naranja y rojo, y una tabla de tres filas para una obra de
// 4.110 actividades. Eso se lee como una captura de pantalla, y una captura de
// pantalla no se radica, no se firma y no se archiva.
//
// Los dos informes de interventoria que se estudiaron -Metro de Bogota y
// Gobernacion de Boyaca- no se parecen en nada a eso. Lo que los hace
// admisibles son cuatro rasgos que aqui se copian a proposito:
//
//   1. CAJETIN repetido en todas las paginas (emisor, titulo, codigo de
//      formato, version, corte). Una hoja suelta sigue diciendo de donde sale.
//   2. Tabla de CONTROL DE APROBACION: quien elabora, quien revisa, quien
//      aprueba, con cargo y fecha.
//   3. Numeracion jerarquica de secciones y de tablas («Tabla 3.1-1»), para
//      que se pueda citar un dato por su direccion exacta.
//   4. Codigo unico de documento y «Pag. X de N» en el pie.
//
// De ahi sale todo lo demas: MONOCROMO -el color de un informe tecnico es
// decoracion, y la decoracion en un documento que se firma resta-, una sola
// columna, carta vertical y cero esquinas redondeadas.
//
// == LA TRAMPA DE LAS FUENTES ===============================================
//
// En todo el repo NO hay ni una llamada a `Font.register`. Es decir: solo
// existen las 14 fuentes base del PDF. Si aqui se escribiera `fontFamily:
// "Inter"`, react-pdf NO avisa: cae a Helvetica en silencio y el informe sale
// con una tipografia que nadie eligio. Por eso todo este modulo se mueve
// dentro de Helvetica / Helvetica-Bold / Helvetica-Oblique y nada mas.
// ---------------------------------------------------------------------------

import { StyleSheet } from "@react-pdf/renderer";

// ─── Identidad del formato ──────────────────────────────────────────────────

/**
 * Los datos del formato, no del informe. Cambian cuando cambia el FORMATO
 * -o sea, casi nunca-, y por eso viven aqui y no en la ruta: si un dia se
 * añade una seccion, sube `version` y todos los PDF emitidos desde entonces
 * quedan distinguibles de los anteriores sin mirar el contenido.
 */
export const FORMATO = {
  codigo: "SEI-FR-AV-01",
  version: "1.0",
  titulo: "INFORME DE AVANCE DE OBRA",
  emisor: "SEIRICON",
  emisorPie: "Seiricon · control de obra · seiricon.com",
} as const;

/** Lo que se escribe donde NO hay dato suficiente para afirmar nada. */
export const NO_CALCULABLE = "No calculable";

/** Lo que se escribe donde el dato simplemente no esta registrado. */
export const NO_REGISTRADO = "No registrado";

// ─── Tinta ──────────────────────────────────────────────────────────────────

/**
 * Escala de grises, a proposito.
 *
 * Un informe tecnico se fotocopia, se escanea y se imprime en laser en blanco
 * y negro. Un semaforo de colores sobrevive a ninguna de las tres: el rojo y
 * el verde acaban siendo el MISMO gris, y entonces el documento dice menos
 * despues de imprimirlo que en pantalla. Lo que separa una fila de otra aqui
 * es el texto, no el fondo.
 */
export const tinta = {
  texto: "#111111",
  suave: "#555555",
  tenue: "#7a7a7a",
  linea: "#111111",
  lineaFina: "#c9c9c9",
  fondoCab: "#e8e8e8",
  fondoClave: "#f4f4f4",
  papel: "#ffffff",
} as const;

// ─── Hoja ───────────────────────────────────────────────────────────────────

/**
 * Carta vertical. Los margenes no son gusto: el cajetin y el pie van
 * ABSOLUTOS y fijos, asi que la hoja tiene que reservarles sitio con padding o
 * el texto se les mete debajo en la pagina 2 en adelante — y eso no se ve en
 * la pagina 1, que es la unica que uno mira cuando prueba.
 *
 * `paddingTop` 112 = 26 (aire) + ~70 (alto real del cajetin, medido sobre el
 * PDF renderizado) + 16 (respiro). Con 96 el titulo de la seccion 1 se metia
 * dentro del borde inferior del cajetin.
 * `paddingBottom` 62 = 26 (aire) + ~22 (alto del pie) + 14 (respiro).
 *
 * ── LA TRAMPA DEL `lineHeight` EN `Page` ──────────────────────────────────
 * Aqui NO hay `lineHeight`, y no es un olvido. Con `lineHeight` en el estilo
 * de `Page`, react-pdf deja de pintar los elementos `fixed` anclados con
 * `bottom` — el pie del informe desaparecia de las siete paginas sin un solo
 * error, ni en consola ni en el render. Se aislo probando una a una las
 * propiedades de la pagina: con `backgroundColor`, `fontFamily`, `color` y
 * `fontSize` el pie sale; anadiendo `lineHeight: 1.35` desaparece, y vuelve a
 * salir al quitarlo. El interlineado se declara en cada estilo de texto que
 * lo necesita (parrafos y notas); las tablas van con el de por defecto, que
 * ademas les sienta mejor.
 */
export const MARGEN_LATERAL = 48;
const ALTO_CAJETIN_RESERVADO = 112;
const ALTO_PIE_RESERVADO = 62;

export const estilosInforme = StyleSheet.create({
  pagina: {
    paddingTop: ALTO_CAJETIN_RESERVADO,
    paddingBottom: ALTO_PIE_RESERVADO,
    paddingHorizontal: MARGEN_LATERAL,
    backgroundColor: tinta.papel,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: tinta.texto,
  },

  // ── Cajetin ──────────────────────────────────────────────────────────────
  // Absoluto + `fixed`: es el mismo par que ya usa el pie de `styles.ts` y que
  // funciona en produccion. En react-pdf las coordenadas absolutas dentro de
  // `Page` se miden desde el BORDE DEL PAPEL (no desde el area de contenido),
  // por eso `left/right` repiten el margen lateral en vez de valer 0.
  cajetin: {
    position: "absolute",
    top: 26,
    left: MARGEN_LATERAL,
    right: MARGEN_LATERAL,
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: tinta.linea,
  },
  cajetinEmisor: {
    width: 132,
    borderRightWidth: 0.8,
    borderRightColor: tinta.linea,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  cajetinLogo: {
    width: 22,
    height: 22,
    marginRight: 6,
    objectFit: "contain",
  },
  cajetinMarca: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.1,
    color: tinta.texto,
  },
  cajetinMarcaPie: {
    fontSize: 5.5,
    color: tinta.tenue,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  cajetinCentro: {
    flex: 1,
    borderRightWidth: 0.8,
    borderRightColor: tinta.linea,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: "center",
  },
  cajetinTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    color: tinta.texto,
  },
  cajetinObra: {
    fontSize: 7.5,
    color: tinta.suave,
    marginTop: 2,
  },
  cajetinMeta: {
    // 168 y no 148: el codigo del documento puede llegar a 24 caracteres y con
    // la columna estrecha se partia en dos lineas, estirando el cajetin.
    width: 168,
  },
  cajetinMetaFila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: tinta.lineaFina,
  },
  cajetinMetaFilaUltima: {
    flexDirection: "row",
  },
  cajetinMetaClave: {
    width: 50,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: tinta.suave,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRightWidth: 0.5,
    borderRightColor: tinta.lineaFina,
  },
  cajetinMetaValor: {
    flex: 1,
    fontSize: 6.5,
    color: tinta.texto,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
  },

  // ── Pie ──────────────────────────────────────────────────────────────────
  pie: {
    position: "absolute",
    bottom: 26,
    left: MARGEN_LATERAL,
    right: MARGEN_LATERAL,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: tinta.linea,
    paddingTop: 4,
  },
  pieTexto: {
    fontSize: 6.5,
    color: tinta.suave,
  },

  // ── Titulos ──────────────────────────────────────────────────────────────
  seccion: {
    marginTop: 14,
  },
  seccionPrimera: {
    marginTop: 0,
  },
  tituloSeccion: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    letterSpacing: 0.4,
    borderBottomWidth: 0.8,
    borderBottomColor: tinta.linea,
    paddingBottom: 3,
    marginBottom: 6,
  },
  tituloSubseccion: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    marginTop: 10,
    marginBottom: 4,
  },
  parrafo: {
    fontSize: 8.5,
    color: tinta.texto,
    lineHeight: 1.45,
    textAlign: "justify",
    marginBottom: 4,
  },
  parrafoTenue: {
    fontSize: 7.5,
    color: tinta.suave,
    lineHeight: 1.4,
    marginTop: 3,
  },

  // ── Nota declarada (el «no calculable» razonado) ──────────────────────────
  nota: {
    borderWidth: 0.5,
    borderColor: tinta.lineaFina,
    borderLeftWidth: 2.5,
    borderLeftColor: tinta.linea,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginTop: 4,
    marginBottom: 2,
  },
  notaTitulo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    color: tinta.texto,
    marginBottom: 2,
  },
  notaTexto: {
    fontSize: 7.5,
    color: tinta.suave,
    lineHeight: 1.45,
    textAlign: "justify",
  },

  // ── Ficha clave/valor ────────────────────────────────────────────────────
  ficha: {
    borderWidth: 0.8,
    borderColor: tinta.linea,
  },
  fichaFila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: tinta.lineaFina,
  },
  fichaFilaUltima: {
    flexDirection: "row",
  },
  fichaClave: {
    width: "30%",
    backgroundColor: tinta.fondoClave,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: tinta.suave,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderRightColor: tinta.lineaFina,
  },
  fichaValor: {
    flex: 1,
    fontSize: 8,
    color: tinta.texto,
    paddingHorizontal: 6,
    paddingVertical: 4,
    lineHeight: 1.3,
  },

  // ── Tablas ───────────────────────────────────────────────────────────────
  rotulo: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: tinta.suave,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  rotuloNota: {
    fontSize: 6.5,
    color: tinta.tenue,
    marginTop: 3,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  tabla: {
    borderWidth: 0.8,
    borderColor: tinta.linea,
  },
  tablaCab: {
    flexDirection: "row",
    backgroundColor: tinta.fondoCab,
    borderBottomWidth: 0.8,
    borderBottomColor: tinta.linea,
  },
  tablaCabTexto: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    letterSpacing: 0.3,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  tablaFila: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: tinta.lineaFina,
  },
  tablaFilaUltima: {
    flexDirection: "row",
  },
  tablaFilaTotal: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderTopColor: tinta.linea,
    backgroundColor: tinta.fondoClave,
  },
  celda: {
    fontSize: 7.5,
    color: tinta.texto,
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    lineHeight: 1.3,
  },
  celdaFuerte: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    lineHeight: 1.3,
  },
  celdaDer: {
    textAlign: "right",
  },
  celdaCen: {
    textAlign: "center",
  },
  celdaVacia: {
    fontSize: 7.5,
    color: tinta.tenue,
    paddingHorizontal: 5,
    paddingVertical: 8,
    textAlign: "center",
  },

  // ── Barra de avance en escala de grises ──────────────────────────────────
  // Sustituye al numerote de color: se lee igual en una fotocopia y no compite
  // con el texto. 3pt de alto, negro pleno sobre linea fina.
  barra: {
    height: 3,
    backgroundColor: tinta.lineaFina,
    marginTop: 3,
  },
  barraRelleno: {
    height: 3,
    backgroundColor: tinta.texto,
  },

  // ── Trio de indicadores de la seccion 2 ──────────────────────────────────
  trio: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: tinta.linea,
  },
  trioCelda: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRightWidth: 0.5,
    borderRightColor: tinta.lineaFina,
  },
  trioCeldaUltima: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  trioClave: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: tinta.suave,
    letterSpacing: 0.5,
  },
  trioValor: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    marginTop: 3,
  },
  trioValorNulo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: tinta.tenue,
    marginTop: 5,
  },
  trioDetalle: {
    fontSize: 6.5,
    color: tinta.tenue,
    marginTop: 3,
    lineHeight: 1.3,
  },

  // ── Firmas ───────────────────────────────────────────────────────────────
  lineaFirma: {
    borderBottomWidth: 0.5,
    borderBottomColor: tinta.tenue,
    height: 16,
    marginBottom: 2,
  },
});

// ─── Formato de fechas ──────────────────────────────────────────────────────
//
// == POR QUE A MANO Y NO CON `toLocaleDateString` ============================
//
// Hay DOS clases de fecha en este dominio y se imprimen distinto:
//
//   · FECHA DE CALENDARIO (inicio de obra, fin estimado, ventanas del plan).
//     Nacen de un selector «2026-01-15» y se guardan como medianoche UTC. Si
//     se formatean en la zona del servidor, una maquina en UTC-5 imprime el
//     14 de enero. Se formatean en UTC siempre, que es la unica lectura que
//     devuelve el dia que el usuario escribio.
//   · INSTANTE (cuando se firmo una aprobacion). Ese si ocurrio en un momento
//     concreto y hay que leerlo en la hora de Colombia, o una decision de las
//     8 de la noche aparece fechada al dia siguiente.
//
// `toLocaleDateString(...)` sin `timeZone` usa la zona del SERVIDOR, o sea que
// el mismo informe sale con fechas distintas en local (Bogota) y en
// produccion (UTC). Se formatea a mano: es determinista, no depende de que el
// runtime traiga ICU completo, y deja el criterio a la vista.

/** Colombia no tiene horario de verano: el desfase es constante. */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function valida(d: Date | null | undefined): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime());
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha de calendario en `dd/mm/aaaa`, leida en UTC. */
export function fechaDMA(d: Date | null | undefined, sinDato = NO_REGISTRADO): string {
  if (!valida(d)) return sinDato;
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Fecha de calendario en texto largo: «14 de septiembre de 2026». */
export function fechaLarga(d: Date | null | undefined, sinDato = NO_REGISTRADO): string {
  if (!valida(d)) return sinDato;
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Instante leido en hora de Colombia: `dd/mm/aaaa hh:mm`. */
export function fechaHoraColombia(d: Date | null | undefined, sinDato = NO_REGISTRADO): string {
  if (!valida(d)) return sinDato;
  const local = new Date(d.getTime() - OFFSET_COLOMBIA_MS);
  return `${dos(local.getUTCDate())}/${dos(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${dos(
    local.getUTCHours(),
  )}:${dos(local.getUTCMinutes())}`;
}

// ─── Formato de numeros ─────────────────────────────────────────────────────

/** Entero con punto de millar, como se escribe en Colombia: 4.110. */
export function entero(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const signo = n < 0 ? "-" : "";
  const cuerpo = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return signo + cuerpo;
}

/**
 * Porcentaje con un decimal y coma decimal. `null` NO se pinta como 0: se
 * pinta como «No calculable», que es lo unico honesto cuando el dato no
 * existe. Es la misma regla que ya aplica `bitacora.ts` con la latencia.
 */
export function porcentaje(n: number | null | undefined, sinDato = NO_CALCULABLE): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return sinDato;
  return `${n.toFixed(1).replace(".", ",")}%`;
}

/** Indice adimensional (SPI) con dos decimales y coma. */
export function indice(n: number | null | undefined, sinDato = NO_CALCULABLE): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return sinDato;
  return n.toFixed(2).replace(".", ",");
}

/** Texto o el marcador de «no registrado». Vacios y espacios cuentan como nada. */
export function texto(v: string | null | undefined, sinDato = NO_REGISTRADO): string {
  if (typeof v !== "string") return sinDato;
  const limpio = v.trim();
  return limpio.length > 0 ? limpio : sinDato;
}

// ─── Codigo del documento ───────────────────────────────────────────────────

/**
 * Codigo unico de ESTA emision: `{registro de la obra}-AV-{aaaammdd}`.
 *
 * Hace de consecutivo sin inventarse uno. Un «Informe N.º 7» exigiria una
 * tabla de emisiones que hoy no existe, y ponerlo a ojo -contando meses desde
 * el inicio, por ejemplo- afirmaria que hubo seis informes anteriores que
 * nadie emitio. El codigo por corte es unico, es verificable contra los datos
 * y no afirma nada que no haya pasado.
 */
export function codigoDocumento(
  numeroRegistro: string | null | undefined,
  nombreObra: string,
  corte: Date,
): string {
  const base = (numeroRegistro?.trim() || nombreObra || "OBRA")
    .toUpperCase()
    .normalize("NFD")
    // Marcas diacriticas: «Ñ» y los acentos salen del codigo, que tiene que
    // poder teclearse y buscarse desde cualquier teclado.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const d = valida(corte) ? corte : new Date(0);
  const sello = `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}`;
  return `${base || "OBRA"}-AV-${sello}`;
}
