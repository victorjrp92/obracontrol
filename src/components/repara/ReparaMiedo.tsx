import { Quote } from "lucide-react";
// Reutilizamos el Reveal de /beta a propósito (NO se extrae un ui/Reveal común:
// eso obligaría a tocar dos landings ya publicados). Acoplamiento deliberado y
// documentado — ver docs/specs/2026-08-13-seiricon-go-repara.md, D8.
import Reveal from "@/components/beta/Reveal";

const testimonios = [
  "Le di el anticipo para los materiales y no volvió a contestar el teléfono.",
  "Me dijo que ya iba en la mitad. Yo no estaba ahí para verlo.",
  "Me cobró cemento que nunca llegó a mi casa.",
  "Mi mamá está sola en la casa y yo vivo en otra ciudad.",
];

export default function ReparaMiedo() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <span
            data-reveal
            className="mb-4 inline-block rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700"
          >
            Lo que pasa después de la réplica
          </span>
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            El segundo golpe no lo da el temblor
          </h2>
          <p
            data-reveal
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600"
          >
            Está documentado en todos los desastres, en todos los países: cuando media ciudad
            necesita arreglos al tiempo, aparecen los que piden la mitad por adelantado &ldquo;para
            comprar materiales&rdquo; y no vuelven a contestar. O empiezan, cobran, y dejan la casa
            a medias. No es mala suerte. Es un patrón.
          </p>
        </Reveal>

        <Reveal className="grid gap-4 sm:grid-cols-2" stagger={0.1}>
          {testimonios.map((t) => (
            <blockquote
              key={t}
              data-reveal
              className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6"
            >
              <Quote className="h-5 w-5 flex-shrink-0 text-slate-300" />
              <p className="text-sm leading-relaxed text-slate-700">{t}</p>
            </blockquote>
          ))}
        </Reveal>

        <Reveal className="mt-10 text-center">
          <p data-reveal className="text-base font-semibold text-slate-800">
            No se trata de desconfiar de todo el mundo. Se trata de tener con qué.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
