"use client";

// ---------------------------------------------------------------------------
// EL MAPA DE EVIDENCIAS: la prueba de que se estuvo ahí.
//
// Cada foto de obra llega con las coordenadas del móvil que la tomó. Hasta hoy
// eso se veía como cinco decimales dentro del detalle de UNA tarea. Puestas
// todas sobre el mapa, esas coordenadas contestan lo que ninguna otra pantalla
// contesta: «¿esta foto se tomó en el apartamento 301, o desde la casa del
// contratista?».
//
// ══ POR QUÉ AGRUPADO Y NO UN MARCADOR POR FOTO ═════════════════════════════
//
// Una sola obra de producción tiene 3.348 evidencias. Un `mapboxgl.Marker` es
// un nodo del DOM con su propia transformación en cada frame: 3.348 marcadores
// dejan el mapa inservible en un móvil. Aquí van como una fuente GeoJSON con
// `cluster: true`, que Mapbox agrupa y dibuja en WebGL. Es la misma librería
// que ya usa el mapa de obras (`MapaProyectos`), sin añadir nada.
//
// El clúster además SUMA (`clusterProperties`) cuántas de las fotos que esconde
// caen fuera del radio, para poder pintarse de otro color. Sin eso, un grupo de
// doscientas fotos ocultaría el único punto raro, que es justo el que importa.
//
// ══ POR QUÉ LA FOTO SE PIDE AL PINCHAR ═════════════════════════════════════
//
// El bucket es privado y cada URL hay que firmarla. Firmar 3.348 para que se
// miren tres es pagar la espera de 3.345 firmas que se tiran. El mapa se dibuja
// con id y coordenadas; la foto se pide por acción de servidor al abrir un
// punto.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Calendar, ExternalLink, ImageOff, Loader2, MapPin, User, X } from "lucide-react";
import {
  formatearDistancia,
  poligonoCirculo,
  type Coordenada,
} from "@/lib/distancia-obra";
import type { DetalleEvidencia, PuntoEvidencia } from "@/lib/data-mapa-evidencias";

const FUENTE_PUNTOS = "evidencias";
const FUENTE_RADIO = "radio-obra";
const CAPA_CLUSTERS = "evidencias-clusters";
const CAPA_CONTEO = "evidencias-conteo";
const CAPA_PUNTOS = "evidencias-punto";
const CAPA_SELECCION = "evidencias-seleccion";

// Azul = dentro del radio, ámbar = fuera. Ámbar y no rojo a propósito: el GPS
// de un móvil se equivoca decenas de metros pegado al hormigón, así que esto es
// un aviso para mirar, no un veredicto de fraude.
const COLOR_DENTRO = "#2563eb";
const COLOR_FUERA = "#d97706";
const COLOR_OBRA = "#0f766e";

const CENTRO_COLOMBIA: [number, number] = [-74.2973, 4.5709];

const VACIO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface Props {
  proyectoId: string;
  obra: { nombre: string; ubicacion: Coordenada | null };
  puntos: PuntoEvidencia[];
  radioMetros: number;
  /** Acción de servidor: firma y trae el detalle de UNA foto. */
  obtenerDetalle: (proyectoId: string, evidenciaId: string) => Promise<DetalleEvidencia | null>;
}

function coleccionPuntos(puntos: PuntoEvidencia[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: puntos.map((p) => ({
      type: "Feature",
      // `fuera` viaja como 0/1 y no como booleano porque el clúster lo suma.
      properties: { id: p.id, fuera: p.fuera },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  };
}

function coleccionRadio(centro: Coordenada | null, radioMetros: number): GeoJSON.FeatureCollection {
  const anillo = poligonoCirculo(centro, radioMetros);
  if (anillo.length === 0) return VACIO;
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anillo] } },
    ],
  };
}

