import type { TareaInput } from "./wizard-types";

/**
 * Generate a single .xlsx template for ALL phases.
 * 13 columns: Fase | Tipo unidad | Subfase | Espacio | Nombre | Días | Valor Instalación | Valor Lustro | Estructura | Nave | Chapa | Cartera | Marca/Línea
 */
export async function generateTemplate(
  fases: string[],
  espacios: string[],
  tiposUnidad?: string[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Seiricon";

  const ws = wb.addWorksheet("Tareas");

  ws.columns = [
    { header: "Fase", key: "fase", width: 18 },
    { header: "Tipo unidad (Madera)", key: "tipo_unidad", width: 22 },
    { header: "Subfase (opcional)", key: "subfase", width: 20 },
    { header: "Espacio", key: "espacio", width: 22 },
    { header: "Nombre de la tarea", key: "nombre", width: 35 },
    { header: "Dias acordados", key: "dias", width: 16 },
    { header: "Valor Instalación (COP)", key: "valor_instalacion", width: 22 },
    { header: "Valor Lustro y Detallado (COP)", key: "valor_lustro", width: 28 },
    { header: "Estructura", key: "estructura", width: 12 },
    { header: "Nave", key: "nave", width: 10 },
    { header: "Chapa", key: "chapa", width: 10 },
    { header: "Cartera", key: "cartera", width: 10 },
    { header: "Marca/Linea (opcional)", key: "marca", width: 20 },
  ];

  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center" };
  });

  const exampleFase1 = fases[0] ?? "Madera";
  const exampleFase2 = fases[1] ?? fases[0] ?? "Obra Blanca";
  const exampleEsp1 = espacios[0] ?? "Cocina";
  const exampleEsp2 = espacios[1] ?? espacios[0] ?? "Bano principal";
  const exampleTipo = tiposUnidad?.[0] ?? "Tipo estándar";

  const examples = [
    { fase: exampleFase1, tipo_unidad: exampleTipo, subfase: "", espacio: exampleEsp1, nombre: "[EJEMPLO] Mueble bajo cocina", dias: 3, valor_instalacion: 450000, valor_lustro: 180000, estructura: "Sí", nave: "Sí", chapa: "No", cartera: "No", marca: "SAGANO" },
    { fase: exampleFase1, tipo_unidad: exampleTipo, subfase: "", espacio: exampleEsp2, nombre: "[EJEMPLO] Mueble lavamanos", dias: 2, valor_instalacion: "", valor_lustro: "", estructura: "Sí", nave: "Sí", chapa: "No", cartera: "No", marca: "" },
    { fase: exampleFase2, tipo_unidad: "", subfase: "Pintura", espacio: exampleEsp1, nombre: "[EJEMPLO] Pintura paredes cocina", dias: 1, valor_instalacion: 120000, valor_lustro: "", estructura: "", nave: "", chapa: "", cartera: "", marca: "Corona" },
  ];

  for (const ex of examples) {
    const row = ws.addRow(ex);
    row.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF94A3B8" } };
    });
  }

  const sanitize = (v: string) => v.replace(/[",]/g, "");

  // Data validation: Fase (col A)
  if (fases.length > 0) {
    const safeList = fases.map(sanitize).join(",");
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`A${r}`).dataValidation = { type: "list", formulae: [`"${safeList}"`], showErrorMessage: true, errorTitle: "Fase invalida", error: "Selecciona una fase de la lista" };
    }
  }

  // Data validation: Tipo unidad (col B)
  if (tiposUnidad && tiposUnidad.length > 0) {
    const safeList = tiposUnidad.map(sanitize).join(",");
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`B${r}`).dataValidation = { type: "list", formulae: [`"${safeList}"`] };
    }
  }

  // Data validation: Espacio (col D)
  if (espacios.length > 0) {
    const safeList = espacios.map(sanitize).join(",");
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`D${r}`).dataValidation = { type: "list", formulae: [`"${safeList}"`], showErrorMessage: true, errorTitle: "Espacio invalido", error: "Selecciona un espacio de la lista" };
    }
  }

  // Data validation: Sí/No for component columns (I, J, K, L)
  for (const col of ["I", "J", "K", "L"]) {
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`${col}${r}`).dataValidation = { type: "list", formulae: ['"Sí,No"'] };
    }
  }

  // --- Instrucciones ---
  const instrWs = wb.addWorksheet("Instrucciones");
  instrWs.getColumn(1).width = 70;

  const instrucciones = [
    "Plantilla de tareas - Todas las fases",
    "",
    "Como llenar esta plantilla:",
    "1. 'Fase' es obligatorio: selecciona del dropdown.",
    "2. 'Tipo unidad' solo para Madera: indica a qué tipo de apartamento aplica la tarea.",
    "3. 'Subfase' es opcional (no se usa para Madera, se genera automáticamente).",
    "4. 'Espacio' es obligatorio: selecciona del dropdown.",
    "5. 'Nombre de la tarea' es obligatorio.",
    "6. 'Dias acordados' es obligatorio y debe ser mayor a 0.",
    "7. 'Valor Instalación (COP)' es opcional: precio de instalación en pesos colombianos.",
    "8. 'Valor Lustro y Detallado (COP)' es opcional: precio de lustro (solo Madera).",
    "9. Estructura/Nave/Chapa/Cartera: componentes del mueble (solo Madera). Sí o No.",
    "10. 'Marca/Linea' es opcional.",
    "",
    "Fases validas:",
    ...fases.map((f) => `  - ${f}`),
    "",
    "Tipos de unidad:",
    ...(tiposUnidad ?? []).map((t) => `  - ${t}`),
    "",
    "Espacios validos:",
    ...espacios.map((e) => `  - ${e}`),
    "",
    "NOTA: Las filas que empiecen con [EJEMPLO] seran ignoradas al importar.",
    "NOTA: Para Madera, el sistema crea automáticamente 2 registros por tarea (Instalación + Detallado y lustro).",
  ];

  instrucciones.forEach((line, i) => {
    const cell = instrWs.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) {
      cell.font = { bold: true, size: 14, color: { argb: "FF2563EB" } };
    } else if (line.startsWith("Como llenar") || line.startsWith("Fases validas") || line.startsWith("Tipos de unidad") || line.startsWith("Espacios validos") || line.startsWith("NOTA:")) {
      cell.font = { bold: true };
    }
  });

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
 * Parse an uploaded .xlsx template with the 13-column format.
 * Returns { tareas, errores }.
 *
 * Columns:
 *  1: Fase (required)
 *  2: Tipo unidad (optional, Madera only)
 *  3: Subfase (optional)
 *  4: Espacio (required)
 *  5: Nombre (required)
 *  6: Días acordados (required, > 0)
 *  7: Valor Instalación COP (optional)
 *  8: Valor Lustro y Detallado COP (optional)
 *  9: Estructura (Sí/No)
 * 10: Nave (Sí/No)
 * 11: Chapa (Sí/No)
 * 12: Cartera (Sí/No)
 * 13: Marca/Línea (optional)
 */
