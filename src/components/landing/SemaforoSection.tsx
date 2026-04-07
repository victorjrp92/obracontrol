"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const semaforos = [
  {
    color: "bg-green-700",
    ring: "ring-green-300",
    label: "Verde intenso",
    condition: "> 10% antes del plazo",
    icon: "●",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    example: "Terminó 3 días antes",
  },
  {
    color: "bg-green-500",
    ring: "ring-green-200",
    label: "Verde",
    condition: "Dentro del plazo",
    icon: "●",
    text: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
    example: "Terminó a tiempo",
  },
  {
    color: "bg-yellow-400",
    ring: "ring-yellow-200",
    label: "Amarillo",
    condition: "1% – 15% de retraso",
    icon: "●",
    text: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    example: "2 días de retraso",
  },
  {
    color: "bg-red-500",
    ring: "ring-red-200",
    label: "Rojo",
    condition: "16% – 30% de retraso",
    icon: "●",
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    example: "1 semana de retraso",
  },
  {
    color: "bg-red-900",
    ring: "ring-red-300",
    label: "Vinotinto",
    condition: "> 30% de retraso",
    icon: "●",
    text: "text-red-900",
    bg: "bg-red-50",
    border: "border-red-300",
    example: "Retraso crítico",
  },
];

const buildingData = [
  [5, 4, 5, 3, 2],
  [5, 5, 4, 3, 2],
  [5, 5, 5, 4, 3],
  [5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5],
];

const colorMap = [
  "#dc2626",
  "#7c2d12",
  "#eab308",
  "#22c55e",
  "#15803d",
];

export default function SemaforoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.7, ease: "power3.out",
          scrollTrigger: { trigger: titleRef.current, start: "top 85%" },
        }
      );

      gsap.fromTo(
        cardsRef.current?.querySelectorAll(".semaforo-pill") ?? [],
        { scale: 0.85, opacity: 0 },
        {
          scale: 1, opacity: 1, duration: 0.5, stagger: 0.08, ease: "back.out(1.4)",
          scrollTrigger: { trigger: cardsRef.current, start: "top 85%", once: true },
        }
      );

      gsap.fromTo(
        ".building-cell",
        { scale: 0, opacity: 0 },
        {
          scale: 1, opacity: 1, duration: 0.4, stagger: { each: 0.03, from: "end" }, ease: "back.out(1.2)",
          scrollTrigger: { trigger: ".building-grid", start: "top 80%", once: true },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={titleRef} className="text-center mb-16 opacity-0">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wide mb-4">
            Semáforo de riesgo
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Ve el riesgo de un vistazo
          </h2>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Cada tarea tiene un color según su estado de cumplimiento. De verde intenso a vinotinto,
            sin ambigüedad.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Semáforo pills */}
          <div ref={cardsRef} className="flex flex-col gap-3">
            {semaforos.map((s) => (
              <div
                key={s.label}
                className={`semaforo-pill opacity-0 flex items-center gap-4 p-4 rounded-xl border ${s.bg} ${s.border}`}
              >
                <div className={`w-8 h-8 rounded-full ${s.color} ring-4 ${s.ring} flex-shrink-0 shadow-sm`} />
                <div className="flex-1">
                  <div className={`font-bold text-sm ${s.text}`}>{s.label}</div>
                  <div className="text-xs text-slate-600">{s.condition}</div>
                </div>
                <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-100">
                  {s.example}
                </div>
              </div>
            ))}
          </div>

          {/* Building grid visualization */}
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Torre 5 · Proyecto Olivo</div>
            <div className="building-grid flex flex-col gap-1.5 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              {buildingData.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-1.5 items-center">
                  <span className="text-[10px] text-slate-400 w-8 text-right">P{buildingData.length - rowIdx}</span>
                  {row.map((val, colIdx) => (
                    <div
                      key={colIdx}
                      className="building-cell opacity-0 w-10 h-8 rounded-md flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
                      style={{ backgroundColor: colorMap[val - 1] }}
                      title={`Apto ${(buildingData.length - rowIdx) * 100 + colIdx + 1}`}
                    >
                      {val === 5 ? "✓" : val === 1 || val === 2 ? "!" : "~"}
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex gap-1.5 mt-1 pl-8">
                {["A", "B", "C", "D", "E"].map((l) => (
                  <div key={l} className="w-10 text-center text-[10px] text-slate-400">{l}</div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              Vista por edificio — el gerente ve de un solo vistazo dónde están los riesgos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
