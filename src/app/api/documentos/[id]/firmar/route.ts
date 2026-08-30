import { NextResponse } from "next/server";
import { checkAdminProjectPermission } from "@/lib/access";
import {
  almacenPerfilFirma,
  almacenPrisma,
  fechaEnColombia,
  firmarDocumento,
  momentoEnColombia,
} from "@/lib/documentos";
import { assertProyectoInTenant, requireUser, tenantErrorResponse } from "@/lib/tenant";
import { respuestaDeFalla } from "../../_fallas";

/**
 * POST /api/documentos/[id]/firmar
 *
 * Cierra el documento con la firma del profesional.
 *
 * LA SESIÓN ES LA IDENTIDAD. El cuerpo de la petición no aporta nada y no se
 * lee: quién firma sale de `requireUser()`, cuándo firma sale del reloj del
 * servidor, y la matrícula sale de su perfil. Un campo de texto donde el propio
 * firmante escribiera su nombre no probaría absolutamente nada.
 *
 * La matrícula se CONGELA aquí: se copia del perfil a la fila del documento. Si
 * el profesional la cambia mañana, este documento sigue diciendo la de hoy —
 * ninguna operación del módulo sabe reescribir una fila ya firmada.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireUser();
    const { id } = await params;

    const doc = await almacenPrisma.porId(id);
    // Un documento sin obra no es de nadie en este tenant: no se puede acotar,
    // así que para esta ruta no existe.
    if (!doc || !doc.proyecto_id) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    await assertProyectoInTenant(doc.proyecto_id, ctx.constructoraId);

    // Firmar un documento sobre una obra pesa al menos tanto como editarla.
    const puede = await checkAdminProjectPermission(ctx.usuario.id, doc.proyecto_id, "can_edit_project");
    if (!puede) {
      return NextResponse.json(
        { error: "No tienes permiso para firmar documentos de esta obra" },
        { status: 403 }
      );
    }

    const perfil = await almacenPerfilFirma.leer(ctx.usuario.id);
    const firmado = await firmarDocumento(id, { usuarioId: ctx.usuario.id, perfil });

    return NextResponse.json({
      folio: firmado.folio,
      version: firmado.version,
      matricula: firmado.matricula,
      firmadoEl: firmado.firmado_el ? fechaEnColombia(firmado.firmado_el) : null,
      firmadoMomento: firmado.firmado_el ? momentoEnColombia(firmado.firmado_el) : null,
    });
  } catch (err) {
    const falla = respuestaDeFalla(err);
    if (falla) return falla;
    const tenant = tenantErrorResponse(err);
    if (tenant) return tenant;
    console.error("POST /api/documentos/[id]/firmar: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
