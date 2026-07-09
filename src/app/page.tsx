import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getHomePathForRole } from "@/lib/access";
import PwaLaunchRedirect from "@/components/pwa/PwaLaunchRedirect";
import "@/components/landing-v2/landing-v2.css";

import NavBar from "@/components/landing-v2/NavBar";
import Hero from "@/components/landing-v2/Hero";
import Pasos from "@/components/landing-v2/Pasos";
import Ticker from "@/components/landing-v2/Ticker";
import Cifras from "@/components/landing-v2/Cifras";
import FiguraDashboard from "@/components/landing-v2/FiguraDashboard";
import FiguraObrero from "@/components/landing-v2/FiguraObrero";
import SeccionCrearObra from "@/components/landing-v2/SeccionCrearObra";
import FiguraEquipo from "@/components/landing-v2/FiguraEquipo";
import MapaVivo from "@/components/landing-v2/MapaVivo";
import SeccionGastos from "@/components/landing-v2/SeccionGastos";
import GridDenso from "@/components/landing-v2/GridDenso";
import Precios from "@/components/landing-v2/Precios";
import Testimonio from "@/components/landing-v2/Testimonio";
import Faq from "@/components/landing-v2/Faq";
import Cierre from "@/components/landing-v2/Cierre";
import Footer from "@/components/landing-v2/Footer";
import Reveals from "@/components/landing-v2/Reveals";

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
    <div className="lv2">
      <Suspense fallback={null}>
        <PwaLaunchRedirect />
      </Suspense>
      <NavBar />
      <Hero />
      <Pasos />
      <Ticker />
      <Cifras />
      <FiguraDashboard />
      <FiguraObrero />
      <SeccionCrearObra />
      <FiguraEquipo />
      <MapaVivo />
      <SeccionGastos />
      <GridDenso />
      <Precios />
      <Testimonio />
      <Faq />
      <Cierre />
      <Footer />
      <Reveals />
    </div>
  );
}
