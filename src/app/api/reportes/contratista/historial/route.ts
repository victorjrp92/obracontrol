import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getContratistaHistorial } from "@/lib/data-contratista";
import { ContratistaHistorialReport } from "@/lib/pdf/ContratistaHistorialReport";

// GET /api/reportes/contratista/historial — genera PDF del historial de aprobaciones del contratista
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

    const historialRaw = await getContratistaHistorial(usuario.id, usuario.constructora_id);

    const historialData = historialRaw.map((h) => ({
      tareaNombre: h.tarea,
      proyecto: h.proyecto,
      ubicacion: `${h.edificio} · Apto ${h.unidad}`,
      fecha: new Date(h.fecha),
      estado: h.estado,
      justificacion: h.justificacion ?? undefined,
      aprobadorNombre: h.aprobador,
    }));

    const pdfBuffer = await renderToBuffer(
      ContratistaHistorialReport({
        data: {
          contratistaNombre: usuario.nombre,
          constructoraNombre: usuario.constructora.nombre,
          historial: historialData,
        },
      })
    );

    const fecha = new Date().toISOString().split("T")[0];
    const filename = `historial-${usuario.nombre.replace(/\s+/g, "-").toLowerCase()}-${fecha}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reportes/contratista/historial", error);
    return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
  }
}
