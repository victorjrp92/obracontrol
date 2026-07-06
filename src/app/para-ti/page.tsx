import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Gauge,
  Calculator,
  Star,
  Quote,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Users,
  MessageSquare,
  Lock,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import B2CNavbar from "@/components/b2c/B2CNavbar";
import Reveal from "@/components/b2c/Reveal";
import PhotoSlot from "@/components/b2c/PhotoSlot";
import PhoneMockup from "@/components/b2c/PhoneMockup";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Tu casa, bajo control — sin sustos",
  description:
    "Construye o remodela tu casa viendo cada avance con fotos y sabiendo a dónde va tu plata. Seiricon para personas y arquitectos. Empieza gratis, sin tarjeta.",
  alternates: { canonical: "/para-ti" },
  openGraph: {
    title: "Seiricon para ti — tu casa, bajo control sin sustos",
    description:
      "Ve cada avance de tu obra con fotos, aprueba lo que se hizo y entiende a dónde va tu plata. Empieza gratis.",
    type: "website",
  },
};

/* ── Datos de las secciones ───────────────────────────────────────── */

const dolores = [
  "Pago y pago… pero no sé exactamente en qué va mi obra.",
  "El maestro dice «ya casi», y llevamos semanas así.",
  "Yo no entiendo de construcción; me toca confiar y rezar.",
  "Me da miedo pagar por material o trabajo que no está.",
];

const pilares = [
  {
    icon: Camera,
    color: "bg-blue-600",
    title: "Ves cada avance con fotos reales",
    text: "Cada tarea se reporta con foto fechada y ubicada por GPS. Es como estar en la obra, desde tu celular y sin moverte de casa.",
  },
  {
    icon: CheckCircle2,
    color: "bg-emerald-600",
    title: "Nada se da por hecho hasta que tú apruebas",
    text: "Tú revisas la evidencia y das el sí. Lo que no cumple, se corrige antes de seguir. Tu plata sigue al trabajo, no al revés.",
  },
  {
    icon: Gauge,
    color: "bg-orange-500",
    title: "Un color te dice cómo va",
    text: "Verde, amarillo o rojo. De un vistazo sabes si tu obra va bien, va lenta o necesita tu atención hoy. Te enteras a tiempo, no tarde.",
  },
  {
    icon: Calculator,
    color: "bg-violet-600",
    title: "Sabes cuánto cuesta antes de empezar",
    text: "Un presupuesto con inteligencia artificial, anclado a precios reales de referencia, para que el costo no te tome por sorpresa.",
  },
];

const pasos = [
  {
    icon: MessageSquare,
    title: "Cuéntanos tu proyecto",
    text: "¿Reformas, amplías o construyes algo nuevo? Te preguntamos en palabras normales y armamos tu obra por ti. No necesitas saber de construcción.",
  },
  {
    icon: Camera,
    title: "Tu equipo reporta con fotos",
    text: "Tu maestro o contratista sube la evidencia de cada avance desde su celular, incluso cuando en la obra no hay señal. Todo se sincroniza solo.",
  },
  {
    icon: CheckCircle2,
    title: "Tú apruebas y ves crecer tu casa",
    text: "Recibes los avances, apruebas con un toque y sigues todo en tiempo real. Por fin tu casa avanza a la vista, no a ciegas.",
  },
];

const testimonios = [
  {
    quote:
      "Por primera vez supe en qué se iba mi plata. Veía las fotos cada noche y dormía tranquila.",
    name: "Una propietaria",
    role: "Remodelación de apartamento",
  },
  {
    quote:
      "Mis clientes ven su obra avanzar sin llamarme cada día. Me hace ver serio y me ahorra horas.",
    name: "Un arquitecto independiente",
    role: "3 proyectos a la vez",
  },
];

const objeciones = [
  {
    icon: Sparkles,
    q: "¿Y si no sé nada de construcción?",
    a: "Justo para ti. Seiricon traduce todo a lenguaje simple: tú decides y apruebas, sin tecnicismos ni planos que descifrar.",
  },
  {
    icon: WifiOff,
    q: "¿Y si mi maestro no es de apps?",
    a: "Solo necesita tomar una foto. Y si en la obra no hay señal, se guarda y se sube solo cuando vuelve el internet.",
  },
  {
    icon: Star,
    q: "¿Es caro?",
    a: "Tu primera obra es gratis y sin tarjeta. Creces a un plan personal solo si algún día quieres manejar más obras.",
  },
  {
    icon: Lock,
    q: "¿Mis datos están seguros?",
    a: "Tu información y la de tu obra son tuyas. Las protegemos y nunca las usamos a tus espaldas. Puedes leer nuestra política cuando quieras.",
  },
];

/* ── Página ───────────────────────────────────────────────────────── */

