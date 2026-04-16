import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ContratistasReport } from "@/lib/pdf/ContratistasReport";

// GET /api/reportes/contratistas — PDF ranking contratistas de la constructora
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: { constructora: { select: { nombre: true } } },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const contratistas = await prisma.contratista.findMany({
      where: { usuario: { constructora_id: usuario.constructora_id } },
      include: {
        usuario: {
          select: {
            nombre: true,
            rol_ref: { select: { nombre: true } },
            tareas_asignadas: { select: { estado: true } },
          },
        },
      },
      orderBy: { score_total: "desc" },
    });

    const data = contratistas.map((c) => ({
      nombre: c.usuario.nombre,
      rol: c.usuario.rol_ref.nombre,
      score_total: c.score_total,
      score_cumplimiento: c.score_cumplimiento,
      score_calidad: c.score_calidad,
      score_velocidad_correccion: c.score_velocidad_correccion,
      tareas_aprobadas: c.usuario.tareas_asignadas.filter((t) => t.estado === "APROBADA").length,
      tareas_pendientes: c.usuario.tareas_asignadas.filter(
        (t) => t.estado !== "APROBADA" && t.estado !== "NO_APROBADA"
      ).length,
    }));

    const pdfBuffer = await renderToBuffer(
      ContratistasReport({
        data: {
          constructoraNombre: usuario.constructora.nombre,
          contratistas: data,
        },
      })
    );

    const filename = `contratistas-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reportes/contratistas", error);
    return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
  }
}
