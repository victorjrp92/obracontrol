"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FolderPlus, ClipboardList, CameraIcon, ShieldCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "01",
    icon: FolderPlus,
    color: "bg-blue-600",
    ring: "ring-blue-200",
    title: "Crea el proyecto",
    description:
      "Define torres, pisos, apartamentos y espacios. El wizard guía cada paso. Configura fases, días hábiles y tipos de apartamento en minutos.",
    detail: "Wizard de onboarding estructurado",
  },
  {
    number: "02",
    icon: ClipboardList,
    color: "bg-violet-600",
    ring: "ring-violet-200",
    title: "Asigna tareas y tiempos",
    description:
      "La app sugiere tareas por fase y espacio. Agrega códigos de referencia, marcas y cantidades. Asigna contratistas y define tiempos acordados.",
    detail: "Sugerencias inteligentes por fase",
  },
  {
    number: "03",
    icon: CameraIcon,
    color: "bg-emerald-600",
    ring: "ring-emerald-200",
    title: "El obrero reporta con evidencia",
    description:
      "Desde la app (offline si es necesario), toma 2-4 fotos con GPS y timestamp, graba video opcional de 30 segundos y marca el checklist.",
    detail: "Funciona sin señal en obra",
  },
  {
    number: "04",
    icon: ShieldCheck,
    color: "bg-orange-500",
    ring: "ring-orange-200",
    title: "Supervisor aprueba o devuelve",
    description:
      "El coordinador revisa evidencia, verifica checklist y aprueba o devuelve con justificación por ítem. El progreso se actualiza en tiempo real.",
    detail: "Score automático del contratista",
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title
      gsap.fromTo(
        titleRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: titleRef.current, start: "top 85%" },
        }
      );

      // Animated progress line
      gsap.fromTo(
        lineRef.current,
        { scaleY: 0, transformOrigin: "top center" },
        {
          scaleY: 1,
          duration: 1.5,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            end: "bottom 60%",
            scrub: 1,
          },
        }
      );

      // Step cards
      ScrollTrigger.batch(".step-card", {
        onEnter: (elements) => {
          gsap.fromTo(
            elements,
            { x: -40, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: "power3.out" }
          );
        },
        start: "top 85%",
        once: true,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="como-funciona"
      ref={sectionRef}
      className="py-24 bg-slate-50"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-16 opacity-0">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wide mb-4">
            Cómo funciona
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            De la obra al tablero, en 4 pasos
          </h2>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Un flujo claro que conecta al obrero en campo con el gerente en oficina.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 hidden sm:block">
            <div
              ref={lineRef}
              className="absolute inset-0 bg-gradient-to-b from-blue-600 via-violet-500 to-orange-400 origin-top"
            />
          </div>

          <div className="flex flex-col gap-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="step-card opacity-0 flex gap-6 items-start"
                >
                  {/* Icon circle */}
                  <div
                    className={`relative z-10 w-16 h-16 rounded-2xl ${step.color} ring-4 ${step.ring} flex items-center justify-center flex-shrink-0 shadow-md`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 flex items-center justify-center shadow-sm">
                      {step.number.slice(1)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base mb-1.5">{step.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs text-slate-500 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {step.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
