import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Helper central de autenticación + aislamiento multi-tenant.
 *
 * Reglas:
 * - Toda ruta API DEBE empezar con `requireUser()`.
 * - Toda lectura/escritura que reciba un ID externo DEBE verificar pertenencia
 *   al tenant vía `assert*InTenant()`.
 * - Ver docs/architecture.md §2 para el contrato completo.
 */

export class TenantError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "TenantError";
  }
}

export interface AuthContext {
  authUserId: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    constructora_id: string;
  };
  constructoraId: string;
}

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new TenantError(401, "No autorizado");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: user.email },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      constructora_id: true,
    },
  });

  if (!usuario) {
    throw new TenantError(404, "Usuario no encontrado");
  }

  return {
    authUserId: user.id,
    usuario,
    constructoraId: usuario.constructora_id,
  };
}

export function requireRole(
  ctx: { usuario: { rol: string } },
  ...roles: string[]
): void {
  if (!roles.includes(ctx.usuario.rol)) {
    throw new TenantError(403, "Sin permisos");
  }
}

export async function assertProyectoInTenant(
  proyectoId: string,
  constructoraId: string
): Promise<void> {
  const count = await prisma.proyecto.count({
    where: { id: proyectoId, constructora_id: constructoraId },
  });
  if (count === 0) throw new TenantError(404, "Proyecto no encontrado");
}

export async function assertEdificioInTenant(
  edificioId: string,
  constructoraId: string
): Promise<void> {
  const count = await prisma.edificio.count({
    where: {
      id: edificioId,
      proyecto: { constructora_id: constructoraId },
    },
  });
  if (count === 0) throw new TenantError(404, "Edificio no encontrado");
}

export async function assertEspacioInTenant(
  espacioId: string,
  constructoraId: string
): Promise<void> {
  const count = await prisma.espacio.count({
    where: {
      id: espacioId,
      unidad: {
        piso: { edificio: { proyecto: { constructora_id: constructoraId } } },
      },
    },
  });
  if (count === 0) throw new TenantError(404, "Espacio no encontrado");
}

export async function assertTareaInTenant(
  tareaId: string,
  constructoraId: string
): Promise<void> {
  const count = await prisma.tarea.count({
    where: {
      id: tareaId,
      espacio: {
        unidad: {
          piso: { edificio: { proyecto: { constructora_id: constructoraId } } },
        },
      },
    },
  });
  if (count === 0) throw new TenantError(404, "Tarea no encontrada");
}

export async function assertUsuarioInTenant(
  usuarioId: string,
  constructoraId: string
): Promise<void> {
  const count = await prisma.usuario.count({
    where: { id: usuarioId, constructora_id: constructoraId },
  });
  if (count === 0) throw new TenantError(404, "Usuario no encontrado");
}

/** Fragmento Prisma `where` para filtrar Tareas por constructora. */
export function tenantTareaWhere(constructoraId: string) {
  return {
    espacio: {
      unidad: {
        piso: { edificio: { proyecto: { constructora_id: constructoraId } } },
      },
    },
  } as const;
}

/** Fragmento Prisma `where` para filtrar Edificios por constructora. */
export function tenantEdificioWhere(constructoraId: string) {
  return { proyecto: { constructora_id: constructoraId } } as const;
}

/**
 * Convierte `TenantError` en respuesta JSON estándar.
 * Si no es `TenantError`, devuelve `null` para que el handler maneje el resto.
 */
export function tenantErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof TenantError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
