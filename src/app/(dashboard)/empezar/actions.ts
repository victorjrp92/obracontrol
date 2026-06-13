"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal, limiteObrasActivas } from "@/lib/plan";
import { generarNumeroTarea } from "@/lib/numero-registro";
import { subtipoDesdePropiedad, nombreFaseDesdeObra } from "@/lib/plantillas-personal";
import type { CrearObraInput, CrearObraResult } from "./types";

const MAX_ESPACIOS = 40;
const MAX_TAREAS_POR_ESPACIO = 40;

export async function crearObraPersonal(input: CrearObraInput): Promise<CrearObraResult> {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const tipoCuenta = usuario.constructora.tipo_cuenta;
  // Guarda de backend: este flujo es solo para cuentas personales.
  if (!esCuentaPersonal(tipoCuenta)) {
    return { ok: false, error: "Este asistente es para cuentas personales." };
  }
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    return { ok: false, error: "No tienes permisos para crear obras." };
  }

  // Validación de entrada
  const nombreObra = input.nombreObra?.trim();
  if (!nombreObra || nombreObra.length < 2) {
    return { ok: false, error: "Ponle un nombre a tu obra." };
  }
  const espacios = (input.espacios ?? []).map((e) => e.trim()).filter(Boolean).slice(0, MAX_ESPACIOS);
  if (espacios.length === 0) {
    return { ok: false, error: "Elige al menos un espacio." };
  }

  const constructoraId = usuario.constructora_id;

  // ── Tope freemium ─────────────────────────────────────────────────────────
  const limite = limiteObrasActivas(usuario.constructora.plan_suscripcion, tipoCuenta);
  if (Number.isFinite(limite)) {
    const activas = await prisma.proyecto.count({
      where: { constructora_id: constructoraId, estado: "ACTIVO" },
    });
    if (activas >= limite) {
      return {
        ok: false,
        limiteAlcanzado: true,
        error:
          `Tu plan gratis permite ${limite} obra${limite === 1 ? "" : "s"} activa${limite === 1 ? "" : "s"}. ` +
          `Archiva una obra terminada o pásate a un plan superior para crear más.`,
      };
    }
  }

  // ── Cliente (solo arquitecto, opcional) ───────────────────────────────────
  let clienteId: string | null = null;
  const clienteNombre = input.clienteNombre?.trim();
  if (tipoCuenta === "ARQUITECTO" && clienteNombre) {
    const cliente = await prisma.cliente.upsert({
      where: { constructora_id_nombre: { constructora_id: constructoraId, nombre: clienteNombre } },
      update: {},
      create: { constructora_id: constructoraId, nombre: clienteNombre },
    });
    clienteId = cliente.id;
  }

  // ── Número de registro autogenerado (único por constructora) ──────────────
  const totalProyectos = await prisma.proyecto.count({ where: { constructora_id: constructoraId } });
  let numeroRegistro = `OB-${String(totalProyectos + 1).padStart(3, "0")}`;
  const yaExiste = await prisma.proyecto.findFirst({
    where: { constructora_id: constructoraId, numero_registro: numeroRegistro },
    select: { id: true },
  });
  if (yaExiste) numeroRegistro = `OB-${String(totalProyectos + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;

  const subtipo = subtipoDesdePropiedad(input.tipoPropiedad);
  const faseNombre = nombreFaseDesdeObra(input.tipoObra);

  try {
    const proyecto = await prisma.$transaction(async (tx) => {
      // Re-verificación del tope DENTRO de la transacción para evitar el race
      // de dos creaciones concurrentes (doble clic / dos pestañas).
      if (Number.isFinite(limite)) {
        const activas = await tx.proyecto.count({
          where: { constructora_id: constructoraId, estado: "ACTIVO" },
        });
        if (activas >= limite) throw new Error("LIMITE_FREEMIUM");
      }

      // 1. Proyecto
      const proyecto = await tx.proyecto.create({
        data: {
          constructora_id: constructoraId,
          cliente_id: clienteId,
          numero_registro: numeroRegistro,
          nombre: nombreObra,
          subtipo,
          dias_habiles_semana: 5,
          estado: "ACTIVO",
          fecha_inicio: new Date(),
        },
      });

      // 2. Fase única (el modelo exige fase en cada tarea)
      const fase = await tx.fase.create({
        data: { proyecto_id: proyecto.id, nombre: faseNombre, orden: 1 },
      });

      // 3. Estructura implícita: 1 edificio → 1 piso → 1 unidad (la propiedad).
      //    El usuario nunca ve esto; piensa en espacios y tareas.
      const edificio = await tx.edificio.create({
        data: { proyecto_id: proyecto.id, nombre: "Mi propiedad", num_pisos: 1 },
      });
      const piso = await tx.piso.create({ data: { edificio_id: edificio.id, numero: 1 } });
      const unidad = await tx.unidad.create({
        data: { piso_id: piso.id, nombre: nombreObra.slice(0, 80) },
      });

      // 4. Espacios + tareas
      let seq = 0;
      for (const nombreEspacio of espacios) {
        const espacio = await tx.espacio.create({
          data: { unidad_id: unidad.id, nombre: nombreEspacio.slice(0, 100) },
        });
        const tareas = (input.tareasPorEspacio[nombreEspacio] ?? []).slice(0, MAX_TAREAS_POR_ESPACIO);
        for (const t of tareas) {
          const nombreTarea = t.nombre?.trim();
          if (!nombreTarea) continue;
          seq++;
          await tx.tarea.create({
            data: {
              espacio_id: espacio.id,
              fase_id: fase.id,
              numero_registro: generarNumeroTarea(numeroRegistro, seq),
              nombre: nombreTarea.slice(0, 200),
              tiempo_acordado_dias: Math.max(1, Math.round(t.tiempo_acordado_dias || 1)),
              // Las tareas se asignan al dueño de la cuenta: sus obreros (que
              // cuelgan de él como contratista_id) las verán y reportarán, y él
              // mismo las valida. Así se cierra el ciclo en modo simple.
              asignado_a: usuario.id,
              estado: "PENDIENTE",
            },
          });
        }
      }

      return proyecto;
    }, { timeout: 30000 });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/proyectos");
    return { ok: true, proyectoId: proyecto.id };
  } catch (err) {
    if (err instanceof Error && err.message === "LIMITE_FREEMIUM") {
      return {
        ok: false,
        limiteAlcanzado: true,
        error:
          `Tu plan gratis permite ${limite} obra${limite === 1 ? "" : "s"} activa${limite === 1 ? "" : "s"}. ` +
          `Archiva una obra terminada o pásate a un plan superior para crear más.`,
      };
    }
    console.error("crearObraPersonal failed:", err);
    return { ok: false, error: "No pudimos crear la obra. Intenta de nuevo." };
  }
}
