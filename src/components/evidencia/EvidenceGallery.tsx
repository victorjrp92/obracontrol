"use client";

import { useState } from "react";
import { Image as ImageIcon, Video as VideoIcon, MapPin, Calendar, X } from "lucide-react";

interface Evidencia {
  id: string;
  tipo: "FOTO" | "VIDEO";
  url_storage: string;
  gps_lat: number | null;
  gps_lng: number | null;
  timestamp_captura: string;
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
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {fotos.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelected(ev)}
                className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors"
              >
                <img src={ev.url_storage} alt="Evidencia" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {videos.map((v) => (
        <div key={v.id} className="mb-3 rounded-xl overflow-hidden border border-slate-200">
          <video src={v.url_storage} controls className="w-full max-h-64 bg-black" />
          <div className="px-3 py-2 bg-slate-50 flex items-center gap-3 text-xs text-slate-500">
            <VideoIcon className="w-3.5 h-3.5" />
            <span>{new Date(v.timestamp_captura).toLocaleString("es-CO")}</span>
          </div>
        </div>
      ))}

      {/* Modal de foto */}
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
              {selected.gps_lat && selected.gps_lng && (
                <a
                  href={`https://www.google.com/maps?q=${selected.gps_lat},${selected.gps_lng}`}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {selected.gps_lat.toFixed(5)}, {selected.gps_lng.toFixed(5)}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
