import type { NivelAcceso, TipoCuenta } from "@/generated/prisma";
import { canAccessProject, getAccessibleProjectIds, type AccessibleProjects } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { assertProyectoInTenant, TenantError, type AuthContext } from "@/lib/tenant";
import { assertPerfilConAcceso } from "./acceso";
import { fallar } from "./errores";

/**
 * Lo que toda ruta del módulo necesita saber después de `requireUser()`.
 *
 * `requireUser()` devuelve el nombre del rol, no su `nivel_acceso`, y no dice
 * nada del `tipo_cuenta` de la constructora. Los dos hacen falta: el
 * `tipo_cuenta` decide si el perfil entra al módulo, y el `nivel_acceso` decide
 * QUÉ obras ve dentro. Se resuelven en una sola consulta, scopeada por tenant.
 *
 * Se separa de `subida.ts` a propósito: este archivo arrastra Prisma y
 * `next/headers` (vía `tenant.ts`), y el dominio tiene que poder verificarse
 * sin ninguna de las dos cosas.
 */
export interface ContextoProductosTecnicos {
  usuarioId: string;
  constructoraId: string;
  tipoCuenta: TipoCuenta;
  nivelAcceso: NivelAcceso;
  proyectosAccesibles: AccessibleProjects;
}

/**
 * Enriquece el contexto de sesión y CORTA CON 403 si el perfil no tiene la
 * capacidad `productosTecnicos` (CONTRATISTA y PROPIETARIO no la tienen).
 */
export async function contextoProductosTecnicos(
  auth: AuthContext,
): Promise<ContextoProductosTecnicos> {
  const usuario = await prisma.usuario.findFirst({
    where: { id: auth.usuario.id, constructora_id: auth.constructoraId },
    select: {
      id: true,
      constructora_id: true,
      rol_ref: { select: { nivel_acceso: true } },
      constructora: { select: { tipo_cuenta: true } },
    },
  });

  if (!usuario) {
    throw new TenantError(404, "Usuario no encontrado");
  }

  const tipoCuenta = usuario.constructora.tipo_cuenta;
  assertPerfilConAcceso(tipoCuenta);

  const nivelAcceso = usuario.rol_ref.nivel_acceso;
  const proyectosAccesibles = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    nivelAcceso,
  );

  return {
    usuarioId: usuario.id,
    constructoraId: usuario.constructora_id,
    tipoCuenta,
    nivelAcceso,
    proyectosAccesibles,
  };
}

/**
 * Las dos preguntas de aislamiento, en orden, para una obra concreta:
 *
 *   1. ¿La obra es de esta constructora? Si no, 404 — y 404 y no 403, porque
 *      confirmar que existe una obra de otro tenant ya es filtrar información.
 *   2. ¿Este usuario tiene acceso a esa obra dentro de su propia constructora?
 *      Un ADMIN_PROYECTO solo ve las suyas, un CONTRATISTA solo aquellas donde
 *      tiene tareas. Si no, 403.
 */
export async function assertObraAccesible(
  ctx: ContextoProductosTecnicos,
  proyectoId: string,
): Promise<void> {
  await assertProyectoInTenant(proyectoId, ctx.constructoraId);

  if (!canAccessProject(ctx.proyectosAccesibles, proyectoId)) {
    fallar(403, "OBRA_SIN_ACCESO", "No tienes acceso a esta obra.");
  }
}
