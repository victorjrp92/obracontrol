import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  isAnyAdmin,
  isProjectAdmin,
  checkAdminProjectPermission,
  type AdminProjectPermission,
} from "@/lib/access";

interface PermisosPayload {
  can_edit_project?: boolean;
  can_assign_contractors?: boolean;
  can_manage_team?: boolean;
  can_approve_tasks?: boolean;
}

/** Las cuatro banderas de AdminProyectoAccess, en versión recorrible. */
const CLAVES_PERMISOS = [
  "can_edit_project",
  "can_assign_contractors",
  "can_manage_team",
  "can_approve_tasks",
] as const satisfies readonly AdminProjectPermission[];

type PermisosDeObra = Record<AdminProjectPermission, boolean>;

/**
 * Los cuatro apagados. Es también lo que le toca a una fila de PERSONAL_CAMPO:
 * esa fila solo dice «este residente trabaja en esta obra». Hay que declararlos
 * explícitamente porque `can_approve_tasks` tiene @default(true) en el esquema y
 * `sanitizePermisos` también lo deja en true cuando el body no lo manda.
 */
const NINGUN_PERMISO: PermisosDeObra = {
  can_edit_project: false,
  can_assign_contractors: false,
  can_manage_team: false,
  can_approve_tasks: false,
};

const TODOS_LOS_PERMISOS: PermisosDeObra = {
  can_edit_project: true,
  can_assign_contractors: true,
  can_manage_team: true,
  can_approve_tasks: true,
};

function sanitizePermisos(input: PermisosPayload | undefined): PermisosDeObra {
  return {
    can_edit_project: Boolean(input?.can_edit_project),
    can_assign_contractors: Boolean(input?.can_assign_contractors),
    can_manage_team: Boolean(input?.can_manage_team),
    can_approve_tasks: input?.can_approve_tasks === undefined ? true : Boolean(input.can_approve_tasks),
  };
}

/**
 * Gate común de los tres métodos: el NIVEL lo decide `isAnyAdmin` y la obra
 * concreta la afina `checkAdminProjectPermission`. Es el mismo patrón de
 * `api/proyectos/[id]/personas` y de `reasignar`, y por eso NO se toca
 * `isGeneralAdmin` en `src/lib/access.ts`: ampliar ese helper abriría de paso
 * el checkout de pagos, los datos fiscales de la constructora y el borrado de
 * proyectos.
 *
 * El POST exigía ADMIN_GENERAL mientras el PATCH y el DELETE ya aceptaban al
 * admin de la obra con `can_manage_team`: una puerta de un solo sentido, podía
 * sacar a su residente de la obra y no volver a meterlo.
 */
async function requireGestionDeEquipo(
  usuarioId: string,
  nivel: string,
  proyectoId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isAnyAdmin(nivel)) {
    return { ok: false, status: 403, error: "Solo administradores pueden gestionar el equipo" };
  }
  if (isProjectAdmin(nivel)) {
    const allowed = await checkAdminProjectPermission(usuarioId, proyectoId, "can_manage_team");
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "No tienes permiso para gestionar el equipo de este proyecto",
      };
    }
  }
  return { ok: true };
}

/**
 * Los permisos que el actor tiene EN ESTA OBRA. Para ADMIN_GENERAL y SUPER_ADMIN
 * son los cuatro (no hay fila que leer); para el admin de obra, los de su fila.
 */
async function permisosDelActor(
  usuarioId: string,
  nivel: string,
  proyectoId: string,
): Promise<PermisosDeObra> {
  if (!isProjectAdmin(nivel)) return { ...TODOS_LOS_PERMISOS };

  const acceso = await prisma.adminProyectoAccess.findUnique({
    where: { usuario_id_proyecto_id: { usuario_id: usuarioId, proyecto_id: proyectoId } },
    select: {
      can_edit_project: true,
      can_assign_contractors: true,
      can_manage_team: true,
      can_approve_tasks: true,
    },
  });
  if (!acceso) return { ...NINGUN_PERMISO };
  return {
    can_edit_project: acceso.can_edit_project,
    can_assign_contractors: acceso.can_assign_contractors,
    can_manage_team: acceso.can_manage_team,
    can_approve_tasks: acceso.can_approve_tasks,
  };
}

/**
 * Techo de permisos: nadie puede OTORGAR sobre una obra un permiso que él mismo
 * no tiene ahí. Sin este techo, `can_manage_team` valdría por los cuatro: al
 * admin de obra le bastaría traerse a un colega con `can_edit_project` para
 * hacer por mano ajena lo que el Admin General no le concedió.
 *
 * Solo se bloquea el paso false -> true. QUITAR un permiso sí puede, aunque él
 * no lo tenga: gestionar el equipo incluye recortar, no solo repartir.
 *
 * Para ADMIN_GENERAL y SUPER_ADMIN `delActor` son los cuatro en true, así que la
 * comprobación nunca dispara y no hace falta ramificar por nivel.
 */
function permisoEscalado(
  actuales: PermisosDeObra,
  solicitados: PermisosDeObra,
  delActor: PermisosDeObra,
): AdminProjectPermission | null {
  return (
    CLAVES_PERMISOS.find((k) => solicitados[k] && !actuales[k] && !delActor[k]) ?? null
  );
}

