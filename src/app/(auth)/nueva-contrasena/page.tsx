import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { actualizarContrasena } from "../actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NuevaContrasenaPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="min-h-dvh flex hero-bg">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <img src="/seiricon-icon.png" alt="Seiricon" className="w-10 h-10" />
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-lg tracking-wide">SEIRICON</div>
              <div className="text-[10px] text-slate-500">construyendo en orden</div>
            </div>
          </Link>

          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Nueva contraseña</h1>
          <p className="text-slate-500 text-sm mb-8">
            Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={actualizarContrasena} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Guardar nueva contraseña
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Right — visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 backdrop-blur">
            <img src="/seiricon-icon.png" alt="Seiricon" className="w-14 h-14" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4 leading-tight">
            Elige una contraseña segura para proteger tu cuenta
          </h2>
          <p className="text-blue-200 text-base leading-relaxed">
            Una vez guardada, podrás iniciar sesión con tu nueva contraseña de inmediato.
          </p>
        </div>
      </div>
    </div>
  );
}
