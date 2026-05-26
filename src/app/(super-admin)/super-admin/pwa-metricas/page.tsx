import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { isSuperAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { Smartphone, Download, Apple, Monitor, TrendingUp, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PwaMetricasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  if (!isSuperAdmin(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  // ── Agregados básicos ───────────────────────────────────────────────────
  const [totalAceptados, totalDismissed, totalAppInstalled, totalPrompts] =
    await Promise.all([
      prisma.pwaEvento.count({ where: { evento: "INSTALL_ACCEPTED" } }),
      prisma.pwaEvento.count({ where: { evento: "INSTALL_DISMISSED" } }),
      prisma.pwaEvento.count({ where: { evento: "APP_INSTALLED" } }),
      prisma.pwaEvento.count({ where: { evento: "PROMPT_SHOWN" } }),
    ]);

  // Conteo de installs únicos (algunos navegadores emiten ambos eventos)
  const totalInstalls = Math.max(totalAceptados, totalAppInstalled);
  const tasaConversion = totalPrompts > 0 ? (totalAceptados / totalPrompts) * 100 : 0;

  // Usuarios activos PWA: distinct usuario_id con LAUNCHED_STANDALONE últimos 7 días
  const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activosPwa = await prisma.pwaEvento.findMany({
    where: {
      evento: "LAUNCHED_STANDALONE",
      created_at: { gte: sieteDiasAtras },
      usuario_id: { not: null },
    },
    select: { usuario_id: true },
    distinct: ["usuario_id"],
  });

  // Breakdown por plataforma (sobre installs aceptados)
  const platformGroups = await prisma.pwaEvento.groupBy({
    by: ["plataforma"],
    where: { evento: { in: ["INSTALL_ACCEPTED", "APP_INSTALLED"] } },
    _count: { _all: true },
  });
  const totalPorPlataforma = platformGroups.reduce(
    (acc, p) => ({ ...acc, [p.plataforma]: p._count._all }),
    {} as Record<string, number>,
  );

  // Últimos 14 días: installs por día
  const catorceDiasAtras = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const installsRecientes = await prisma.pwaEvento.findMany({
    where: {
      evento: { in: ["INSTALL_ACCEPTED", "APP_INSTALLED"] },
      created_at: { gte: catorceDiasAtras },
    },
    select: { created_at: true },
    orderBy: { created_at: "asc" },
  });
  const installsPorDia = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    installsPorDia.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of installsRecientes) {
    const k = e.created_at.toISOString().slice(0, 10);
    installsPorDia.set(k, (installsPorDia.get(k) ?? 0) + 1);
  }
  const maxDia = Math.max(1, ...installsPorDia.values());

  // Últimos eventos
  const ultimos = await prisma.pwaEvento.findMany({
    take: 20,
    orderBy: { created_at: "desc" },
    include: { usuario: { select: { nombre: true, email: true } } },
  });

  return (
    <>
      <Topbar
        title="Métricas PWA"
        subtitle="Instalaciones, conversión y usuarios activos en modo app"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Download}
            label="Instalaciones totales"
            value={totalInstalls.toLocaleString("es-CO")}
            tone="emerald"
          />
          <MetricCard
            icon={TrendingUp}
            label="Tasa de conversión"
            value={`${tasaConversion.toFixed(1)}%`}
            subtitle={`${totalAceptados} de ${totalPrompts} prompts`}
            tone="blue"
          />
          <MetricCard
            icon={Users}
            label="Usuarios activos PWA"
            value={activosPwa.length.toLocaleString("es-CO")}
            subtitle="Últimos 7 días"
            tone="violet"
          />
          <MetricCard
            icon={Smartphone}
            label="Instalaciones rechazadas"
            value={totalDismissed.toLocaleString("es-CO")}
            tone="slate"
          />
        </div>

        {/* Bar chart: installs por día */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 mb-1">Instalaciones por día</h2>
          <p className="text-xs text-slate-500 mb-4">Últimos 14 días</p>
          <div className="flex items-end gap-1 h-32">
            {Array.from(installsPorDia.entries()).map(([fecha, count]) => {
              const altura = (count / maxDia) * 100;
              return (
                <div
                  key={fecha}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                  title={`${fecha}: ${count} install${count === 1 ? "" : "s"}`}
                >
                  <div className="text-[10px] text-slate-400 mb-1">{count > 0 ? count : ""}</div>
                  <div
                    className="w-full bg-blue-500 hover:bg-blue-600 rounded-t transition-colors"
                    style={{ height: `${Math.max(altura, count > 0 ? 4 : 0)}%`, minHeight: count > 0 ? 4 : 0 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>{Array.from(installsPorDia.keys())[0]?.slice(5)}</span>
            <span>{Array.from(installsPorDia.keys()).at(-1)?.slice(5)}</span>
          </div>
        </section>

        {/* Plataforma breakdown + Últimos eventos */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="font-bold text-slate-800 mb-4">Por plataforma</h2>
            <div className="space-y-3">
              <PlatformRow icon={Smartphone} label="Android" count={totalPorPlataforma.android ?? 0} total={totalInstalls} color="emerald" />
              <PlatformRow icon={Apple} label="iOS" count={totalPorPlataforma.ios ?? 0} total={totalInstalls} color="slate" />
              <PlatformRow icon={Monitor} label="Desktop" count={totalPorPlataforma.desktop ?? 0} total={totalInstalls} color="blue" />
              {(totalPorPlataforma.unknown ?? 0) > 0 && (
                <PlatformRow icon={Smartphone} label="Desconocida" count={totalPorPlataforma.unknown ?? 0} total={totalInstalls} color="slate" />
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="font-bold text-slate-800 mb-4">Últimos eventos</h2>
            {ultimos.length === 0 ? (
              <p className="text-xs text-slate-400">Aún no hay eventos registrados.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {ultimos.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-xs">
                    <EventoBadge evento={e.evento} />
                    <span className="text-slate-700 truncate flex-1">
                      {e.usuario?.nombre ?? <span className="text-slate-400 italic">anónimo</span>}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                      {e.plataforma}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {e.created_at.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: typeof Download;
  label: string;
  value: string;
  subtitle?: string;
  tone: "emerald" | "blue" | "violet" | "slate";
}) {
  const toneCls = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className={`w-9 h-9 rounded-lg ${toneCls} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 leading-tight">{value}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function PlatformRow({
  icon: Icon,
  label,
  count,
  total,
  color,
}: {
  icon: typeof Smartphone;
  label: string;
  count: number;
  total: number;
  color: "emerald" | "blue" | "slate";
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const barCls = { emerald: "bg-emerald-500", blue: "bg-blue-500", slate: "bg-slate-500" }[color];
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-700 flex-1">{label}</span>
        <span className="text-xs text-slate-500">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${barCls} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EventoBadge({ evento }: { evento: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PROMPT_SHOWN: { label: "Prompt", cls: "bg-slate-100 text-slate-600" },
    INSTALL_ACCEPTED: { label: "Aceptó", cls: "bg-emerald-100 text-emerald-700" },
    INSTALL_DISMISSED: { label: "Rechazó", cls: "bg-amber-100 text-amber-700" },
    APP_INSTALLED: { label: "Instalada", cls: "bg-emerald-100 text-emerald-700" },
    LAUNCHED_STANDALONE: { label: "Abrió app", cls: "bg-blue-100 text-blue-700" },
    IOS_INSTRUCTIONS_SHOWN: { label: "iOS instr.", cls: "bg-violet-100 text-violet-700" },
  };
  const cfg = map[evento] ?? { label: evento, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.cls} flex-shrink-0`}>
      {cfg.label}
    </span>
  );
}
