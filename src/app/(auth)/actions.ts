"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionarUsuario } from "@/lib/onboarding";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function registro(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nombre = formData.get("name") as string;
  const empresa = formData.get("company") as string;

  // Campos opcionales de la empresa (step 1 del wizard)
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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, empresa },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
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

  redirect("/dashboard");
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
  await supabase.auth.signOut();
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
