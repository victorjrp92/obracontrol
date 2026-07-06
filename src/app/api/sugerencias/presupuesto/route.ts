import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { estimarPreciosIA, type TareaPrecioInput } from "@/lib/deepseek";
import {
  buscarPrecioSemilla,
  factorRegional,
  pctManoObraDeTarea,
} from "@/lib/precios-semilla";
import {
  repartoSinPresupuesto,
  repartoGeneral,
  repartoSeparado,
  type TareaReparto,
  type ResultadoReparto,
} from "@/lib/estimar-presupuesto";

const MAX_TAREAS = 200;
const MAX_TXT = 120;
const INT_CAP = 2_000_000_000;

type Modo = "ninguno" | "general" | "separado";

/** Lee un entero COP no negativo de un valor desconocido; 0 si no es válido. */
function copNoNeg(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, INT_CAP) : 0;
}

/**
 * Estimado DETERMINISTA del costo total de una tarea (peso de reparto), basado
 * en la base semilla. Sirve de fallback cuando la IA no está, y de "peso real"
 * cuando sí está (para distinguir, p. ej., cocina de baño aunque el monto final
 * lo fije el presupuesto del usuario). Usa el factor regional unificado.
 */
function estimadoDeterminista(t: TareaPrecioInput, factor: number): number {
  const p = buscarPrecioSemilla(t.tarea);
  if (p) {
    // Cantidad aproximada: m² si vino (tareas por área), si no 1 (unidad/ml).
    const q = p.unidad === "m2" && t.metraje && t.metraje > 0 ? t.metraje : 1;
    return Math.round(p.medianoCOP * q * factor);
  }
  // Sin dato semilla: ~$80k/día de mano de obra (mismo criterio que el estimador).
  return Math.round((t.dias || 1) * 80000 * factor);
}

/**
 * POST /api/sugerencias/presupuesto — motor de costos con desglose mano de obra
 * / materiales y 3 modos de reparto. Solo B2C / autenticado.
 *
 * Body: {
 *   tareas: [{ i, espacio, tarea, dias, metraje? }],
 *   tipoObra?, tipoPropiedad?, ciudad?,
 *   modo?: "ninguno" | "general" | "separado",
 *   total?: number,                         // modo "general"
 *   manoObra?: number, materiales?: number, // modo "separado"
 * }
 *
 * Respuesta: {
 *   modo, fuente: "ia"|"sin_key"|"error",
 *   tareas: [{ i, costo, manoObra, materiales }],
 *   totales: { costo, manoObra, materiales },
 *   precios: { <i>: <COP total> } | null,   // compat. con el cliente actual
 * }
 *
 * El "peso inteligente" del reparto sale del estimado IA (o determinista si la
 * IA no está); por eso el reparto NO es parejo. Siempre hay fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.tareas)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const tareas: TareaPrecioInput[] = body.tareas
      .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === "object")
      .slice(0, MAX_TAREAS)
      .map((t: Record<string, unknown>) => ({
        i: Number(t.i),
        espacio: typeof t.espacio === "string" ? t.espacio.slice(0, MAX_TXT) : "",
        tarea: typeof t.tarea === "string" ? t.tarea.slice(0, MAX_TXT) : "",
        dias: Math.max(1, Math.round(Number(t.dias) || 1)),
        metraje: typeof t.metraje === "number" && t.metraje > 0 ? t.metraje : undefined,
      }))
      .filter((t: TareaPrecioInput) => Number.isInteger(t.i) && t.tarea);

    if (tareas.length === 0) {
      return NextResponse.json({
        modo: "ninguno",
        fuente: "error",
        tareas: [],
        totales: { costo: 0, manoObra: 0, materiales: 0 },
        precios: null,
      });
    }

    const tipoObra = typeof body.tipoObra === "string" ? body.tipoObra : "REFORMA";
    const tipoPropiedad = typeof body.tipoPropiedad === "string" ? body.tipoPropiedad : "CASA";
    const ciudad = typeof body.ciudad === "string" ? body.ciudad.slice(0, 80) : null;
    const modo: Modo =
      body.modo === "general" || body.modo === "separado" ? body.modo : "ninguno";
    const factor = factorRegional(ciudad);

    // 1. Estimado por tarea: peso "inteligente". Intenta IA; cae a determinista.
    const r = await estimarPreciosIA({ tareas, tipoObra, tipoPropiedad, ciudad });
    let fuente: "ia" | "sin_key" | "error" = "error";
    const estimadoPorIndice = new Map<number, number>();
    if (r.ok) {
      fuente = "ia";
      for (const [k, v] of Object.entries(r.data)) estimadoPorIndice.set(Number(k), v);
    } else {
      fuente = r.motivo; // "sin_key" | "error"
    }

    // 2. TareaReparto: estimado (IA o determinista) + % mano de obra (semilla).
    const repartoInput: TareaReparto[] = tareas.map((t) => ({
      i: t.i,
      estimado: estimadoPorIndice.get(t.i) ?? estimadoDeterminista(t, factor),
      pctManoObra: pctManoObraDeTarea(t.tarea),
    }));

    // 3. Aplica el modo de reparto (funciones puras del estimador).
    let resultado: ResultadoReparto;
    if (modo === "general") {
      resultado = repartoGeneral(copNoNeg(body.total), repartoInput);
    } else if (modo === "separado") {
      resultado = repartoSeparado(copNoNeg(body.manoObra), copNoNeg(body.materiales), repartoInput);
    } else {
      resultado = repartoSinPresupuesto(repartoInput);
    }

    // 4. `precios` compacto por índice (compat. con el cliente actual).
    const precios: Record<number, number> = {};
    for (const p of resultado.porTarea) precios[p.i] = p.costo;

    return NextResponse.json({
      modo,
      fuente,
      tareas: resultado.porTarea, // [{ i, costo, manoObra, materiales }]
      totales: {
        costo: resultado.totalCosto,
        manoObra: resultado.totalManoObra,
        materiales: resultado.totalMateriales,
      },
      precios,
    });
  } catch {
    return NextResponse.json({
      modo: "ninguno",
      fuente: "error",
      tareas: [],
      totales: { costo: 0, manoObra: 0, materiales: 0 },
      precios: null,
    });
  }
}
