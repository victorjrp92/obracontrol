import { ArrowRight, ShieldAlert } from "lucide-react";

// Hero de /alerta. Fondo oscuro (bg-slate-900) OBLIGATORIO: el Navbar público
// es fixed y arranca transparente con texto blanco, y solo cambia a tema
// claro pasado 0.85 * innerHeight de scroll (ver Navbar.tsx). Si este hero
// fuera claro, el logo y los links quedarían ilegibles al cargar la página.
// Mismo patrón que BetaHero (bg-slate-900 pt-28 pb-20), pero sin tono
// comercial: esto es una herramienta de emergencia, no una landing de venta.
export default function AlertaHero() {
  return (
    <section className="relative overflow-hidden bg-slate-900 pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-600/15 blur-3xl" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-slate-50" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 text-center sm:gap-6 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-300 sm:text-sm">
          <ShieldAlert className="h-3.5 w-3.5" />
          Seiricon Alerta — respuesta al sismo
        </span>

        <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl">
          ¿Tu casa o edificio tuvo daños?
          <br />
          <span className="text-gradient-hero">Primero, revisa si es seguro quedarte</span>
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
          Una guía gratuita, en lenguaje sencillo, para saber si debes salir ya y para documentar
          los daños con fotos con fecha, hora y ubicación — pensada para personas en casas,
          apartamentos y locales, no solo para constructoras.
        </p>

        <a
          href="#filtro-seguridad"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-red-600/30 transition-colors hover:bg-red-700"
        >
          Empezar la guía
          <ArrowRight className="h-5 w-5" />
        </a>

        <p className="-mt-1 max-w-md text-xs text-white/50 sm:text-sm">
          Gratis, sin registro. Esta guía no reemplaza una evaluación de un ingeniero estructural.
        </p>
      </div>
    </section>
  );
}
