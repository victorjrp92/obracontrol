"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Search, X, Loader2, Check, ChevronDown } from "lucide-react";
import {
  parseLatLng,
  isGoogleShortLink,
  geocodeDireccion,
  reverseGeocode,
  type GeocodeResult,
} from "@/lib/geo";

export interface LocationValue {
  lat: number;
  lng: number;
  direccion?: string;
}

interface Props {
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
}

const COLOMBIA_CENTER: [number, number] = [-74.2973, 4.5709];

export default function LocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [resultados, setResultados] = useState<GeocodeResult[]>([]);
  // El mapa va COLAPSADO por defecto (ocupa mucho espacio en el wizard).
  // Solo se monta cuando el usuario quiere ajustar el punto a mano.
  const [showMap, setShowMap] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  function pintarMarcador(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      const m = new mapboxgl.Marker({ color: "#2563EB", draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      m.on("dragend", async () => {
        const { lat: dLat, lng: dLng } = m.getLngLat();
        const dir = await reverseGeocode(dLat, dLng);
        onChange({ lat: dLat, lng: dLng, direccion: dir ?? undefined });
      });
      markerRef.current = m;
    }
    map.flyTo({ center: [lng, lat], zoom: 15 });
  }

  function setUbicacion(lat: number, lng: number, direccion?: string) {
    onChange({ lat, lng, direccion });
    setResultados([]);
    setError("");
    if (showMap) pintarMarcador(lat, lng);
  }

  // Init del mapa SOLO cuando se muestra.
  useEffect(() => {
    if (!showMap || !token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: value ? [value.lng, value.lat] : COLOMBIA_CENTER,
      zoom: value ? 15 : 5,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      pintarMarcador(lat, lng);
      const dir = await reverseGeocode(lat, lng);
      onChange({ lat, lng, direccion: dir ?? undefined });
      setError("");
    });
    mapRef.current = map;
    if (value) pintarMarcador(value.lat, value.lng);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, token]);

  async function handleBuscar() {
    setError("");
    setResultados([]);
    const text = query.trim();
    if (!text) return;

    const coords = parseLatLng(text);
    if (coords) {
      const dir = await reverseGeocode(coords.lat, coords.lng);
      setUbicacion(coords.lat, coords.lng, dir ?? undefined);
      return;
    }
    if (isGoogleShortLink(text)) {
      setError(
        "Los links cortos de Google Maps no se pueden leer aquí. Abre el link, copia las coordenadas (mantén presionado el punto → copiar) y pégalas.",
      );
      return;
    }
    setBuscando(true);
    try {
      const res = await geocodeDireccion(text);
      if (res.length === 0) {
        setError("No se encontró esa dirección. Prueba con más detalle o ajústala en el mapa.");
      } else if (res.length === 1) {
        setUbicacion(res[0].lat, res[0].lng, res[0].label);
      } else {
        setResultados(res);
      }
    } catch {
      setError("Error buscando la dirección. Intenta de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  function limpiar() {
    onChange(null);
    setResultados([]);
    setError("");
    setQuery("");
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    mapRef.current?.flyTo({ center: COLOMBIA_CENTER, zoom: 5 });
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        El mapa no está configurado (falta NEXT_PUBLIC_MAPBOX_TOKEN).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Input unificado: dirección, coords o link */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBuscar();
              }
            }}
            placeholder="Dirección, o pega coordenadas / link de Google Maps"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <button
          type="button"
          onClick={handleBuscar}
          disabled={buscando || !query.trim()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5"
        >
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Verificar
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Resultados de geocoding (cuando hay varios) */}
      {resultados.length > 0 && (
        <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {resultados.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setUbicacion(r.lat, r.lng, r.label)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/50 flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="flex-1">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmación de la ubicación (chip compacto, sin mapa) */}
      {value && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-800 truncate">
              {value.direccion ?? "Ubicación verificada"}
            </p>
            <p className="text-[10px] text-emerald-600 font-mono">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={limpiar}
            className="text-emerald-700 hover:text-emerald-900 p-1"
            aria-label="Quitar ubicación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toggle del mapa — colapsado por defecto para no ocupar espacio */}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="self-start inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        <MapPin className="w-3.5 h-3.5" />
        {showMap ? "Ocultar mapa" : "Ajustar en el mapa"}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMap ? "rotate-180" : ""}`} />
      </button>

      {showMap && (
        <div
          ref={containerRef}
          className="w-full h-56 rounded-xl overflow-hidden border border-slate-200"
        />
      )}

      {!value && !showMap && (
        <p className="text-xs text-slate-400">Opcional. Puedes agregarla después.</p>
      )}
    </div>
  );
}
