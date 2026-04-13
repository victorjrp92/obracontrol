import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, asunto, mensaje } = body as {
      nombre: string;
      email: string;
      asunto: string;
      mensaje: string;
    };

    if (!nombre?.trim() || !email?.trim() || !asunto?.trim() || !mensaje?.trim()) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo electronico no valido" }, { status: 400 });
    }

    await prisma.mensajeContacto.create({
      data: {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/contacto", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
