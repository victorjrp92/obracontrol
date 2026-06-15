import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";
import { uploadFacturaFile } from "@/lib/storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];

/**
 * POST /api/proyectos/[id]/gastos/upload — subir la FOTO de una factura.
 *
 * multipart/form-data: { file }
 * Devuelve: { path } — un path de storage que luego se manda como
 * `factura_url` al POST de /gastos.
 *
 * Permisos: cualquier usuario con acceso al proyecto (igual que registrar un
 * gasto). Tenant: el proyecto debe ser de la constructora del usuario.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id } = await params;

    // Tenant: el proyecto debe ser de la constructora del usuario.
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
      select: { id: true },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Acceso por rol (admins ven todo; contratistas solo sus proyectos).
    const accesibles = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accesibles, proyecto_id)) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "file es requerido" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se aceptan imágenes (JPG, PNG, WEBP o HEIC)" },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto no puede superar 10 MB" }, { status: 400 });
    }

    const path = await uploadFacturaFile(file, proyecto_id, currentUser.id);
    return NextResponse.json({ path }, { status: 201 });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/gastos/upload", err);
    return NextResponse.json({ error: "No se pudo subir la factura" }, { status: 500 });
  }
}
