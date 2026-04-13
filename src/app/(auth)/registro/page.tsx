import Link from "next/link";
import { Mail, Lock, User, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { registro } from "../actions";
import AuthRightPanel from "@/components/auth/AuthRightPanel";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function RegistroPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Revisa tu correo</h2>
          <p className="text-slate-500 text-sm mb-6">
            Te enviamos un enlace de confirmación a tu email. Haz click en el enlace para activar tu cuenta.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm w-full"
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <img src="/seiricon-icon.png" alt="Seiricon" className="w-10 h-10" />
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-lg tracking-wide">SEIRICON</div>
              <div className="text-[10px] text-slate-500">construyendo en orden</div>
            </div>
          </Link>

          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Crea tu cuenta gratis</h1>
          <p className="text-slate-500 text-sm mb-8">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Inicia sesión
            </Link>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={registro} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="name" name="name" type="text" autoComplete="name"
                  placeholder="Juan Pérez"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="company" className="text-sm font-medium text-slate-700">
                Nombre de la constructora <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="company" name="company" type="text"
                  placeholder="Constructora ABC"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email" name="email" type="email" autoComplete="email"
                  placeholder="tu@constructora.co"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password" name="password" type="password" autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 -mt-1">
              Al registrarte aceptas nuestros{" "}
              <Link href="/terminos" className="text-blue-600 hover:text-blue-700">términos de uso</Link>{" "}
              y{" "}
              <Link href="/privacidad" className="text-blue-600 hover:text-blue-700">política de privacidad</Link>.
            </p>

            <button
              type="submit"
              className="mt-1 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Right — interactive buildings visual */}
      <AuthRightPanel />
    </div>
  );
}
