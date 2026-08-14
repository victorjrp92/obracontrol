import { ArrowRight } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";
import { CIUDADES_ELEGIBLES_TEXTO, MESES_GRATIS } from "./config";

export default function ReparaClosing() {
  return (
    <section className="bg-slate-50 pb-20 pt-4 sm:pb-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div
            data-reveal
            className="relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16"
            style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)",
            }}
          >
            <div className="dot-pattern absolute inset-0 opacity-10" />
            <div className="relative flex flex-col items-center gap-5">
              <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                Repara tu casa. Y que quede la prueba.
              </h2>
              <p className="max-w-md text-base text-blue-100">
                Seiricon Go, gratis {MESES_GRATIS} meses para las reparaciones del sismo en{" "}
                {CIUDADES_ELEGIBLES_TEXTO}.
              </p>
              <a
                href="#cupo"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-700 shadow-lg transition-colors hover:bg-blue-50"
              >
                Pedir mi cupo gratis
                <ArrowRight className="h-5 w-5" />
              </a>
              <p className="text-xs text-blue-200">Sin tarjeta · Sin instalar nada</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
