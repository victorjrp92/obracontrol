import Link from "next/link";
import { ShieldAlert } from "lucide-react";

// Franja discreta bajo el hero: devuelve tráfico a /alerta (gratis, sin cuenta)
// ANTES de vender nada. Es la primera de las dos veces que /repara enlaza a
// /alerta — el remarketing honesto va en este sentido, no al revés.
export default function ReparaFranjaAlerta() {
  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-2xl items-start gap-2.5 px-4 py-3.5 sm:items-center sm:px-6">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 sm:mt-0" />
        <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
          ¿Todavía no sabes si esa grieta es grave? Revísala gratis primero, sin cuenta →{" "}
          <Link href="/alerta" className="font-semibold text-blue-600 hover:text-blue-700">
            Seiricon Alerta
          </Link>
        </p>
      </div>
    </div>
  );
}
