"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AuroraBackground from "./AuroraBackground";
import AnimatedTextCycle from "./AnimatedTextCycle";

const words = ["obra", "equipo", "progreso", "contratistas", "calidad", "proyecto"];

const stats = [
  { value: "160+", label: "Tareas controladas" },
  { value: "4", label: "Vistas por rol" },
  { value: "99.9%", label: "Uptime" },
];

export default function Hero() {
  return (
    <AuroraBackground className="pt-16">
      <section className="flex flex-col items-center justify-center min-h-dvh px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6 sm:gap-8 animate-fade-up">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs sm:text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Plataforma activa — constructoras en Latinoamerica
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
            <span className="font-light text-white/70">Tu </span>
            <AnimatedTextCycle words={words} interval={3000} />
            <br />
            <span className="text-gradient-hero">bajo control total</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base md:text-lg text-white/50 leading-relaxed max-w-xl">
            Evidencia fotográfica, aprobaciones estructuradas y métricas de
            desempeño en tiempo real. Todo desde un solo lugar.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm sm:text-base"
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 text-white font-semibold px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-sm sm:text-base"
            >
              Ver demo
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 sm:gap-10 mt-4 sm:mt-8">
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-6 sm:gap-10">
                {i > 0 && <div className="w-px h-10 bg-white/10" />}
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">{s.value}</div>
                  <div className="text-[10px] sm:text-xs text-white/40 mt-1">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AuroraBackground>
  );
}
