"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { provisionarUsuario, provisionarPersonal } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { getHomePathForRole } from "@/lib/access";
import { registrarConsentimiento } from "@/lib/consent";
import type { TipoCuenta } from "@/generated/prisma";
import { esCuentaPersonal } from "@/lib/plan";

/** Valores válidos del enum, para validar lo que llega del formulario. */
const TIPOS_CUENTA: TipoCuenta[] = ["CONSTRUCTORA", "CONTRATISTA", "PROPIETARIO", "ARQUITECTO"];

/**
 * Registra el consentimiento (IP + fecha) del usuario recién creado.
 * El checkbox del formulario es obligatorio, así que llegar aquí implica aceptación.
 * No bloquea el registro si falla (el gate /aceptar-politica lo recoge luego).
 */
async function registrarConsentimientoRegistro(email: string): Promise<void> {
  try {
    const u = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (u) await registrarConsentimiento(u.id);
  } catch {
    // best-effort
  }
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const rawEmail = (formData.get("email") as string | null) ?? "";
  const password = formData.get("password") as string;
  const email = rawEmail.trim().toLowerCase();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Invalidar TODOS los layouts cacheados — evita que aparezca el usuario anterior.
  revalidatePath("/", "layout");

  // Redirect by role: SUPER_ADMIN → /super-admin, DIRECTIVO → /directivo,
  // CONTRATISTA → /contratista, ADMIN_* → /dashboard.
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { rol_ref: { select: { nivel_acceso: true } } },
  });
  const home = usuario ? getHomePathForRole(usuario.rol_ref.nivel_acceso) : "/dashboard";
  redirect(home);
}

export async function registro(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nombre = formData.get("name") as string;
  const empresa = formData.get("company") as string;

  // Perfil elegido en el paso 0 del wizard. Por defecto CONSTRUCTORA (empresa)
  // para no cambiar el comportamiento de quien no eligió perfil.
  const tipoCuentaRaw = (formData.get("tipo_cuenta") as string) || "CONSTRUCTORA";
  // Se valida contra el enum de Prisma, NO contra una lista escrita a mano: la
  // lista anterior tenía solo CONTRATISTA y PROPIETARIO, así que al añadir
  // ARQUITECTO el perfil se caía en silencio a la rama de empresa. Cualquier
  // perfil futuro entra aquí solo.
  const tipoCuenta: TipoCuenta = TIPOS_CUENTA.includes(tipoCuentaRaw as TipoCuenta)
    ? (tipoCuentaRaw as TipoCuenta)
    : "CONSTRUCTORA";
  const esPersonal = esCuentaPersonal(tipoCuenta);

  // ── Cuenta PERSONAL (contratista B2C / propietario) ───────────────────────
  if (esPersonal) {
    const estudioNombre = (formData.get("estudio_nombre") as string) || undefined;
    const telefono = (formData.get("persona_telefono") as string) || undefined;
    const ciudad = (formData.get("persona_ciudad") as string) || undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Guardamos el tipo de cuenta en metadata para que el callback de
        // confirmación por correo pueda re-provisionar correctamente.
        data: { nombre, tipo_cuenta: tipoCuenta, estudio_nombre: estudioNombre },
        // Tras confirmar el correo, pasa por /onboarding (que luego sigue a /empezar).
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      redirect(`/registro?error=${encodeURIComponent(error.message)}`);
    }

    try {
      await provisionarPersonal(email, nombre, tipoCuenta, { estudioNombre, telefono, ciudad });
    } catch {
      // Si falla silenciosamente, el callback lo reintentará
    }

    await registrarConsentimientoRegistro(email);

    // Si Supabase exige confirmar el correo, no hay sesión activa todavía:
    // llevamos a una pantalla que explica que revise su correo (no a /login).
    if (!data.session) redirect("/revisa-tu-correo");
    // Cuenta recién creada con sesión: pasa por el onboarding antes de entrar.
    // /onboarding decide el destino final (personal → /empezar).
    redirect("/onboarding");
  }

  // ── Cuenta de EMPRESA (flujo actual) ──────────────────────────────────────
  const empresaNit = (formData.get("empresa_nit") as string) || undefined;
  const empresaDireccion = (formData.get("empresa_direccion") as string) || undefined;
  const empresaCiudad = (formData.get("empresa_ciudad") as string) || undefined;
  const empresaTelefono = (formData.get("empresa_telefono") as string) || undefined;
  const empresaSitioWeb = (formData.get("empresa_sitio_web") as string) || undefined;

  const empresaData = {
    nit: empresaNit,
    direccion: empresaDireccion,
    ciudad: empresaCiudad,
    telefono: empresaTelefono,
    sitio_web: empresaSitioWeb,
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, empresa },
      // Tras confirmar el correo, pasa por /onboarding (que luego sigue a /dashboard).
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(`/registro?error=${encodeURIComponent(error.message)}`);
  }

  // Provisionar constructora + usuario + datos demo en Prisma
  try {
    await provisionarUsuario(email, nombre, empresa, empresaData);
  } catch {
    // Si falla silenciosamente, el callback lo reintentará
  }

  await registrarConsentimientoRegistro(email);

  // Si Supabase exige confirmar el correo, aún no hay sesión: pantalla amable.
  if (!data.session) redirect("/revisa-tu-correo");
  // Cuenta de empresa recién creada con sesión: pasa por el onboarding antes
  // de entrar. /onboarding decide el destino final (empresa → /dashboard).
  redirect("/onboarding");
}

export async function loginConGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  // scope: 'local' invalida solo la sesión actual (esta cookie). Suficiente y seguro.
  await supabase.auth.signOut({ scope: "local" });
  // Invalidar layouts cacheados para que el próximo login no muestre el usuario viejo.
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function recuperarContrasena(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/api/auth/callback?next=/nueva-contrasena`,
  });

  if (error) {
    redirect(`/recuperar?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/recuperar?success=1");
}

export async function actualizarContrasena(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    redirect("/nueva-contrasena?error=Las%20contrase%C3%B1as%20no%20coinciden");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/nueva-contrasena?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?success=password_updated");
}
