"use client";

// ---------------------------------------------------------------------------
// Porcentaje de tareas que cerraron dentro del plazo acordado, periodo a
// periodo, contra una meta.
//
// Es binaria por tarea -cumplio o no cumplio- asi que no hace falta ponderar
// nada: cada tarea se compara contra SU PROPIO plazo, y pintar una pared no
// compite con levantar una columna.
//
// == POR QUE COLUMNAS Y NO UNA LINEA ========================================
//
// Antes esto era una linea, igual que la grafica de dias de mas que va debajo,
// y el dueno lo dijo sin rodeos: «para una persona normal las dos primeras
// graficas no parecen tan diferentes». Tenia razon, y el arreglo no es de
// color sino de TIPO DE DIBUJO. Una linea promete continuidad -que entre marzo
// y abril hubo un camino- y aqui no la hay: cada periodo es un conteo cerrado
// sobre un grupo distinto de tareas. Eso son columnas.
//
// Y ademas resuelve lo que la linea no podia: la pregunta de esta grafica no
// es "como venia la tendencia", es "cuales meses quedaron cortos". Con columnas
// coloreadas contra la meta y la meta punteada cruzando por encima, las cortas
// se ven de un golpe sin leer un solo numero.
//
// La banda de meta no es un dato, es una raya que pone la constructora. Va
// dibujada porque sin ella un 74% no significa nada: el mismo numero es
// excelente o desastroso segun a que aspire la empresa.
//
// == EL RESALTADO ES UNA SELECCION, NO UN HOVER =============================
//
// El periodo resaltado vive en `ReporteVelocidad` -el padre de las dos
// graficas- para que destacar un mes aqui lo destaque tambien abajo: es la
// unica forma de que se vea que las dos hablan del MISMO periodo. Por eso el
// componente no guarda ese estado, lo recibe.
//
// Pasar por encima resalta y al salir se suelta; pero si la grafica tiene el
// foco del teclado el puntero NO manda, porque sacar el raton borraria el mes
// que el usuario acaba de elegir con las flechas. Se navega con eventos de
// `pointer` -no de `mouse`- para que el dedo funcione igual que el raton.
//
// El SVG se mide en PIXELES: el ancho del viewBox es el ancho real del
// contenedor (ver `useAnchoContenedor`). Con un viewBox fijo la grafica se
// escalaba entera en pantallas anchas y la letra salia al doble de tamano.
// ---------------------------------------------------------------------------

import type { KeyboardEvent as EventoTeclado, PointerEvent as EventoPuntero } from "react";
import { useAnchoContenedor } from "@/hooks/useAnchoContenedor";
import type { PuntoVelocidad } from "@/lib/velocidad";

/** Alto del area dibujable, en pixeles. No crece con el ancho. */
const H = 150;
const MX = 34;
const MY = 20;
/** Sitio para las etiquetas del eje, debajo del area. */
const PIE = 20;

/** Tope de ancho de columna: mas gorda parece un bloque, no una medida. */
const COL_MAX = 44;
/** Fraccion de la banda que ocupa la columna; el resto es el aire entre ellas. */
const COL_RATIO = 0.66;
/** Suelo de ancho: con muchos periodos la columna se afila, pero no desaparece. */
const COL_MIN = 2;

/**
 * Alto minimo de columna, en pixeles. Un periodo con 0% dibujaria una columna
 * de alto cero y se leeria como "ese mes no existio", que es justo lo
 * contrario: existio y fue el peor. El numero escrito encima despeja la duda.
 */
const ALTO_MINIMO = 2;

/** Puntos por debajo de la meta que todavia cuentan como "quedo cerca". */
const CERCA = 10;

/**
 * Alto del fondo que marca el carril resaltado. Baja hasta pasada la etiqueta
 * del eje: si se cortara en la base de las columnas, el mes senalado quedaria
 * con el nombre fuera del resaltado, que es justo lo que hay que leer.
 */
const SEL_ARRIBA = MY - 14;
const SEL_ABAJO = H + 17;

