import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal } from "@/lib/plan";
import { normalizarFase, type FaseObra } from "@/lib/fases-obra";
import {
  estructuraValida,
  parseUbicacion,
  normalizarComparacion,
  type DestinoUbicacion,
  type EstructuraPlantilla,
} from "@/lib/plantilla-obra";

// ── Límites (spec) ───────────────────────────────────────────────────────────
const MAX_FILAS = 500;
const MAX_ARCHIVO_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TXT = 120;
const INT_CAP = 2_000_000_000;
// Tope DURO de filas a ESCANEAR (defensa contra DoS de CPU): una hoja hostil
// puede declarar ~1M filas. exceljs ya materializa la hoja al cargar, así que
// esto no cambia el pico de memoria del load (ver auditoría), pero evita
// recorrer 10^6 filas para quedarnos solo con 500. Margen holgado sobre
// MAX_FILAS para tolerar filas vacías / de ejemplo intercaladas.
const MAX_ESCANEO_FILAS = MAX_FILAS + 2000;
// Guarda anti zip-bomb: un .xlsx es un zip y exceljs lo descomprime ENTERO en
// memoria. Tope de contenido descomprimido declarado y de nº de entradas (un
// .xlsx real tiene ~10-30 entradas y unos pocos MB descomprimidos).
const MAX_DESCOMPRIMIDO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_ENTRADAS_ZIP = 200;

/**
 * Inspecciona el directorio central del zip SIN descomprimir y rechaza
 * archivos cuyo contenido declarado exceda los topes o cuyas entradas no
 * declaren tamaño (sospechosas). Nota de alcance: un zip con directorio
 * central mentiroso podría declarar menos de lo que infla realmente; esto
 * detiene las bombas típicas, y el despliegue serverless (memoria aislada
 * por invocación) acota el radio del caso restante a esa sola petición.
 */
async function zipSeguro(bytes: ArrayBuffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    let total = 0;
    let entradas = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      entradas++;
      if (entradas > MAX_ENTRADAS_ZIP) return false;
      // `_data.uncompressedSize` sale del directorio central (no descomprime).
      const u = (entry as unknown as { _data?: { uncompressedSize?: number } })
        ._data?.uncompressedSize;
      if (typeof u !== "number" || u < 0) return false;
      total += u;
      if (total > MAX_DESCOMPRIMIDO_BYTES) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Flags por fila (tolerantes: casi nada rechaza la fila, se devuelve para que
 * el usuario decida en el paso de revisión):
 *  - "sin_tarea"            → falta el nombre de la tarea (fila NO aplicable)
 *  - "texto_recortado"      → algún texto superaba el límite y se recortó
 *  - "fase_vacia"           → sin fase (el front puede sugerir con faseDeTarea)
 *  - "fase_no_reconocida"   → fase escrita que no mapea a la lista curada
 *  - "sin_ubicacion"        → sin ubicación (candidata a "Toda la propiedad")
 *  - "ubicacion_invalida"   → huérfana: el espacio/piso ya no existe (renombrado)
 *  - "ubicacion_no_verificada" → no se envió `estructura`; solo validación sintáctica
 *  - "texto_en_monto"       → "opcional"/texto en una columna numérica (monto ignorado)
 *  - "monto_cero"           → presupuesto en 0 (¿incluir?)
 *  - "monto_negativo"       → monto negativo (ignorado)
 *  - "monto_excede_tope"    → monto > INT_CAP (recortado al tope)
 *  - "total_recalculado"    → venía M.O.+materiales Y un total distinto → prevalece la suma
 *  - "solo_total"           → solo vino total: candidata a división M.O./materiales
 *                             (pctManoObraDeTarea; la decisión es del usuario en el front)
 *  - "duplicada"            → misma tarea + misma ubicación que una fila anterior
 */
interface FilaPreview {
  fila: number;
  fase: string;
  faseReconocida: boolean;
  faseNormalizada?: FaseObra;
  tarea: string;
  ubicacion: string;
  ubicacionValida: boolean;
  destino?: DestinoUbicacion;
  manoObra?: number;
  materiales?: number;
  total?: number;
  flags: string[];
}

interface ResumenPreview {
  totalFilas: number;
  validas: number;
  conPresupuesto: number;
  soloTotal: number;
  sinPresupuesto: number;
  fasesNoReconocidas: string[];
  ubicacionesInvalidas: number;
  duplicadas: number;
  conFlags: number;
  /** Filas de datos por encima del tope de 500 que NO se procesaron. */
  omitidas: number;
}

/** Texto plano de una celda exceljs (string, número, richText, hipervínculo, fórmula…). */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((rt) => rt.text ?? "").join("").trim();
    }
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String((v as { text: unknown }).text ?? "").trim();
    if ("error" in v) return "";
  }
  return String(v).trim();
}

/**
 * Monto COP tolerante. Acepta números, strings con $/puntos/comas de miles
 * ("$ 1.500.000"). Texto no numérico ("opcional", "por definir") → flag.
 * Los COP no usan centavos: se eliminan separadores y se parsea entero.
 */
