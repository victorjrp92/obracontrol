import { NextResponse } from "next/server";
import { tenantErrorResponse } from "@/lib/tenant";
import { ProductoTecnicoError } from "./errores";

/**
 * Traduce cualquier error de una ruta del módulo a su respuesta JSON.
 *
 * Los errores del dominio ya traen `status` y `codigo`: se devuelven tal cual.
 * Los de tenant los traduce `tenantErrorResponse()`. Todo lo demás sale como
 * 500 genérico y se registra en el servidor — por estas rutas viajan nombres
 * de archivo y de obra, y no tienen por qué acabar en la respuesta de un error
 * inesperado.
 */
export function respuestaDeError(error: unknown, contexto: string): NextResponse {
  const deTenant = tenantErrorResponse(error);
  if (deTenant) return deTenant;

  if (error instanceof ProductoTecnicoError) {
    // Un 5xx del dominio es una invariante rota (dos versiones vigentes a la
    // vez, por ejemplo). Sale con su mensaje porque le sirve a quien lo ve,
    // pero además se registra: nadie va a reportar lo que la UI ya explicó.
    if (error.status >= 500) {
      console.error(`${contexto} [${error.codigo}]`, error.message);
    }
    return NextResponse.json(
      { error: error.message, codigo: error.codigo },
      { status: error.status },
    );
  }

  console.error(contexto, error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
