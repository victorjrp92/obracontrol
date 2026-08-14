import { ChevronDown } from "lucide-react";
import Reveal from "./Reveal";

const preguntas = [
  {
    q: "¿Cuánto cuesta?",
    a: "Gratis durante el beta. Y si entras como fundador, congelas el precio más bajo de por vida.",
  },
  {
    q: "¿Y después del beta, cuánto vale?",
    a: "Te avisamos con tiempo. Como fundador, congelas el precio más bajo para siempre; nunca te subiremos por encima de eso.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Si usas WhatsApp, usas Seiricon. Te acompañamos en tu primera obra por videollamada.",
  },
  {
    q: "¿Tengo que instalar algo?",
    a: "No. Funciona en el navegador de tu celular y, si quieres, se puede instalar como app con un toque.",
  },
  {
    q: "¿Me van a estar llamando o enviando publicidad?",
    a: "No. Solo te escribimos por WhatsApp para activarte. Sin spam.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Tu información y la de tu obra están protegidas y solo tú y quien tú autorices las ven. No vendemos tus datos ni los de tus clientes. Punto.",
  },
  {
    q: "¿Cuándo empiezo?",
    a: "Te contactamos por WhatsApp para activarte y acompañarte en tu primera obra.",
  },
];

export default function BetaFaq() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Reveal className="mb-8 text-center sm:mb-10">
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Preguntas frecuentes
          </h2>
        </Reveal>

        <Reveal className="flex flex-col gap-3" stagger={0.08}>
          {preguntas.map((item) => (
            <details
              key={item.q}
              data-reveal
              className="group rounded-xl border border-slate-200 bg-slate-50 open:bg-white open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-slate-900 sm:text-base">
                {item.q}
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
