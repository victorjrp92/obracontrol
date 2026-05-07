import type { TareaInput } from "./wizard-types";

/**
 * Generate a single .xlsx template for ALL phases.
 * 9 columns: Fase | Subfase | Espacio | Nombre tarea | Días acordados | Valor COP | Marca/Línea | Componentes | Notas
 * ExcelJS is dynamically imported to avoid bundle bloat.
 */
export async function generateTemplate(
  fases: string[],
  espacios: string[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Seiricon";

  // --- Sheet 1: Tareas ---
  const ws = wb.addWorksheet("Tareas");

  ws.columns = [
    { header: "Fase", key: "fase", width: 18 },
    { header: "Subfase (opcional)", key: "subfase", width: 20 },
    { header: "Espacio", key: "espacio", width: 22 },
    { header: "Nombre de la tarea", key: "nombre", width: 35 },
    { header: "Dias acordados", key: "dias", width: 16 },
    { header: "Valor COP (opcional)", key: "valor", width: 18 },
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

  // Example rows showing data for multiple phases
  const exampleFase1 = fases[0] ?? "Madera";
  const exampleFase2 = fases[1] ?? fases[0] ?? "Obra Blanca";
  const exampleEsp1 = espacios[0] ?? "Cocina";
  const exampleEsp2 = espacios[1] ?? espacios[0] ?? "Bano principal";

  const examples = [
    { fase: exampleFase1, subfase: "Instalacion", espacio: exampleEsp1, nombre: "[EJEMPLO] Instalar meson de cocina", dias: 3, valor: 450000, marca: "SAGANO", componentes: "estructura + cubierta", notas: "" },
    { fase: exampleFase1, subfase: "", espacio: exampleEsp2, nombre: "[EJEMPLO] Instalar mueble lavamanos", dias: 2, valor: "", marca: "", componentes: "", notas: "Verificar plomeria" },
    { fase: exampleFase2, subfase: "Pintura", espacio: exampleEsp1, nombre: "[EJEMPLO] Pintura paredes cocina", dias: 1, valor: 120000, marca: "Corona", componentes: "", notas: "" },
  ];

  for (const ex of examples) {
    const row = ws.addRow({
      fase: ex.fase,
      subfase: ex.subfase,
      espacio: ex.espacio,
      nombre: ex.nombre,
      dias: ex.dias,
      valor: ex.valor,
      marca: ex.marca,
      componentes: ex.componentes,
      notas: ex.notas,
    });
    row.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF94A3B8" } };
    });
  }

  // Sanitize values for Excel list validation (strip commas and quotes that break formulae)
  const sanitize = (v: string) => v.replace(/[",]/g, "");

  // Data validation for "Fase" column (column A, rows 2-200)
  if (fases.length > 0) {
    const safeList = fases.map(sanitize).join(",");
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list",
        formulae: [`"${safeList}"`],
        showErrorMessage: true,
        errorTitle: "Fase invalida",
        error: "Selecciona una fase de la lista",
      };
    }
  }

  // Data validation for "Espacio" column (column C, rows 2-200)
  if (espacios.length > 0) {
    const safeList = espacios.map(sanitize).join(",");
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`C${r}`).dataValidation = {
        type: "list",
        formulae: [`"${safeList}"`],
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
    "Plantilla de tareas - Todas las fases",
    "",
    "Como llenar esta plantilla:",
    "1. En la hoja 'Tareas', cada fila es una tarea.",
    "2. 'Fase' es obligatorio: selecciona del dropdown (o escribe exacto).",
    "3. 'Subfase' es opcional: puedes agrupar tareas dentro de una fase.",
    "4. 'Espacio' es obligatorio: selecciona del dropdown (o escribe exacto).",
    "5. 'Nombre de la tarea' es obligatorio.",
    "6. 'Dias acordados' es obligatorio y debe ser mayor a 0.",
    "7. 'Valor COP' es opcional: precio de la tarea en pesos colombianos.",
    "8. Las columnas 'Marca/Linea', 'Componentes' y 'Notas' son opcionales.",
    "",
    "Fases validas:",
    ...fases.map((f) => `  - ${f}`),
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
    } else if (
      line.startsWith("Como llenar") ||
      line.startsWith("Fases validas") ||
      line.startsWith("Espacios validos") ||
      line.startsWith("NOTA:")
    ) {
      cell.font = { bold: true };
    }
  });

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-tareas.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded .xlsx template with the 9-column format.
 * Returns { tareas, errores }.
 *
 * Columns:
 *  1: Fase (required, must be in validFases)
 *  2: Subfase (optional)
 *  3: Espacio (required, must be in validEspacios)
 *  4: Nombre (required)
 *  5: Días acordados (required, > 0)
 *  6: Valor COP → maps to `precio` (optional)
 *  7: Marca/Línea (optional)
 *  8: Componentes (optional)
 *  9: Notas (ignored, not mapped to TareaInput)
 */
export async function parseTemplate(
  file: File,
  validFases: string[],
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
  const validFasesLower = validFases.map((f) => f.toLowerCase());
  const validEspaciosLower = validEspacios.map((e) => e.toLowerCase());

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const fase = String(row.getCell(1).value ?? "").trim();
    const subfase = String(row.getCell(2).value ?? "").trim() || undefined;
    const espacio = String(row.getCell(3).value ?? "").trim();
    const nombre = String(row.getCell(4).value ?? "").trim();
    const dias = Number(row.getCell(5).value);
    const valorRaw = row.getCell(6).value;
    const precio = valorRaw != null && String(valorRaw).trim() !== "" ? Number(valorRaw) : undefined;
    const marca = String(row.getCell(7).value ?? "").trim() || undefined;
    const componentes = String(row.getCell(8).value ?? "").trim() || undefined;
    // Column 9 (Notas) is intentionally not mapped to TareaInput

    // Skip completely empty rows
    if (!fase && !espacio && !nombre) return;

    // Skip example rows
    if (nombre.startsWith("[EJEMPLO]")) return;

    // Validate fase
    if (!fase) {
      errores.push(`Fila ${rowNumber}: falta la fase`);
      return;
    }
    if (!validFasesLower.includes(fase.toLowerCase())) {
      errores.push(`Fila ${rowNumber}: fase "${fase}" no es valida. Opciones: ${validFases.join(", ")}`);
      return;
    }

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

    // Validate precio if provided
    if (precio !== undefined && isNaN(precio)) {
      errores.push(`Fila ${rowNumber}: valor COP debe ser un numero`);
      return;
    }

    // Normalize casing to match the valid lists
    const matchedFase = validFases.find((f) => f.toLowerCase() === fase.toLowerCase()) ?? fase;
    const matchedEspacio = validEspacios.find((e) => e.toLowerCase() === espacio.toLowerCase()) ?? espacio;

    tareas.push({
      fase: matchedFase,
      subfase,
      espacio: matchedEspacio,
      nombre,
      tiempo_acordado_dias: dias,
      precio: precio !== undefined && !isNaN(precio) ? precio : undefined,
      marca_linea: marca,
      componentes,
    });
  });

  return { tareas, errores };
}
