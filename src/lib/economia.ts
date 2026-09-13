// ---------------------------------------------------------------------------
// Quien ve el dinero DE LA OBRA.
//
// Seiricon B2B se especializa en reporting: que avanzo, quien lo hizo, cuando,
// donde, quien lo aprobo y quien lo rechazo. El dinero de la obra
// -presupuestos, precios por tarea, gastos, anticipos- sale de la interfaz de
// las constructoras. NO se borra: los campos, los modelos y las rutas de API
// siguen intactos, y lo ya capturado se conserva. Lo unico que se apaga es lo
// que el usuario ve y puede escribir, para poder encenderlo de nuevo el dia
// que el producto vuelva a ese terreno.
//
// En B2C se queda TAL CUAL. Para un propietario que no vive en la obra, la
// alarma de "entregaste esto y te sustentaron esto otro" no es una funcion
// mas: es la razon por la que compra. Apagarsela lo dejaria con fotos.
//
// == POR QUE UNA FUNCION Y NO UN `if` EN CADA PANTALLA =====================
//
// El dinero de obra aparece hoy en ocho sitios distintos -boton de gastos,
// columna de la tabla de tareas, detalle de tarea, cuatro campos del asistente
// y el chip de las sugerencias-. Ocho condiciones escritas a mano se
// desincronizan: alguien anade una pantalla nueva y se olvida de una. Aqui la
// regla se escribe una vez y las pantallas preguntan.
//
// == LO QUE ESTA FUNCION NO ES =============================================
//
// No tiene NADA que ver con lo que la constructora le paga a Seiricon
// -planes, Wompi, `suscripcion.ts`-. Eso es la facturacion del SaaS y sigue
// visible para todo el mundo. Confundir las dos cosas apagaria el cobro.
// ---------------------------------------------------------------------------

import type { TipoCuenta } from "@/generated/prisma";
import { esCuentaPersonal } from "./plan";

/**
 * Si esta cuenta ve el dinero de la obra.
 *
 * Se pregunta por el TIPO DE CUENTA, no por el rol: no es un permiso que un
 * administrador pueda conceder, es una decision de producto sobre que hace
 * Seiricon para cada negocio.
 */
export function muestraEconomiaDeObra(tipo: TipoCuenta): boolean {
  return esCuentaPersonal(tipo);
}
