import { Sparkles, ImageUp, CheckCircle2 } from "lucide-react";
import Reveal from "./Reveal";

const pasos = [
  {
    numero: "1",
    icon: Sparkles,
    color: "bg-blue-600",
    titulo: "Armas tu obra en minutos",
    texto: "Con ayuda de la IA defines tareas, tiempos y presupuesto. Sin formularios interminables.",
  },
  {
    numero: "2",
    icon: ImageUp,
    color: "bg-violet-600",
    titulo: "Tu gente sube el avance",
    texto: "Fotos con ubicación y hora, por un link. Sin instalar nada en el celular.",
  },
  {
    numero: "3",
    icon: CheckCircle2,
    color: "bg-green-600",
    titulo: "Tú apruebas desde donde estés",
    texto: "Revisas la evidencia, apruebas o devuelves, y ves todo en tiempo real.",
  },
];

export default function BetaHowItWorks() {
  return (
    <section className="bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <span
            data-reveal
            className="mb-4 inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700"
          >
            Cómo funciona
          </span>
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Tres pasos, y listo
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 sm:grid-cols-3" stagger={0.15}>
          {pasos.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.numero}
                data-reveal
                className="relative rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="absolute right-5 top-5 text-4xl font-extrabold text-slate-100">
                  {p.numero}
                </span>
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${p.color} shadow-sm`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900">{p.titulo}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{p.texto}</p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
