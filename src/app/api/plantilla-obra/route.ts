import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal } from "@/lib/plan";
import { FASES_OBRA } from "@/lib/fases-obra";
import {
  estructuraValida,
  opcionesUbicacion,
  UBICACION_TODA_PROPIEDAD,
} from "@/lib/plantilla-obra";

// Filas con dropdown/formato en la hoja (500 filas de datos + margen).
const FILAS_VALIDACION = 521;

/**
 * POST /api/plantilla-obra — genera la plantilla Excel ÚNICA (tareas +
 * presupuesto) con los espacios REALES del usuario como dropdown bloqueado.
 * Solo cuentas personales (B2C). La estructura viene del estado ACTUAL del
 * wizard (no persistida):
 *
 * Body: {
 *   tipoPropiedad: "CASA" | "APARTAMENTO" | "LOCAL",   // EDIFICIO fuera de alcance
 *   pisos: [{ numero: number, espacios: string[] }]
 * }
 *
 * Respuesta: binario .xlsx (Content-Disposition: attachment).
 * Columnas: Fase (dropdown) · Tarea / Ítem · Ubicación (dropdown BLOQUEADO) ·
 * Ppto. mano de obra · Ppto. materiales · Ppto. total.
 * Los dropdowns usan una hoja oculta "Listas" + nombres definidos (evita el
 * límite de 255 caracteres de las listas inline de Excel).
 */
export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario?.constructora) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!esCuentaPersonal(usuario.constructora.tipo_cuenta)) {
      return NextResponse.json(
        { error: "La plantilla está disponible solo para cuentas personales." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const estructura = estructuraValida(body);
    if (!estructura) {
      return NextResponse.json(
        {
          error:
            "Estructura inválida. Se espera { tipoPropiedad: CASA|APARTAMENTO|LOCAL, pisos: [{ numero, espacios }] } con al menos un piso.",
        },
        { status: 400 },
      );
    }

    const ubicaciones = opcionesUbicacion(estructura);
    const fases: string[] = [...FASES_OBRA];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Seiricon";

    // ── Hoja principal ──────────────────────────────────────────────────────
    const ws = wb.addWorksheet("Tareas");
    ws.columns = [
      { header: "Fase", key: "fase", width: 26 },
      { header: "Tarea / Ítem", key: "tarea", width: 40 },
      { header: "Ubicación", key: "ubicacion", width: 30 },
      { header: "Ppto. mano de obra (COP)", key: "mano_obra", width: 24 },
      { header: "Ppto. materiales (COP)", key: "materiales", width: 24 },
      { header: "Ppto. total (COP)", key: "total", width: 20 },
    ];
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      cell.alignment = { horizontal: "center" };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // Fila de ejemplo (se ignora al importar por el prefijo [EJEMPLO]).
    const primerEspacio =
      ubicaciones.find((u) => u !== UBICACION_TODA_PROPIEDAD) ?? UBICACION_TODA_PROPIEDAD;
    const ejemplos = [
      {
        fase: "Pintura",
        tarea: "[EJEMPLO] Pintura general de paredes y techos",
        ubicacion: UBICACION_TODA_PROPIEDAD,
        mano_obra: 1500000,
        materiales: 900000,
        total: 2400000,
      },
      {
        fase: "Pisos/Enchapes",
        tarea: "[EJEMPLO] Porcelanato de piso (solo total)",
        ubicacion: primerEspacio,
        mano_obra: "",
        materiales: "",
        total: 1800000,
      },
    ];
    for (const ej of ejemplos) {
      const row = ws.addRow(ej);
      row.eachCell((cell) => {
        cell.font = { italic: true, color: { argb: "FF94A3B8" } };
      });
    }

    // Formato de moneda en las columnas de presupuesto.
    for (const col of ["D", "E", "F"]) {
      for (let r = 2; r <= FILAS_VALIDACION; r++) {
        ws.getCell(`${col}${r}`).numFmt = "#,##0";
      }
    }

    // ── Hoja oculta "Listas" (fuente de los dropdowns) ──────────────────────
    const listas = wb.addWorksheet("Listas");
    fases.forEach((f, i) => (listas.getCell(`A${i + 1}`).value = f));
    ubicaciones.forEach((u, i) => (listas.getCell(`B${i + 1}`).value = u));
    listas.state = "veryHidden";

    wb.definedNames.add(`Listas!$A$1:$A$${fases.length}`, "FasesObra");
    wb.definedNames.add(`Listas!$B$1:$B$${ubicaciones.length}`, "UbicacionesObra");

    // ── Dropdowns ───────────────────────────────────────────────────────────
    for (let r = 2; r <= FILAS_VALIDACION; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["FasesObra"],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Fase inválida",
        error: "Selecciona una fase de la lista.",
      };
      // Ubicación BLOQUEADA: solo valores del dropdown.
      ws.getCell(`C${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["UbicacionesObra"],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Ubicación inválida",
        error:
          "Selecciona una ubicación de la lista (se generó con tus espacios). " +
          "Si falta un espacio, agrégalo en el asistente y descarga la plantilla de nuevo.",
      };
    }

    // ── Hoja "Instrucciones" (corta) ────────────────────────────────────────
    const instr = wb.addWorksheet("Instrucciones");
    instr.getColumn(1).width = 90;
    const lineas = [
      "Plantilla de tareas y presupuesto — Seiricon",
      "",
      "Cómo llenarla:",
      "1. Una fila por tarea o ítem de tu presupuesto (ej.: 'Estuco y pintura', 'Enchape baño').",
      "2. 'Fase': selecciona del listado. Si tu presupuesto usa otros nombres, no pasa nada: al importar te ayudamos a mapearlos.",
      "3. 'Ubicación': SOLO del listado (se generó con tus espacios). 'Toda la propiedad' o 'Piso N (todo el piso)' sirven para tareas generales como pintar todo.",
      "4. Presupuesto: puedes llenar mano de obra + materiales (el total se calcula al importar), solo el total, o dejarlo vacío.",
      "5. Máximo 500 filas. Los montos van en pesos colombianos, sin puntos ni símbolos.",
      "",
      "La fila que empieza con [EJEMPLO] se ignora al importar (puedes borrarla).",
      "Si renombras espacios en el asistente después de descargar, vuelve a descargar la plantilla.",
    ];
    lineas.forEach((linea, i) => {
      const cell = instr.getCell(`A${i + 1}`);
      cell.value = linea;
      if (i === 0) cell.font = { bold: true, size: 14, color: { argb: "FF2563EB" } };
      else if (linea.startsWith("Cómo")) cell.font = { bold: true };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-obra.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/plantilla-obra", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
