// Configuración editable de «Juntos». Mismo patrón que
// src/components/beta/config.ts: valores que se pueden ajustar sin tocar el
// markup de los componentes.
//
// Vivía en src/components/alerta/config.ts. Cuando se borraron los componentes
// muertos de esa carpeta, este archivo quedó como su único habitante y sus dos
// únicos consumidores estaban aquí, en Juntos — así que se mudó y la carpeta
// `alerta/` de componentes desapareció.
//
// Se dejaron atrás ocho exports que solo usaban los componentes borrados
// (LineaEmergencia, LINEA_EMERGENCIA_NACIONAL, LINEAS_EMERGENCIA_CIUDADES,
// CONTACTO_WHATSAPP, CanalOficial, CANALES_OFICIALES y sus placeholders).
// Ojo con el primero: `src/lib/juntos/telefonos.ts` define su PROPIA interfaz
// `LineaEmergencia` con sus propias líneas verificadas, y esa es la viva.
// Tener dos tipos homónimos para el mismo concepto es justo lo que hace que
// alguien copie el equivocado.

/** Moneda de referencia para la Foto A (acercamiento) — GuiaFotoJuntos.tsx y el prompt de observar-grieta.ts. */
export const MONEDA_REFERENCIA = { nombre: "$500 COP", diametro_mm: 23.7 };

/** Verificado contra Footer.tsx, contacto/page.tsx y privacidad/page.tsx — mismo correo en todo el sitio. */
export const CONTACTO_EMAIL = "info@seiricon.com";

// `LABEL_ELEMENTO` (nombres en lenguaje llano de cada `Elemento`) vive en
// src/lib/alerta/copys.ts, no aquí: lo consume src/lib/pdf/InformeGrietasReport.tsx
// (capa `lib`) además de los componentes, y `lib` no debe depender de `components`.
