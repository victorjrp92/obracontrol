// Utilidades de geolocalización para el LocationPicker.
// - parseLatLng: extrae lat/lng de coordenadas crudas o links largos de Google Maps.
// - geocodeDireccion: convierte una dirección de texto en coordenadas (Mapbox).

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  label: string;
}

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= LAT_MIN &&
    lat <= LAT_MAX &&
    lng >= LNG_MIN &&
    lng <= LNG_MAX &&
    // Descarta 0,0 (golfo de Guinea) que suele ser un parseo fallido.
    !(lat === 0 && lng === 0)
  );
}

/**
 * Intenta extraer coordenadas de:
 *  - "4.6097, -74.0817"  (coords crudas, coma o espacio)
 *  - "https://maps.google.com/?q=4.6097,-74.0817"
 *  - "https://www.google.com/maps/@4.6097,-74.0817,15z"
 *  - "https://www.google.com/maps/place/Nombre/@4.6097,-74.0817,17z"
 *
 * NO resuelve short links (maps.app.goo.gl / goo.gl/maps) — esos no traen
 * coords en la URL y el browser no puede seguir el redirect por CORS.
 * Devuelve null si no encuentra coords válidas.
 */
export function parseLatLng(input: string): LatLng | null {
  if (!input) return null;
  const text = input.trim();

  // 1) Patrón @lat,lng (URLs de Google Maps con vista)
  const atMatch = text.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // 2) Patrón q=lat,lng o query=lat,lng
  const qMatch = text.match(/[?&](?:q|query|ll|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // 3) Coords crudas "lat, lng" o "lat lng" (sin que sea parte de una URL larga)
  const rawMatch = text.match(/^\s*(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  return null;
}

/** True si el texto parece un short link de Google Maps (no resoluble en browser). */
export function isGoogleShortLink(input: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(input);
}

/**
 * Geocoding directo con Mapbox (forward geocoding v6).
 * Sesga resultados a Colombia. Requiere NEXT_PUBLIC_MAPBOX_TOKEN.
 * Llamada desde el cliente (token público).
 */
export async function geocodeDireccion(query: string): Promise<GeocodeResult[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error("Falta NEXT_PUBLIC_MAPBOX_TOKEN");
  }
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "co");
  url.searchParams.set("language", "es");
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error consultando Mapbox");
  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { full_address?: string; name?: string; place_formatted?: string };
    }>;
  };

  const out: GeocodeResult[] = [];
  for (const f of data.features ?? []) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const [lng, lat] = coords;
    if (!valid(lat, lng)) continue;
    const label =
      f.properties?.full_address ??
      f.properties?.name ??
      f.properties?.place_formatted ??
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    out.push({ lat, lng, label });
  }
  return out;
}

/**
 * Reverse geocoding: de coordenadas a una dirección legible (al pinchar el mapa).
 * Devuelve null si no encuentra nada o no hay token.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("access_token", token);
  url.searchParams.set("language", "es");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ properties?: { full_address?: string; place_formatted?: string } }>;
    };
    const f = data.features?.[0];
    return f?.properties?.full_address ?? f?.properties?.place_formatted ?? null;
  } catch {
    return null;
  }
}
