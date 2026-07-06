// ─────────────────────────────────────────────────────────────────────────
// Motor de estimación de DURACIÓN (B2C). DETERMINISTA Y PURO: mismas entradas
// → mismas salidas. No toca DB ni IA (la clasificación IA de tareas no
// reconocidas vive en otra capa; aquí solo matchers deterministas).
//
// Modelo:
//  - días por tarea = cantidad ÷ rendimiento (rendimientos.ts, por cuadrilla
//    de 1 oficial + 1 ayudante), con mínimo 0.5 día. La cantidad REUSA la
//    lógica del estimador de costos (cantidadPorUnidad de
//    estimar-presupuesto.ts): misma área de pared/piso, mismos defaults.
//  - Pintura/sellador son POR MANO: base 1 mano, final 2 manos, sellador 1.
//  - Secuencia por FASES en orden constructivo (fases-obra.ts). Tareas de la
//    misma fase en espacios distintos se paralelizan según `cuadrillas`
//    (parámetro simple, no simulación): días de fase = max(tarea más larga,
//    trabajo total ÷ cuadrillas).
//  - Factor de CUADRILLA ÚNICA ×1.4 (1.3–1.5) cuando cuadrillas = 1 (default).
//  - Imprevistos +20% (parámetro) sobre probable y máximo; el mínimo queda
//    como borde optimista sin imprevistos.
//  - Buffers de secado como ESPERAS entre fases (no lentitud): pañete→estuco
//    2–3 días de fragüe, estuco→pintura ~1 día por mano, placa→carga 7–14.
//  - Fases PARALELAS (ramas de la línea de tiempo): eléctricas ∥
//    hidrosanitarias y carpintería ∥ cocina/closets — oficios distintos que en
//    la práctica son personas/talleres distintos, así que se solapan aun con
//    cuadrillas = 1 (el total toma el máximo de la pareja).
//
// CALIBRACIÓN DE CORDURA (verificada contra duraciones típicas Colombia):
//  - Baño integral (≈5 m²):        7–15 días
//  - Cocina media (≈9 m²):        10–20 días
//  - Apto completo (≈60 m²):      60–70 días
//  - Casa completa (≈120 m²):    100–120 días
// Si el motor devuelve algo absurdo frente a esta tabla, revisar factores.
// ─────────────────────────────────────────────────────────────────────────

import {
  cantidadPorUnidad,
  distribuirAreaTotal,
  type EspacioEstim,
} from "./estimar-presupuesto";
import {
  buscarRendimiento,
  BUFFER_FRAGUE_PANETE,
  BUFFER_FRAGUE_PLACA,
  BUFFER_SECADO_POR_MANO,
  FACTOR_CUADRILLA_UNICA,
  IMPREVISTOS_PCT_DEFAULT,
  RENDIMIENTOS,
} from "./rendimientos";
import { FASES_OBRA, faseDeTarea, normalizarFase, type FaseObra } from "./fases-obra";

// Contrato público del motor: se re-exporta lo que el front necesita.
export { faseDeTarea, FASES_OBRA, type FaseObra } from "./fases-obra";
export type { EspacioEstim, TareaEstim } from "./estimar-presupuesto";

/** Fase de agrupación: las curadas + "Otros" para lo no clasificable. */
export type FaseDuracionNombre = FaseObra | "Otros";
export const FASE_OTROS = "Otros" as const;

export interface OpcionesDuracion {
  /** Cuadrillas trabajando en paralelo dentro de una fase. Default 1. */
  cuadrillas?: number;
  /** Imprevistos sobre probable y máximo. Default 0.20 (+20%). */
  imprevistosPct?: number;
  /** Incluir buffers de secado/fragüe como esperas. Default true. */
  incluirEsperas?: boolean;
  /** m² de toda la obra (se reparte igual que en estimar-presupuesto). */
  areaTotal?: number;
}

