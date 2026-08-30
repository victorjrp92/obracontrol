/**
 * API pública del bloque de datos del inmueble (spec-arquitecto-2026-08.md, B8).
 *
 * Todo lo que consuman el acta de estado inicial, los informes técnicos, la
 * línea Juntos y el wizard de proyecto entra por aquí. Los módulos internos
 * (`matricula.ts`, `norma-sismica.ts`, `validacion.ts`, `documento.ts`,
 * `copys.ts`) siguen siendo importables directamente, pero este barril es el
 * contrato estable.
 */
export type {
  CampoInmueble,
  DatosInmueble,
  FormularioInmueble,
  NormaSismica,
  NormaSismicaId,
  Resultado,
  TipoPropiedad,
} from "./tipos";

export type { MatriculaInmobiliaria } from "./matricula";
export { MATRICULA_MAX_LARGO, formatearMatricula, normalizarMatricula, validarMatricula } from "./matricula";

export {
  ANIO_CCCSR_84,
  ANIO_MIN_CONSTRUCCION,
  ANIO_NSR_10,
  ANIO_NSR_98,
  NORMAS_SISMICAS,
  TRAMOS_NORMA_SISMICA,
  anioMaximoConstruccion,
  fraseNormaSismica,
  normaSismicaPorAnio,
} from "./norma-sismica";

export type { ErroresInmueble, ValidacionBloque } from "./validacion";
export {
  ALTURA_MAX_M,
  ALTURA_MIN_M,
  AREA_MAX_M2,
  AREA_MIN_M2,
  CIUDAD_MAX_LARGO,
  DIRECCION_MAX_LARGO,
  DIRECCION_MIN_LARGO,
  TEXTO_MAX_LARGO,
  formularioDesdeDatos,
  formularioInmuebleVacio,
  validarAlturaLibre,
  validarAnioConstruccion,
  validarCiudad,
  validarConjuntoEdificio,
  validarDatosInmueble,
  validarDireccionInmueble,
  validarFormularioInmueble,
  validarHabitadaDuranteObra,
  validarMatriculaOpcional,
  validarMetrajeTotal,
  validarSolicitante,
  validarTipoPropiedad,
  validarUnidadInmueble,
} from "./validacion";

export type { CopyCampo } from "./copys";
export {
  COPY_INMUEBLE,
  ETIQUETAS_DOCUMENTO,
  LABEL_HABITADA,
  LABEL_TIPO_PROPIEDAD,
  NOTA_NORMA_SISMICA,
  SUBTITULO_BLOQUE,
  TEXTO_OCUPACION,
  TITULO_BLOQUE,
} from "./copys";

export type { LineaInmueble } from "./documento";
export { lineasInmuebleParaDocumento, resumenInmuebleUnaLinea } from "./documento";
