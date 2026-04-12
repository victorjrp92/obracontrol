import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const BUCKET = "evidencias";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// POST /api/sugerencias/upload — upload a photo for a suggestion
// multipart/form-data: file
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Solo contratistas pueden subir fotos de sugerencias" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file es requerido" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto no puede superar 10 MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `sugerencias/${usuario.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      throw new Error(`Error subiendo foto: ${uploadError.message}`);
    }

    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sugerencias/upload", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
