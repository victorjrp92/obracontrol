import { ChevronDown } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec).
import Reveal from "@/components/beta/Reveal";
import { MESES_GRATIS } from "./config";

// Honestidad por encima de conversión: dos de las seis respuestas empiezan por
// "No" a propósito. Prometer que la app evita un robo sería mentir, y esta
// campaña se dirige a gente que acaba de quedar vulnerable.
const preguntas = [
  {
    q: "¿De verdad es gratis?",
    a: `Sí, ${MESES_GRATIS} meses. No pedimos tarjeta, así que no hay cobro automático que se dispare a los 30 días.`,
  },
  {
    q: "¿Y si mi maestro no es de aplicaciones?",
    a: "Solo necesita tomar una foto. Entra por un link, no instala nada.",
  },
  {
    q: "¿Y si en la casa no hay internet?",
    a: "Las fotos se guardan en el celular y se suben solas cuando vuelve la señal.",
  },
  {
    q: "¿Esto me garantiza que no me roben?",
    a: "No. Ninguna aplicación puede prometerte eso, y quien te lo prometa te está mintiendo. Lo que hace Seiricon es dejar rastro: quién hizo qué, qué día, con qué foto y con qué factura. Con rastro es mucho más difícil que te vean la cara, y si algo pasa, tienes con qué reclamar.",
  },
  {
    q: "¿Ustedes verifican a los reparadores?",
    a: "No. No tenemos una lista de reparadores aprobados por nosotros y no vamos a decir que sí. Lo que te damos son pruebas del trabajo, no un aval de la persona.",
  },
  {
    q: `¿Qué pasa cuando se cumplan los ${MESES_GRATIS} meses?`,
    a: "Te avisamos antes. Como nunca nos diste una tarjeta, no hay forma de que se te cobre sin que tú digas que sí.",
  },
];

export default function ReparaFaq() {
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
