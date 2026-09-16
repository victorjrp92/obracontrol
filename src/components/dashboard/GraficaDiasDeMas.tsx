"use client";

// ---------------------------------------------------------------------------
// Promedio de dias que las tareas se pasaron -o se adelantaron- respecto al
// plazo acordado, periodo a periodo.
//
// Va junto al porcentaje a tiempo porque miden cosas distintas: aquel dice
// CUANTAS incumplieron, este dice POR CUANTO. Diez tareas de dos dias, cinco
// que se pasan a 2,2 y cinco que se pasan a 6 dan el MISMO 50% a tiempo y son
// obras opuestas.
//
// Y por eso esta si es un area continua mientras la de arriba son columnas:
// aqui el valor SI tiene camino entre un periodo y el siguiente -el atraso se
// arrastra- y lo que se lee es el momento en que la obra cruza de un lado al
// otro del cero. Dibujar las dos igual era lo que las hacia parecer la misma.
//
// == EL EJE VA VOLTEADO A PROPOSITO =========================================
//
// El valor es "dias de mas", asi que lo bueno es el numero NEGATIVO. Con el
// eje natural -mas arriba, mas grande- terminar antes quedaba abajo y el area
// verde caia justo sobre los meses en que se atrasan: el color contradecia a
// la posicion. Arriba es antes, abajo es tarde.
//
// Cada punto lleva su valor escrito, del lado de afuera de la linea: encima
// cuando van adelantados, debajo cuando van tarde. Sin el numero la grafica
// dice que cambio el signo pero no por cuanto, y "por cuanto" es justo lo que
// esta metrica aporta sobre el porcentaje.
//
// == EL RESALTADO VIENE DE AFUERA ===========================================
//
// El periodo resaltado lo guarda `ReporteVelocidad`, el padre de las dos
// graficas, para que senalar un mes aqui lo senale tambien arriba. Se navega
// con eventos de `pointer` -no de `mouse`- para que el dedo funcione igual que
// el raton, y con flechas para que funcione sin ninguno de los dos.
//
// El SVG se mide en PIXELES (ver `useAnchoContenedor`): con un viewBox fijo se
// escalaba entero en pantallas anchas y la letra salia al doble.
// ---------------------------------------------------------------------------

import type { KeyboardEvent as EventoTeclado, PointerEvent as EventoPuntero } from "react";
import { useAnchoContenedor } from "@/hooks/useAnchoContenedor";
import type { PuntoVelocidad } from "@/lib/velocidad";

const H = 130;
const MX = 40;
const MY = 26;
const PIE = 20;

