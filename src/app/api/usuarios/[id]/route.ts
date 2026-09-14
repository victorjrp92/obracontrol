import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers, isProjectAdmin } from "@/lib/access";
import { puedeInvitarloUnAdminProyecto } from "@/lib/niveles-acceso";

// PATCH /api/usuarios/[id] — change role and/or project assignments
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    // El gate de NIVEL se queda en los helpers que ya existen: `canManageUsers`
    // NO se amplía en `src/lib/access.ts` porque ese helper también gobierna el
    // checkout de pagos, los datos fiscales de la constructora y el acotado de
    // obras de `POST /api/usuarios`. El admin de obra entra por la puerta de al
    // lado y sale acotado en el bloque de más abajo.
    if (
      !currentUser ||
      !(
        canManageUsers(currentUser.rol_ref.nivel_acceso) ||
        isProjectAdmin(currentUser.rol_ref.nivel_acceso)
      )
    ) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    const actorEsAdminDeObra = isProjectAdmin(currentUser.rol_ref.nivel_acceso);

    const { id } = await params;
    const body = await req.json();
    const { rol_id, proyectos_asignados, nombre, email } = body as {
      rol_id?: string;
      proyectos_asignados?: string[];
      nombre?: string;
      email?: string;
    };

    if (!rol_id && proyectos_asignados === undefined && !nombre && !email) {
      return NextResponse.json({ error: "rol_id, proyectos_asignados, nombre o email es requerido" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Only allow nombre/email edits for uninvited users
    if ((nombre || email) && target.invitado) {
      return NextResponse.json({ error: "Solo se puede editar nombre/email de usuarios sin invitación" }, { status: 400 });
    }

    // Validate nombre/email if provided
    if (nombre !== undefined) {
      const trimmed = nombre.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return NextResponse.json({ error: "El nombre debe tener entre 2 y 100 caracteres" }, { status: 400 });
      }
    }
    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Email no válido" }, { status: 400 });
      }
      // Check if new email already exists (and it's not the same user)
      if (trimmed !== target.email) {
        const existing = await prisma.usuario.findUnique({ where: { email: trimmed } });
        if (existing) {
          return NextResponse.json({ error: "Ya existe un usuario con este email" }, { status: 409 });
        }
      }
    }

    let effectiveNivel = target.rol_ref.nivel_acceso;

    if (rol_id) {
      const rol = await prisma.rol.findFirst({
        where: { id: rol_id, constructora_id: currentUser.constructora_id },
      });
      if (!rol) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      effectiveNivel = rol.nivel_acceso;
    }

    // ─── Acotado del ADMIN_PROYECTO ──────────────────────────────────────────
    // El admin de obra necesita corregirle los datos y las obras a SU residente,
    // y este PATCH es el único sitio donde se hace. Se abre con las TRES
    // condiciones a la vez porque este endpoint puede cambiar el ROL y las
    // OBRAS de cualquier usuario de la constructora: la validación de arriba
    // solo compara `constructora_id`, nunca obra ni nivel.
    if (actorEsAdminDeObra) {
      // (a) El objetivo: solo personal de campo. CONTRATISTA y OBRERO se quedan
      //     en 403 a propósito: no hay con qué establecer a qué obra pertenecen.
      //     El obrero no tiene fila en AdminProyectoAccess (su acceso es por
      //     token, `getAccessibleProjectIds` le devuelve []) y la obra del
      //     contratista sale de sus tareas, que pueden estar repartidas en obras
      //     de otros administradores. Sin esa pertenencia, la condición (b) no
      //     se puede garantizar, así que el endpoint no se abre para ellos.
      if (target.rol_ref.nivel_acceso !== "PERSONAL_CAMPO") {
        return NextResponse.json(
          { error: "Solo puedes editar al personal de campo de tus obras" },
          { status: 403 },
        );
      }

      // (c) El rol: no puede ascender a nadie a un nivel que él no puede
      //     invitar. Misma lista que valida `POST /api/usuarios`.
      if (!puedeInvitarloUnAdminProyecto(effectiveNivel)) {
        return NextResponse.json(
          { error: "Solo puedes asignar roles de contratista, maestro o personal de campo" },
          { status: 403 },
        );
      }

      // (b) Las obras: el conjunto de ANTES y el de DESPUÉS tienen que caber en
      //     las suyas. El de antes importa tanto como el de después porque la
      //     transacción del final REEMPLAZA el conjunto entero (deleteMany +
      //     createMany): sin mirarlo, un admin le borraría al residente las
      //     obras de otro administrador de paso que le corrige el nombre.
      //     Se exige `can_manage_team` y no la simple pertenencia porque es el
      //     mismo permiso que pide `POST /api/proyectos/[id]/admins` para meter
      //     a ese residente en la obra desde la pantalla de equipo.
      const misObras = new Set(
        (
          await prisma.adminProyectoAccess.findMany({
            where: {
              usuario_id: currentUser.id,
              can_manage_team: true,
              proyecto: { constructora_id: currentUser.constructora_id },
            },
            select: { proyecto_id: true },
          })
        ).map((a) => a.proyecto_id),
      );

      const obrasActuales = await prisma.adminProyectoAccess.findMany({
        where: { usuario_id: id },
        select: { proyecto_id: true },
      });
      if (obrasActuales.some((o) => !misObras.has(o.proyecto_id))) {
        return NextResponse.json(
          {
            error:
              "Este usuario también trabaja en obras que no administras. Pídeselo a un Admin General.",
          },
          { status: 403 },
        );
      }

      if (Array.isArray(proyectos_asignados) && proyectos_asignados.some((p) => !misObras.has(p))) {
        return NextResponse.json(
          { error: "Solo puedes asignar obras que administras" },
          { status: 403 },
        );
      }

      // Un residente sin ninguna obra no es de nadie: el conjunto vacío cabe en
      // cualquier lado y, sin este corte, el admin podría editar a cualquier
      // personal de campo recién creado de la constructora. Para hacerlo suyo
      // basta con que el PATCH le asigne una obra.
      const quedaEnAlgunaDeMisObras =
        obrasActuales.length > 0 ||
        (Array.isArray(proyectos_asignados) && proyectos_asignados.length > 0);
      if (!quedaEnAlgunaDeMisObras) {
        return NextResponse.json(
          { error: "Este usuario no trabaja en ninguna de tus obras" },
          { status: 403 },
        );
      }
    }

    // Niveles cuyo acceso sale de AdminProyectoAccess (obra por obra).
    // PERSONAL_CAMPO comparte esa tabla con ADMIN_PROYECTO: su obra se la asigna
    // un administrador igual que a un admin junior, pero solo para leer y
    // reportar. Ver la sincronización del final de la transacción.
    const asignaPorObra =
      effectiveNivel === "ADMIN_PROYECTO" || effectiveNivel === "PERSONAL_CAMPO";

    // El personal de campo NO hereda los permisos granulares del admin de obra:
    // `can_approve_tasks` viene con @default(true) en el esquema, así que para
    // este nivel se apagan los cuatro a mano.
    const permisosDeObra: {
      can_edit_project?: boolean;
      can_assign_contractors?: boolean;
      can_manage_team?: boolean;
      can_approve_tasks?: boolean;
    } =
      effectiveNivel === "PERSONAL_CAMPO"
        ? {
            can_edit_project: false,
            can_assign_contractors: false,
            can_manage_team: false,
            can_approve_tasks: false,
          }
        : {};

    // If the resulting role is ADMIN_PROYECTO, we need a non-empty project list.
    // Al personal de campo NO se le exige: se le puede asignar la obra después
    // desde el equipo del proyecto.
    if (effectiveNivel === "ADMIN_PROYECTO") {
      const nextList =
        proyectos_asignados !== undefined
          ? proyectos_asignados
          : (await prisma.adminProyectoAccess.findMany({
              where: { usuario_id: id },
              select: { proyecto_id: true },
            })).map((a) => a.proyecto_id);

      if (!Array.isArray(nextList) || nextList.length === 0) {
        return NextResponse.json(
          { error: "Un Admin Proyecto debe tener al menos un proyecto asignado" },
          { status: 400 },
        );
      }
    }

    // Validate proyectos_asignados belong to the constructora
    if (Array.isArray(proyectos_asignados) && proyectos_asignados.length > 0) {
      const proyectosDb = await prisma.proyecto.findMany({
        where: { id: { in: proyectos_asignados }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (proyectosDb.length !== proyectos_asignados.length) {
        return NextResponse.json(
          { error: "Algunos proyectos no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // Build update data for nombre/email if provided (uninvited users only)
      const updateData: { rol_id?: string; nombre?: string; email?: string } = {};
      if (rol_id) updateData.rol_id = rol_id;
      if (nombre && !target.invitado) updateData.nombre = nombre.trim();
      if (email && !target.invitado) updateData.email = email.trim().toLowerCase();

      if (Object.keys(updateData).length > 0) {
        await tx.usuario.update({ where: { id }, data: updateData });
      }

      if (rol_id) {

        // Ensure contratista row if switching to CONTRATISTA
        if (effectiveNivel === "CONTRATISTA") {
          const existing = await tx.contratista.findUnique({ where: { usuario_id: id } });
          if (!existing) {
            await tx.contratista.create({
              data: {
                usuario_id: id,
                score_cumplimiento: 80,
                score_calidad: 80,
                score_velocidad_correccion: 80,
                score_total: 80,
              },
            });
          }
        }
      }

      // Sync project assignments:
      // - Si el nivel resultante trabaja por obra asignada y vino una lista, se
      //   reemplaza el conjunto entero.
      // - Si NO trabaja por obra asignada, se limpia lo que hubiera.
      //
      // ⚠️ PERSONAL_CAMPO TIENE que estar en `asignaPorObra`. Mientras la
      // condición era solo `!== "ADMIN_PROYECTO"`, CUALQUIER PATCH sobre un
      // personal de campo —aunque solo cambiara el nombre— caía en el `else` y
      // le borraba TODAS sus obras dentro de esta misma transacción.
      if (asignaPorObra && Array.isArray(proyectos_asignados)) {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
        if (proyectos_asignados.length > 0) {
          await tx.adminProyectoAccess.createMany({
            data: proyectos_asignados.map((pid) => ({
              usuario_id: id,
              proyecto_id: pid,
              asignado_por: currentUser.id,
              ...permisosDeObra,
            })),
            skipDuplicates: true,
          });
        }
      } else if (!asignaPorObra) {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
      }

      // Bajar de admin de obra a personal de campo conserva las obras (sigue
      // trabajando en ellas) pero apaga los permisos que ya no le tocan. Sin
      // esto, las filas viejas se quedarían con can_approve_tasks en true.
      if (effectiveNivel === "PERSONAL_CAMPO") {
        await tx.adminProyectoAccess.updateMany({
          where: { usuario_id: id },
          data: {
            can_edit_project: false,
            can_assign_contractors: false,
            can_manage_team: false,
            can_approve_tasks: false,
          },
        });
      }
    });

    const updated = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: true, proyectos_administrados: { select: { proyecto_id: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
