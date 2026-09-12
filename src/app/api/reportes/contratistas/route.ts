import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/access";
import { ContratistasReport } from "@/lib/pdf/ContratistasReport";

/**
 * GET /api/reportes/contratistas — PDF con el ranking de contratistas.
 *
 * SOLO SUPER_ADMIN. Antes bastaba con estar autenticado, asi que un
 * contratista o un obrero de la misma constructora podia bajarse el puntaje de
 * todos sus companeros escribiendo la URL. Es informacion sobre el desempeno
 * de personas: quien la ve es una decision de producto, no un descuido.
 *
 * Acepta `?constructora=<id>` porque un super admin no pertenece a la empresa
 * que quiere auditar: sin el parametro reportaria los contratistas de su
 * propio tenant, que no tiene ninguno.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: {
        constructora: { select: { nombre: true } },
        rol_ref: { select: { nivel_acceso: true } },
      },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (!isSuperAdmin(usuario.rol_ref.nivel_acceso)) {
      // 404 y no 403: un 403 confirma que el reporte existe.
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const pedida = req.nextUrl.searchParams.get("constructora");
    const objetivo = pedida
      ? await prisma.constructora.findUnique({ where: { id: pedida }, select: { id: true, nombre: true } })
      : { id: usuario.constructora_id, nombre: usuario.constructora.nombre };
    if (!objetivo) return NextResponse.json({ error: "Constructora no encontrada" }, { status: 404 });

    const contratistas = await prisma.contratista.findMany({
      where: { usuario: { constructora_id: objetivo.id } },
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
          // La constructora AUDITADA, no la de quien descarga: con el
          // parametro puesto, un super admin baja el de otro tenant y el PDF
          // tiene que decir de quien es.
          constructoraNombre: objetivo.nombre,
          contratistas: data,
        },
      })
    );

    const sufijo = objetivo.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `contratistas-${sufijo}-${new Date().toISOString().split("T")[0]}.pdf`;

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
