import type { NivelAcceso } from "@/generated/prisma";

/**
 * Niveles cuyo acceso NO sale de la constructora entera sino de filas de
 * `AdminProyectoAccess`: un administrador les asigna las obras una por una.
 *
 * - ADMIN_PROYECTO administra la obra que le asignan.
 * - PERSONAL_CAMPO (auxiliar o residente) solo la ve y reporta avance, pero la
 *   obra se le asigna por la misma tabla y desde las mismas pantallas.
 *
 * Vive en su propio módulo, con `import type` de Prisma, porque lo usan por
 * igual pantallas de servidor y componentes de cliente: un import de valor
 * arrastraría Prisma al bundle del navegador.
 *
 * Está aquí, y no repetido en cada pantalla, porque así nació el fallo que
 * arregla: el predicado `=== "ADMIN_PROYECTO"` estaba copiado en cinco sitios,
 * así que al añadir PERSONAL_CAMPO ninguno pintó el selector de obras y el rol
 * nacía sin ninguna obra que ver. El siguiente nivel que trabaje por obra se
 * añade aquí y en ningún otro lado.
 */
export const NIVELES_CON_OBRAS_ASIGNADAS = [
  "ADMIN_PROYECTO",
  "PERSONAL_CAMPO",
] as const satisfies readonly NivelAcceso[];

type NivelConObrasAsignadas = (typeof NIVELES_CON_OBRAS_ASIGNADAS)[number];

/** `true` si a este nivel hay que asignarle obras para que vea algo. */
export function necesitaObrasAsignadas(nivel: string | null | undefined): boolean {
  return NIVELES_CON_OBRAS_ASIGNADAS.includes(nivel as NivelConObrasAsignadas);
}

/**
 * Los mismos niveles en un array mutable, que es lo que espera el `in` de
 * Prisma. Función y no constante para que nadie pueda mutar el original.
 */
export function nivelesConObrasAsignadas(): NivelAcceso[] {
  return [...NIVELES_CON_OBRAS_ASIGNADAS];
}

/**
 * Niveles que un ADMIN_PROYECTO puede dar de alta: los que trabajan en SU obra.
 * El personal de campo entra en la lista porque el admin de la obra es quien
 * conoce a sus auxiliares y residentes, y las obras que puede asignarles ya
 * quedan acotadas a las suyas en el propio endpoint.
 *
 * Espejo de la lista que valida `POST /api/usuarios`. Cuando ese endpoint se
 * toque, que importe esta constante en vez de mantener su propia copia: la
 * lista de la pantalla y la de la API tienen que decir lo mismo o el selector
 * ofrece roles que la API rechaza con 403.
 */
export const NIVELES_QUE_INVITA_UN_ADMIN_PROYECTO = [
  "CONTRATISTA",
  "OBRERO",
  "PERSONAL_CAMPO",
] as const satisfies readonly NivelAcceso[];

type NivelInvitablePorAdminProyecto = (typeof NIVELES_QUE_INVITA_UN_ADMIN_PROYECTO)[number];

/** `true` si un ADMIN_PROYECTO puede dar de alta a alguien de este nivel. */
export function puedeInvitarloUnAdminProyecto(nivel: string | null | undefined): boolean {
  return NIVELES_QUE_INVITA_UN_ADMIN_PROYECTO.includes(
    nivel as NivelInvitablePorAdminProyecto,
  );
}
