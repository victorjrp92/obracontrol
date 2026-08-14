import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";

// Segunda (y última) vuelta de tráfico hacia /alerta, antes del cierre. Que la
// campaña de pago devuelva gente a la herramienta gratuita es justamente lo que
// separa el remarketing honesto de aprovecharse de una emergencia.
export default function ReparaPuenteAlerta() {
  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div
            data-reveal
            className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              ¿Todavía no sabes qué tan grave es?
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Antes de contratar, entérate de lo que tienes enfrente. Seiricon Alerta es gratis, no
              pide cuenta y te dice si esa grieta puede esperar, si necesita un ingeniero, o si lo
              que toca es salir. Reparas mejor cuando sabes qué estás reparando.
            </p>
            <Link
              href="/alerta"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50"
            >
              Ir a Seiricon Alerta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
