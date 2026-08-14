"use client";

import { ArrowRight, MapPin, Camera, Clock } from "lucide-react";
import { CUPOS_TOTALES } from "./config";

// Hero de /beta. Fondo navy (tono del landing) para que el Navbar reutilizado
// arranque en su modo oscuro y haga el switch a claro al bajar (misma UX del home).
export default function BetaHero() {
  return (
    <section className="relative overflow-hidden bg-slate-900 pt-28 pb-20 sm:pt-32 sm:pb-28">
      {/* Glows de marca */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
      </div>
      {/* Transición suave a la sección clara de abajo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-slate-50" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 text-center sm:gap-7 sm:px-6">
        {/* Insignias: escasez + origen */}
        <div className="animate-fade-up flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold text-orange-300 sm:text-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            Beta gratis · solo {CUPOS_TOTALES} cupos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 sm:text-sm">
            Hecho en Colombia 🇨🇴
          </span>
        </div>

        {/* Titular del pilar */}
        <h1 className="animate-fade-up text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
          Controla tu obra
          <br />
          <span className="text-gradient-hero">sin ir todos los días</span>
        </h1>

        {/* Subtítulo — aclara qué es Seiricon */}
        <p className="animate-fade-up max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
          Seiricon es la app para dueños y contratistas que quieren ver el avance
          real de su obra —con foto, ubicación y hora— y controlar el dinero, desde
          el celular. Deja de cruzar la ciudad para ver si de verdad avanzó.
        </p>

        {/* CTA principal → scroll al formulario */}
        <a
          href="#inscribirme"
          className="animate-fade-up inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700"
        >
          Quiero mi cupo
          <ArrowRight className="h-5 w-5" />
        </a>

        {/* Microcopy de tranquilidad bajo el CTA */}
        <p className="animate-fade-up -mt-2 text-xs text-white/40 sm:text-sm">
          Sin tarjeta. Sin compromiso. Solo cuéntanos de tu obra.
        </p>

        {/* Micro-prueba visual del pilar: la evidencia confiable */}
        <div className="animate-fade-up mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-blue-400" /> Foto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-400" /> Ubicación
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-400" /> Hora
          </span>
        </div>
      </div>

      {/* Centinela para el CTA sticky de mobile: marca el final del hero. */}
      <div id="beta-hero-sentinel" aria-hidden="true" className="absolute bottom-0 h-px w-full" />
    </section>
  );
}
