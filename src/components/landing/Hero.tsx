"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import DashboardMockup from "./DashboardMockup";

const stats = [
  { value: 40, suffix: "%", label: "Menos tiempo en reportes" },
  { value: 98, suffix: "%", label: "Precisión en trazabilidad" },
  { value: 3, suffix: "x", label: "Más velocidad de aprobación" },
];

const highlights = [
  "Sin instalación — 100% desde el navegador",
  "Modo offline para obra",
  "Evidencia fotográfica con GPS",
];

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const hlRef = useRef<HTMLUListElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dur = reduceMotion ? 0 : 1;
      const delay = reduceMotion ? 0 : 0.3;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(badgeRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 0.5, delay })
        .fromTo(headlineRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 0.7 }, "-=0.2")
        .fromTo(subRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 0.6 }, "-=0.4")
        .fromTo(
          hlRef.current?.querySelectorAll("li") ?? [],
          { x: -20, opacity: 0 },
          { x: 0, opacity: 1, duration: dur * 0.5, stagger: reduceMotion ? 0 : 0.1 },
          "-=0.3"
        )
        .fromTo(ctaRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 0.5 }, "-=0.2")
        .fromTo(statsRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 0.5 }, "-=0.3")
        .fromTo(mockupRef.current, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: dur * 0.9, ease: "power2.out" }, "<0.3");

      // Floating animation on mockup (only on desktop, not reduced motion)
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.to(mockupRef.current, {
          y: -12,
          duration: 3,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 1.5,
        });
      });

      // Counter animation for stats
      const counters = sectionRef.current?.querySelectorAll("[data-counter]");
      counters?.forEach((el) => {
        const target = parseInt(el.getAttribute("data-counter") ?? "0");
        gsap.fromTo(
          el,
          { textContent: 0 },
          {
            textContent: target,
            duration: 2,
            delay: 1.2,
            ease: "power2.out",
            snap: { textContent: 1 },
            onUpdate() {
              el.textContent = Math.round(parseFloat(el.textContent ?? "0")).toString();
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-dvh flex items-center hero-bg overflow-hidden pt-16"
    >
      {/* Dot pattern bg */}
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 rounded-full bg-blue-600/8 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 sm:py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <div className="flex flex-col gap-5 sm:gap-6">
            {/* Badge */}
            <div ref={badgeRef} className="opacity-0">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Piloto activo · Jaramillo Mora
              </span>
            </div>

            {/* Headline */}
            <h1
              ref={headlineRef}
              className="opacity-0 text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900"
            >
              Control total de{" "}
              <span className="text-gradient-blue">obra blanca</span>{" "}
              y carpintería
            </h1>

            {/* Sub */}
            <p
              ref={subRef}
              className="opacity-0 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl"
            >
              Reemplaza el Excel por un sistema digital con evidencia fotográfica,
              aprobaciones estructuradas y métricas en tiempo real. Sabe exactamente
              qué está pasando en cada apartamento.
            </p>

            {/* Highlights */}
            <ul ref={hlRef} className="flex flex-col gap-2">
              {highlights.map((h) => (
                <li key={h} className="opacity-0 flex items-center gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors duration-150 shadow-lg shadow-blue-600/30 text-sm"
              >
                Empezar gratis — 14 días
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 text-slate-700 hover:text-blue-600 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all duration-150 text-sm cursor-pointer">
                <Play className="w-4 h-4 fill-current" />
                Ver demo en 2 min
              </button>
            </div>

            {/* Stats */}
            <div
              ref={statsRef}
              className="opacity-0 grid grid-cols-3 gap-4 pt-4 border-t border-slate-200"
            >
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    <span data-counter={s.value}>0</span>
                    <span className="text-blue-600">{s.suffix}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — mockup */}
          <div ref={mockupRef} className="opacity-0 relative">
            <DashboardMockup />
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 60L1440 60L1440 30C1200 0 960 0 720 20C480 40 240 60 0 30L0 60Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
