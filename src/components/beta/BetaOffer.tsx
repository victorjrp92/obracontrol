import { ArrowRight, Gift, Lock, Users, MessageSquareHeart } from "lucide-react";
import { CUPOS_TOTALES, CUPOS_POR_PERFIL } from "./config";
import Reveal from "./Reveal";

const beneficios = [
  {
    icon: Gift,
    titulo: "3 meses gratis",
    texto: "Usa Seiricon completo, sin pagar, durante todo el beta.",
  },
  {
    icon: Lock,
    titulo: "Precio de fundador congelado",
    texto: "Cuando terminemos el beta, mantienes el precio más bajo de por vida.",
  },
  {
    icon: MessageSquareHeart,
    titulo: "A cambio: tu feedback",
    texto: "Nos cuentas qué sirve y qué no, para pulir la app contigo.",
  },
];

export default function BetaOffer() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-16 sm:py-24">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          {/* Escasez real y honesta */}
          <span
            data-reveal
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 text-sm font-bold text-orange-300"
          >
            <Users className="h-4 w-4" />
            Solo {CUPOS_TOTALES} cupos · {CUPOS_POR_PERFIL} por perfil
          </span>

          <h2 data-reveal className="text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Sé <span className="text-gradient-hero">Fundador Seiricon</span>
          </h2>
          <p data-reveal className="mx-auto mt-4 max-w-xl text-base text-white/60 sm:text-lg">
            Abrimos {CUPOS_TOTALES} lugares: {CUPOS_POR_PERFIL} propietarios y {CUPOS_POR_PERFIL} contratistas.
            Los primeros entran gratis; el resto queda en lista de espera.
          </p>
          <p data-reveal className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/50">
            Elegimos a los {CUPOS_POR_PERFIL} mejores de cada perfil y confirmamos en
            una llamada 1-a-1. Cuando se llenan, el resto pasa a lista de espera para
            la siguiente ronda.
          </p>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 text-left sm:grid-cols-3" stagger={0.12}>
          {beneficios.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.titulo}
                data-reveal
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
                  <Icon className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="mb-1 text-sm font-bold text-white">{b.titulo}</h3>
                <p className="text-sm leading-relaxed text-white/50">{b.texto}</p>
              </div>
            );
          })}
        </Reveal>

        <Reveal className="mt-10">
          <a
            data-reveal
            href="#inscribirme"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700"
          >
            Quiero mi cupo
            <ArrowRight className="h-5 w-5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
