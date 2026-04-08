import Link from "next/link";
import { HardHat, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { recuperarContrasena } from "../actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function RecuperarPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center hero-bg px-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Revisa tu correo</h2>
          <p className="text-slate-500 text-sm mb-6">
            Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm w-full"
          >
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex hero-bg">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
              <HardHat className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">
              Obra<span className="text-blue-600">Control</span>
            </span>
          </Link>

          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Recupera tu contraseña</h1>
          <p className="text-slate-500 text-sm mb-8">
            Ingresa tu correo y te enviaremos un enlace para restablecerla.{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Volver al login
            </Link>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={recuperarContrasena} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@constructora.co"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Enviar enlace de recuperación
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Right — visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 backdrop-blur">
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4 leading-tight">
            Recupera el acceso a tu cuenta en segundos
          </h2>
          <p className="text-blue-200 text-base leading-relaxed">
            Te enviaremos un enlace seguro para que puedas restablecer tu contraseña fácilmente.
          </p>
        </div>
      </div>
    </div>
  );
}
