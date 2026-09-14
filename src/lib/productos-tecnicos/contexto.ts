import type { NivelAcceso, TipoCuenta } from "@/generated/prisma";
import {
  canAccessProject,
  getAccessibleProjectIds,
  isFieldStaff,
  type AccessibleProjects,
} from "@/lib/access";
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
/**
 * Quién ESCRIBE productos técnicos, que no es lo mismo que quién los ve.
 *
 * `assertPerfilConAcceso` pregunta por el TIPO DE CUENTA («¿este negocio tiene
 * el módulo?»). Esta pregunta por el NIVEL DE ACCESO («¿este rol manda sobre
 * los planos de la obra?»), y son dos preguntas distintas: el personal de campo
 * trabaja en una constructora que sí tiene el módulo y aun así no decide con
 * qué plano se construye.
 *
 * Lee planos y renders de sus obras —es la mitad de su encargo— pero no sube,
 * no reemplaza, no elige qué versión rige y no firma actas. TODA ruta que
 * escriba en el módulo llama a esta guarda; si mañana aparece otra, la que le
 * falte se encuentra buscando este símbolo en vez de releyendo seis ficheros.
 *
 * Vive aquí y no en `acceso.ts` porque `acceso.ts` sale por el barril
 * `index.ts`, que importan componentes `"use client"`: traer `@/lib/access`
 * allí arrastraría Prisma al bundle del navegador (ver la cabecera de
 * `index.ts`). Este fichero ya arrastra Prisma, así que no cuesta nada.
 */
export function puedeEscribirProductoTecnico(nivel: NivelAcceso): boolean {
  return !isFieldStaff(nivel);
}

/** Corta con 403 si este nivel solo puede mirar. */
export function assertPuedeEscribirProductoTecnico(ctx: ContextoProductosTecnicos): void {
  if (!puedeEscribirProductoTecnico(ctx.nivelAcceso)) {
    // Sale como `TenantError` y no como `ProductoTecnicoError` a propósito: los
    // códigos del dominio existen para que la UI reaccione —reintentar con otro
    // archivo cuando el cupo se llenó, por ejemplo— y aquí no hay nada que
    // reintentar. Es el límite del rol, no una condición recuperable.
    throw new TenantError(
      403,
      "El personal de campo consulta los planos y renders de su obra, pero no puede subirlos, reemplazarlos ni decidir qué versión rige.",
    );
  }
}
