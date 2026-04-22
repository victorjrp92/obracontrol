import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import AuthRightPanel from "@/components/auth/AuthRightPanel";
import RegistroWizard from "./RegistroWizard";

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
            Te enviamos un enlace de confirmacion a tu email. Haz click en el enlace para activar tu cuenta.
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
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <img src="/seiricon-icon.png" alt="Seiricon" className="w-10 h-10" />
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-lg tracking-wide">SEIRICON</div>
              <div className="text-[10px] text-slate-500">construyendo en orden</div>
            </div>
          </Link>

          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Crea tu cuenta gratis</h1>
          <p className="text-slate-500 text-sm mb-6">
            Ya tienes cuenta?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Inicia sesion
            </Link>
          </p>

          <RegistroWizard error={error} />
        </div>
      </div>

      {/* Right — interactive buildings visual */}
      <AuthRightPanel />
    </div>
  );
}
