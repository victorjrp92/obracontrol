"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current?.querySelectorAll(".cta-item") ?? [],
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%" },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div
          className="relative rounded-3xl overflow-hidden p-10 sm:p-16"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)",
          }}
        >
          {/* Pattern */}
          <div className="absolute inset-0 dot-pattern opacity-10" />

          {/* Glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex flex-col items-center gap-6">
            <div className="cta-item opacity-0 w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <img src="/seiricon-icon.png" alt="Seiricon" className="w-14 h-14" />
            </div>

            <h2 className="cta-item opacity-0 text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              Empieza a controlar tu obra
              <br />
              desde hoy mismo
            </h2>

            <p className="cta-item opacity-0 text-blue-100 text-lg max-w-xl">
              14 días gratis, sin tarjeta de crédito. Configura tu primer proyecto
              en menos de 10 minutos.
            </p>

            <div className="cta-item opacity-0 flex flex-col sm:flex-row gap-3">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-7 py-3.5 rounded-xl transition-colors duration-150 shadow-lg text-sm"
              >
                Prueba gratis — 14 días
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center justify-center gap-2 border border-white/30 text-white hover:bg-white/10 font-semibold px-7 py-3.5 rounded-xl transition-colors duration-150 text-sm"
              >
                Hablar con el equipo
              </Link>
            </div>

            <p className="cta-item opacity-0 text-blue-200 text-xs">
              Sin tarjeta · Sin instalación · Cancela cuando quieras
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
