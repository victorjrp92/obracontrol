"use client";

import { useState } from "react";
import { Image as ImageIcon, Video as VideoIcon, MapPin, Calendar, X, ExternalLink } from "lucide-react";

interface Evidencia {
  id: string;
  tipo: "FOTO" | "VIDEO";
  url_storage: string;
  gps_lat: number | null;
  gps_lng: number | null;
  timestamp_captura: string;
}

function formatFechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }),
    hora: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
  };
}

function MetadataPanel({ ev }: { ev: Evidencia }) {
  const { fecha, hora } = formatFechaHora(ev.timestamp_captura);
  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 text-slate-600">
        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span>{fecha}</span>
        <span className="text-slate-400">·</span>
        <span>{hora}</span>
      </div>
      {ev.gps_lat != null && ev.gps_lng != null ? (
        <a
          href={`https://www.google.com/maps?q=${ev.gps_lat},${ev.gps_lng}`}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline w-fit"
          title="Abrir en Google Maps"
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono">
            {ev.gps_lat.toFixed(5)}, {ev.gps_lng.toFixed(5)}
          </span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          GPS no disponible
        </span>
      )}
    </div>
  );
}

export default function EvidenceGallery({ evidencias }: { evidencias: Evidencia[] }) {
  const [selected, setSelected] = useState<Evidencia | null>(null);

  if (evidencias.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin evidencia subida aún</p>
      </div>
    );
  }

  const fotos = evidencias.filter((e) => e.tipo === "FOTO");
  const videos = evidencias.filter((e) => e.tipo === "VIDEO");

  return (
    <>
      {fotos.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {fotos.map((ev, idx) => (
            <div
              key={ev.id}
              className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
            >
              <button
                onClick={() => setSelected(ev)}
                className="w-full sm:w-40 aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors flex-shrink-0"
              >
                <img src={ev.url_storage} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700">Foto {idx + 1}</div>
                <MetadataPanel ev={ev} />
              </div>
            </div>
          ))}
        </div>
      )}

      {videos.map((v, idx) => (
        <div
          key={v.id}
          className="mb-3 flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
        >
          <div className="w-full sm:w-64 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
            <video src={v.url_storage} controls className="w-full max-h-48 bg-black" />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <VideoIcon className="w-3.5 h-3.5" />
              Video {idx + 1}
            </div>
            <MetadataPanel ev={v} />
          </div>
        </div>
      ))}

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 z-10 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selected.url_storage} alt="Evidencia ampliada" className="w-full h-auto rounded-xl" />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(selected.timestamp_captura).toLocaleString("es-CO")}
              </span>
              {selected.gps_lat != null && selected.gps_lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${selected.gps_lat},${selected.gps_lng}`}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {selected.gps_lat.toFixed(5)}, {selected.gps_lng.toFixed(5)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
