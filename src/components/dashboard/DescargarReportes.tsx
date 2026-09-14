"use client";

// ---------------------------------------------------------------------------
// Descarga de reportes de avance: se eligen una o varias obras y se bajan.
//
// Antes era una lista con un boton por obra. Con tres obras funciona; con
// treinta es una pantalla entera de botones, y bajar el cierre de mes son
// treinta clics. Por eso el selector es un desplegable con buscador y
// casillas: se marca lo que se quiere y se baja de una.
//
// == POR QUE SE DESCARGA UNA POR UNA Y NO EN UN ZIP =========================
//
// Cada reporte es un PDF que el servidor ya devuelve con
// `Content-Disposition: attachment`, asi que un clic programatico en un enlace
// lo baja sin abrir pestana ni disparar el bloqueador de ventanas. Un zip
// obligaria a un endpoint nuevo que arme el paquete en memoria; con diez obras
// de cuatro mil tareas eso es bastante PDF en RAM de una funcion serverless,
// para ahorrarle al usuario un archivo.
//
// Las descargas van escalonadas: los navegadores estrangulan varias descargas
// simultaneas del mismo origen y algunas se pierden en silencio, que es el
// peor de los fallos -el usuario cree que bajo todo-.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ChevronDown, Search, Check, Loader2 } from "lucide-react";

/** Separacion entre descargas. Por debajo de esto el navegador empieza a
 *  descartar las que llegan de a rafagas. */
const PAUSA_MS = 400;

/**
 * El nombre con el que se guarda el PDF.
 *
 * Al bajar por `fetch` el navegador ya no lee `Content-Disposition` por su
 * cuenta -eso solo pasa en una navegacion-, asi que hay que sacarlo a mano. Sin
 * esto el fichero se llamaria como el id de la obra, que es justo el sintoma
 * que teniamos.
 */
function nombreDeArchivo(res: Response, id: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return `avance-${id}.pdf`;
}

export interface ObraDescargable {
  id: string;
  nombre: string;
  porcentaje: number;
  aprobadas: number;
  total: number;
}

export default function DescargarReportes({ obras }: { obras: ObraDescargable[] }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera o con Escape: un desplegable que solo se cierra
  // con su propio boton atrapa al usuario.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return obras;
    return obras.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [obras, busqueda]);

  const alternar = (id: string) =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  // "Todas" opera sobre lo FILTRADO, no sobre la lista entera: si el usuario
  // busco "torre", espera marcar las torres y no las treinta obras.
  const todasFiltradasMarcadas = filtradas.length > 0 && filtradas.every((o) => marcadas.has(o.id));
  const alternarTodas = () =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      for (const o of filtradas) {
        if (todasFiltradasMarcadas) s.delete(o.id);
        else s.add(o.id);
      }
      return s;
    });

  async function descargar() {
    const ids = obras.filter((o) => marcadas.has(o.id)).map((o) => o.id);
    if (ids.length === 0 || bajando) return;
    setBajando(true);
    setError(null);
    try {
      for (const [i, id] of ids.entries()) {
        // Se baja con `fetch` y no con un `<a download>`.
        //
        // Con el atributo `download`, quien hace la peticion es el gestor de
        // descargas del navegador, no la pagina, y ahi la cookie de sesion no
        // viaja siempre: el servidor respondia 401 y Chrome guardaba el JSON
        // del error como un fichero llamado `<id-de-obra>.json`. El usuario se
        // encontraba un archivo ilegible en su carpeta de descargas y ningun
        // aviso. Con `fetch` la sesion va segura y, sobre todo, un fallo se
        // puede CONTAR en vez de guardarse en el disco.
        const res = await fetch(`/api/reportes/progreso/${id}`);

        if (!res.ok) {
          const nombre = obras.find((o) => o.id === id)?.nombre ?? "la obra";
          let detalle = `error ${res.status}`;
          try {
            const cuerpo = await res.json();
            if (typeof cuerpo?.error === "string") detalle = cuerpo.error;
          } catch {
            // El cuerpo no era JSON: nos quedamos con el codigo.
          }
          throw new Error(`No se pudo generar el reporte de ${nombre}: ${detalle}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreDeArchivo(res, id);
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Sin esto el blob se queda en memoria hasta recargar la pagina, y
        // treinta PDF de una obra grande no son poca cosa.
        URL.revokeObjectURL(url);

        if (i < ids.length - 1) await new Promise((r) => setTimeout(r, PAUSA_MS));
      }
      setAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el reporte.");
    } finally {
      setBajando(false);
    }
  }

  if (obras.length === 0) {
    return <p className="text-sm text-slate-400 py-2">No hay obras activas para generar reporte.</p>;
  }

  const n = marcadas.size;

  return (
    <div className="flex items-center gap-2" ref={caja}>
      <div className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-haspopup="listbox"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {n === 0
              ? "Elegir obras"
              : n === 1
                ? obras.find((o) => marcadas.has(o.id))!.nombre
                : `${n} obras seleccionadas`}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </button>

        {abierto && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {obras.length > 6 && (
              <div className="relative border-b border-slate-100">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar obra..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              type="button"
              onClick={alternarTodas}
              disabled={filtradas.length === 0}
              className="w-full text-left px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer disabled:text-slate-300 disabled:cursor-not-allowed"
            >
              {todasFiltradasMarcadas ? "Quitar todas" : "Marcar todas"}
              {busqueda.trim() && filtradas.length !== obras.length && ` (${filtradas.length})`}
            </button>

            <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto">
              {filtradas.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-400 text-center">Ninguna obra coincide.</li>
              ) : (
                filtradas.map((o) => {
                  const on = marcadas.has(o.id);
                  return (
                    <li key={o.id} role="option" aria-selected={on}>
                      <button
                        type="button"
                        onClick={() => alternar(o.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        <span
                          className={`w-4 h-4 rounded border flex-shrink-0 grid place-items-center ${
                            on ? "bg-blue-600 border-blue-600" : "border-slate-300"
                          }`}
                        >
                          {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-800 truncate">
                            {o.nombre}
                          </span>
                          <span className="flex items-center gap-2 mt-0.5">
                            <span className="h-1 w-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                              <span
                                className="block h-full rounded-full bg-blue-600"
                                style={{ width: `${o.porcentaje}%` }}
                              />
                            </span>
                            <span className="text-[10.5px] font-semibold text-slate-400 truncate">
                              {o.porcentaje}% · {o.aprobadas}/{o.total}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={descargar}
        disabled={n === 0 || bajando}
        title={n === 0 ? "Elige al menos una obra" : `Descargar ${n} reporte${n === 1 ? "" : "s"} en PDF`}
        aria-label={n === 0 ? "Descargar reportes" : `Descargar ${n} reporte${n === 1 ? "" : "s"} en PDF`}
        className="flex-shrink-0 w-9 h-9 grid place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        {bajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </button>

      {/* Un fallo tiene que VERSE. Antes se guardaba como fichero en la carpeta
          de descargas y el usuario no se enteraba de nada. */}
      {error && (
        <p role="alert" className="basis-full text-xs text-red-600 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