// POST /api/proyectos/[id]/admins
// Asigna a la obra a un Admin Junior (con permisos granulares) o a un Personal
// de campo. Lo puede hacer un ADMIN_GENERAL o un ADMIN_PROYECTO con
// `can_manage_team` sobre ESTA obra — los mismos que ya podían quitarlo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const nivelActor = currentUser.rol_ref.nivel_acceso;
    const gate = await requireGestionDeEquipo(currentUser.id, nivelActor, proyecto_id);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = (await req.json()) as { usuario_id?: string; permisos?: PermisosPayload };
    if (!body.usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    // Anti-escalación: el POST hace upsert, así que sobre su propia fila sería
    // un PATCH encubierto con el que auto-otorgarse los permisos que le faltan.
    if (isProjectAdmin(nivelActor) && body.usuario_id === currentUser.id) {
      return NextResponse.json(
        { error: "No puedes modificar tus propios permisos. Pídeselo a un Admin General." },
        { status: 403 },
      );
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id: body.usuario_id, constructora_id: currentUser.constructora_id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado en tu constructora" }, { status: 404 });
    }
    // AdminProyectoAccess sirve a dos niveles: el admin junior, que administra
    // la obra, y el personal de campo, que solo la ve y reporta. Exigir
    // ADMIN_PROYECTO aquí rechazaba con 400 una asignación perfectamente válida
    // desde la pantalla de equipo.
    const NIVELES_ASIGNABLES_A_OBRA = ["ADMIN_PROYECTO", "PERSONAL_CAMPO"];
    if (!NIVELES_ASIGNABLES_A_OBRA.includes(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json(
        { error: "Solo se puede asignar usuarios con rol Admin Proyecto o Personal de campo" },
        { status: 400 },
      );
    }

    const permisos =
      usuario.rol_ref.nivel_acceso === "PERSONAL_CAMPO"
        ? { ...NINGUN_PERMISO }
        : sanitizePermisos(body.permisos);

    // El upsert puede caer sobre una fila que ya existe: los permisos de partida
    // son los suyos, no cero, o reasignar a alguien contaría como otorgar.
    const existing = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      select: {
        can_edit_project: true,
        can_assign_contractors: true,
        can_manage_team: true,
        can_approve_tasks: true,
      },
    });
    const actuales: PermisosDeObra = existing
      ? {
          can_edit_project: existing.can_edit_project,
          can_assign_contractors: existing.can_assign_contractors,
          can_manage_team: existing.can_manage_team,
          can_approve_tasks: existing.can_approve_tasks,
        }
      : { ...NINGUN_PERMISO };

    const delActor = await permisosDelActor(currentUser.id, nivelActor, proyecto_id);
    const escalado = permisoEscalado(actuales, permisos, delActor);
    if (escalado) {
      return NextResponse.json(
        { error: "No puedes otorgar un permiso que tú no tienes en esta obra", permiso: escalado },
        { status: 403 },
      );
    }

    const access = await prisma.adminProyectoAccess.upsert({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      update: { ...permisos },
      create: {
        usuario_id: body.usuario_id,
        proyecto_id,
        asignado_por: currentUser.id,
        ...permisos,
      },
    });
    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/proyectos/[id]/admins — actualizar permisos de un Admin Junior existente.
// ADMIN_GENERAL o ADMIN_PROYECTO con can_manage_team pueden modificarlos.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const nivelActor = currentUser.rol_ref.nivel_acceso;
    const gate = await requireGestionDeEquipo(currentUser.id, nivelActor, proyecto_id);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = (await req.json()) as { usuario_id?: string; permisos?: PermisosPayload };
    if (!body.usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    // Anti-escalación: un Admin Proyecto NO puede modificar sus propios permisos
    // (de otro modo, can_manage_team le permitiría auto-otorgarse can_edit_project, etc.)
    if (isProjectAdmin(nivelActor) && body.usuario_id === currentUser.id) {
      return NextResponse.json(
        { error: "No puedes modificar tus propios permisos. Pídeselo a un Admin General." },
        { status: 403 },
      );
    }

    const existing = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      include: { usuario: { select: { rol_ref: { select: { nivel_acceso: true } } } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Admin Junior no asignado a este proyecto" }, { status: 404 });
    }

    // El personal de campo no administra: su fila se queda sin permisos aunque
    // el body pida lo contrario.
    const permisos =
      existing.usuario.rol_ref.nivel_acceso === "PERSONAL_CAMPO"
        ? { ...NINGUN_PERMISO }
        : sanitizePermisos(body.permisos);

    const actuales: PermisosDeObra = {
      can_edit_project: existing.can_edit_project,
      can_assign_contractors: existing.can_assign_contractors,
      can_manage_team: existing.can_manage_team,
      can_approve_tasks: existing.can_approve_tasks,
    };
    const delActor = await permisosDelActor(currentUser.id, nivelActor, proyecto_id);
    const escalado = permisoEscalado(actuales, permisos, delActor);
    if (escalado) {
      return NextResponse.json(
        { error: "No puedes otorgar un permiso que tú no tienes en esta obra", permiso: escalado },
        { status: 403 },
      );
    }

    const updated = await prisma.adminProyectoAccess.update({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      data: permisos,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const nivelActor = currentUser.rol_ref.nivel_acceso;
    const gate = await requireGestionDeEquipo(currentUser.id, nivelActor, proyecto_id);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const usuario_id = req.nextUrl.searchParams.get("usuario_id");
    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    // Anti-escalación: un Admin Proyecto NO puede quitarse a sí mismo del proyecto.
    if (isProjectAdmin(nivelActor) && usuario_id === currentUser.id) {
      return NextResponse.json(
        { error: "No puedes quitarte a ti mismo del proyecto. Pídeselo a un Admin General." },
        { status: 403 },
      );
    }

    try {
      await prisma.adminProyectoAccess.delete({
        where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } },
      });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Admin Junior no encontrado en este proyecto" }, { status: 404 });
    }
  } catch (error) {
    console.error("DELETE /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