export interface TareaDuracion {
  nombre: string;
  espacio: string;
  fase: FaseDuracionNombre;
  /** Días de trabajo probables de la tarea (sin factores globales). */
  dias: number;
  /** Clave de rendimiento usada; null si se cayó a los días acordados. */
  key: string | null;
  /** true si hubo rendimiento investigado; false = fallback (días del usuario). */
  conDato: boolean;
}

export interface FaseDuracion {
  fase: FaseDuracionNombre;
  /** Días hábiles PROBABLES de trabajo de la fase (con factores aplicados). */
  dias: number;
  diasMin: number;
  diasMax: number;
  /** Espera de secado/fragüe (días calendario, probable) ANTES/DENTRO de la fase. */
  esperaDias: number;
  tareas: TareaDuracion[];
  /** Fases presentes que corren en paralelo con esta (ramas de la línea de tiempo). */
  enParaleloCon: FaseDuracionNombre[];
}

export interface ResultadoDuracion {
  /** Duración total estimada de la obra en días (incluye esperas de secado). */
  totalDias: { probable: number; min: number; max: number };
  /** Fases en orden constructivo, con lo que el front necesita para el
   *  contra-pronóstico y la línea de tiempo con ramas. */
  fases: FaseDuracion[];
  /** Fracción 0–1 de tareas con rendimiento investigado. */
  cobertura: number;
  /** # de tareas estimadas con fallback (días acordados del usuario). */
  sinDato: number;
}

// Parejas de fases que corren en PARALELO cuando ambas existen: oficios
// distintos (electricista/plomero; taller de carpintería/cocinas) que no
// compiten por la cuadrilla general.
const PARES_PARALELOS: [FaseObra, FaseObra][] = [
  ["Instalaciones eléctricas", "Instalaciones hidrosanitarias"],
  ["Carpintería/Madera", "Cocina/Closets"],
];

interface Escenario {
  min: number;
  probable: number;
  max: number;
}

/** Redondeo a medios días, con piso en 0.5. */
function aMediosDias(d: number): number {
  return Math.max(0.5, Math.round(d * 2) / 2);
}

/**
 * Estima la duración de la obra a partir de los espacios y sus tareas activas
 * (misma entrada `EspacioEstim` que el estimador de costos).
 */
