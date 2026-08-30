/**
 * Microcopy del bloque de datos del inmueble. Vive en `lib` y no dentro del
 * componente por dos razones: lo consumen también el acta y los informes, y
 * así `scripts/verificar-inmueble.ts` puede barrer TODO el texto que produce
 * el módulo sin renderizar React.
 *
 * Registro de voz: el mismo de `src/components/juntos/GateDatos.tsx` — cada
 * campo dice POR QUÉ se pide. Un formulario que solo pone etiquetas hace que
 * la gente se salte los campos opcionales, y aquí casi todos lo son.
 *
 * REGLA DURA, la misma de `src/lib/alerta/copys.ts`: ninguna cadena de este
 * archivo emite un juicio sobre el estado del inmueble. Se describe qué norma
 * regía y para qué sirve el dato, nunca si el inmueble está bien o mal.
 */
import type { CampoInmueble, TipoPropiedad } from "./tipos";

export interface CopyCampo {
  label: string;
  /** La justificación: por qué le pedimos este dato. */
  pista: string;
  placeholder?: string;
}

export const TITULO_BLOQUE = "Datos del inmueble";

export const SUBTITULO_BLOQUE =
  "Se escriben una vez y salen impresos en el acta y en los informes. Solo la dirección es obligatoria: lo demás lo puedes completar después.";

export const COPY_INMUEBLE: Record<CampoInmueble, CopyCampo> = {
  direccion_inmueble: {
    label: "Dirección del inmueble",
    pista: "El único dato obligatorio: es lo que identifica el inmueble en todos los documentos.",
    placeholder: "Calle 33A #2B-100",
  },
  conjunto_edificio: {
    label: "Conjunto o edificio",
    pista: "Si es propiedad horizontal, el nombre del conjunto ubica mejor que la dirección sola.",
    placeholder: "Conjunto Prados del Naranjo",
  },
  unidad_inmueble: {
    label: "Apartamento, casa o local",
    pista: "Sin el número de unidad, la dirección apunta a la portería y no al inmueble.",
    placeholder: "Apto 904B",
  },
  ciudad: {
    label: "Ciudad",
    pista: "Fija el municipio para los trámites y ajusta los precios a la zona.",
    placeholder: "Cali",
  },
  matricula_inmobiliaria: {
    label: "Matrícula inmobiliaria",
    pista: "Es lo que va a pedirte tu aseguradora o la alcaldía. Está en tu escritura.",
    placeholder: "370-7596",
  },
  tipo_propiedad: {
    label: "Tipo de inmueble",
    pista: "Cambia los espacios que te vamos a listar y cómo se estima la obra.",
  },
  metraje_total: {
    label: "Área aproximada",
    pista: "Aproximada está bien. Con ella se estiman cantidades, duración y presupuesto.",
    placeholder: "70",
  },
  altura_libre_m: {
    label: "Altura libre",
    pista: "De piso a techo. Gobierna buena parte del trabajo de estuco y pintura.",
    placeholder: "2,4",
  },
  anio_construccion: {
    label: "Año de construcción",
    pista: "Dice bajo qué norma sísmica se construyó. Si no lo sabes exacto, el aproximado sirve.",
    placeholder: "1998",
  },
  habitada_durante_obra: {
    label: "¿Van a vivir ahí mientras dura la obra?",
    pista: "Trabajar con gente adentro alarga la obra: hay que proteger, limpiar y parar más veces.",
  },
  solicitante: {
    label: "Solicitado por",
    pista: "Quién pide la inspección, si no es el dueño. Va impreso en el documento.",
    placeholder: "Apto 904B - Ana Steward",
  },
};

/**
 * Acompaña SIEMPRE al dato de norma sísmica, en pantalla y en el documento.
 * El año dice qué norma regía; no dice cómo se construyó ni qué le hicieron
 * después. Sin esta nota, el dato se lee como una conclusión y no lo es.
 */
export const NOTA_NORMA_SISMICA =
  "El año dice qué norma regía cuando se construyó. No dice cómo se construyó de verdad ni qué reformas tuvo después: eso lo establece una inspección.";

/** Nombres en lenguaje llano de `TipoPropiedad`, para pantalla y documento. */
export const LABEL_TIPO_PROPIEDAD: Record<TipoPropiedad, string> = {
  CASA: "Casa",
  APARTAMENTO: "Apartamento",
  EDIFICIO: "Edificio",
  LOCAL: "Local",
};

/** Las dos respuestas de `habitada_durante_obra`, tal como se leen. */
export const LABEL_HABITADA: Record<"si" | "no", string> = {
  si: "Sí, van a estar viviendo ahí",
  no: "No, el inmueble queda desocupado",
};

/** Cómo se lee `habitada_durante_obra` dentro de un documento. */
export const TEXTO_OCUPACION: Record<"si" | "no", string> = {
  si: "Ocupado",
  no: "Desocupado",
};

/** Etiquetas del bloque tal como se imprimen en el acta y en los informes. */
export const ETIQUETAS_DOCUMENTO: Record<CampoInmueble | "norma_sismica", string> = {
  direccion_inmueble: "Dirección del inmueble",
  conjunto_edificio: "Conjunto o edificio",
  unidad_inmueble: "Unidad",
  ciudad: "Ciudad",
  matricula_inmobiliaria: "Nro. matrícula",
  tipo_propiedad: "Tipo de inmueble",
  metraje_total: "Dimensiones aproximadas",
  altura_libre_m: "Altura libre",
  anio_construccion: "Año de construcción",
  habitada_durante_obra: "Ocupación durante la obra",
  solicitante: "Solicitado por",
  norma_sismica: "Norma vigente al construir",
};
