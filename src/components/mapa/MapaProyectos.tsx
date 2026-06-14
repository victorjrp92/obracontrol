"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface ProyectoMapa {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  porcentaje: number;
  subtitulo?: string; // ciudad, constructora (super admin), etc.
}

interface Props {
  proyectos: ProyectoMapa[];
  /** Base del link al hacer click en un pin. Ej: "/dashboard/proyectos" */
  hrefBase?: string;
  className?: string;
}

const COLOMBIA_CENTER: [number, number] = [-74.2973, 4.5709];

// Color del pin según avance: gris (por iniciar) → azul (en curso) → verde (listo).
function colorPorAvance(pct: number): string {
  if (pct >= 100) return "#16a34a"; // verde
  if (pct > 0) return "#2563eb"; // azul
  return "#94a3b8"; // gris
}

export default function MapaProyectos({ proyectos, hrefBase = "/dashboard/proyectos", className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const conCoords = proyectos.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: conCoords[0] ? [conCoords[0].lng, conCoords[0].lat] : COLOMBIA_CENTER,
      zoom: conCoords.length === 1 ? 14 : 5,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const bounds = new mapboxgl.LngLatBounds();

    for (const p of conCoords) {
      const color = colorPorAvance(p.porcentaje);
      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:160px">
          <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px">${escapeHtml(p.nombre)}</div>
          ${p.subtitulo ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">${escapeHtml(p.subtitulo)}</div>` : ""}
          <div style="font-size:11px;color:#334155;margin-bottom:6px">${p.porcentaje}% completado</div>
          <a href="${hrefBase}/${p.id}" style="font-size:12px;color:#2563eb;font-weight:600;text-decoration:none">Ver proyecto →</a>
        </div>`;
      const popup = new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(popupHtml);
      new mapboxgl.Marker({ color })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map);
      bounds.extend([p.lng, p.lat]);
    }

    if (conCoords.length > 1) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        El mapa no está configurado (falta NEXT_PUBLIC_MAPBOX_TOKEN).
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-72 sm:h-80 rounded-xl overflow-hidden border border-slate-200" />
      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Por iniciar</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> En curso</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Terminado</span>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
