import { HardHat, Home } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";

// Las dos puertas mapean 1:1 a TipoCuenta.PROPIETARIO y TipoCuenta.CONTRATISTA
// (perfiles que el producto YA soporta: ver src/lib/plan.ts y RegistroWizard.tsx).
// Al reparador se le habla con dignidad — nunca como sospechoso.
const puertas = [
  {
    icon: Home,
    color: "bg-blue-600",
    etiqueta: "Voy a mandar a arreglar mi casa",
    texto:
      "Vas a contratar a alguien y no quieres pagar a ciegas. Armas la lista de arreglos en minutos, quien trabaja sube las fotos desde su celular, y tú apruebas lo que de verdad se hizo antes de soltar la plata.",
  },
  {
    icon: HardHat,
    color: "bg-orange-500",
    etiqueta: "Yo soy el que repara",
    texto:
      "Eres maestro, contratista o arquitecto, y estás cansado de que te midan con la misma vara que a los que se roban el anticipo. Aquí tu trabajo queda documentado solo: tu cliente ve el avance sin llamarte cada día, y te paga sin pelear.",
  },
];

export default function ReparaDosPuertas() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            ¿De qué lado estás?
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 sm:grid-cols-2" stagger={0.12}>
          {puertas.map((p) => {
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
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
