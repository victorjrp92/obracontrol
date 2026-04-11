import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calcularProgreso } from "@/lib/scoring";
import { ProgresoReport } from "@/lib/pdf/ProgresoReport";

// GET /api/reportes/progreso/[proyectoId] — genera y devuelve PDF
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proyectoId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol: true },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { proyectoId } = await params;

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        constructora: { select: { nombre: true } },
        edificios: {
          orderBy: { nombre: "asc" },
          include: {
            pisos: {
              include: {
                unidades: {
                  include: {
                    espacios: {
                      include: {
                        tareas: { select: { estado: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto || proyecto.constructora_id !== usuario.constructora_id) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Calcular progreso global
    const todasTareas = proyecto.edificios.flatMap((e) =>
      e.pisos.flatMap((p) => p.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
    );
    const progreso = calcularProgreso(todasTareas);

    // Stats
    const pendientes = todasTareas.filter((t) => t.estado === "PENDIENTE").length;
    const noAprobadas = todasTareas.filter((t) => t.estado === "NO_APROBADA").length;
    const enRiesgo = todasTareas.filter(
      (t) => t.estado === "PENDIENTE" || t.estado === "REPORTADA"
    ).length;

    // Datos por edificio
    const edificiosData = proyecto.edificios.map((e) => {
      const tareas = e.pisos.flatMap((p) =>
        p.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas))
      );
      const prog = calcularProgreso(tareas);
      const unidades = e.pisos.reduce((acc, p) => acc + p.unidades.length, 0);
      return {
        nombre: e.nombre,
        unidades,
        porcentajeAprobado: prog.porcentajeAprobado,
        porcentajeReportado: prog.porcentajeReportado,
        tareasAprobadas: prog.aprobadas,
        tareasTotales: prog.total,
      };
    });

    const pdfBuffer = await renderToBuffer(
      ProgresoReport({
        data: {
          proyectoNombre: proyecto.nombre,
          constructoraNombre: proyecto.constructora.nombre,
          fechaInicio: proyecto.fecha_inicio,
          fechaFin: proyecto.fecha_fin_estimada,
          progreso,
          stats: { pendientes, noAprobadas, enRiesgo },
          edificios: edificiosData,
        },
      })
    );

    const filename = `progreso-${proyecto.nombre.replace(/\s+/g, "-").toLowerCase()}-${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reportes/progreso/[proyectoId]", error);
    return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
  }
}
