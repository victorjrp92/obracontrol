"use client";

import { useMemo, useState } from "react";
import { Camera, ImageOff } from "lucide-react";
import type { EstadoCupo } from "@/lib/productos-tecnicos";
import CamaraRegistroInicial, { type CapturaRegistro } from "./CamaraRegistroInicial";
import CupoBarra from "./CupoBarra";
import EspacioRegistroSection from "./EspacioRegistroSection";
import EstadoVacio from "./EstadoVacio";
import FotosSinMarcaAviso from "./FotosSinMarcaAviso";
import SelectorEspacioRegistro from "./SelectorEspacioRegistro";
import {
  descartarFotoRegistro,
  subirFotoRegistro,
} from "./logica/api-acta-inicial";
import type { EspacioListado } from "./logica/arbol-espacios";
import { NOTA_LARGO_MAX } from "./logica/marca-foto-inicial";
import {
  agruparPorEspacio,
  aFotoVista,
  numerarComoEnElActa,
  type FotoRegistroVista,
  type FotoSinMarca,
} from "./logica/vista-registro-inicial";

/**
 * El registro fotográfico inicial de una obra: escoger el espacio, tomar la
 * foto, revisarla.
 *
 * NO HAY NINGUNA VÍA DE SUBIDA DESDE ARCHIVO en esta pantalla, y no por un
 * `disabled` que se pueda quitar desde las herramientas del navegador: no se
 * importa `SubidaProductoDialog` ni `subirProducto()`, y el único componente que
 * produce imágenes es `CamaraRegistroInicial`, que las saca de un `MediaStream`.
 * El camino no está cerrado con llave: no está construido.
 *
 * La previsualización de una foto recién tomada sale de un `blob:` local, no de
 * volver a pedirla al servidor. Además de ahorrar la vuelta, evita el momento
 * incómodo en el que la foto ya se guardó pero todavía no se ve.
 */
export default function RegistroInicialPanel({
  proyectoId,
  espacios,
  fotos,
  fotosSinMarca,
  cupo,
  onFotoSubida,
  onFotoDescartada,
  onCupo,
}: {
  proyectoId: string;
  espacios: readonly EspacioListado[];
  fotos: readonly FotoRegistroVista[];
  /** Imágenes del registro que no llevan marca. Bloquean el acta hasta descartarse. */
  fotosSinMarca: readonly FotoSinMarca[];
  cupo: EstadoCupo;
  onFotoSubida: (foto: FotoRegistroVista) => void;
  onFotoDescartada: (id: string) => void;
  onCupo: (cupo: EstadoCupo) => void;
}) {
  const [espacioId, setEspacioId] = useState<string | null>(espacios[0]?.espacioId ?? null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);

  const espacio = espacios.find((e) => e.espacioId === espacioId) ?? null;

  const grupos = useMemo(() => agruparPorEspacio(fotos, espacios), [fotos, espacios]);
  const numeros = useMemo(() => numerarComoEnElActa(grupos), [grupos]);

  async function guardarCaptura(captura: CapturaRegistro) {
    if (!espacio) {
      setError("Escoge primero en qué espacio estás tomando la foto.");
      return;
    }

    setError(null);
    setSubiendo(true);
    const resultado = await subirFotoRegistro({
      proyectoId,
      espacioId: espacio.espacioId,
      imagen: captura.imagen,
      capturadaEn: captura.capturadaEn,
      lat: captura.gps.lat,
      lng: captura.gps.lng,
      nota: nota.trim() || null,
    });
    setSubiendo(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    const vista = aFotoVista(
      resultado.datos.producto,
      espacios,
      URL.createObjectURL(captura.imagen),
    );
    if (!vista) {
      // No debería ocurrir: el servidor escribe la marca. Si ocurriera, se dice,
      // porque significa que se guardó una foto que el acta no va a admitir.
      setError(
        "La foto se guardó pero llegó sin su fecha y su ubicación. Descártala y vuelve a tomarla.",
      );
      return;
    }

    onFotoSubida(vista);
    onCupo(resultado.datos.cupo);
    setNota("");
  }

  async function descartar(id: string) {
    setError(null);
    setDescartandoId(id);
    const resultado = await descartarFotoRegistro(id);
    setDescartandoId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    // Las miniaturas de las fotos recién tomadas son `blob:` creadas en esta
    // pestaña. Quitarlas del estado no libera la imagen: hay que revocarlas, o
    // el navegador se queda con cada foto descartada en memoria hasta recargar.
    const url = fotos.find((f) => f.id === id)?.url;
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    onFotoDescartada(id);
  }

  // El aviso de las imágenes sin marca va ANTES del estado vacío, y no dentro
  // del flujo normal: si la obra se quedó sin espacios registrados, esas
  // imágenes seguirían bloqueando la emisión del acta y no habría en toda la
  // pantalla un botón para quitarlas.
  const avisoSinMarca = (
    <FotosSinMarcaAviso
      fotos={fotosSinMarca}
      descartandoId={descartandoId}
      onDescartar={descartar}
    />
  );

  if (espacios.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {avisoSinMarca}
        <EstadoVacio
          icono={ImageOff}
          titulo="Esta obra todavía no tiene espacios registrados"
          descripcion="El registro fotográfico se organiza por espacio: cocina, baño, alcoba. Crea la estructura de la obra —torres, pisos, unidades y espacios— y vuelve aquí."
        />
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <CupoBarra estado={cupo} />

      {avisoSinMarca}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <SelectorEspacioRegistro
          espacios={espacios}
          espacioId={espacioId}
          disabled={subiendo}
          onCambiar={setEspacioId}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota-foto" className="text-xs font-semibold text-slate-600">
            Observación de la próxima foto (opcional)
          </label>
          <input
            id="nota-foto"
            type="text"
            value={nota}
            maxLength={NOTA_LARGO_MAX}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Fisura vertical sobre el marco de la puerta"
            disabled={subiendo}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <p className="text-xs text-slate-400">
            Queda impresa junto a la foto en el acta. Describe lo que se ve, no su causa.
          </p>
        </div>

        {espacio ? (
          <CamaraRegistroInicial
            etiquetaUbicacion={espacio.ubicacion}
            disabled={subiendo}
            onCapturada={guardarCaptura}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Escoge el espacio para abrir la cámara.
          </p>
        )}

        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>

      {grupos.length === 0 ? (
        <EstadoVacio
          icono={Camera}
          titulo="Todavía no hay fotos del estado inicial"
          descripcion="Recorre el inmueble espacio por espacio antes de empezar la obra. Cada foto queda con la fecha, la hora y las coordenadas impresas dentro de la imagen."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((grupo) => (
            <EspacioRegistroSection
              key={grupo.espacioId}
              espacio={grupo}
              numeros={numeros}
              descartandoId={descartandoId}
              onDescartar={descartar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