export function estimarDuracion(
  espaciosEntrada: EspacioEstim[],
  opts: OpcionesDuracion = {},
): ResultadoDuracion {
  const cuadrillas = Math.max(1, Math.round(opts.cuadrillas ?? 1));
  const imprevistos = Number.isFinite(opts.imprevistosPct)
    ? Math.min(1, Math.max(0, opts.imprevistosPct!))
    : IMPREVISTOS_PCT_DEFAULT;
  const conEsperas = opts.incluirEsperas !== false;

  const espacios =
    opts.areaTotal && opts.areaTotal > 0
      ? distribuirAreaTotal(espaciosEntrada, opts.areaTotal)
      : espaciosEntrada;

  // ── 1. Días por tarea (cantidad ÷ rendimiento; mínimo 0.5) ────────────────
  interface TareaCalc extends TareaDuracion {
    esc: Escenario; // min = cuadrilla rápida, max = cuadrilla lenta
  }
  const tareas: TareaCalc[] = [];
  const keysPresentes = new Set<string>();

  for (const esp of espacios) {
    for (const t of esp.tareas) {
      if (!t.on) continue;
      const fase: FaseDuracionNombre =
        (t.fase ? normalizarFase(t.fase) : null) ?? faseDeTarea(t.nombre) ?? FASE_OTROS;

      const r = buscarRendimiento(t.nombre);
      if (r) {
        keysPresentes.add(r.key);
        const cantidad = cantidadPorUnidad(r.key, r.unidad, esp);
        const manos = r.porMano ? r.manosDefault ?? 1 : 1;
        const trabajo = cantidad * manos;
        const esc: Escenario = {
          min: Math.max(0.5, trabajo / r.max),
          probable: Math.max(0.5, trabajo / r.porDia),
          max: Math.max(0.5, trabajo / r.min),
        };
        tareas.push({
          nombre: t.nombre,
          espacio: esp.nombre,
          fase,
          dias: aMediosDias(esc.probable),
          key: r.key,
          conDato: true,
          esc,
        });
      } else {
        // Fallback: sin rendimiento investigado → días acordados del usuario
        // (o 1 día), con rango ±(30/50)% marcado como menos confiable.
        const dias = Math.max(0.5, t.dias || 1);
        tareas.push({
          nombre: t.nombre,
          espacio: esp.nombre,
          fase,
          dias: aMediosDias(dias),
          key: null,
          conDato: false,
          esc: { min: Math.max(0.5, dias * 0.7), probable: dias, max: dias * 1.5 },
        });
      }
    }
  }

  if (tareas.length === 0) {
    return {
      totalDias: { probable: 0, min: 0, max: 0 },
      fases: [],
      cobertura: 0,
      sinDato: 0,
    };
  }

  // ── 2. Agrupar por fase en orden constructivo ("Otros" antes del cierre) ──
  const ordenFases: FaseDuracionNombre[] = [
    ...FASES_OBRA.slice(0, -1),
    FASE_OTROS,
    FASES_OBRA[FASES_OBRA.length - 1], // "Detalles y aseo" cierra la obra
  ];
  const porFase = new Map<FaseDuracionNombre, TareaCalc[]>();
  for (const t of tareas) {
    const lista = porFase.get(t.fase) ?? [];
    lista.push(t);
    porFase.set(t.fase, lista);
  }
  const fasesPresentes = ordenFases.filter((f) => porFase.has(f));

  // ── 3. Días por fase: paralelización por cuadrillas + factores ────────────
  const factorCuadrilla: Escenario =
    cuadrillas === 1 ? FACTOR_CUADRILLA_UNICA : { min: 1, probable: 1, max: 1 };

  const calcularFase = (lista: TareaCalc[]): Escenario => {
    const calc = (s: keyof Escenario): number => {
      const suma = lista.reduce((acc, t) => acc + t.esc[s], 0);
      const mayor = Math.max(...lista.map((t) => t.esc[s]));
      // Con C cuadrillas el trabajo de la fase se reparte, pero nunca por
      // debajo de la tarea más larga (una tarea no se parte entre cuadrillas).
      let dias = Math.max(mayor, suma / cuadrillas);
      dias *= factorCuadrilla[s];
      if (s !== "min") dias *= 1 + imprevistos; // el mínimo es el borde optimista
      return aMediosDias(dias);
    };
    return { min: calc("min"), probable: calc("probable"), max: calc("max") };
  };

  // ── 4. Esperas de secado/fragüe (buffers ENTRE fases, no lentitud) ────────
  // Se anotan en la fase que debe ESPERAR. Una sola espera por transición:
  // el secado corre en paralelo en todos los espacios.
  const esperas = new Map<FaseDuracionNombre, Escenario>();
  if (conEsperas) {
    const sumarEspera = (fase: FaseDuracionNombre, e: Escenario) => {
      const previa = esperas.get(fase) ?? { min: 0, probable: 0, max: 0 };
      esperas.set(fase, {
        min: previa.min + e.min,
        probable: previa.probable + e.probable,
        max: previa.max + e.max,
      });
    };

    // Placa → siguiente fase presente: fragüe de 7–14 días antes de cargarla.
    if (keysPresentes.has("placa")) {
      const idxGris = fasesPresentes.indexOf("Obra gris/Estructura");
      const siguiente = idxGris >= 0 ? fasesPresentes[idxGris + 1] : undefined;
      if (siguiente) sumarEspera(siguiente, BUFFER_FRAGUE_PLACA);
    }

    // Pañete → estuco: fragüe de 2–3 días DENTRO de Repello/Estuco.
    const hayPanete = keysPresentes.has("panete");
    const hayEstuco = keysPresentes.has("estuco_pared") || keysPresentes.has("estuco_techo");
    if (hayPanete && hayEstuco && porFase.has("Repello/Estuco")) {
      sumarEspera("Repello/Estuco", BUFFER_FRAGUE_PANETE);
    }

    // Estuco/repello → pintura: ~1 día de secado POR MANO (antes de la primera
    // y entre manos). Manos según las claves de pintura presentes; si la fase
    // Pintura existe sin clave reconocida, asumimos 2 manos.
    if (porFase.has("Pintura") && (hayPanete || hayEstuco)) {
      let manos = 0;
      for (const key of ["pintura_base", "pintura_final", "sellador"]) {
        if (keysPresentes.has(key)) manos += RENDIMIENTOS[key].manosDefault ?? 1;
      }
      if (manos === 0) manos = 2;
      sumarEspera("Pintura", {
        min: manos * BUFFER_SECADO_POR_MANO.min,
        probable: manos * BUFFER_SECADO_POR_MANO.probable,
        max: manos * BUFFER_SECADO_POR_MANO.max,
      });
    }
  }

  // ── 5. Paralelización entre fases (ramas) + total ─────────────────────────
  const paraleloDe = new Map<FaseDuracionNombre, FaseDuracionNombre>();
  for (const [a, b] of PARES_PARALELOS) {
    if (porFase.has(a) && porFase.has(b)) {
      paraleloDe.set(a, b);
      paraleloDe.set(b, a);
    }
  }

  const fasesOut: FaseDuracion[] = [];
  const total: Escenario = { min: 0, probable: 0, max: 0 };
  const contadas = new Set<FaseDuracionNombre>();

  const escPorFase = new Map<FaseDuracionNombre, Escenario>();
  for (const f of fasesPresentes) escPorFase.set(f, calcularFase(porFase.get(f)!));

  for (const f of fasesPresentes) {
    const esc = escPorFase.get(f)!;
    const espera = esperas.get(f) ?? { min: 0, probable: 0, max: 0 };
    const par = paraleloDe.get(f);

    fasesOut.push({
      fase: f,
      dias: esc.probable,
      diasMin: esc.min,
      diasMax: esc.max,
      esperaDias: espera.probable,
      tareas: porFase.get(f)!.map(({ nombre, espacio, fase, dias, key, conDato }) => ({
        nombre,
        espacio,
        fase,
        dias,
        key,
        conDato,
      })),
      enParaleloCon: par ? [par] : [],
    });

    // Total: una pareja paralela aporta el MÁXIMO de las dos (se solapan);
    // las esperas de ambas sí se respetan (se toma la mayor).
    if (contadas.has(f)) continue;
    if (par && !contadas.has(par)) {
      const escPar = escPorFase.get(par)!;
      const esperaPar = esperas.get(par) ?? { min: 0, probable: 0, max: 0 };
      total.min += Math.max(esc.min, escPar.min) + Math.max(espera.min, esperaPar.min);
      total.probable +=
        Math.max(esc.probable, escPar.probable) +
        Math.max(espera.probable, esperaPar.probable);
      total.max += Math.max(esc.max, escPar.max) + Math.max(espera.max, esperaPar.max);
      contadas.add(f);
      contadas.add(par);
    } else {
      total.min += esc.min + espera.min;
      total.probable += esc.probable + espera.probable;
      total.max += esc.max + espera.max;
      contadas.add(f);
    }
  }

  const conDato = tareas.filter((t) => t.conDato).length;

  return {
    totalDias: {
      probable: Math.max(1, Math.round(total.probable)),
      min: Math.max(1, Math.round(total.min)),
      max: Math.max(1, Math.round(total.max)),
    },
    fases: fasesOut,
    cobertura: conDato / tareas.length,
    sinDato: tareas.length - conDato,
  };
}
