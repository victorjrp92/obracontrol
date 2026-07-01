import { HardHat, Home } from "lucide-react";
import Reveal from "./Reveal";

const perfiles = [
  {
    icon: Home,
    etiqueta: "Propietario",
    color: "bg-blue-600",
    texto:
      "Remodelas o construyes lo tuyo y quieres control del avance, del presupuesto y de los pagos, sin vivir en la obra.",
    resultado: "Duermes tranquilo: ves con pruebas que tu plata está avanzando.",
  },
  {
    icon: HardHat,
    etiqueta: "Contratista",
    color: "bg-orange-500",
    texto:
      "Tienes un negocio de un oficio (pintura, carpintería, eléctricos, cocinas…) y mandas tu gente a obras de clientes. Quieres verte pro y controlar a distancia.",
    resultado:
      "Te ves profesional: tu cliente ve el avance en vivo y te paga sin pelear.",
  },
];

export default function BetaAudience() {
  return (
    <section className="bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            ¿Para quién es?
          </h2>
          <p data-reveal className="mx-auto mt-3 max-w-md text-base text-slate-600">
            Seiricon se adapta a los dos lados de la obra.
          </p>
        </Reveal>

        <Reveal className="grid gap-5 sm:grid-cols-2" stagger={0.12}>
          {perfiles.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.etiqueta}
                data-reveal
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md sm:p-8"
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${p.color} shadow-sm`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">{p.etiqueta}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{p.texto}</p>
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800">
                  {p.resultado}
                </p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
