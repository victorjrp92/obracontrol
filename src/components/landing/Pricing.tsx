"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, Zap } from "lucide-react";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: "Plan Obra",
    badge: null,
    price: "$650.000",
    currency: "COP/mes",
    usd: "~$150 USD",
    description: "Ideal para una obra activa",
    features: [
      "1 proyecto activo",
      "Hasta 150 unidades",
      "2 fases (obra blanca + madera)",
      "Hasta 10 usuarios",
      "Dashboard operativo + semáforo",
      "Alertas email + plataforma",
      "Soporte email",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=obra",
    highlight: false,
    cardClass: "bg-white border border-slate-200",
    ctaClass: "border border-blue-600 text-blue-600 hover:bg-blue-50",
  },
  {
    name: "Plan Proyecto",
    badge: "Recomendado",
    price: "$1.800.000",
    currency: "COP/mes",
    usd: "~$415 USD",
    description: "Para constructoras con varios proyectos",
    features: [
      "Hasta 3 proyectos activos",
      "Hasta 500 unidades totales",
      "Fases ilimitadas",
      "Usuarios de gestión ilimitados",
      "Score de contratistas (3 ejes)",
      "Analítica de materiales",
      "Alertas email + plataforma + WhatsApp",
      "Soporte prioritario",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=proyecto",
    highlight: true,
    cardClass: "bg-blue-600 border border-blue-500 shadow-2xl shadow-blue-600/30",
    ctaClass: "bg-white text-blue-600 hover:bg-blue-50 font-bold",
  },
  {
    name: "Plan Empresa",
    badge: null,
    price: "$3.500.000",
    currency: "COP/mes",
    usd: "~$807 USD",
    description: "Para grupos constructores y regionales",
    features: [
      "Proyectos y unidades ilimitados",
      "Benchmarking entre proyectos",
      "Reportes auto-generados en PDF",
      "Dashboard gerencial multi-proyecto",
      "Excedente >1.000 unidades: $2.500/u",
      "Onboarding asistido",
      "Soporte dedicado",
    ],
    cta: "Hablar con ventas",
    href: "/contacto",
    highlight: false,
    cardClass: "bg-slate-900 border border-slate-700",
    ctaClass: "border border-slate-600 text-slate-200 hover:bg-slate-800",
  },
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

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

      ScrollTrigger.batch(".pricing-card", {
        onEnter: (elements) => {
          gsap.fromTo(
            elements,
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: "power3.out" }
          );
        },
        start: "top 88%",
        once: true,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="precios" ref={sectionRef} className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-16 opacity-0">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wide mb-4">
            Precios
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Precio justo para cada etapa
          </h2>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            14 días gratis, sin tarjeta de crédito.{" "}
            <span className="text-blue-600 font-semibold">Piloto Jaramillo Mora:</span>{" "}
            6 meses gratis a cambio de feedback.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card opacity-0 relative rounded-2xl p-6 flex flex-col gap-5 ${plan.cardClass} ${plan.highlight ? "md:-mt-4 md:mb-4" : ""}`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg">
                    <Zap className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div>
                <div
                  className={`text-sm font-semibold mb-1 ${plan.highlight ? "text-blue-100" : plan.name === "Plan Empresa" ? "text-slate-400" : "text-slate-500"}`}
                >
                  {plan.name}
                </div>
                <div className={`text-3xl font-extrabold ${plan.highlight ? "text-white" : plan.name === "Plan Empresa" ? "text-white" : "text-slate-900"}`}>
                  {plan.price}
                </div>
                <div className={`text-sm ${plan.highlight ? "text-blue-200" : plan.name === "Plan Empresa" ? "text-slate-500" : "text-slate-500"}`}>
                  {plan.currency} · {plan.usd}
                </div>
                <p className={`text-sm mt-2 ${plan.highlight ? "text-blue-100" : plan.name === "Plan Empresa" ? "text-slate-400" : "text-slate-600"}`}>
                  {plan.description}
                </p>
              </div>

              {/* Divider */}
              <div className={`h-px ${plan.highlight ? "bg-blue-500" : plan.name === "Plan Empresa" ? "bg-slate-700" : "bg-slate-100"}`} />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-blue-200" : plan.name === "Plan Empresa" ? "text-slate-400" : "text-blue-500"}`}
                    />
                    <span
                      className={plan.highlight ? "text-blue-50" : plan.name === "Plan Empresa" ? "text-slate-300" : "text-slate-700"}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`block text-center text-sm font-semibold px-5 py-3 rounded-xl transition-colors duration-150 cursor-pointer ${plan.ctaClass}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
