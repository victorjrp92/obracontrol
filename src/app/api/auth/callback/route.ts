import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionarUsuario } from "@/lib/onboarding";

// GET /api/auth/callback — Supabase Auth callback (email confirmation, OAuth)
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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
        const empresa =
          user.user_metadata?.empresa ?? "Mi Constructora";

        try {
          await provisionarUsuario(user.email, nombre, empresa);
        } catch {
          // Continuar aunque falle — el usuario al menos puede ver el dashboard vacío
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
