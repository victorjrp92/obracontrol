import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated SUPER_ADMIN user, or `null` if the caller is not one.
 * Use in API routes:
 *   const su = await requireSuperAdmin();
 *   if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
 */
export async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { email: user.email },
    include: { rol_ref: true },
  });
  if (!usuario || usuario.rol_ref.nivel_acceso !== "SUPER_ADMIN") return null;
  return usuario;
}