/**
 * El color contesta UNA pregunta: llego a la meta o no.
 *
 * Antes la rampa era de umbrales fijos (85/70/55) que no sabian nada de la
 * meta: con meta 60 una constructora veia en ambar un mes que habia cumplido
 * de sobra. El unico umbral que significa algo es el que puso la empresa.
 * El ambar intermedio existe para que un 78 contra meta 80 no se pinte igual
 * de rojo que un 20: el alto de la columna ya dice por cuanto, el color dice
 * si hay que reaccionar.
 */
function color(pct: number, meta: number): string {
  if (pct >= meta) return "#059669";
  if (pct >= meta - CERCA) return "#B45309";
  return "#DC2626";
}

export default function GraficaATiempo({
  serie,
  meta = 80,
  resaltado,
  onResaltar,
}: {
  serie: PuntoVelocidad[];
  /** Umbral que la constructora considera aceptable. */
  meta?: number;
  /**
   * `orden` del periodo resaltado, o null. Se identifica por `orden` y no por
   * indice porque es la clave estable del periodo: las dos graficas comparten
   * el valor y tienen que referirse al mismo mes, no a la misma posicion.
   */
  resaltado: number | null;
  onResaltar: (orden: number | null) => void;
}) {
  const { ref, ancho: W } = useAnchoContenedor<HTMLDivElement>();

  if (serie.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin tareas cerradas todavia.</p>;
  }

  const n = serie.length;
  const util = Math.max(1, W - MX * 2);
  /** Ancho del carril de cada periodo: la columna va centrada dentro de el. */
  const banda = util / n;
  const anchoCol = Math.max(COL_MIN, Math.min(banda * COL_RATIO, COL_MAX));

  const cx = (i: number) => MX + (i + 0.5) * banda;
  const y = (v: number) => MY + ((100 - v) / 100) * (H - MY * 2);
  const base = y(0);

  // Con muchos periodos las etiquetas se encabalgan: se muestra una de cada N,
  // calculado sobre el ancho REAL disponible por periodo.
  const cada = banda >= 44 ? 1 : banda >= 22 ? 2 : 4;
  /** "100%" a 10,5 px mide unos 24 px: por debajo de eso el valor no cabe. */
  const cabeValor = banda >= 26;

  const iSel = resaltado === null ? -1 : serie.findIndex((p) => p.orden === resaltado);
  const sel = iSel >= 0 ? serie[iSel] : null;
  const ultimo = serie[n - 1];

  /** Que periodo hay bajo el puntero: division entera del carril, no el mas cercano. */
  const indiceEn = (clientX: number, caja: DOMRect) =>
    Math.min(n - 1, Math.max(0, Math.floor((clientX - caja.left - MX) / banda)));

  const alApuntar = (e: EventoPuntero<HTMLDivElement>) => {
    onResaltar(serie[indiceEn(e.clientX, e.currentTarget.getBoundingClientRect())].orden);
  };

  const alSalir = () => {
    // Con el foco puesto el teclado manda: soltar aqui borraria la seleccion
    // que el usuario acaba de hacer con las flechas.
    if (ref.current && document.activeElement === ref.current) return;
    onResaltar(null);
  };

  const alTeclear = (e: EventoTeclado<HTMLDivElement>) => {
    if (e.key === "Escape") {
      onResaltar(null);
      return;
    }
    let i = iSel;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") i = iSel < 0 ? 0 : Math.min(n - 1, iSel + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = iSel < 0 ? n - 1 : Math.max(0, iSel - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else return;
    // Sin esto las flechas ademas hacen scroll de la pagina.
    e.preventDefault();
    onResaltar(serie[i].orden);
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label="Tareas a tiempo por periodo. Flechas para recorrer los periodos, Escape para soltar."
      onKeyDown={alTeclear}
      onFocus={() => {
        if (iSel < 0) onResaltar(ultimo.orden);
      }}
      onPointerMove={alApuntar}
      onPointerDown={alApuntar}
      onPointerLeave={alSalir}
      onPointerCancel={alSalir}
      className="w-full rounded-lg touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
    >
      <svg
        width={W}
        height={H + PIE}
        viewBox={`0 0 ${W} ${H + PIE}`}
        className="block overflow-visible"
        role="img"
        aria-label={`Columnas de porcentaje de tareas a tiempo por periodo, contra una meta de ${meta}%. Ultimo periodo, ${ultimo.etiqueta}: ${ultimo.pctATiempo}%`}
      >
        <rect x={MX} y={y(100)} width={util} height={y(meta) - y(100)} fill="#059669" opacity="0.07" />
        {[25, 50, 75].map((g) => (
          <line key={g} x1={MX} y1={y(g)} x2={W - MX} y2={y(g)} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        <line x1={MX} y1={base} x2={W - MX} y2={base} stroke="#CBD5E1" strokeWidth="1" />

        {serie.map((p, i) => {
          const esta = i === iSel;
          const alto = Math.max(base - y(p.pctATiempo), ALTO_MINIMO);
          const c = color(p.pctATiempo, meta);
          const muestraValor = cabeValor || i % cada === 0 || esta;
          const muestraEtiqueta = i % cada === 0 || esta;
          return (
            <g
              key={p.orden}
              className="transition-opacity duration-150 motion-reduce:transition-none"
              style={{ opacity: iSel >= 0 && !esta ? 0.28 : 1 }}
            >
              {esta && (
                <rect
                  x={cx(i) - banda / 2}
                  y={SEL_ARRIBA}
                  width={banda}
                  height={SEL_ABAJO - SEL_ARRIBA}
                  rx="4"
                  fill="#0F172A"
                  opacity="0.05"
                />
              )}
              <rect
                x={cx(i) - anchoCol / 2}
                y={base - alto}
                width={anchoCol}
                height={alto}
                rx={Math.min(3, anchoCol / 2)}
                fill={c}
                stroke={esta ? "#0F172A" : "none"}
                strokeWidth={esta ? 1.5 : 0}
              >
                <title>{`${p.etiqueta}: ${p.pctATiempo}% de ${p.cerradas} tareas`}</title>
              </rect>
              {muestraValor && (
                <text
                  x={cx(i)}
                  y={base - alto - 6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="800"
                  fill={c}
                >
                  {p.pctATiempo}%
                </text>
              )}
              {muestraEtiqueta && (
                <text
                  x={cx(i)}
                  y={H + 13}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={esta ? "800" : "700"}
                  fill={esta ? "#0F172A" : "#94A3B8"}
                >
                  {p.etiqueta}
                </text>
              )}
            </g>
          );
        })}

        {/* La meta va DESPUES de las columnas: es la raya contra la que se
            miden, y por debajo quedaria tapada justo donde importa leerla. */}
        <line
          x1={MX}
          y1={y(meta)}
          x2={W - MX}
          y2={y(meta)}
          stroke="#059669"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        {/* Halo blanco: el rotulo cae encima de las columnas mas altas y sin el
            se vuelve ilegible justo sobre las que cumplieron. */}
        <text
          x={W - MX}
          y={y(meta) - 5}
          textAnchor="end"
          fontSize="10"
          fontWeight="800"
          fill="#059669"
          stroke="#fff"
          strokeWidth="3"
          paintOrder="stroke"
        >
          META {meta}%
        </text>
      </svg>

      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[10px] font-bold text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#059669" }} /> llego a la meta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#B45309" }} /> quedo cerca
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#DC2626" }} /> quedo corta
        </span>
      </div>

      {/* Lo que el resaltado dice en voz alta: sin esto, recorrer con flechas no
          cambia nada de lo que un lector de pantalla puede oir. */}
      <p className="sr-only" aria-live="polite">
        {sel ? `${sel.etiqueta}: ${sel.pctATiempo}% de ${sel.cerradas} tareas a tiempo, meta ${meta}%` : ""}
      </p>
    </div>
  );
}
