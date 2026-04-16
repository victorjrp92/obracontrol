import Link from "next/link";
import { Camera, Check, Clock, XCircle } from "lucide-react";

interface TareaCardProps {
  token: string;
  id: string;
  nombre: string;
  ubicacion: string;
  estado: string;
  reportadaPor: string | null;
  fotoReferenciaUrl: string | null;
}

const estadoBadge: Record<string, { bg: string; text: string; label: string }> = {
  PENDIENTE: { bg: "bg-slate-100", text: "text-slate-700", label: "Por hacer" },
  REPORTADA: { bg: "bg-amber-100", text: "text-amber-800", label: "En revision" },
  APROBADA: { bg: "bg-green-100", text: "text-green-800", label: "Aprobada" },
  NO_APROBADA: { bg: "bg-red-100", text: "text-red-800", label: "Rechazada" },
};

export default function TareaCard({
  token,
  id,
  nombre,
  ubicacion,
  estado,
  reportadaPor,
  fotoReferenciaUrl,
}: TareaCardProps) {
  const badge = estadoBadge[estado] ?? estadoBadge.PENDIENTE;
  const isActionable = estado === "PENDIENTE" || estado === "NO_APROBADA";
  const isDimmed = reportadaPor && estado === "REPORTADA";

  const content = (
    <div
      className={`min-h-[80px] rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-4 transition-shadow ${
        isActionable ? "hover:shadow-md active:bg-slate-50" : ""
      } ${isDimmed ? "opacity-70" : ""}`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {estado === "APROBADA" && (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
        )}
        {estado === "REPORTADA" && (
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
        )}
        {estado === "NO_APROBADA" && (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
        )}
        {estado === "PENDIENTE" && (
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900 truncate">
            {nombre}
          </h3>
          {fotoReferenciaUrl && (
            <Camera className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
          )}
        </div>
        <p className="text-sm text-slate-500 truncate">{ubicacion}</p>

        <div className="flex items-center gap-2 mt-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
          >
            {badge.label}
            {estado === "APROBADA" && " \u2713"}
          </span>

          {reportadaPor && estado === "REPORTADA" && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Reportada por {reportadaPor}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (isActionable) {
    return (
      <Link href={`/o/${token}/tarea/${id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
