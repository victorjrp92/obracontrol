import { redirect } from "next/navigation";

/**
 * La ficha de empresa se mudó a /dashboard/perfil. Esta ruta NO se borra:
 * quien la tenga en un marcador (o en un enlace viejo de un correo) debe
 * seguir llegando a la misma información.
 *
 * Redirige en vez de servir la sección otra vez, a propósito:
 *  - Una segunda copia de la ficha volvería a ser, de hecho, la pantalla que
 *    acabamos de quitar del menú, y las dos derivarían con el primer cambio.
 *  - No hay nada que decidir aquí: la sección ya se pinta bajo la condición
 *    correcta en el perfil. Si quien llega no la tiene, ve su perfil sin ella
 *    — que es exactamente lo que le tocaba: esta página nunca fue suya.
 *
 * Es `redirect` (307) y no `permanentRedirect` (308) porque el 308 se queda
 * cacheado en el navegador y dejaría la ruta secuestrada si algún día la ficha
 * vuelve a tener pantalla propia.
 *
 * Sin consulta a la base de datos y sin guarda de nivel: no se lee ni se expone
 * ningún dato. El permiso lo sigue aplicando el destino.
 */
export default function EmpresaPage() {
  redirect("/dashboard/perfil#empresa");
}
