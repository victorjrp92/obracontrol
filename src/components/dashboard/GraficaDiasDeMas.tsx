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
// El SVG se mide en PIXELES (ver `useAnchoContenedor`): con un viewBox fijo se
// escalaba entero en pantallas anchas y la letra salia al doble.
// ---------------------------------------------------------------------------

import { useAnchoContenedor } from "@/hooks/useAnchoContenedor";
import type { PuntoVelocidad } from "@/lib/velocidad";

const H = 130;
const MX = 40;
const MY = 26;
const PIE = 20;

const nf = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}`;

export default function GraficaDiasDeMas({ serie }: { serie: PuntoVelocidad[] }) {
  const { ref, ancho: W } = useAnchoContenedor<HTMLDivElement>();

  if (serie.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin tareas cerradas todavia.</p>;
  }

  // Escala simetrica alrededor del cero: si cada lado tuviera la suya, medio
  // dia de atraso se veria igual de largo que medio dia de adelanto.
  const max = Math.max(...serie.map((p) => Math.abs(p.diasDeMas)), 0.05) * 1.25;
  const x = (i: number) => (serie.length === 1 ? W / 2 : MX + (i * (W - MX * 2)) / (serie.length - 1));
  const y = (v: number) => MY + ((v + max) / (max * 2)) * (H - MY * 2);

  const pts = serie.map((p, i) => [x(i), y(p.diasDeMas)] as const);
  const linea = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const cero = y(0);
  const cierre = `L${x(serie.length - 1).toFixed(1)} ${cero.toFixed(1)} L${x(0).toFixed(1)} ${cero.toFixed(1)} Z`;

  // El periodo en que la obra pasa de ir adelantada a ir atrasada: es el dato
  // que esta grafica existe para ensenar.
  const cruce = serie.findIndex((p) => p.diasDeMas > 0);
  const hayCruce = cruce > 0 && serie[cruce - 1].diasDeMas <= 0;

  const pxPorPunto = (W - MX * 2) / Math.max(1, serie.length - 1);
  const cada = pxPorPunto >= 48 ? 1 : pxPorPunto >= 24 ? 2 : 4;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={W}
        height={H + PIE}
        viewBox={`0 0 ${W} ${H + PIE}`}
        className="block overflow-visible"
        role="img"
        aria-label={`Dias de mas o de menos respecto al plazo, por periodo. Ultimo: ${nf(serie[serie.length - 1].diasDeMas)} dias`}
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
              AQUI CAMBIO
            </text>
          </g>
        )}

        <path d={linea} fill="none" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {serie.map((p, i) => {
          const tarde = p.diasDeMas > 0;
          const c = tarde ? "#DC2626" : "#059669";
          return (
            <g key={p.orden}>
              <circle cx={pts[i][0]} cy={pts[i][1]} r="3.5" fill={c} stroke="#fff" strokeWidth="1.5">
                <title>{`${p.etiqueta}: ${nf(p.diasDeMas)} dias sobre ${p.cerradas} tareas`}</title>
              </circle>
              {i % cada === 0 && (
                <>
                  <text
                    x={pts[i][0]}
                    y={tarde ? pts[i][1] + 15 : pts[i][1] - 8}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="800"
                    fill={c}
                  >
                    {nf(p.diasDeMas)}
                  </text>
                  <text x={pts[i][0]} y={H + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8">
                    {p.etiqueta}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