function parseMonto(v: ExcelJS.CellValue): { valor?: number; flags: string[] } {
  const flags: string[] = [];
  if (v == null) return { flags };

  let n: number | null = null;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "object" && "result" in v) {
    return parseMonto(v.result as ExcelJS.CellValue); // fórmula → su resultado
  } else {
    const texto = cellText(v);
    if (texto === "") return { flags };
    // Tolera el apóstrofo colombiano de millones ($1'500.000 / $1’500.000)
    // además de $, espacios y "COP".
    const limpio = texto.replace(/[$\s'’]/g, "").replace(/COP/gi, "");
    if (/^-?[\d.,]+$/.test(limpio)) {
      n = Number(limpio.replace(/[.,]/g, ""));
    } else {
      // "opcional", "N/A", "por definir"… → se ignora el monto y se avisa.
      flags.push("texto_en_monto");
      return { flags };
    }
  }

  if (n == null || !Number.isFinite(n)) {
    flags.push("texto_en_monto");
    return { flags };
  }
  if (n < 0) {
    flags.push("monto_negativo");
    return { flags };
  }
  let valor = Math.round(n);
  if (valor > INT_CAP) {
    flags.push("monto_excede_tope");
    valor = INT_CAP;
  }
  if (valor === 0) flags.push("monto_cero");
  return { valor, flags };
}

/**
 * POST /api/plantilla-obra/parse — parsea la plantilla subida y devuelve un
 * PREVIEW en JSON para el paso de revisión del wizard. NO persiste nada: el
 * APPLY lo hace el wizard convirtiendo el preview confirmado en su estado y
 * llamando a `crearObraPersonal`/`editarObraPersonal`.
 *
 * Form-data:
 *  - archivo:    File .xlsx (obligatorio, ≤ 2MB)
 *  - estructura: string JSON opcional con la estructura ACTUAL del wizard
 *                ({ tipoPropiedad, pisos: [{ numero, espacios }] }). Si viene,
 *                se validan las ubicaciones contra ella (detección de
 *                huérfanas); si no, la validación es solo sintáctica.
 *
 * Respuesta 200: { ok: true, filas: FilaPreview[], resumen: ResumenPreview }
 * (ver los tipos arriba; los flags documentan cada tolerancia).
 */
export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario?.constructora) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!esCuentaPersonal(usuario.constructora.tipo_cuenta)) {
      return NextResponse.json(
        { error: "La importación está disponible solo para cuentas personales." },
        { status: 403 },
      );
    }

    // Rechazo temprano por tamaño: `req.formData()` bufferiza TODO el cuerpo
    // antes de que podamos mirar `archivo.size`. Si el Content-Length ya supera
    // el tope (archivo 2MB + margen para el campo `estructura` y overhead
    // multipart), cortamos aquí y no materializamos el cuerpo. (Un cuerpo sin
    // Content-Length —chunked— cae al control por `archivo.size` de abajo.)
    const MAX_BODY_BYTES = MAX_ARCHIVO_BYTES + 512 * 1024;
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "El archivo supera el máximo de 2 MB." }, { status: 413 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Se espera multipart/form-data." }, { status: 400 });
    }

    const archivo = form.get("archivo");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (.xlsx) en el campo 'archivo'." }, { status: 400 });
    }
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return NextResponse.json({ error: "El archivo supera el máximo de 2 MB." }, { status: 400 });
    }
    if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Solo se aceptan archivos .xlsx." }, { status: 400 });
    }

    let estructura: EstructuraPlantilla | null = null;
    const estructuraRaw = form.get("estructura");
    if (typeof estructuraRaw === "string" && estructuraRaw.trim() !== "") {
      try {
        estructura = estructuraValida(JSON.parse(estructuraRaw));
      } catch {
        estructura = null;
      }
      if (!estructura) {
        return NextResponse.json({ error: "El campo 'estructura' no es válido." }, { status: 400 });
      }
    }

    // ── Carga segura del workbook ───────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    try {
      const bytes = await archivo.arrayBuffer();
      if (!(await zipSeguro(bytes))) {
        return NextResponse.json(
          { error: "No pudimos leer el archivo. ¿Es la plantilla .xlsx de Seiricon?" },
          { status: 400 },
        );
      }
      await wb.xlsx.load(bytes);
    } catch {
      return NextResponse.json(
        { error: "No pudimos leer el archivo. ¿Es la plantilla .xlsx de Seiricon?" },
        { status: 400 },
      );
    }
    const ws = wb.getWorksheet("Tareas") ?? wb.worksheets[0];
    if (!ws) {
      return NextResponse.json({ error: "El archivo no tiene hojas con datos." }, { status: 400 });
    }

    // ── Parse tolerante fila a fila ─────────────────────────────────────────
    const filas: FilaPreview[] = [];
    const fasesNoReconocidas = new Set<string>();
    const clavesVistas = new Set<string>();
    let omitidas = 0;

    // Se acota el rango escaneado (ver MAX_ESCANEO_FILAS): las filas de datos
    // por encima del tope se reportan como `omitidas`, sin recorrerlas.
    const ultimaFila = Math.min(ws.rowCount, MAX_ESCANEO_FILAS);
    for (let r = 2; r <= ultimaFila; r++) {
      const row = ws.getRow(r);
      const faseRaw = cellText(row.getCell(1).value);
      const tareaRaw = cellText(row.getCell(2).value);
      const ubicacionRaw = cellText(row.getCell(3).value);
      const moCell = row.getCell(4).value;
      const matCell = row.getCell(5).value;
      const totCell = row.getCell(6).value;

      // Fila totalmente vacía → se ignora en silencio.
      const montosVacios =
        cellText(moCell) === "" && cellText(matCell) === "" && cellText(totCell) === "";
      if (!faseRaw && !tareaRaw && !ubicacionRaw && montosVacios) continue;

      // Fila de ejemplo de la plantilla → se ignora.
      if (tareaRaw.startsWith("[EJEMPLO]")) continue;

      if (filas.length >= MAX_FILAS) {
        omitidas++;
        continue;
      }

      const flags: string[] = [];

      // Textos acotados.
      let tarea = tareaRaw;
      if (tarea.length > MAX_TXT) {
        tarea = tarea.slice(0, MAX_TXT);
        flags.push("texto_recortado");
      }
      const fase = faseRaw.slice(0, MAX_TXT);
      const ubicacion = ubicacionRaw.slice(0, 160);

      if (!tarea) flags.push("sin_tarea");

      // Fase: normalización tolerante → lista curada; lo no reconocido vuelve
      // para mapeo manual (sugerencia automática la pone el front/IA).
      let faseNormalizada: FaseObra | undefined;
      let faseReconocida = false;
      if (!fase) {
        flags.push("fase_vacia");
      } else {
        const f = normalizarFase(fase);
        if (f) {
          faseNormalizada = f;
          faseReconocida = true;
        } else {
          flags.push("fase_no_reconocida");
          fasesNoReconocidas.add(fase);
        }
      }

      // Ubicación: dropdown bloqueado, pero toleramos ediciones externas.
      let ubicacionValida = false;
      let destino: DestinoUbicacion | undefined;
      if (!ubicacion) {
        flags.push("sin_ubicacion");
      } else {
        const u = parseUbicacion(ubicacion, estructura);
        destino = u.destino ?? undefined;
        ubicacionValida = u.valida;
        if (u.huerfana) flags.push("ubicacion_invalida");
        if (!estructura && u.valida) flags.push("ubicacion_no_verificada");
      }

      // Montos tolerantes ("opcional"/texto → flag; 0 → flag; negativos → fuera).
      const mo = parseMonto(moCell);
      const mat = parseMonto(matCell);
      const tot = parseMonto(totCell);
      flags.push(...mo.flags, ...mat.flags, ...tot.flags);

      const manoObra = mo.valor;
      const materiales = mat.valor;
      let total = tot.valor;

      // Regla del spec: M.O. + materiales → total = suma, y la suma PREVALECE
      // sobre un total distinto (se avisa). Solo-total → candidato a división
      // (pctManoObraDeTarea), decisión del usuario en el front.
      if (manoObra != null || materiales != null) {
        const suma = Math.min((manoObra ?? 0) + (materiales ?? 0), INT_CAP);
        if (total != null && total !== suma) flags.push("total_recalculado");
        total = suma;
      } else if (total != null && total > 0) {
        flags.push("solo_total");
      }

      // Duplicados: misma tarea + misma ubicación que una fila anterior.
      if (tarea) {
        const clave = `${normalizarComparacion(tarea)}|${normalizarComparacion(ubicacion)}`;
        if (clavesVistas.has(clave)) flags.push("duplicada");
        else clavesVistas.add(clave);
      }

      filas.push({
        fila: r,
        fase,
        faseReconocida,
        ...(faseNormalizada ? { faseNormalizada } : {}),
        tarea,
        ubicacion,
        ubicacionValida,
        ...(destino ? { destino } : {}),
        ...(manoObra != null ? { manoObra } : {}),
        ...(materiales != null ? { materiales } : {}),
        ...(total != null ? { total } : {}),
        flags,
      });
    }

    // Filas de datos más allá del rango escaneado: no se procesaron.
    if (ws.rowCount > ultimaFila) omitidas += ws.rowCount - ultimaFila;

    const resumen: ResumenPreview = {
      totalFilas: filas.length,
      validas: filas.filter((f) => f.tarea && f.ubicacionValida).length,
      conPresupuesto: filas.filter((f) => (f.total ?? 0) > 0).length,
      soloTotal: filas.filter((f) => f.flags.includes("solo_total")).length,
      sinPresupuesto: filas.filter((f) => f.total == null || f.total === 0).length,
      fasesNoReconocidas: [...fasesNoReconocidas],
      ubicacionesInvalidas: filas.filter((f) => !f.ubicacionValida).length,
      duplicadas: filas.filter((f) => f.flags.includes("duplicada")).length,
      conFlags: filas.filter((f) => f.flags.length > 0).length,
      omitidas,
    };

    return NextResponse.json({ ok: true, filas, resumen });
  } catch (error) {
    console.error("POST /api/plantilla-obra/parse", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
