// ---------------------------------------------------------------------------
// Quitar el dinero de obra de una respuesta de API.
//
// El personal de campo no maneja dinero: ni presupuestos, ni precios por tarea.
// Las pantallas de "/campo" ya no lo pintan, pero OCULTAR NO ES AUTORIZAR —
// varias rutas compartidas (`/api/proyectos`, `/api/tareas`,
// `/api/progreso/[id]`) consultan con `include` y sin `select`, asi que
// devuelven la fila ENTERA. Un `curl` con la cookie del residente basta para
// leer el presupuesto de la obra y el precio de cada tarea.
//
// Este modulo es el ultimo filtro antes de serializar. Se aplica SOLO a los
// niveles que no manejan dinero; para todos los demas la respuesta sale igual
// que siempre.
//
// == POR QUE UN BARRIDO Y NO UN `select` EN CADA CONSULTA ==================
//
// Las tres rutas devuelven arboles anidados distintos -proyecto con edificios,
// pisos, unidades, espacios y tareas- y escribir el `select` completo de cada
// una significa enumerar a mano DECENAS de campos y mantenerlos al dia cada vez
// que alguien anada uno. Un campo nuevo olvidado en un `select` no se ve; aqui,
// al reves, lo que se olvida es QUITAR un campo de dinero, y para eso esta la
// lista de abajo, que es corta y esta en un solo sitio.
// ---------------------------------------------------------------------------

/**
 * Campos que llevan dinero de obra en el esquema.
 *
 * Salen de `prisma/schema.prisma`: Proyecto (presupuesto_*), Tarea (precio,
 * presupuesto_*), Gasto y Anticipo (monto), TareaSugerida (precio). Si algun
 * dia se anade otro campo monetario, va aqui.
 */
const CAMPOS_DINERO = new Set([
  "precio",
  "lustro_precio",
  "presupuesto_total",
  "presupuesto_mano_obra",
  "presupuesto_materiales",
  "monto",
  "monto_retenido",
  "monto_centavos",
]);

/**
 * Devuelve una copia sin los campos de dinero, a cualquier profundidad.
 *
 * No muta la entrada: las rutas suelen reutilizar el objeto para otra cosa
 * -contar, agrupar- y vaciarselo por debajo produciria fallos a distancia.
 *
 * `Date` y `null` se devuelven tal cual: son objetos para `typeof` pero no
 * tienen campos que barrer, y clonarlos con un spread los convertiria en un
 * objeto vacio, que es justo como se pierde una fecha sin que nadie lo note.
 */
export function sinDinero<T>(valor: T): T {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(sinDinero) as unknown as T;
  if (valor instanceof Date) return valor;
  if (typeof valor !== "object") return valor;

  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_DINERO.has(clave)) continue;
    salida[clave] = sinDinero(v);
  }
  return salida as T;
}
