/**
 * El bloque del inmueble tal como se imprime: la lista de líneas
 * «etiqueta: valor» que hoy un arquitecto escribe a mano al inicio de un
 * informe de inspección.
 *
 * Lo consumen el acta de estado inicial, los informes técnicos y la línea
 * Juntos. Por eso el orden de las líneas está fijado aquí y no en cada
 * plantilla: el mismo bloque se lee igual en todos los documentos.
 *
 * Solo salen las líneas que tienen valor. Un documento con «Nro. matrícula:
 * —» no informa de nada y hace ver incompleto un acta que está bien.
 */
import { ETIQUETAS_DOCUMENTO, LABEL_TIPO_PROPIEDAD, TEXTO_OCUPACION } from "./copys";
import { fraseNormaSismica, normaSismicaPorAnio } from "./norma-sismica";
import type { DatosInmueble } from "./tipos";

export interface LineaInmueble {
  etiqueta: string;
  valor: string;
}

/** Números como se escriben en Colombia: coma decimal, punto de miles. */
function numero(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Las líneas del bloque, en el orden en que se leen en un informe: primero
 * dónde está el inmueble, después cómo se identifica legalmente, después cómo
 * es, y de último quién pidió la inspección.
 */
export function lineasInmuebleParaDocumento(datos: DatosInmueble): LineaInmueble[] {
  const lineas: LineaInmueble[] = [];
  const agregar = (etiqueta: string, valor: string | null) => {
    if (valor && valor.trim() !== "") lineas.push({ etiqueta, valor: valor.trim() });
  };

  // La dirección y el conjunto se leen juntos, como los escribe un arquitecto:
  // «Calle 33A #2B-100, Conjunto Prados del Naranjo».
  const direccion = datos.conjunto_edificio
    ? `${datos.direccion_inmueble}, ${datos.conjunto_edificio}`
    : datos.direccion_inmueble;
  agregar(ETIQUETAS_DOCUMENTO.direccion_inmueble, direccion);
  agregar(ETIQUETAS_DOCUMENTO.unidad_inmueble, datos.unidad_inmueble);
  agregar(ETIQUETAS_DOCUMENTO.ciudad, datos.ciudad);
  agregar(ETIQUETAS_DOCUMENTO.matricula_inmobiliaria, datos.matricula_inmobiliaria);
  agregar(
    ETIQUETAS_DOCUMENTO.tipo_propiedad,
    datos.tipo_propiedad ? LABEL_TIPO_PROPIEDAD[datos.tipo_propiedad] : null
  );
  agregar(
    ETIQUETAS_DOCUMENTO.metraje_total,
    datos.metraje_total !== null ? `${numero(datos.metraje_total)} m²` : null
  );
  agregar(
    ETIQUETAS_DOCUMENTO.altura_libre_m,
    datos.altura_libre_m !== null ? `${numero(datos.altura_libre_m)} m` : null
  );

  // El año arrastra su norma: «1998 (NSR-98)». La frase completa va en su
  // propia línea porque es la que se cita en la justificación técnica.
  const norma = normaSismicaPorAnio(datos.anio_construccion);
  agregar(
    ETIQUETAS_DOCUMENTO.anio_construccion,
    datos.anio_construccion !== null
      ? norma
        ? `${datos.anio_construccion} (${norma.etiqueta})`
        : String(datos.anio_construccion)
      : null
  );
  agregar(ETIQUETAS_DOCUMENTO.norma_sismica, fraseNormaSismica(datos.anio_construccion));

  agregar(
    ETIQUETAS_DOCUMENTO.habitada_durante_obra,
    datos.habitada_durante_obra === null ? null : TEXTO_OCUPACION[datos.habitada_durante_obra ? "si" : "no"]
  );
  agregar(ETIQUETAS_DOCUMENTO.solicitante, datos.solicitante);

  return lineas;
}

/** Una sola línea de texto para encabezados y asuntos de correo. */
export function resumenInmuebleUnaLinea(datos: DatosInmueble): string {
  const partes = [datos.unidad_inmueble, datos.conjunto_edificio ?? datos.direccion_inmueble, datos.ciudad];
  return partes.filter((p): p is string => Boolean(p && p.trim())).join(" · ");
}
