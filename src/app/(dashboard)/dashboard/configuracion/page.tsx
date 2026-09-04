import Link from "next/link";
import Topbar from "@/components/dashboard/Topbar";
import RolesManager from "@/components/dashboard/RolesManager";
import { getUsuarioActual } from "@/lib/data";
import { estadoDeAcceso, PLANES, precioMensualCentavos } from "@/lib/suscripcion";
import { Building2, Bell, Briefcase, Shield, CreditCard, Users, Wrench } from "lucide-react";

const sections = [
  {
    icon: Building2,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Información de la constructora",
    description: "Nombre, NIT, logo, y datos generales de la empresa.",
    action: "Editar",
    href: "/dashboard/configuracion/empresa",
  },
  {
    icon: Users,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "Usuarios y roles",
    description: "Gestión de accesos, invitaciones y asignación de roles por proyecto.",
    action: "Gestionar",
    href: "/dashboard/usuarios",
  },
  {
    icon: Briefcase,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    title: "Clientes",
    description: "Empresas externas que contratan proyectos. Asigna un cliente a cada proyecto.",
    action: "Gestionar",
    href: "/dashboard/configuracion/clientes",
  },
  {
    icon: Bell,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    title: "Notificaciones",
    description: "Alertas por email, plataforma y WhatsApp. Configuración de frecuencia.",
    action: "Configurar",
    href: null,
  },
  {
    icon: Wrench,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Configuración de proyectos",
    description: "Días hábiles, checklists, dependencias entre tareas, y pagos a contratistas.",
    action: "Configurar",
    href: null,
  },
  {
    icon: Shield,
    iconBg: "bg-slate-50",
    iconColor: "text-slate-600",
    title: "Seguridad",
    description: "Contraseña, autenticación en dos pasos y sesiones activas.",
    action: "Configurar",
    href: null,
  },
  {
    icon: CreditCard,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    title: "Suscripción y facturación",
    description: "Plan actual, historial de pagos y cambio de plan.",
    action: "Gestionar",
    href: "/dashboard/configuracion/plan",
  },
];

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  // El bloque del plan estaba QUEMADO: decía «Plan Proyecto · $1.800.000 ·
  // Próxima facturación: 7 Mayo 2026» para todo el mundo, sin relación con la
  // base de datos. Ahora sale del estado real de la suscripción.
  const usuario = await getUsuarioActual();
  const c = usuario?.constructora;

  const acceso = c
    ? estadoDeAcceso({
        plan_suscripcion: c.plan_suscripcion,
        estado_suscripcion: c.estado_suscripcion,
        suscripcion_vence_el: c.suscripcion_vence_el,
      })
    : null;

  // El precio sale de la misma función que cobra, no de `PLANES` a secas: con
  // precios de prueba activos esta tarjeta y la pantalla de plan mostrarían
  // cifras distintas del mismo plan.
  const def = c
    ? {
        ...PLANES[c.plan_suscripcion],
        precioCentavos: precioMensualCentavos(c.plan_suscripcion, usuario?.email),
      }
    : null;
  const vencido = acceso !== null && !acceso.permite;

  return (
    <>
      <Topbar title="Configuración" subtitle="Administración de la cuenta" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Plan actual */}
        {c && def && acceso && (
          <Link
            href="/dashboard/configuracion/plan"
            className={`block rounded-2xl p-5 mb-6 transition-opacity hover:opacity-95 ${
              vencido
                ? "bg-gradient-to-r from-red-600 to-red-700"
                : acceso.porVencer
                  ? "bg-gradient-to-r from-amber-500 to-amber-600"
                  : "bg-gradient-to-r from-blue-600 to-blue-700"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-bold text-base">Plan {def.nombre}</div>
                <div className="text-white/80 text-sm mt-0.5">
                  {acceso.motivo === "gratuito"
                    ? "Plan gratuito · sin vencimiento"
                    : vencido
                      ? "Venció — renueva para crear obras nuevas"
                      : c.suscripcion_vence_el
                        ? `${acceso.motivo === "prueba" ? "Prueba gratis" : "Renovación"}: ${c.suscripcion_vence_el.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`
                        : "Activo"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-extrabold text-lg tabular-nums">
                  {def.precioCentavos === 0
                    ? "Gratis"
                    : new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(def.precioCentavos / 100)}
                </div>
                {def.precioCentavos > 0 && <div className="text-white/70 text-xs">/mes</div>}
              </div>
            </div>
          </Link>
        )}

        {/* Config sections */}
        <div className="grid md:grid-cols-2 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            const content = (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{s.description}</p>
                  {s.href ? (
                    <span className="text-xs font-semibold text-blue-600">{s.action} &rarr;</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                      Próximamente
                    </span>
                  )}
                </div>
              </div>
            );

            if (s.href) {
              return (
                <Link key={s.title} href={s.href} className="block">
                  {content}
                </Link>
              );
            }

            return (
              <div key={s.title} className="opacity-75 cursor-default">
                {content}
              </div>
            );
          })}
        </div>

        {/* Roles section */}
        <div className="mt-6">
          <RolesManager />
        </div>
      </main>
    </>
  );
}
