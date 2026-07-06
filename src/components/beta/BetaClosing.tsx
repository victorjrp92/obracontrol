import { ArrowRight } from "lucide-react";
import { CUPOS_TOTALES } from "./config";
import Reveal from "./Reveal";

export default function BetaClosing() {
  return (
    <section className="bg-slate-50 pb-20 pt-4 sm:pb-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div
            data-reveal
            className="relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16"
            style={{
              background:
                "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)",
            }}
          >
            <div className="dot-pattern absolute inset-0 opacity-10" />
            <div className="relative flex flex-col items-center gap-5">
              <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                Tu obra bajo control, desde tu celular
              </h2>
              <p className="max-w-md text-base text-blue-100">
                Solo {CUPOS_TOTALES} cupos para el beta. Reserva el tuyo antes de que se llenen.
              </p>
              <a
                href="#inscribirme"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-700 shadow-lg transition-colors hover:bg-blue-50"
              >
                Reservar mi cupo gratis
                <ArrowRight className="h-5 w-5" />
              </a>
              <p className="text-xs text-blue-200">Gratis en el beta · Sin instalar nada</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
