import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin } from "@/lib/access";

// POST /api/proyectos/[id]/importar-tareas — import tasks from Excel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !(isAnyAdmin(currentUser.rol_ref.nivel_acceso) || currentUser.rol_ref.nivel_acceso === "DIRECTIVO")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    const { id } = await params;
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    const proyecto = await prisma.proyecto.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
      include: {
        fases: true,
        edificios: {
          include: {
            pisos: {
              include: {
                unidades: {
                  include: { espacios: true },
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

    // Parse uploaded file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envio archivo" }, { status: 400 });
    }

    // Bound file size to prevent DoS via oversized uploads. 10 MB is generous
    // for task spreadsheets (tens of thousands of rows at most).
    const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "El archivo no puede superar 10 MB" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrayBuffer as any);

    const ws = wb.getWorksheet("Tareas");
    if (!ws) {
      return NextResponse.json({ error: "La hoja 'Tareas' no existe en el archivo" }, { status: 400 });
    }

    // Build lookup maps
    const faseMap = new Map(proyecto.fases.map((f) => [f.nombre.toLowerCase().trim(), f.id]));

    type EspacioLookup = { espacioId: string };
    const espacioMap = new Map<string, EspacioLookup>();
    for (const edificio of proyecto.edificios) {
      for (const piso of edificio.pisos) {
        for (const unidad of piso.unidades) {
          for (const espacio of unidad.espacios) {
            const key = `${edificio.nombre.toLowerCase().trim()}|${piso.numero}|${unidad.nombre.toLowerCase().trim()}|${espacio.nombre.toLowerCase().trim()}`;
            espacioMap.set(key, { espacioId: espacio.id });
          }
        }
      }
    }

    // Parse rows (skip header row 1)
    const errors: string[] = [];
    const tasksToCreate: {
      espacio_id: string;
      fase_id: string;
      nombre: string;
      tiempo_acordado_dias: number;
      notas: string | null;
    }[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const edificio = String(row.getCell(1).value ?? "").trim();
      const piso = Number(row.getCell(2).value);
      const unidad = String(row.getCell(3).value ?? "").trim();
      const espacio = String(row.getCell(4).value ?? "").trim();
      const fase = String(row.getCell(5).value ?? "").trim();
      const nombre = String(row.getCell(6).value ?? "").trim();
      const dias = Number(row.getCell(7).value);
      const notas = String(row.getCell(8).value ?? "").trim() || null;

      // Skip empty rows
      if (!edificio && !nombre) return;

      // Skip example row
      if (nombre.startsWith("Ejemplo:")) return;

      // Validate
      if (!edificio || !unidad || !espacio || !fase || !nombre) {
        errors.push(`Fila ${rowNumber}: faltan campos obligatorios (edificio, unidad, espacio, fase, nombre)`);
        return;
      }
      if (!dias || dias < 1) {
        errors.push(`Fila ${rowNumber}: dias acordados debe ser mayor a 0`);
        return;
      }

      const key = `${edificio.toLowerCase()}|${piso}|${unidad.toLowerCase()}|${espacio.toLowerCase()}`;
      const espacioLookup = espacioMap.get(key);
      if (!espacioLookup) {
        errors.push(`Fila ${rowNumber}: no se encontro la combinacion edificio "${edificio}" / piso ${piso} / unidad "${unidad}" / espacio "${espacio}"`);
        return;
      }

      const faseId = faseMap.get(fase.toLowerCase());
      if (!faseId) {
        errors.push(`Fila ${rowNumber}: fase "${fase}" no existe en el proyecto`);
        return;
      }

      tasksToCreate.push({
        espacio_id: espacioLookup.espacioId,
        fase_id: faseId,
        nombre,
        tiempo_acordado_dias: dias,
        notas,
      });
    });

    if (errors.length > 0 && tasksToCreate.length === 0) {
      return NextResponse.json({ error: "No se pudo importar ninguna tarea", errores: errors }, { status: 400 });
    }

    // Bound the number of tasks created per import to avoid abuse.
    const MAX_TASKS_PER_IMPORT = 5000;
    if (tasksToCreate.length > MAX_TASKS_PER_IMPORT) {
      return NextResponse.json(
        {
          error: `El archivo contiene demasiadas tareas (maximo ${MAX_TASKS_PER_IMPORT} por importacion)`,
        },
        { status: 400 }
      );
    }

    // Create tasks in batch
    const created = await prisma.tarea.createMany({
      data: tasksToCreate.map((t) => ({
        espacio_id: t.espacio_id,
        fase_id: t.fase_id,
        nombre: t.nombre,
        tiempo_acordado_dias: t.tiempo_acordado_dias,
        notas: t.notas,
        estado: "PENDIENTE",
      })),
    });

    return NextResponse.json({
      importadas: created.count,
      errores: errors,
    });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/importar-tareas", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
