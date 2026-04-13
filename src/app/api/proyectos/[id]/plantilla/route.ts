import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

// GET /api/proyectos/[id]/plantilla — download Excel template for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !["ADMINISTRADOR", "DIRECTIVO"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
      include: {
        fases: { orderBy: { orden: "asc" } },
        edificios: {
          include: {
            pisos: {
              orderBy: { numero: "asc" },
              include: {
                unidades: {
                  orderBy: { nombre: "asc" },
                  include: { espacios: { orderBy: { nombre: "asc" } } },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Seiricon";

    // -- Sheet 1: Template for tasks --
    const ws = wb.addWorksheet("Tareas");

    ws.columns = [
      { header: "Edificio", key: "edificio", width: 20 },
      { header: "Piso", key: "piso", width: 10 },
      { header: "Unidad", key: "unidad", width: 15 },
      { header: "Espacio", key: "espacio", width: 20 },
      { header: "Fase", key: "fase", width: 20 },
      { header: "Nombre de la tarea", key: "nombre", width: 35 },
      { header: "Dias acordados", key: "dias", width: 15 },
      { header: "Notas (opcional)", key: "notas", width: 30 },
    ];

    // Style header
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      cell.alignment = { horizontal: "center" };
    });

    // Collect valid values for dropdowns
    const edificioNames: string[] = [];
    const espacioNames = new Set<string>();
    const faseNames = proyecto.fases.map((f) => f.nombre);

    for (const edificio of proyecto.edificios) {
      edificioNames.push(edificio.nombre);
      for (const piso of edificio.pisos) {
        for (const unidad of piso.unidades) {
          for (const espacio of unidad.espacios) {
            espacioNames.add(espacio.nombre);
          }
        }
      }
    }

    // Add example rows
    const firstEdificio = proyecto.edificios[0];
    const firstPiso = firstEdificio?.pisos[0];
    const firstUnidad = firstPiso?.unidades[0];
    const firstEspacio = firstUnidad?.espacios[0];
    const firstFase = proyecto.fases[0];

    if (firstEdificio && firstPiso && firstUnidad && firstEspacio && firstFase) {
      ws.addRow({
        edificio: firstEdificio.nombre,
        piso: firstPiso.numero,
        unidad: firstUnidad.nombre,
        espacio: firstEspacio.nombre,
        fase: firstFase.nombre,
        nombre: "Ejemplo: Instalacion de piso",
        dias: 5,
        notas: "Esta fila es un ejemplo, borrala antes de subir",
      });
      ws.getRow(2).eachCell((cell) => {
        cell.font = { italic: true, color: { argb: "FF94A3B8" } };
      });
    }

    // -- Sheet 2: Reference data (edificios, pisos, unidades, espacios, fases) --
    const refWs = wb.addWorksheet("Referencia (no modificar)");
    refWs.columns = [
      { header: "Edificio", key: "edificio", width: 20 },
      { header: "Piso", key: "piso", width: 10 },
      { header: "Unidad", key: "unidad", width: 15 },
      { header: "Espacio", key: "espacio", width: 20 },
      { header: "Fase", key: "fase", width: 20 },
    ];
    refWs.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });

    // Fill reference data with all combinations
    for (const edificio of proyecto.edificios) {
      for (const piso of edificio.pisos) {
        for (const unidad of piso.unidades) {
          for (const espacio of unidad.espacios) {
            refWs.addRow({
              edificio: edificio.nombre,
              piso: piso.numero,
              unidad: unidad.nombre,
              espacio: espacio.nombre,
              fase: "",
            });
          }
        }
      }
    }
    // Add fases as separate column
    proyecto.fases.forEach((f, i) => {
      const row = refWs.getRow(i + 2);
      row.getCell("fase").value = f.nombre;
    });

    // Add data validation for fase column in Tareas sheet (rows 2-200)
    if (faseNames.length > 0) {
      for (let r = 2; r <= 200; r++) {
        ws.getCell(`E${r}`).dataValidation = {
          type: "list",
          formulae: [`"${faseNames.join(",")}"`],
          showErrorMessage: true,
          errorTitle: "Fase invalida",
          error: "Selecciona una fase de la lista",
        };
      }
    }

    // Store project ID in a hidden cell for upload reference
    const metaWs = wb.addWorksheet("_meta");
    metaWs.getCell("A1").value = "proyecto_id";
    metaWs.getCell("B1").value = proyecto.id;
    metaWs.state = "hidden";

    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="plantilla-${proyecto.nombre.replace(/[^a-zA-Z0-9]/g, "-")}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("GET /api/proyectos/[id]/plantilla", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
