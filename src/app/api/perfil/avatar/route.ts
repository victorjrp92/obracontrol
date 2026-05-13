import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const BUCKET = "avatars";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, avatar_url: true },
    });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La imagen no puede superar 5 MB" }, { status: 400 });
    }

    // Delete previous avatar if exists
    if (usuario.avatar_url) {
      await supabase.storage.from(BUCKET).remove([usuario.avatar_url]);
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${usuario.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Error subiendo: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { avatar_url: urlData.publicUrl },
    });

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e) {
    console.error("POST /api/perfil/avatar", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