export default function ParaTiPage() {
  return (
    <>
      <B2CNavbar />

      <main className="overflow-hidden">
        {/* ══════════ HERO ══════════ */}
        <section
          className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(251,146,60,0.18) 0%, transparent 60%)," +
              "radial-gradient(ellipse 60% 50% at 85% 30%, rgba(96,165,250,0.16) 0%, transparent 60%)," +
              "#fffdfa",
          }}
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            {/* Texto */}
            <div className="animate-fade-up text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700 sm:text-sm">
                <HeartHandshake className="h-4 w-4" />
                Para tu casa · tu remodelación · tu proyecto
              </span>

              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Tu casa avanza.
                <br />
                <span className="text-gradient-blue">Y por fin lo ves</span> con
                tus propios ojos.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
                Seiricon te muestra —foto por foto— en qué va tu obra y a dónde
                va tu plata. Sin saber de construcción, sin sustos y sin tener
                que ir hasta allá.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
                <Link
                  href="/registro"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600 sm:w-auto sm:text-base"
                >
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#como"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-auto sm:text-base"
                >
                  Ver cómo funciona
                </a>
              </div>

              <p className="mt-5 text-xs text-slate-500 sm:text-sm">
                Gratis para tu primera obra · Sin tarjeta · Listo en 2 minutos
              </p>
            </div>

            {/* Mockup */}
            <Reveal delay={150} className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </Reveal>
          </div>
        </section>

        {/* ══════════ EMPATÍA (¿Te suena?) ══════════ */}
        <section className="bg-white px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-orange-500">
                Sabemos por qué te preocupa
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Tu casa es el sueño de tu vida.
                <br className="hidden sm:block" /> No tendría por qué quitarte el
                sueño.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {dolores.map((d, i) => (
                <Reveal key={d} delay={i * 80}>
                  <figure className="flex h-full items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <Quote className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
                    <blockquote className="text-base font-medium italic leading-snug text-slate-700">
                      {d}
                    </blockquote>
                  </figure>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120}>
              <p className="mt-10 text-center text-lg font-semibold text-slate-800">
                Si alguna te resonó, estás en el lugar correcto. 👋
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══════════ SOLUCIÓN (pilares) ══════════ */}
        <section className="bg-gradient-to-b from-white to-amber-50/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Tu tranquilidad, en una app
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Con Seiricon, dejas de confiar a ciegas
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Cuatro cosas simples que cambian por completo cómo vives tu obra.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-10 lg:grid-cols-2">
              {/* Columna de pilares */}
              <div className="grid gap-5 sm:grid-cols-2">
                {pilares.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <Reveal key={p.title} delay={i * 80}>
                      <div className="group h-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div
                          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${p.color} shadow-sm`}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="mb-2 text-base font-bold text-slate-900">
                          {p.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {p.text}
                        </p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>

              {/* Foto humana */}
              <Reveal delay={150} className="min-h-[22rem]">
                <div className="relative h-full overflow-hidden rounded-3xl">
                  <PhotoSlot
                    label="Foto cálida: una pareja o familia revisando el avance de su casa en el celular, en su sala, con luz natural."
                    icon={Smartphone}
                    className="min-h-[22rem]"
                  />
                  {/* Tarjeta flotante de confianza sobre la foto */}
                  <div className="glass-card absolute bottom-5 left-5 right-5 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Avance aprobado por ti
                        </p>
                        <p className="text-xs text-slate-500">
                          Tu casa avanza con tu visto bueno.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════ CÓMO FUNCIONA ══════════ */}
        <section id="como" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-orange-500">
                Así de simple
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Empezar te toma menos que pedir un domicilio
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {pasos.map((p, i) => {
                const Icon = p.icon;
                return (
                  <Reveal key={p.title} delay={i * 100}>
                    <div className="relative h-full rounded-2xl border border-slate-100 bg-slate-50 p-7">
                      <span className="absolute right-5 top-5 text-5xl font-extrabold text-slate-100">
                        {i + 1}
                      </span>
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-slate-900">
                        {p.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {p.text}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={120} className="mt-12 text-center">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600"
              >
                Crear mi obra gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ══════════ ARQUITECTOS ══════════ */}
        <section
          id="arquitectos"
          className="scroll-mt-20 px-4 py-24 sm:px-6"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 80% 20%, rgba(37,99,235,0.25) 0%, transparent 60%), #0f172a",
          }}
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300">
                <Users className="h-4 w-4" />
                ¿Eres arquitecto independiente?
              </span>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                Maneja todos tus clientes y obras en un solo lugar
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/60">
                Dale a cada cliente la tranquilidad de ver su proyecto avanzar en
                vivo. Tú te ves profesional y ordenado; ellos se quedan tranquilos
                y dejan de llamarte cada día.
              </p>

              <ul className="mt-7 space-y-3">
                {[
                  "Varios clientes y proyectos, sin mezclarlos.",
                  "Evidencia con foto que respalda y valora tu trabajo.",
                  "Presupuestos claros que generan confianza desde el día uno.",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-white/80">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <span className="text-base">{b}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/registro"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-slate-900 shadow-lg transition-colors hover:bg-slate-100"
              >
                Crear mi cuenta de arquitecto
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>

            <Reveal delay={150} className="min-h-[22rem]">
              <PhotoSlot
                label="Foto: arquitecto/a en sitio de obra mostrando algo en una tablet a su cliente, ambiente cálido y profesional."
                icon={Users}
                className="min-h-[22rem]"
              />
            </Reveal>
          </div>
        </section>

        {/* ══════════ CONFIANZA / TESTIMONIOS ══════════ */}
        <section className="bg-white px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Gente que ya duerme tranquila
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                No tienes que creernos a nosotros
              </h2>
            </Reveal>

            {/* Testimonios */}
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {testimonios.map((t, i) => (
                <Reveal key={t.quote} delay={i * 100}>
                  <figure className="flex h-full flex-col justify-between rounded-3xl border border-slate-100 bg-gradient-to-br from-amber-50/80 to-white p-7 shadow-sm">
                    <div>
                      <div className="mb-3 flex gap-0.5 text-orange-400">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <blockquote className="text-lg font-medium leading-relaxed text-slate-800">
                        “{t.quote}”
                      </blockquote>
                    </div>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-full">
                        <PhotoSlot
                          label="Avatar"
                          rounded="rounded-full"
                          className="h-11 w-11"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-500">{t.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>

            {/* Señales de confianza */}
            <Reveal delay={150}>
              <div className="mt-12 grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-6 sm:grid-cols-3">
                {[
                  { icon: ShieldCheck, t: "Evidencia con fecha y GPS" },
                  { icon: Lock, t: "Tus datos son tuyos y están protegidos" },
                  { icon: Smartphone, t: "Funciona en tu celular, hasta sin señal" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.t}
                      className="flex items-center gap-3 text-sm font-medium text-slate-700"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-emerald-600" />
                      {s.t}
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════ OBJECIONES ══════════ */}
        <section className="bg-amber-50/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-orange-500">
                Lo que seguro te estás preguntando
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Tranquilo, lo hicimos pensando en ti
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {objeciones.map((o, i) => {
                const Icon = o.icon;
                return (
                  <Reveal key={o.q} delay={i * 70}>
                    <div className="h-full rounded-2xl border border-white bg-white p-6 shadow-sm">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                          <Icon className="h-5 w-5 text-orange-500" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {o.q}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {o.a}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════ PRECIO (freemium) ══════════ */}
        <section id="precio" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl">
            <Reveal className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Precio honesto
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Empieza gratis. En serio.
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <div className="glow-blue mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <div className="bg-gradient-to-br from-blue-600 to-blue-500 px-8 py-8 text-center text-white">
                  <p className="text-sm font-medium text-blue-100">
                    Plan personal — para tu casa
                  </p>
                  <p className="mt-2 text-5xl font-extrabold">
                    $0
                    <span className="text-lg font-semibold text-blue-100">
                      {" "}
                      / tu primera obra
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-blue-100">
                    Sin tarjeta. Sin compromisos.
                  </p>
                </div>
                <div className="space-y-3 px-8 py-8">
                  {[
                    "1 obra activa, tuya y bajo control.",
                    "Avances con foto fechada y ubicada por GPS.",
                    "Semáforo de avance y aprobaciones con un toque.",
                    "Tu presupuesto con IA, anclado a precios reales.",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <span className="text-sm text-slate-700">{f}</span>
                    </div>
                  ))}

                  <Link
                    href="/registro"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600"
                  >
                    Empezar gratis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="text-center text-xs text-slate-500">
                    ¿Más obras o eres arquitecto con varios proyectos? Crece a un
                    plan personal cuando lo necesites.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════ CTA FINAL ══════════ */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal className="mx-auto max-w-5xl">
            <div
              className="relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12"
              style={{
                background:
                  "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(251,146,60,0.35) 0%, transparent 60%), #0f172a",
              }}
            >
              <div className="dot-pattern absolute inset-0 opacity-[0.06]" />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                  Tu próxima obra puede ser la primera que de verdad controlas.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
                  Empieza hoy, gratis, y mira tu casa avanzar con tus propios
                  ojos.
                </p>
                <Link
                  href="/registro"
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/40 transition-colors hover:bg-orange-600"
                >
                  Empezar gratis
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <p className="mt-5 text-sm text-white/40">
                  Gratis para tu primera obra · Sin tarjeta · Listo en 2 minutos
                </p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
