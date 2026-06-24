import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getHomePathForRole } from "@/lib/access";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import SemaforoSection from "@/components/landing/SemaforoSection";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import PwaLaunchRedirect from "@/components/pwa/PwaLaunchRedirect";

export default async function LandingPage() {
  // Si ya hay sesión iniciada, no mostramos el landing: enviamos al panel según
  // el rol (mismo destino que usa el login). El cálculo del destino va dentro del
  // try/catch — pero el redirect() va FUERA, porque redirect() lanza una excepción
  // especial (NEXT_REDIRECT) que un catch se tragaría e impediría la redirección.
  let destino: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const usuario = await prisma.usuario.findUnique({
        where: { email: user.email },
        include: { rol_ref: { select: { nivel_acceso: true } } },
      });
      destino = usuario ? getHomePathForRole(usuario.rol_ref.nivel_acceso) : "/dashboard";
    }
  } catch {
    // Si la verificación de sesión falla, mostramos el landing igual (no romper la página pública).
    destino = null;
  }
  if (destino) redirect(destino);

  return (
    <>
      <Suspense fallback={null}>
        <PwaLaunchRedirect />
      </Suspense>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SemaforoSection />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
