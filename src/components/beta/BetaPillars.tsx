import { ShieldCheck, Wallet, Smartphone } from "lucide-react";
import Reveal from "./Reveal";

const pilares = [
  {
    icon: ShieldCheck,
    color: "bg-blue-600",
    titulo: "Control a distancia con evidencia confiable",
    texto:
      "Cada tarea se cierra con foto + GPS + hora. No es «me dijeron que ya está»: la prueba muestra que estuvieron ahí y cuándo. Así el dueño controla sin desconfiar; el contratista demuestra su trabajo y cobra sin discutir.",
  },
  {
    icon: Wallet,
    color: "bg-orange-500",
    titulo: "Control de tu plata",
    texto:
      "Presupuesto, anticipos con factura y la alarma de «plata entregada vs. sustentada». Sabes en qué se va cada peso.",
  },
  {
    icon: Smartphone,
    color: "bg-orange-500",
    titulo: "Todo desde el celular, sin fricción",
    texto:
      "Tu gente sube la evidencia sin instalar nada, por un link. Tú apruebas desde donde estés.",
  },
];

export default function BetaPillars() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <span
            data-reveal
            className="mb-4 inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700"
          >
            Por qué Seiricon
          </span>
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Lo que cambia cuando tienes pruebas, no cuentos
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 sm:grid-cols-3" stagger={0.12}>
          {pilares.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.titulo}
                data-reveal
                className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-6 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md"
              >
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