export async function parseTemplate(
  file: File,
  validFases: string[],
  validEspacios: string[],
  tiposUnidad?: { id: string; nombre: string }[],
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

  const parseSiNo = (v: unknown): boolean => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "sí" || s === "si" || s === "yes" || s === "1";
  };

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const fase = String(row.getCell(1).value ?? "").trim();
    const tipoUnidadNombre = String(row.getCell(2).value ?? "").trim();
    const subfase = String(row.getCell(3).value ?? "").trim() || undefined;
    const espacio = String(row.getCell(4).value ?? "").trim();
    const nombre = String(row.getCell(5).value ?? "").trim();
    const dias = Number(row.getCell(6).value);
    const valorInstalacionRaw = row.getCell(7).value;
    const precio = valorInstalacionRaw != null && String(valorInstalacionRaw).trim() !== "" ? Number(valorInstalacionRaw) : undefined;
    const valorLustroRaw = row.getCell(8).value;
    const lustro_precio = valorLustroRaw != null && String(valorLustroRaw).trim() !== "" ? Number(valorLustroRaw) : undefined;
    const estructura = row.getCell(9).value;
    const nave = row.getCell(10).value;
    const chapa = row.getCell(11).value;
    const cartera = row.getCell(12).value;
    const marca = String(row.getCell(13).value ?? "").trim() || undefined;

    if (!fase && !espacio && !nombre) return;
    if (nombre.startsWith("[EJEMPLO]")) return;

    if (!fase) {
      errores.push(`Fila ${rowNumber}: falta la fase`);
      return;
    }
    if (!validFasesLower.includes(fase.toLowerCase())) {
      errores.push(`Fila ${rowNumber}: fase "${fase}" no es valida. Opciones: ${validFases.join(", ")}`);
      return;
    }

    if (!espacio) {
      errores.push(`Fila ${rowNumber}: falta el espacio`);
      return;
    }
    if (!validEspaciosLower.includes(espacio.toLowerCase())) {
      errores.push(`Fila ${rowNumber}: espacio "${espacio}" no existe en los tipos definidos`);
      return;
    }

    if (!nombre) {
      errores.push(`Fila ${rowNumber}: falta el nombre de la tarea`);
      return;
    }

    if (!dias || dias < 1) {
      errores.push(`Fila ${rowNumber}: dias acordados debe ser mayor a 0`);
      return;
    }

    if (precio !== undefined && isNaN(precio)) {
      errores.push(`Fila ${rowNumber}: valor instalación debe ser un numero`);
      return;
    }
    if (lustro_precio !== undefined && isNaN(lustro_precio)) {
      errores.push(`Fila ${rowNumber}: valor lustro debe ser un numero`);
      return;
    }

    const matchedFase = validFases.find((f) => f.toLowerCase() === fase.toLowerCase()) ?? fase;
    const matchedEspacio = validEspacios.find((e) => e.toLowerCase() === espacio.toLowerCase()) ?? espacio;

    let tipoUnidadId: string | undefined;
    if (tipoUnidadNombre && tiposUnidad && tiposUnidad.length > 0) {
      const match = tiposUnidad.find((t) => t.nombre.toLowerCase() === tipoUnidadNombre.toLowerCase());
      if (match) {
        tipoUnidadId = match.id;
      } else {
        errores.push(`Fila ${rowNumber}: tipo unidad "${tipoUnidadNombre}" no existe. Opciones: ${tiposUnidad.map((t) => t.nombre).join(", ")}`);
        return;
      }
    }

    const isMadera = matchedFase.toLowerCase() === "madera";
    const hasComponents = estructura != null || nave != null || chapa != null || cartera != null;

    tareas.push({
      fase: matchedFase,
      subfase: isMadera ? undefined : subfase,
      espacio: matchedEspacio,
      nombre,
      tiempo_acordado_dias: dias,
      precio: precio !== undefined && !isNaN(precio) ? precio : undefined,
      lustro_precio: lustro_precio !== undefined && !isNaN(lustro_precio) ? lustro_precio : undefined,
      marca_linea: marca,
      tipo_unidad_id: tipoUnidadId,
      tiene_estructura: isMadera && hasComponents ? parseSiNo(estructura) : undefined,
      tiene_nave: isMadera && hasComponents ? parseSiNo(nave) : undefined,
      tiene_chapa: isMadera && hasComponents ? parseSiNo(chapa) : undefined,
      tiene_cartera: isMadera && hasComponents ? parseSiNo(cartera) : undefined,
    });
  });

  return { tareas, errores };
}
