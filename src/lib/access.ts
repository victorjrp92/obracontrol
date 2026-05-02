import type { NivelAcceso } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type AccessibleProjects = "ALL" | string[];

/**
 * Returns the project IDs accessible to a user.
 * - DIRECTIVO and ADMIN_GENERAL see every project in their constructora -> "ALL".
 * - ADMIN_PROYECTO sees only the projects assigned in AdminProyectoAccess.
 * - CONTRATISTA sees projects where they have at least one task assigned.
 * - OBRERO: not used here (access is token-based); returns [].
 */
export async function getAccessibleProjectIds(
  usuarioId: string,
  constructoraId: string,
  nivelAcceso: NivelAcceso,
): Promise<AccessibleProjects> {
  if (
    nivelAcceso === "SUPER_ADMIN" ||
    nivelAcceso === "DIRECTIVO" ||
    nivelAcceso === "ADMIN_GENERAL"
  ) {
    return "ALL";
  }

  if (nivelAcceso === "ADMIN_PROYECTO") {
    const accesos = await prisma.adminProyectoAccess.findMany({
      where: { usuario_id: usuarioId, proyecto: { constructora_id: constructoraId } },
      select: { proyecto_id: true },
    });
    return accesos.map((a) => a.proyecto_id);
  }

  if (nivelAcceso === "CONTRATISTA") {
    const proyectos = await prisma.proyecto.findMany({
      where: {
        constructora_id: constructoraId,
        edificios: {
          some: {
            pisos: {
              some: {
                unidades: {
                  some: {
                    espacios: {
                      some: {
                        tareas: { some: { asignado_a: usuarioId } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return proyectos.map((p) => p.id);
  }

  return [];
}

/**
 * Returns `true` if the project is accessible to the caller.
 * "ALL" short-circuits, otherwise we check membership.
 */
export function canAccessProject(accessible: AccessibleProjects, proyectoId: string): boolean {
  return accessible === "ALL" || accessible.includes(proyectoId);
}

/**
 * Builds a Prisma `where` fragment that scopes a `proyecto`-side query by id.
 * Returns `{}` for "ALL" so callers can spread it without side effects.
 */
export function buildProjectWhereFilter(accessible: AccessibleProjects): Record<string, unknown> {
  if (accessible === "ALL") return {};
  return { id: { in: accessible } };
}

/**
 * Builds a Prisma `where` fragment that scopes a child query via nested `proyecto_id`.
 * Use when the query is rooted on a model that has a `proyecto_id` column.
 */
export function buildProyectoIdInFilter(accessible: AccessibleProjects): Record<string, unknown> {
  if (accessible === "ALL") return {};
  return { proyecto_id: { in: accessible } };
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function isSuperAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "SUPER_ADMIN";
}

export function isGeneralAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_GENERAL";
}

export function isProjectAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_PROYECTO";
}

/** Either admin (general or per-project). */
export function isAnyAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "SUPER_ADMIN" || nivel === "ADMIN_GENERAL" || nivel === "ADMIN_PROYECTO";
}

/** Can invite/edit/list users: SUPER_ADMIN + ADMIN_GENERAL + DIRECTIVO; ADMIN_PROYECTO limited. */
export function canManageUsers(nivel: NivelAcceso | string): boolean {
  return nivel === "SUPER_ADMIN" || nivel === "ADMIN_GENERAL" || nivel === "DIRECTIVO";
}

/** Can approve tasks: super admin + ambos admins + directivo. */
export function canApproveTasks(nivel: NivelAcceso | string): boolean {
  return (
    nivel === "SUPER_ADMIN" ||
    nivel === "ADMIN_GENERAL" ||
    nivel === "ADMIN_PROYECTO" ||
    nivel === "DIRECTIVO"
  );
}

/** Returns the path where a user with this role should be redirected after login. */
export function getHomePathForRole(nivel: NivelAcceso | string): string {
  if (nivel === "SUPER_ADMIN") return "/super-admin";
  if (nivel === "DIRECTIVO") return "/directivo";
  if (nivel === "CONTRATISTA") return "/contratista";
  return "/dashboard";
}
