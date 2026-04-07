import Topbar from "@/components/dashboard/Topbar";
import { Download, FileText, BarChart3, Clock, FileCheck } from "lucide-react";

const reportTypes = [
  {
    icon: BarChart3,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Progreso por proyecto",
    description: "Estado actual de avance, tareas aprobadas vs. reportadas, y semáforo por edificio.",
    tag: "PDF / Excel",
    action: "Generar reporte",
  },
  {
    icon: FileCheck,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    title: "Score de contratistas",
    description: "Historial de puntuación por contratista con los tres ejes de evaluación.",
    tag: "PDF",
    action: "Generar reporte",
  },
  {
    icon: Clock,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    title: "Extensiones de tiempo",
    description: "Registro oficial de cada extensión con justificación y documentación adjunta.",
    tag: "PDF",
    action: "Generar reporte",
  },
  {
    icon: FileText,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "Consumo de materiales",
    description: "Planeado vs. real por espacio y fase. Reporte de piezas dañadas.",
    tag: "Excel",
    action: "Generar reporte",
  },
];

const recentReports = [
  { name: "Progreso Olivo · Torre 5 · Semana 14", date: "5 Abr 2026", type: "PDF", size: "2.1 MB" },
  { name: "Score contratistas · Marzo 2026", date: "1 Abr 2026", type: "PDF", size: "890 KB" },
  { name: "Extensión de tiempo · Puertas Apto 301", date: "28 Mar 2026", type: "PDF", size: "1.4 MB" },
  { name: "Consumo materiales · Roble Q1 2026", date: "31 Mar 2026", type: "Excel", size: "340 KB" },
];

export default function ReportesPage() {
  return (
    <>
      <Topbar title="Reportes" subtitle="Generación y descarga de reportes" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {reportTypes.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${r.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${r.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{r.title}</h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">{r.tag}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{r.description}</p>
                  <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                    <Download className="w-3.5 h-3.5" />
                    {r.action}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 mb-4">Reportes recientes</h2>
          <div className="flex flex-col divide-y divide-slate-50">
            {recentReports.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.date} · {r.size}</div>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">{r.type}</span>
                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
