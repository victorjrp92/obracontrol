"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Camera,
  BarChart3,
  WifiOff,
  Star,
  Clock,
  CheckSquare,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const problems = [
  {
    icon: Camera,
    color: "bg-blue-600",
    pain: "\u00abEl contratista dice que termin\u00f3, pero cuando vas a obra no es as\u00ed\u00bb",
    solution:
      "Evidencia fotogr\u00e1fica obligatoria con GPS y timestamp del dispositivo. Solo c\u00e1mara, nunca galer\u00eda. Si no hay foto verificable, no hay reporte.",
  },
  {
    icon: BarChart3,
    color: "bg-violet-600",
    pain: "\u00abNo s\u00e9 cu\u00e1nto lleva realmente el proyecto\u00bb",
    solution:
      "Progreso calculado autom\u00e1ticamente por tarea, espacio, piso y torre. Dashboard actualizado en tiempo real con doble barra: reportado vs. aprobado.",
  },
  {
    icon: Clock,
    color: "bg-rose-600",
    pain: "\u00abMe entero del atraso cuando ya es tarde\u00bb",
    solution:
      "Sem\u00e1foro de 5 niveles por tarea: de verde intenso a vinotinto. Ves el riesgo antes de que sea cr\u00edtico y puedes actuar a tiempo.",
  },
  {
    icon: Star,
    color: "bg-orange-500",
    pain: "\u00abSiempre contrato al mismo contratista sin saber si realmente cumple\u00bb",
    solution:
      "Score autom\u00e1tico basado en cumplimiento, calidad y velocidad de correcci\u00f3n. Datos reales de cada proyecto, no percepci\u00f3n.",
  },
  {
    icon: WifiOff,
    color: "bg-emerald-600",
    pain: "\u00abEn la obra no hay se\u00f1al y los reportes se pierden\u00bb",
    solution:
      "La app funciona sin conexi\u00f3n. El obrero toma fotos y reporta tareas offline. Todo se sincroniza autom\u00e1ticamente al recuperar se\u00f1al.",
  },
  {
    icon: CheckSquare,
    color: "bg-sky-600",
    pain: "\u00abNo hay forma de saber si la tarea se hizo bien o si hay que repetirla\u00bb",
    solution:
      "El supervisor revisa evidencia y checklist. Aprueba o rechaza con justificaci\u00f3n por \u00edtem. Cada correcci\u00f3n queda documentada.",
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title reveal
      gsap.fromTo(
        titleRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 85%",
          },
        }
      );

      // Cards batch reveal
      ScrollTrigger.batch(".feature-card", {
        onEnter: (elements) => {
          gsap.fromTo(
            elements,
            { y: 50, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
              stagger: 0.1,
              ease: "power3.out",
            }
          );
        },
        start: "top 88%",
        once: true,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-16 opacity-0">
          <span className="inline-block px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold uppercase tracking-wide mb-4">
            Tu obra sin excusas
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Deja de apagar incendios. Empieza a prevenirlos.
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Cada uno de estos problemas tiene soluci&oacute;n. As&iacute; es como Seiricon los elimina de tu operaci&oacute;n.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.pain}
                className="feature-card opacity-0 group relative bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default"
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4 shadow-sm`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>

                <p className="font-bold text-slate-800 mb-3 text-sm italic leading-snug">{f.pain}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{f.solution}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
