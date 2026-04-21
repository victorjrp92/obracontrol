import type { TareaInput } from "./wizard-types";

/**
 * Generate an .xlsx template for a specific phase.
 * ExcelJS is dynamically imported to avoid bundle bloat.
 */
export async function generatePhaseTemplate(
  fase: string,
  espacios: string[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Seiricon";

  // --- Sheet 1: Tareas ---
  const ws = wb.addWorksheet("Tareas");

  ws.columns = [
    { header: "Espacio", key: "espacio", width: 22 },
    { header: "Nombre de la tarea", key: "nombre", width: 35 },
    { header: "Dias acordados", key: "dias", width: 15 },
    { header: "Codigo referencia (opcional)", key: "codigo", width: 25 },
    { header: "Marca/Linea (opcional)", key: "marca", width: 20 },
    { header: "Componentes (opcional)", key: "componentes", width: 25 },
    { header: "Notas (opcional)", key: "notas", width: 30 },
  ];

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center" };
  });

  // 3 example rows
  const examples = [
    { espacio: espacios[0] ?? "Cocina", nombre: "[EJEMPLO] Instalar meson de cocina", dias: 3, codigo: "MK01", marca: "SAGANO", componentes: "estructura + cubierta", notas: "" },
    { espacio: espacios[1] ?? "Bano principal", nombre: "[EJEMPLO] Instalar mueble lavamanos", dias: 2, codigo: "", marca: "", componentes: "", notas: "Verificar plomeria" },
    { espacio: espacios[0] ?? "Cocina", nombre: "[EJEMPLO] Pintura paredes cocina", dias: 1, codigo: "", marca: "", componentes: "", notas: "" },
  ];

  for (const ex of examples) {
    const row = ws.addRow({
      espacio: ex.espacio,
      nombre: ex.nombre,
      dias: ex.dias,
      codigo: ex.codigo,
      marca: ex.marca,
      componentes: ex.componentes,
      notas: ex.notas,
    });
    row.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF94A3B8" } };
    });
  }

  // Data validation for "Espacio" column (rows 2-200)
  if (espacios.length > 0) {
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list",
        formulae: [`"${espacios.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Espacio invalido",
        error: "Selecciona un espacio de la lista",
      };
    }
  }

  // --- Sheet 2: Instrucciones ---
  const instrWs = wb.addWorksheet("Instrucciones");
  instrWs.getColumn(1).width = 60;

  const instrucciones = [
    `Plantilla de tareas - Fase: ${fase}`,
    "",
    "Como llenar esta plantilla:",
    "1. En la hoja 'Tareas', cada fila es una tarea.",
    "2. 'Espacio' es obligatorio: selecciona del dropdown (o escribe exacto).",
    "3. 'Nombre de la tarea' es obligatorio.",
    "4. 'Dias acordados' es obligatorio y debe ser mayor a 0.",
    "5. Las columnas 'Codigo referencia', 'Marca/Linea', 'Componentes' y 'Notas' son opcionales.",
    "",
    "Espacios validos:",
    ...espacios.map((e) => `  - ${e}`),
    "",
    "NOTA: Las filas que empiecen con [EJEMPLO] seran ignoradas al importar.",
  ];

  instrucciones.forEach((line, i) => {
    const cell = instrWs.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) {
      cell.font = { bold: true, size: 14, color: { argb: "FF2563EB" } };
    } else if (line.startsWith("Como llenar") || line.startsWith("Espacios validos") || line.startsWith("NOTA:")) {
      cell.font = { bold: true };
    }
  });

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla-${fase.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded .xlsx template for a specific phase.
 * Returns { tareas, errores }.
 */
export async function parsePhaseTemplate(
  file: File,
  fase: string,
  validEspacios: string[],
): Promise<{ tareas: Omit<TareaInput, "id">[]; errores: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const ws = wb.getWorksheet("Tareas");
  if (!ws) {
    return { tareas: [], errores: ["La hoja 'Tareas' no existe en el archivo"] };
  }

  const errores: string[] = [];
  const tareas: Omit<TareaInput, "id">[] = [];
  const validEspaciosLower = validEspacios.map((e) => e.toLowerCase());

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const espacio = String(row.getCell(1).value ?? "").trim();
    const nombre = String(row.getCell(2).value ?? "").trim();
    const dias = Number(row.getCell(3).value);
    const codigo = String(row.getCell(4).value ?? "").trim() || undefined;
    const marca = String(row.getCell(5).value ?? "").trim() || undefined;
    const componentes = String(row.getCell(6).value ?? "").trim() || undefined;

    // Skip empty rows
    if (!espacio && !nombre) return;

    // Skip example rows
    if (nombre.startsWith("[EJEMPLO]")) return;

    // Validate espacio
    if (!espacio) {
      errores.push(`Fila ${rowNumber}: falta el espacio`);
      return;
    }
    if (!validEspaciosLower.includes(espacio.toLowerCase())) {
      errores.push(`Fila ${rowNumber}: espacio "${espacio}" no existe en los tipos definidos`);
      return;
    }

    // Validate nombre
    if (!nombre) {
      errores.push(`Fila ${rowNumber}: falta el nombre de la tarea`);
      return;
    }

    // Validate dias
    if (!dias || dias < 1) {
      errores.push(`Fila ${rowNumber}: dias acordados debe ser mayor a 0`);
      return;
    }

    // Normalize espacio casing to match the valid list
    const matchedEspacio = validEspacios.find((e) => e.toLowerCase() === espacio.toLowerCase()) ?? espacio;

    tareas.push({
      fase,
      espacio: matchedEspacio,
      nombre,
      tiempo_acordado_dias: dias,
      codigo_referencia: codigo,
      marca_linea: marca,
      componentes,
    });
  });

  return { tareas, errores };
}
