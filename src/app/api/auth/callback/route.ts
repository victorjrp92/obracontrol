import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionarUsuario, provisionarPersonal } from "@/lib/onboarding";

/**
 * Destinos internos permitidos tras el callback. Lista blanca CERRADA: el
 * valor de `next` viene de la URL y por tanto lo controla quien arme el
 * enlace. Concatenarlo crudo contra el origen permitía salirse del dominio
 * (`?next=@evil.com` produce `https://seiricon.com@evil.com`, cuyo host real
 * es `evil.com`) — el patrón clásico de redirección abierta usado para
 * phishing. Cualquier destino nuevo se agrega aquí a propósito.
 */
const DESTINOS_PERMITIDOS = new Set([
  "/onboarding",
  "/dashboard",
  "/empezar",
  "/nueva-contrasena",
  "/aceptar-politica",
]);

const DESTINO_POR_DEFECTO = "/onboarding";

/** Devuelve `crudo` solo si es un destino interno conocido; si no, el de por defecto. */
function destinoSeguro(crudo: string | null): string {
  if (crudo && DESTINOS_PERMITIDOS.has(crudo)) return crudo;
  return DESTINO_POR_DEFECTO;
}

// GET /api/auth/callback — Supabase Auth callback (email confirmation, OAuth)
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  // Por defecto, una cuenta que confirma correo / entra por OAuth pasa por
  // /onboarding (que decide su destino o lo salta si ya respondió). Flujos
  // especiales como la recuperación de contraseña fijan su propio `next`
  // (p. ej. /nueva-contrasena) y NO deben caer en el onboarding.
  const next = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Provisionar usuario en Prisma si no existe (necesario para Google OAuth)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const nombre =
          user.user_metadata?.full_name ??
          user.user_metadata?.nombre ??
          user.email.split("@")[0];
        const tipoCuenta = user.user_metadata?.tipo_cuenta;

        try {
          if (tipoCuenta === "CONTRATISTA" || tipoCuenta === "PROPIETARIO") {
            // Cuenta personal: sin datos demo, entra al módulo de intención.
            await provisionarPersonal(user.email, nombre, tipoCuenta, {
              estudioNombre: user.user_metadata?.estudio_nombre,
            });
          } else {
            const empresa = user.user_metadata?.empresa ?? "Mi Constructora";
            await provisionarUsuario(user.email, nombre, empresa);
          }
        } catch {
          // Continuar aunque falle — el usuario al menos puede ver el dashboard vacío
        }
      }

      // `new URL(ruta, base)` en vez de concatenar strings: aunque `next` ya
      // viene de la lista blanca, construir la URL con el parser cierra la
      // puerta a que un destino futuro reintroduzca el problema.
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
