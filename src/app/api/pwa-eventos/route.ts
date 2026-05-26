import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { PwaEventoTipo, Prisma } from "@/generated/prisma";

const EVENTOS_VALIDOS: PwaEventoTipo[] = [
  "PROMPT_SHOWN",
  "INSTALL_ACCEPTED",
  "INSTALL_DISMISSED",
  "APP_INSTALLED",
  "LAUNCHED_STANDALONE",
  "IOS_INSTRUCTIONS_SHOWN",
];

const PLATAFORMAS_VALIDAS = ["ios", "android", "desktop", "unknown"];

// POST /api/pwa-eventos — fire-and-forget tracking de eventos PWA.
// Acepta anónimos (usuario_id null) y autenticados.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      evento?: string;
      plataforma?: string;
      navegador?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.evento || !EVENTOS_VALIDOS.includes(body.evento as PwaEventoTipo)) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }
    const plataforma = PLATAFORMAS_VALIDAS.includes(body.plataforma ?? "")
      ? body.plataforma!
      : "unknown";
    const navegador = body.navegador
      ? String(body.navegador).slice(0, 20).toLowerCase()
      : null;

    // Auth opcional — no rechazar si no hay sesión.
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const u = await prisma.usuario.findUnique({
          where: { email: user.email },
          select: { id: true },
        });
        if (u) userId = u.id;
      }
    } catch {
      // anónimo OK
    }

    await prisma.pwaEvento.create({
      data: {
        evento: body.evento as PwaEventoTipo,
        plataforma,
        navegador,
        usuario_id: userId,
        metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("POST /api/pwa-eventos", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
