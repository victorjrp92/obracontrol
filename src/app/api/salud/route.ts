import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/salud — sonda de despliegue.
 *
 * Existe por una caída concreta: se desplegó `main` con el código de
 * suscripciones y la migración no se había aplicado. El cliente de Prisma pedía
 * cuatro columnas de `constructoras` que la base no tenía, y CUALQUIER página
 * del dashboard devolvía 500 — porque el layout llama a `getUsuarioActual()`,
 * que hace `include: { constructora: true }`. Nadie se enteró hasta que una
 * persona intentó entrar.
 *
 * Por eso la comprobación del esquema no es un `SELECT 1`: lee una constructora
 * pidiendo EXACTAMENTE las columnas que el código espera. Si la base va por
 * detrás de una migración, esto se cae igual que se caería el dashboard, y se
 * cae aquí primero — que es todo el objetivo.
 *
 * NO devuelve datos ni mensajes de error: solo tres booleanos. Es pública para
 * que la pueda llamar el CI sin secretos, así que no puede contar nada del
 * interior. El detalle del fallo va a los logs del servidor, no a la respuesta.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let base = false;
  let esquema = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    base = true;

    // `findFirst` sobre una tabla vacía devuelve null sin error, y da igual: lo
    // que se está comprobando es que Postgres acepte el SELECT con estas
    // columnas, no que haya filas.
    await prisma.constructora.findFirst({
      select: {
        id: true,
        plan_suscripcion: true,
        estado_suscripcion: true,
        suscripcion_vence_el: true,
      },
    });
    esquema = true;
  } catch (e) {
    console.error("GET /api/salud:", e instanceof Error ? e.message : e);
  }

  const ok = base && esquema;
  return NextResponse.json(
    { ok, base, esquema },
    {
      status: ok ? 200 : 503,
      // Una sonda cacheada miente: diría que todo va bien un rato después de
      // que dejara de ir bien.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
