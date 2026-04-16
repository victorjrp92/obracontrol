import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getContratistaTareas, getContratistaProgreso } from "@/lib/data-contratista";
import { ContratistaTareasReport } from "@/lib/pdf/ContratistaTareasReport";

// GET /api/reportes/contratista/tareas — genera PDF de tareas del contratista autenticado
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: {
        constructora: { select: { nombre: true } },
        rol_ref: { select: { nivel_acceso: true } },
      },
    });

    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Acceso restringido a contratistas" }, { status: 403 });
    }

    const [tareas, progreso] = await Promise.all([
      getContratistaTareas(usuario.id, usuario.constructora_id),
      getContratistaProgreso(usuario.id),
    ]);

    const tareasData = tareas.map((t) => ({
      nombre: t.nombre,
      proyecto: t.proyecto,
      ubicacion: `${t.edificio} · Apto ${t.unidad}`,
      estado: t.estado,
      diasRestantes: t.diasRestantes,
      semaforo: t.semaforo,
    }));

    const pdfBuffer = await renderToBuffer(
      ContratistaTareasReport({
        data: {
          contratistaNombre: usuario.nombre,
          constructoraNombre: usuario.constructora.nombre,
          resumen: progreso,
          tareas: tareasData,
        },
      })
    );

    const fecha = new Date().toISOString().split("T")[0];
    const filename = `tareas-${usuario.nombre.replace(/\s+/g, "-").toLowerCase()}-${fecha}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reportes/contratista/tareas", error);
    return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
  }
}
