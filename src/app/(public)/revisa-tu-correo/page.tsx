import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata = {
  title: "Revisa tu correo — Seiricon",
};

export default function RevisaTuCorreoPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
          <MailCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Revisa tu correo</h1>
        <p className="text-slate-600 text-sm">
          Te enviamos un enlace de confirmación. Ábrelo desde tu correo para activar tu cuenta y
          entrar a la aplicación.
        </p>
        <p className="text-slate-400 text-xs mt-3">
          ¿No lo ves? Revisa la carpeta de spam o correo no deseado.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
