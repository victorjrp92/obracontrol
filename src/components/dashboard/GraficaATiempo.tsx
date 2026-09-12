"use client";

// ---------------------------------------------------------------------------
// Porcentaje de tareas que cerraron dentro del plazo acordado, periodo a
// periodo, contra una meta.
//
// Es binaria por tarea -cumplio o no cumplio- asi que no hace falta ponderar
// nada: cada tarea se compara contra SU PROPIO plazo, y pintar una pared no
// compite con levantar una columna.
//
// La banda de meta no es un dato, es una raya que pone la constructora. Va
// dibujada porque sin ella un 74% no significa nada: el mismo numero es
// excelente o desastroso segun a que aspire la empresa.
// ---------------------------------------------------------------------------

import type { PuntoVelocidad } from "@/lib/velocidad";

const W = 720;
const H = 180;
const MX = 30;
const MY = 22;

function color(p: number): string {
  if (p >= 85) return "#059669";
  if (p >= 70) return "#2563EB";
  if (p >= 55) return "#B45309";
  return "#DC2626";
}

export default function GraficaATiempo({
  serie,
  meta = 80,
}: {
  serie: PuntoVelocidad[];
  /** Umbral que la constructora considera aceptable. */
  meta?: number;
}) {
  if (serie.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin tareas cerradas todavia.</p>;
  }

  // Con un solo punto no hay linea que trazar: se divide por (n-1) al
  // repartir el ancho, y con n = 1 eso es una division por cero.
  const x = (i: number) => (serie.length === 1 ? W / 2 : MX + (i * (W - MX * 2)) / (serie.length - 1));
  const y = (v: number) => MY + ((100 - v) / 100) * (H - MY * 2);

  const pts = serie.map((p, i) => [x(i), y(p.pctATiempo)] as const);
  const linea = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${linea} L${x(serie.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  // Con muchos periodos las etiquetas se encabalgan: se muestra una de cada N.
  const cada = serie.length > 24 ? 4 : serie.length > 14 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className="w-full h-auto overflow-visible"
      role="img"
      aria-label={`Porcentaje de tareas a tiempo por periodo. Ultimo: ${serie[serie.length - 1].pctATiempo}%`}
    >
      <defs>
        <linearGradient id="gATiempo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={MX} y={y(100)} width={W - MX * 2} height={y(meta) - y(100)} fill="#059669" opacity="0.08" />
      {[25, 50, 75].map((g) => (
        <line key={g} x1={MX} y1={y(g)} x2={W - MX} y2={y(g)} stroke="#E2E8F0" strokeWidth="1" />
      ))}
      <line
        x1={MX}
        y1={y(meta)}
        x2={W - MX}
        y2={y(meta)}
        stroke="#059669"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <text x={W - MX} y={y(meta) - 6} textAnchor="end" fontSize="10" fontWeight="800" fill="#059669">
        META {meta}%
      </text>

      <path d={area} fill="url(#gATiempo)" />
      <path d={linea} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {serie.map((p, i) => (
        <g key={p.orden}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r="4.5" fill={color(p.pctATiempo)} stroke="#fff" strokeWidth="2">
            <title>{`${p.etiqueta}: ${p.pctATiempo}% de ${p.cerradas} tareas`}</title>
          </circle>
          <text
            x={pts[i][0]}
            y={pts[i][1] - 12}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="800"
            fill={color(p.pctATiempo)}
          >
            {p.pctATiempo}%
          </text>
          {i % cada === 0 && (
            <text x={pts[i][0]} y={H + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8">
              {p.etiqueta}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
