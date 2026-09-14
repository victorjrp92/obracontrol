import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, KeyRound, Shield } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import PerfilCampoForm from "./PerfilCampoForm";

export const dynamic = "force-dynamic";

/**
 * «Sus datos los pone él, pero el perfil se lo crea la empresa».
 *
 * Esta ruta es hermana de `/campo/[proyectoId]`. No chocan: Next resuelve
 * primero el segmento estático, así que `/campo/perfil` nunca se interpreta
 * como una obra llamada «perfil» (y los ids de obra son cuid, no palabras).
 */
export default async function PerfilCampoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  return (
    <>
      <Topbar title="Mis datos" subtitle="Tu información de contacto" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          <PerfilCampoForm
            nombre={usuario.nombre}
            email={usuario.email}
            telefono={usuario.telefono}
          />

          {/* Lo que NO decide él. Se enseña igual para que sepa a quién pedirle
              un cambio en vez de buscar un botón que no existe. */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4">Tu cuenta en la empresa</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Rol</p>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {usuario.rol_ref.nombre}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Empresa</p>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {usuario.constructora?.nombre ?? ""}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Tu cuenta la creó tu empresa y las obras que ves te las asigna un administrador. Si
              te falta una obra, pídesela a él.
            </p>
          </div>

          {/* La contraseña llegó por correo al crear la cuenta; el flujo de
              recuperación es el mismo para todos los roles, así que se enlaza
              en vez de duplicarlo. */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-400" />
              Contraseña
            </h2>
            <p className="text-xs text-slate-500">
              Tu contraseña llegó al correo cuando tu empresa creó la cuenta. Para cambiarla, usa{" "}
              <Link href="/recuperar" className="text-blue-600 hover:text-blue-700 font-medium underline">
                recuperar contraseña
              </Link>
              : te llegará un enlace a tu correo.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
