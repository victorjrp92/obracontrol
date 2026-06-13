import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getHomePathForRole } from "@/lib/access";
import { tieneConsentimientoVigente, POLITICA_VERSION } from "@/lib/consent";
import AceptarPoliticaForm from "./AceptarPoliticaForm";

export const dynamic = "force-dynamic";

export default async function AceptarPoliticaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  // Si ya aceptó la versión vigente, no tiene nada que hacer aquí.
  if (await tieneConsentimientoVigente(usuario.id)) {
    redirect(getHomePathForRole(usuario.rol_ref.nivel_acceso));
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Antes de continuar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Hola {usuario.nombre.split(" ")[0]}. Para usar la aplicación necesitamos tu autorización
          para el tratamiento de datos personales.
        </p>

        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-2">
          <p>
            Tratamos datos como tu nombre, correo, datos de tus obras, fotos con fecha y ubicación,
            y los datos del personal que registres. Los usamos solo para prestar el servicio.
          </p>
          <p>
            Puedes conocer el detalle, tus derechos y cómo ejercerlos en nuestra{" "}
            <Link href="/privacidad" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
              Política de Tratamiento de Datos
            </Link>{" "}
            y los{" "}
            <Link href="/terminos" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
              Términos y Condiciones
            </Link>
            .
          </p>
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          Al aceptar guardaremos la fecha, tu dirección IP y el dispositivo como constancia de tu
          autorización (versión {POLITICA_VERSION}), conforme a la Ley 1581 de 2012.
        </p>

        <AceptarPoliticaForm />
      </div>
    </main>
  );
}
