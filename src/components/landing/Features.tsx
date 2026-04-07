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

const features = [
  {
    icon: Camera,
    color: "bg-blue-600",
    title: "Evidencia con triple validación",
    description:
      "Fotos solo desde cámara, nunca galería. GPS automático y timestamp del dispositivo. Anti-fraude por diseño.",
    tag: "Anti-fraude",
  },
  {
    icon: BarChart3,
    color: "bg-violet-600",
    title: "Dashboard en tiempo real",
    description:
      "Progreso ponderado por tarea, espacio, apartamento, piso, edificio y proyecto. Doble barra: reportado vs. aprobado.",
    tag: "Métricas",
  },
  {
    icon: WifiOff,
    color: "bg-emerald-600",
    title: "Modo offline en obra",
    description:
      "El obrero trabaja sin señal. Toma fotos, reporta tareas. Todo se sincroniza automáticamente al recuperar conexión.",
    tag: "Offline-first",
  },
  {
    icon: Star,
    color: "bg-orange-500",
    title: "Score de contratistas",
    description:
      "Tres ejes: cumplimiento (50%), calidad (30%) y velocidad de corrección (20%). Histórico por proyecto.",
    tag: "Desempeño",
  },
  {
    icon: Clock,
    color: "bg-rose-600",
    title: "Semáforo de tiempos",
    description:
      "Verde intenso, verde, amarillo, rojo y vinotinto según el % de retraso real. Calculado en días hábiles configurables.",
    tag: "Riesgo",
  },
  {
    icon: CheckSquare,
    color: "bg-sky-600",
    title: "Flujo de aprobación estructurado",
    description:
      "El supervisor revisa evidencia y checklist. Aprueba o rechaza con justificación por ítem. Ciclo de corrección trazable.",
    tag: "Calidad",
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
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wide mb-4">
            Funcionalidades
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Todo lo que necesita una constructora
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Diseñado con el proceso real de Jaramillo Mora. Reemplaza el Excel de 80 columnas
            con visibilidad total desde el obrero hasta la gerencia.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="feature-card opacity-0 group relative bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default"
              >
                {/* Tag */}
                <span className="absolute top-4 right-4 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {f.tag}
                </span>

                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4 shadow-sm`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>

                <h3 className="font-bold text-slate-900 mb-2 text-base">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