function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MapaEvidencias({
  proyectoId,
  obra,
  puntos,
  radioMetros,
  obtenerDetalle,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const marcadorObraRef = useRef<mapboxgl.Marker | null>(null);
  const [listo, setListo] = useState(false);

  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleEvidencia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // ── Ciclo de vida del mapa ────────────────────────────────────────────────
  // Se monta UNA vez y luego solo se le cambian los datos. Volver a crearlo en
  // cada cambio de radio perdería el encuadre que el usuario acaba de ajustar,
  // que es lo único que hace útil un mapa de tres mil puntos.
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const referencia: [number, number] | null = obra.ubicacion
      ? [obra.ubicacion.lng, obra.ubicacion.lat]
      : puntos[0]
        ? [puntos[0].lng, puntos[0].lat]
        : null;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: referencia ?? CENTRO_COLOMBIA,
      // Sin ningun punto de referencia se abre sobre el pais entero: un zoom 15
      // sobre el centro geografico de Colombia es un potrero sin contexto.
      zoom: referencia ? 15 : 5,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // El círculo del radio va DEBAJO de los puntos: es contexto, no dato.
      map.addSource(FUENTE_RADIO, { type: "geojson", data: VACIO });
      map.addLayer({
        id: "radio-relleno",
        type: "fill",
        source: FUENTE_RADIO,
        paint: { "fill-color": COLOR_OBRA, "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "radio-borde",
        type: "line",
        source: FUENTE_RADIO,
        paint: { "line-color": COLOR_OBRA, "line-width": 1.5, "line-dasharray": [3, 2] },
      });

      map.addSource(FUENTE_PUNTOS, {
        type: "geojson",
        data: VACIO,
        cluster: true,
        // Hasta z17 se agrupa; más cerca que eso ya se distinguen fotos tomadas
        // en apartamentos distintos y agruparlas escondería justo el detalle.
        clusterMaxZoom: 17,
        clusterRadius: 45,
        clusterProperties: { fuera: ["+", ["get", "fuera"]] },
      });

      map.addLayer({
        id: CAPA_CLUSTERS,
        type: "circle",
        source: FUENTE_PUNTOS,
        filter: ["has", "point_count"],
        paint: {
          // Un grupo que esconde aunque sea UNA foto lejana se pinta de ámbar:
          // si no, doscientas fotos buenas taparían la única que hay que mirar.
          "circle-color": ["case", [">", ["get", "fuera"], 0], COLOR_FUERA, COLOR_DENTRO],
          "circle-radius": ["step", ["get", "point_count"], 15, 25, 20, 100, 26, 500, 32],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: CAPA_CONTEO,
        type: "symbol",
        source: FUENTE_PUNTOS,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: CAPA_PUNTOS,
        type: "circle",
        source: FUENTE_PUNTOS,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["==", ["get", "fuera"], 1], COLOR_FUERA, COLOR_DENTRO],
          "circle-radius": 6,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Halo de la foto abierta. Va en su propia capa para no tener que
      // reescribir la fuente entera cada vez que se pincha otra.
      map.addLayer({
        id: CAPA_SELECCION,
        type: "circle",
        source: FUENTE_PUNTOS,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": 13,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#0f172a",
        },
      });

      map.on("click", CAPA_CLUSTERS, (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: [CAPA_CLUSTERS] })[0];
        const clusterId = f?.properties?.cluster_id;
        if (clusterId === undefined) return;
        const fuente = map.getSource(FUENTE_PUNTOS) as mapboxgl.GeoJSONSource | undefined;
        fuente?.getClusterExpansionZoom(clusterId as number, (error, zoom) => {
          // Un clúster que ya no existe (la fuente cambió entre el clic y la
          // respuesta) no es un error que valga la pena enseñar.
          if (error || typeof zoom !== "number") return;
          const centro = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: centro, zoom });
        });
      });

      map.on("click", CAPA_PUNTOS, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") setSeleccionada(id);
      });

      for (const capa of [CAPA_CLUSTERS, CAPA_PUNTOS]) {
        map.on("mouseenter", capa, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", capa, () => { map.getCanvas().style.cursor = ""; });
      }

      setListo(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      marcadorObraRef.current = null;
      setListo(false);
    };
    // Solo el token: el resto se actualiza por el efecto de datos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Datos: puntos, círculo del radio, marcador de la obra y encuadre ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;

    (map.getSource(FUENTE_PUNTOS) as mapboxgl.GeoJSONSource | undefined)?.setData(
      coleccionPuntos(puntos),
    );
    (map.getSource(FUENTE_RADIO) as mapboxgl.GeoJSONSource | undefined)?.setData(
      coleccionRadio(obra.ubicacion, radioMetros),
    );

    if (obra.ubicacion) {
      const centro: [number, number] = [obra.ubicacion.lng, obra.ubicacion.lat];
      if (marcadorObraRef.current) marcadorObraRef.current.setLngLat(centro);
      else {
        marcadorObraRef.current = new mapboxgl.Marker({ color: COLOR_OBRA })
          .setLngLat(centro)
          .setPopup(new mapboxgl.Popup({ offset: 24, closeButton: false }).setText(obra.nombre))
          .addTo(map);
      }
    } else if (marcadorObraRef.current) {
      marcadorObraRef.current.remove();
      marcadorObraRef.current = null;
    }

    // Encuadre: entra todo lo que hay que ver —las fotos y el círculo—, no solo
    // las fotos. Si una obra tiene todas sus fotos en un portal, sin el círculo
    // el mapa abriría tan cerca que nadie entendería dónde está el límite.
    const limites = new mapboxgl.LngLatBounds();
    let hayAlgo = false;
    for (const p of puntos) {
      limites.extend([p.lng, p.lat]);
      hayAlgo = true;
    }
    for (const [lng, lat] of poligonoCirculo(obra.ubicacion, radioMetros, 16)) {
      limites.extend([lng, lat]);
      hayAlgo = true;
    }
    if (hayAlgo) map.fitBounds(limites, { padding: 50, maxZoom: 17, duration: 0 });
  }, [listo, puntos, obra, radioMetros]);

  // Halo de la seleccionada.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    map.setFilter(CAPA_SELECCION, ["==", ["get", "id"], seleccionada ?? ""]);
  }, [listo, seleccionada]);

  // ── Detalle de la foto abierta ───────────────────────────────────────────
  useEffect(() => {
    if (!seleccionada) {
      setDetalle(null);
      setErrorDetalle("");
      return;
    }
    let cancelado = false;
    setCargando(true);
    setErrorDetalle("");
    setDetalle(null);
    obtenerDetalle(proyectoId, seleccionada)
      .then((d) => {
        if (cancelado) return;
        if (!d) setErrorDetalle("No se pudo cargar esta evidencia.");
        setDetalle(d);
      })
      .catch(() => {
        if (!cancelado) setErrorDetalle("No se pudo cargar esta evidencia.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [seleccionada, proyectoId, obtenerDetalle]);

  const cerrar = useCallback(() => setSeleccionada(null), []);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        El mapa no está configurado (falta NEXT_PUBLIC_MAPBOX_TOKEN). Las coordenadas de cada foto
        siguen guardadas y visibles en el detalle de su tarea.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div>
        <div
          ref={containerRef}
          className="w-full h-[420px] sm:h-[540px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
        />

        {puntos.length === 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Ninguna foto de esta obra trae coordenadas todavía. En cuanto el equipo reporte desde el
            móvil con la ubicación activa, aparecen aquí.
          </p>
        )}

        {/* Leyenda + el aviso de precisión. El aviso NO es letra pequeña
            decorativa: sin él, un punto ámbar se lee como una acusación. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_DENTRO }} />
            Dentro del radio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_FUERA }} />
            A más de {formatearDistancia(radioMetros)} de la obra
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_OBRA }} />
            Punto de la obra
          </span>
          <span className="text-slate-400">Los números son grupos de fotos; pincha para abrirlos.</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
          El GPS de un móvil se equivoca entre 5 y 50 m a cielo abierto, y bastante más pegado a una
          estructura de hormigón o dentro de un sótano. Una foto fuera del radio es motivo para
          mirarla, no prueba de nada por sí sola.
        </p>
      </div>

      {/* ── Panel de la foto abierta ────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 min-h-[200px]">
        {!seleccionada && (
          <div className="text-center text-slate-400 py-10">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              Pincha una foto del mapa para ver la imagen, la tarea, quién la tomó, cuándo y a qué
              distancia de la obra.
            </p>
          </div>
        )}

        {seleccionada && (
          <>
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Evidencia</h3>
              <button
                onClick={cerrar}
                className="text-slate-400 hover:text-slate-700 flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cargando && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando la foto…
              </div>
            )}

            {!cargando && errorDetalle && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {errorDetalle}
              </p>
            )}

            {!cargando && detalle && (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-900/5">
                  {detalle.url === "" ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-10 text-slate-400">
                      <ImageOff className="w-7 h-7 opacity-40" />
                      <span className="text-[11px]">El archivo ya no está disponible</span>
                    </div>
                  ) : detalle.tipo === "VIDEO" ? (
                    <video src={detalle.url} controls className="w-full max-h-56 bg-black" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detalle.url}
                      alt={`Evidencia de ${detalle.tarea}`}
                      className="w-full max-h-56 object-cover"
                    />
                  )}
                </div>

                <DistanciaBadge distancia={detalle.distancia} radioMetros={radioMetros} />

                <div className="flex flex-col gap-1.5 text-[11px]">
                  <a
                    href={`/dashboard/tareas/${detalle.tareaId}`}
                    className="text-sm font-semibold text-blue-700 hover:underline leading-snug"
                  >
                    {detalle.tarea}
                  </a>
                  <div className="text-slate-500">{detalle.ubicacion}</div>
                  <div className="text-slate-400">Fase: {detalle.fase}</div>
                  <div className="flex items-center gap-1.5 text-slate-600 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {detalle.autor}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {formatearFechaHora(detalle.fecha)}
                  </div>
                  {detalle.lat !== null && detalle.lng !== null && (
                    <a
                      href={`https://www.google.com/maps?q=${detalle.lat},${detalle.lng}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline w-fit mt-0.5"
                    >
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-mono">
                        {detalle.lat.toFixed(5)}, {detalle.lng.toFixed(5)}
                      </span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * La distancia, con el aviso solo cuando toca.
 *
 * Sin distancia NO dice «0 m» ni «en la obra»: dice que no se puede medir. Un
 * cero aquí sería la afirmación contraria a lo que sabemos.
 */
function DistanciaBadge({
  distancia,
  radioMetros,
}: {
  distancia: number | null;
  radioMetros: number;
}) {
  if (distancia === null) {
    return (
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-[11px] text-slate-500">
        Sin distancia: falta la ubicación de la obra o la de esta foto.
      </div>
    );
  }
  const fuera = distancia > radioMetros;
  return (
    <div
      className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
        fuera
          ? "bg-amber-50 border-amber-200 text-amber-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      A {formatearDistancia(distancia)} del punto de la obra
      {fuera && (
        <span className="block font-normal mt-0.5">
          Fuera del radio de {formatearDistancia(radioMetros)} que tienes elegido.
        </span>
      )}
    </div>
  );
}