const nf = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}`;

export default function GraficaDiasDeMas({
  serie,
  resaltado,
  onResaltar,
}: {
  serie: PuntoVelocidad[];
  /** `orden` del periodo resaltado, o null. Ver el comentario de la cabecera. */
  resaltado: number | null;
  onResaltar: (orden: number | null) => void;
}) {
  const { ref, ancho: W } = useAnchoContenedor<HTMLDivElement>();

  if (serie.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin tareas cerradas todavia.</p>;
  }

  const n = serie.length;

  // Escala simetrica alrededor del cero: si cada lado tuviera la suya, medio
  // dia de atraso se veria igual de largo que medio dia de adelanto.
  const max = Math.max(...serie.map((p) => Math.abs(p.diasDeMas)), 0.05) * 1.25;
  const x = (i: number) => (n === 1 ? W / 2 : MX + (i * (W - MX * 2)) / (n - 1));
  const y = (v: number) => MY + ((v + max) / (max * 2)) * (H - MY * 2);

  const pts = serie.map((p, i) => [x(i), y(p.diasDeMas)] as const);
  const linea = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const cero = y(0);
  const cierre = `L${x(n - 1).toFixed(1)} ${cero.toFixed(1)} L${x(0).toFixed(1)} ${cero.toFixed(1)} Z`;

  // El periodo en que la obra pasa de ir adelantada a ir atrasada: es el dato
  // que esta grafica existe para ensenar.
  const cruce = serie.findIndex((p) => p.diasDeMas > 0);
  const hayCruce = cruce > 0 && serie[cruce - 1].diasDeMas <= 0;

  const pxPorPunto = (W - MX * 2) / Math.max(1, n - 1);
  const cada = pxPorPunto >= 48 ? 1 : pxPorPunto >= 24 ? 2 : 4;

  const iSel = resaltado === null ? -1 : serie.findIndex((p) => p.orden === resaltado);
  const sel = iSel >= 0 ? serie[iSel] : null;
  const ultimo = serie[n - 1];

  /** Aqui el dato es un punto, no un carril: manda el mas cercano al puntero. */
  const indiceEn = (clientX: number, caja: DOMRect) =>
    n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round((clientX - caja.left - MX) / pxPorPunto)));

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
      aria-label="Días de más o de menos frente al plazo, por período. Flechas para recorrer los períodos, Escape para soltar."
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
        aria-label={`Dias de mas o de menos respecto al plazo, por periodo. Ultimo periodo, ${ultimo.etiqueta}: ${nf(ultimo.diasDeMas)} dias`}
      >
        <defs>
          <clipPath id="cdmArriba">
            <rect x="0" y="0" width={W} height={cero} />
          </clipPath>
          <clipPath id="cdmAbajo">
            <rect x="0" y={cero} width={W} height={H + PIE} />
          </clipPath>
        </defs>

        <path d={`${linea} ${cierre}`} fill="#059669" opacity="0.16" clipPath="url(#cdmArriba)" />
        <path d={`${linea} ${cierre}`} fill="#DC2626" opacity="0.16" clipPath="url(#cdmAbajo)" />

        <line x1={MX} y1={cero} x2={W - MX} y2={cero} stroke="#CBD5E1" strokeWidth="1.5" />
        <text x={MX - 6} y={cero - 5} textAnchor="end" fontSize="9.5" fontWeight="800" fill="#059669">
          antes
        </text>
        <text x={MX - 6} y={cero + 13} textAnchor="end" fontSize="9.5" fontWeight="800" fill="#DC2626">
          tarde
        </text>

        {hayCruce && (
          <g>
            <line
              x1={(x(cruce - 1) + x(cruce)) / 2}
              y1={MY - 8}
              x2={(x(cruce - 1) + x(cruce)) / 2}
              y2={H - MY + 8}
              stroke="#DC2626"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={(x(cruce - 1) + x(cruce)) / 2}
              y={MY - 12}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="800"
              fill="#DC2626"
            >
              AQUÍ CAMBIÓ
            </text>
          </g>
        )}

        {/* Guia vertical del periodo resaltado: dibujada bajo la linea para que
            no le pase por encima al dato. */}
        {sel && (
          <line
            x1={x(iSel)}
            y1={MY - 6}
            x2={x(iSel)}
            y2={H - MY + 6}
            stroke="#0F172A"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.3"
          />
        )}

        <path d={linea} fill="none" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {serie.map((p, i) => {
          const tarde = p.diasDeMas > 0;
          const c = tarde ? "#DC2626" : "#059669";
          const esta = i === iSel;
          const muestraValor = i % cada === 0 || esta;
          return (
            <g
              key={p.orden}
              className="transition-opacity duration-150 motion-reduce:transition-none"
              style={{ opacity: iSel >= 0 && !esta ? 0.3 : 1 }}
            >
              <circle
                cx={pts[i][0]}
                cy={pts[i][1]}
                r={esta ? 5.5 : 3.5}
                fill={c}
                stroke="#fff"
                strokeWidth={esta ? 2 : 1.5}
              >
                <title>{`${p.etiqueta}: ${nf(p.diasDeMas)} días sobre ${p.cerradas} tareas`}</title>
              </circle>
              {muestraValor && (
                <text
                  x={pts[i][0]}
                  y={tarde ? pts[i][1] + (esta ? 18 : 15) : pts[i][1] - (esta ? 11 : 8)}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="800"
                  fill={c}
                >
                  {nf(p.diasDeMas)}
                </text>
              )}
              {(i % cada === 0 || esta) && (
                <text
                  x={pts[i][0]}
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
      </svg>

      {/* Lo que el resaltado dice en voz alta: sin esto, recorrer con flechas no
          cambia nada de lo que un lector de pantalla puede oir. */}
      <p className="sr-only" aria-live="polite">
        {sel ? `${sel.etiqueta}: ${nf(sel.diasDeMas)} días sobre ${sel.cerradas} tareas` : ""}
      </p>
    </div>
  );
}
