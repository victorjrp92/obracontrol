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
      "1 obra activa",
      "Hasta 150 unidades",
      "Evidencia con foto/video + aprobación",
      "Dashboard operativo + semáforo",
      "Hasta 10 usuarios",
      "Soporte email",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=obra",
    highlight: false,
    dark: false,
  },
  {
    name: "Plan Pro",
    badge: "Recomendado",
    price: "$1.800.000",
    currency: "COP/mes",
    usd: "~$415 USD",
    description: "Para quien gestiona varias obras",
    features: [
      "Hasta 5 obras activas",
      "Unidades y fases ilimitadas",
      "Usuarios ilimitados",
      "Score de contratistas (3 ejes)",
      "Mapa de obras + analítica de materiales",
      "Alertas email + plataforma + WhatsApp",
      "Soporte prioritario",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=pro",
    highlight: true,
    dark: false,
  },
  {
    name: "Plan Empresa",
    badge: null,
    price: "$3.500.000",
    currency: "COP/mes",
    usd: "~$807 USD",
    description: "Para constructoras con varios frentes",
    features: [
      "Hasta 15 obras activas",
      "Todo lo del Plan Pro",
      "Benchmarking entre obras",
      "Reportes auto-generados en PDF",
      "Dashboard gerencial multi-obra",
      "Onboarding asistido",
      "Soporte dedicado",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=empresa",
    highlight: false,
    dark: false,
  },
  {
    name: "Corporativo · a la medida",
    badge: null,
    price: "A convenir",
    currency: "",
    usd: "Precio a tu medida",
    description: "Para grupos constructores y regionales",
    features: [
      "Más de 15 obras activas",
      "Todo lo del Plan Empresa",
      "Volumen sin tope, cotizado a tu medida",
      "Integraciones y datos a la medida",
      "Gerente de cuenta dedicado",
    ],
    cta: "Hablemos",
    href: "/contacto",
    highlight: false,
    dark: true,
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
            14 d&iacute;as gratis, sin tarjeta de cr&eacute;dito. Elige el plan que se ajuste a tu operaci&oacute;n.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {plans.map((plan) => {
            const cardClass = plan.highlight
              ? "bg-blue-600 border border-blue-500 shadow-2xl shadow-blue-600/30"
              : plan.dark
                ? "bg-slate-900 border border-slate-700"
                : "bg-white border border-slate-200";
            const ctaClass = plan.highlight
              ? "bg-white text-blue-600 hover:bg-blue-50 font-bold"
              : plan.dark
                ? "bg-slate-100 text-slate-900 hover:bg-white font-semibold"
                : "border border-blue-600 text-blue-600 hover:bg-blue-50";
            const muted = plan.highlight ? "text-blue-100" : plan.dark ? "text-slate-400" : "text-slate-500";
            const strong = plan.highlight ? "text-white" : plan.dark ? "text-white" : "text-slate-900";
            const body = plan.highlight ? "text-blue-100" : plan.dark ? "text-slate-400" : "text-slate-600";
            const featTxt = plan.highlight ? "text-blue-50" : plan.dark ? "text-slate-300" : "text-slate-700";
            const checkC = plan.highlight ? "text-blue-200" : plan.dark ? "text-slate-400" : "text-blue-500";
            const divider = plan.highlight ? "bg-blue-500" : plan.dark ? "bg-slate-700" : "bg-slate-100";
            return (
            <div
              key={plan.name}
              className={`pricing-card opacity-0 relative rounded-2xl p-6 flex flex-col gap-5 ${cardClass}`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg whitespace-nowrap">
                    <Zap className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div>
                <div className={`text-sm font-semibold mb-1 ${muted}`}>{plan.name}</div>
                <div className={`text-2xl font-extrabold ${strong}`}>{plan.price}</div>
                <div className={`text-xs ${muted}`}>
                  {plan.currency ? `${plan.currency} · ${plan.usd}` : plan.usd}
                </div>
                <p className={`text-sm mt-2 ${body}`}>{plan.description}</p>
              </div>

              {/* Divider */}
              <div className={`h-px ${divider}`} />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${checkC}`} />
                    <span className={featTxt}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`block text-center text-sm font-semibold px-5 py-3 rounded-xl transition-colors duration-150 cursor-pointer ${ctaClass}`}
              >
                {plan.cta}
              </Link>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
