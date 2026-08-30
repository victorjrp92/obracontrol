import { NextRequest, NextResponse } from "next/server";
import { almacenPerfilFirma } from "@/lib/documentos";
import { requireUser, tenantErrorResponse } from "@/lib/tenant";
import { respuestaDeFalla } from "../_fallas";

/**
 * Perfil de firma del profesional: su imagen de firma y su matrícula.
 *
 * Se configura una vez y sirve para todos los documentos que emita. La imagen
 * vive en el bucket PRIVADO y solo se sirve con URL temporal: quien tenga una
 * imagen de firma puede pegarla en cualquier papel, así que no se publica.
 *
 * Siempre sobre el usuario de la SESIÓN. No hay parámetro de usuario y no puede
 * haberlo: una ruta que aceptara un id ajeno sería una ruta para robar firmas.
 */

/** GET — qué tiene configurado, con URL temporal para pintar la imagen. */
export async function GET() {
  try {
    const ctx = await requireUser();
    const perfil = await almacenPerfilFirma.leer(ctx.usuario.id);
    return NextResponse.json({
      matricula: perfil.matricula,
      tieneImagen: perfil.imagenPath !== null,
      imagenUrl: perfil.imagenPath ? await almacenPerfilFirma.urlImagen(perfil.imagenPath) : null,
    });
  } catch (err) {
    const tenant = tenantErrorResponse(err);
    if (tenant) return tenant;
    console.error("GET /api/documentos/perfil-firma: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** POST — sube (o sustituye) la imagen de firma. `multipart/form-data`. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireUser();

    const formulario = await req.formData();
    const archivo = formulario.get("firma");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No llegó ninguna imagen" }, { status: 400 });
    }

    const perfil = await almacenPerfilFirma.guardarImagen(ctx.usuario.id, archivo);
    return NextResponse.json({
      matricula: perfil.matricula,
      tieneImagen: perfil.imagenPath !== null,
      imagenUrl: perfil.imagenPath ? await almacenPerfilFirma.urlImagen(perfil.imagenPath) : null,
    });
  } catch (err) {
    const falla = respuestaDeFalla(err);
    if (falla) return falla;
    const tenant = tenantErrorResponse(err);
    if (tenant) return tenant;
    console.error("POST /api/documentos/perfil-firma: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH — registra o actualiza la matrícula.
 *
 * Cambiarla NO altera ningún documento ya firmado: allí quedó congelada la que
 * estaba vigente el día de la firma. Esta es la que se usará de aquí en adelante.
 */
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireUser();

    const cuerpo = (await req.json()) as { matricula?: unknown };
    const matricula = typeof cuerpo.matricula === "string" ? cuerpo.matricula : "";

    const perfil = await almacenPerfilFirma.guardarMatricula(ctx.usuario.id, matricula);
    return NextResponse.json({ matricula: perfil.matricula, tieneImagen: perfil.imagenPath !== null });
  } catch (err) {
    const falla = respuestaDeFalla(err);
    if (falla) return falla;
    const tenant = tenantErrorResponse(err);
    if (tenant) return tenant;
    console.error("PATCH /api/documentos/perfil-firma: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
