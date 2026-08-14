import { ArrowRight, CalendarClock, Gift, MapPin, ShieldCheck, Users } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";
import {
  CIUDADES_ELEGIBLES_TEXTO,
  CUPOS_GO,
  FECHA_LIMITE_CUPO,
  FECHA_LIMITE_PLACEHOLDER,
  MESES_GRATIS,
} from "./config";

export default function ReparaOferta() {
  // Guarda de render: mientras el dato siga en placeholder, el bloque NO se
  // pinta. Nunca se inventa una fecha de vencimiento ni un número de cupos.
  const vigenciaLista = FECHA_LIMITE_CUPO !== FECHA_LIMITE_PLACEHOLDER;
  const cuposListos = CUPOS_GO !== null;

  const beneficios = [
    {
      icon: Gift,
      titulo: `${MESES_GRATIS} meses sin pagar nada`,
      texto:
        "El producto completo. Sin tarjeta y sin letra chica: no te pedimos datos de pago, así que no hay nada que se cobre solo.",
    },
    {
      icon: MapPin,
      titulo: `Para ${CIUDADES_ELEGIBLES_TEXTO}`,
      texto: "Donde pegó el sismo. Ahí queremos ayudar primero.",
    },
    {
      icon: ShieldCheck,
      titulo: "No te vamos a pedir papeles",
      texto:
        "Ni certificado de damnificado, ni escrituras, ni fotos de la cédula. Confiamos en tu palabra.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-900 py-16 sm:py-24">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          {cuposListos && (
            <span
              data-reveal
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 text-sm font-bold text-orange-300"
            >
              <Users className="h-4 w-4" />
              {CUPOS_GO} cupos
            </span>
          )}

          <h2 data-reveal className="text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Seiricon Go, gratis {MESES_GRATIS} meses para reparar lo del sismo
          </h2>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 text-left sm:grid-cols-3" stagger={0.12}>
          {beneficios.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.titulo} data-reveal className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
                  <Icon className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="mb-1 text-sm font-bold text-white">{b.titulo}</h3>
                <p className="text-sm leading-relaxed text-white/50">{b.texto}</p>
              </div>
            );
          })}
        </Reveal>

        {/* Salida honesta: la puerta queda abierta a quien no califica. Lo
            reservado para las zonas afectadas son los meses, no la herramienta. */}
        <Reveal className="mt-8">
          <p
            data-reveal
            className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-relaxed text-white/60"
          >
            ¿Tu caso no es del sismo, o estás en otra ciudad? Escríbenos igual. La herramienta te
            sirve exactamente igual; lo que estamos guardando para las zonas afectadas son los{" "}
            {MESES_GRATIS} meses.
          </p>
        </Reveal>

        {vigenciaLista && (
          <Reveal className="mt-5">
            <p
              data-reveal
              className="inline-flex items-center gap-2 text-sm font-semibold text-orange-300"
            >
              <CalendarClock className="h-4 w-4" />
              Puedes pedir tu cupo hasta el {FECHA_LIMITE_CUPO}.
            </p>
          </Reveal>
        )}

        <Reveal className="mt-10">
          <a
            data-reveal
            href="#cupo"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700"
          >
            Pedir mi cupo gratis
            <ArrowRight className="h-5 w-5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
