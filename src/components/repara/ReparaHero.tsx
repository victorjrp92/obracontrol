import { ArrowRight, Camera, Clock, MapPin, Receipt, Wrench } from "lucide-react";
import { CIUDADES_ELEGIBLES_TEXTO, MESES_GRATIS } from "./config";

// Hero de /repara. Fondo oscuro (bg-slate-900) OBLIGATORIO: el Navbar público
// es fixed y arranca transparente con texto blanco, y solo cambia a tema claro
// pasado 0.85 * innerHeight de scroll (ver Navbar.tsx). Con un hero claro el
// logo y los links quedan ilegibles en el primer render. Mismo patrón que
// BetaHero y AlertaHero.
export default function ReparaHero() {
  return (
    <section className="relative overflow-hidden bg-slate-900 pt-28 pb-20 sm:pt-32 sm:pb-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
      </div>
      {/* Transición suave a la franja clara de abajo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-slate-50" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 text-center sm:gap-7 sm:px-6">
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold text-orange-300 sm:text-sm">
          <Wrench className="h-3.5 w-3.5" />
          Seiricon Go — reparaciones del sismo
        </span>

        <h1 className="animate-fade-up text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl md:text-6xl">
          Repara tu casa.
          <br />
          <span className="text-gradient-hero">Que cada peso quede con prueba.</span>
        </h1>

        <p className="animate-fade-up max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
          Después de un sismo aparecen los que piden el anticipo &ldquo;para materiales&rdquo; y no
          vuelven. Con Seiricon Go cada avance queda con foto, hora y ubicación; cada gasto queda
          con factura; y tú ves cómo va tu casa desde el celular, aunque estés lejos.
        </p>

        <a
          href="#cupo"
          className="animate-fade-up inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700"
        >
          Pedir mi cupo gratis
          <ArrowRight className="h-5 w-5" />
        </a>

        <p className="animate-fade-up -mt-2 max-w-md text-xs text-white/50 sm:text-sm">
          Gratis {MESES_GRATIS} meses en {CIUDADES_ELEGIBLES_TEXTO} · Sin tarjeta · Sirve igual si
          la reparación es pequeña
        </p>

        <div className="animate-fade-up mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-blue-400" /> Foto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-400" /> Hora
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-400" /> Ubicación
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-blue-400" /> Factura
          </span>
        </div>
      </div>

      {/* Centinela para el CTA sticky de mobile: marca el final del hero. */}
      <div id="repara-hero-sentinel" aria-hidden="true" className="absolute bottom-0 h-px w-full" />
    </section>
  );
}
