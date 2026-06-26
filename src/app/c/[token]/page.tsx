import {
  validarClienteToken,
  getClienteAvance,
  type ClienteAvance,
} from "@/lib/data-cliente";
import ClienteGaleriaFotos from "@/components/cliente/ClienteGaleriaFotos";
import { CheckCircle2, Clock, Hourglass, XCircle, MapPin } from "lucide-react";

export const metadata = {
  title: "Avance de tu obra",
  robots: { index: false, follow: false },
};

// ─── Estados de tarea → lenguaje llano + color ──────────────────────────────
const ESTADO_INFO: Record<
  string,
  { label: string; badge: string; Icon: typeof CheckCircle2 }
> = {
  PENDIENTE: {
    label: "Pendiente",
    badge: "bg-slate-100 text-slate-600",
    Icon: Clock,
  },
  REPORTADA: {
    label: "Reportada",
    badge: "bg-blue-50 text-blue-700",
    Icon: Hourglass,
  },
  APROBADA: {
    label: "Aprobada",
    badge: "bg-emerald-50 text-emerald-700",
    Icon: CheckCircle2,
  },
  NO_APROBADA: {
    label: "Por corregir",
    badge: "bg-amber-50 text-amber-700",
    Icon: XCircle,
  },
};

const SEMAFORO_INFO: Record<
  ClienteAvance["semaforo"],
  { dot: string; texto: string; significado: string }
> = {
  verde: {
    dot: "bg-emerald-500",
    texto: "text-emerald-700",
    significado: "La obra avanza muy bien.",
  },
  amarillo: {
    dot: "bg-amber-400",
    texto: "text-amber-700",
    significado: "La obra está en marcha.",
  },
  rojo: {
    dot: "bg-rose-500",
    texto: "text-rose-700",
    significado: "La obra está en sus primeras etapas.",
  },
};

const ESTADO_OBRA_LABEL: Record<string, string> = {
  ACTIVO: "En ejecución",
  PAUSADO: "En pausa",
  COMPLETADO: "Finalizada",
  ARCHIVADO: "Archivada",
};

function formatearFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(fecha));
}

// ─── Pantalla amable para enlaces no disponibles ────────────────────────────
function EnlaceNoDisponible() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/seiricon-icon.png"
          alt="Seiricon"
          className="mx-auto mb-6 h-16 w-16"
        />
        <h1 className="mb-2 text-xl font-bold text-slate-900">
          Este enlace no está disponible
        </h1>
        <p className="text-base leading-relaxed text-slate-500">
          El enlace que recibiste ya no está activo. Por favor, solicita uno
          nuevo a tu contratista para ver el avance de tu obra.
        </p>
      </div>
    </div>
  );
}

export default async function ClienteAvancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const valido = await validarClienteToken(token);
  if (!valido) return <EnlaceNoDisponible />;

  const avance = await getClienteAvance(valido.proyectoId);
  if (!avance) return <EnlaceNoDisponible />;

  const semaforo = SEMAFORO_INFO[avance.semaforo];
  const { progreso } = avance;

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Encabezado con branding discreto */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seiricon-icon.png" alt="Seiricon" className="h-7 w-7" />
          <span className="text-sm font-semibold text-slate-700">Seiricon</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {/* Título de la obra */}
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {avance.obra}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {avance.ciudad && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {avance.ciudad}
              </span>
            )}
            <span>{ESTADO_OBRA_LABEL[avance.estado] ?? avance.estado}</span>
            <span>Actualizado {formatearFecha(avance.actualizado)}</span>
          </div>
        </div>

        {/* Tarjeta de progreso + semáforo */}
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${semaforo.dot}`} />
            <span className={`text-sm font-semibold ${semaforo.texto}`}>
              {semaforo.significado}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900">
              {progreso.porcentajeAprobado}%
            </span>
            <span className="text-sm font-medium text-slate-500">
              del trabajo aprobado
            </span>
          </div>

          {/* Barra grande: reportado (claro) + aprobado (sólido) */}
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="relative h-full w-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-200"
                style={{ width: `${progreso.porcentajeReportado}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                style={{ width: `${progreso.porcentajeAprobado}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {progreso.aprobadas} de {progreso.total} trabajos aprobados
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
              {progreso.porcentajeReportado}% reportado por el equipo
            </span>
          </div>
        </section>

        {/* Espacios → tareas */}
        <div className="flex flex-col gap-4">
          {avance.espacios.map((espacio) => (
            <section
              key={espacio.id}
              className="rounded-2xl border border-slate-100 bg-white p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900">
                    {espacio.nombre}
                  </h2>
                  <p className="truncate text-xs text-slate-400">
                    {espacio.ubicacion}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {espacio.aprobadas}/{espacio.total} listas
                </span>
              </div>

              <ul className="flex flex-col divide-y divide-slate-100">
                {espacio.tareas.map((tarea) => {
                  const info =
                    ESTADO_INFO[tarea.estado] ?? ESTADO_INFO.PENDIENTE;
                  const Icon = info.Icon;
                  return (
                    <li key={tarea.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-800">
                          {tarea.nombre}
                        </span>
                        <span
                          className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${info.badge}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {info.label}
                        </span>
                      </div>
                      <ClienteGaleriaFotos
                        fotos={tarea.fotos}
                        tareaNombre={tarea.nombre}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {avance.espacios.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">
                Aún no hay avances que mostrar. Vuelve pronto para ver cómo
                progresa tu obra.
              </p>
            </div>
          )}
        </div>

        {/* Nota de solo lectura */}
        <footer className="mt-8 border-t border-slate-200 pt-5 text-center">
          <p className="text-xs text-slate-400">
            Vista de solo lectura compartida por tu contratista.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Avance gestionado con Seiricon
          </p>
        </footer>
      </main>
    </div>
  );
}
