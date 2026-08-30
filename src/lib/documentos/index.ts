/**
 * Documentos verificables — infraestructura compartida.
 *
 * Folio, huella, registro y verificación de cualquier documento que Seiricon
 * emita con el sello «Verificación: <folio> · <huella>» en el pie. Nació dentro
 * de la línea Juntos y salió de ahí cuando el perfil Arquitecto necesitó el
 * mismo mecanismo para sus actas de estado inicial e informes técnicos.
 *
 * La dependencia va en un solo sentido: las líneas de producto consumen este
 * módulo; este módulo no sabe nada de ellas.
 */
export {
  esFolioDeFamilia,
  generarFolio,
  prefijoDeFolio,
  PREFIJOS,
  hashContenido,
  hashCorto,
  normalizarFolio,
  LARGO_HUELLA_CORTA,
  PATRON_FOLIO,
  PATRON_HUELLA,
  type PrefijoFolio,
} from "./folio";

export { cotejarHuella, fechaEmision, resolverVerificacion, LARGO_MINIMO_HUELLA } from "./cotejo";
export { construirFilaRegistro, CAMPOS_REGISTRADOS } from "./fila-registro";
export { registrarDocumento } from "./registro";
export { verificarDocumento } from "./verificacion";
export { hallazgoDeFila, type FilaVerificable } from "./hallazgo";
export type {
  DocumentoRegistrado,
  FilaRegistro,
  FirmasVerificacion,
  FuenteVerificacion,
  Hallazgo,
  RegistroDocumento,
  ResultadoVerificacion,
  VigenciaVerificacion,
} from "./tipos";

/**
 * ─── Firmas, versiones e inmutabilidad ──────────────────────────────────────
 *
 * Un documento firmable se emite, se firma una sola vez, y a partir de ahí no
 * se toca: corregirlo emite otra versión. El cliente deja su constancia de
 * ENTREGA por el enlace sin cuenta, y la verificación pública muestra las dos
 * firmas y si el contenido cambió.
 */
export {
  asegurarBorrador,
  dejarConstanciaDeRecibido,
  documentoParaCliente,
  documentosDelCliente,
  emitirCorreccion,
  emitirDocumento,
  firmarDocumento,
} from "./servicio";

export { almacenPrisma } from "./almacen-prisma";
export type { AlmacenDocumentos } from "./almacen";

export { DocumentoError, esDocumentoError, type CodigoFalla } from "./fallas";
export {
  asegurarModificable,
  estaFirmado,
  estaRecibido,
  CAMPOS_ESCRIBIBLES_UNA_VEZ,
  CAMPOS_INMUTABLES,
} from "./inmutabilidad";
export { planificarFirma, type Firmante } from "./firma";
export {
  normalizarReceptor,
  planificarRecibido,
  RECEPTOR_LARGO_MAX,
  RECEPTOR_LARGO_MIN,
} from "./recibido";
export {
  planificarCorreccion,
  planificarEmision,
  PREFIJO_POR_TIPO,
  type DatosCorreccion,
  type DatosEmision,
} from "./versiones";
export {
  asegurarEnAlcance,
  esDelProyecto,
  vistaCliente,
  type DocumentoParaCliente,
} from "./vista-cliente";
export { fechaEnColombia, momentoEnColombia } from "./fechas";
export {
  COPY_FIRMA,
  COPY_RECIBIDO,
  COPY_VERSION,
  ETIQUETA_TIPO,
  tieneTerminoProhibido,
  TERMINO_CONCEPTO,
  TERMINOS_PROHIBIDOS,
} from "./lenguaje";
export {
  carpetaDeFirma,
  extensionCoincideConFormato,
  extensionDeImagen,
  formatoDeFirma,
  normalizarMatricula,
  rutaImagenFirma,
  rutaPerfilFirma,
  BYTES_CABECERA_FIRMA,
  EXTENSIONES_FIRMA,
  MATRICULA_LARGO_MAX,
  MATRICULA_LARGO_MIN,
  MAX_BYTES_FIRMA,
  PERFIL_VACIO,
  type FormatoFirma,
  type PerfilFirma,
} from "./perfil-firma";
export { almacenPerfilFirma, type AlmacenPerfilFirma } from "./almacen-firma";
export type {
  DatosFirma,
  DatosRecibido,
  DocumentoGuardado,
  DocumentoNuevo,
} from "./estado";
