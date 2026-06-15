"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal, limiteObrasActivas } from "@/lib/plan";
import { generarNumeroTarea } from "@/lib/numero-registro";
import { subtipoDesdePropiedad, nombreFaseDesdeObra } from "@/lib/plantillas-personal";
import type {
  CrearObraInput,
  CrearObraResult,
  EspacioInput,
  PisoInput,
  TipoAptoInput,
} from "./types";

// Topes para evitar explosión de filas (alineados con el wizard B2B).
const MAX_PISOS = 200;
const MAX_ESPACIOS_POR_UNIDAD = 40;
const MAX_TAREAS_POR_ESPACIO = 40;
const MAX_TIPOS_APTO = 30;
const MAX_APTOS_POR_PISO = 50;
const MAX_TAREAS_TOTALES = 5000;

interface CrearCtx {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  faseId: string;
  numeroRegistro: string;
  usuarioId: string;
  /** Contador mutable de tareas creadas (numeración + tope global). */
  seq: { n: number };
}

/**
 * Crea espacios + tareas activas dentro de una unidad ya creada.
 * Solo se persisten tareas con `activa === true` ("qué falta por hacer").
 * Lanza "MAX_TAREAS" si se supera el tope global.
 */
async function crearEspaciosYTareas(
  ctx: CrearCtx,
  unidadId: string,
  espacios: EspacioInput[],
): Promise<void> {
  const espaciosLimitados = espacios.slice(0, MAX_ESPACIOS_POR_UNIDAD);
  for (const espacioInput of espaciosLimitados) {
    const nombreEspacio = espacioInput.nombre?.trim();
    if (!nombreEspacio) continue;

    const espacio = await ctx.tx.espacio.create({
      data: {
        unidad_id: unidadId,
        nombre: nombreEspacio.slice(0, 100),
        ...(typeof espacioInput.metraje === "number" && espacioInput.metraje > 0
          ? { metraje: espacioInput.metraje }
          : {}),
      },
    });

    const tareasActivas = (espacioInput.tareas ?? [])
      .filter((t) => t.activa)
      .slice(0, MAX_TAREAS_POR_ESPACIO);

    for (const t of tareasActivas) {
      const nombreTarea = t.nombre?.trim();
      if (!nombreTarea) continue;
      if (ctx.seq.n >= MAX_TAREAS_TOTALES) throw new Error("MAX_TAREAS");
      ctx.seq.n++;
      await ctx.tx.tarea.create({
        data: {
          espacio_id: espacio.id,
          fase_id: ctx.faseId,
          numero_registro: generarNumeroTarea(ctx.numeroRegistro, ctx.seq.n),
          nombre: nombreTarea.slice(0, 200),
          tiempo_acordado_dias: Math.max(1, Math.round(t.tiempo_acordado_dias || 1)),
          ...(typeof t.precio === "number" && t.precio >= 0 ? { precio: t.precio } : {}),
          // Las tareas se asignan al dueño de la cuenta: sus obreros (que cuelgan
          // de él como contratista) las reportan y él mismo las valida.
          asignado_a: ctx.usuarioId,
          estado: "PENDIENTE",
        },
      });
    }
  }
}

/** Nombre legible del piso ("Primer piso"..) — o el nombre de la obra si es único. */
function nombrePiso(numero: number, totalPisos: number, nombreObra: string): string {
  if (totalPisos <= 1) return nombreObra.slice(0, 80);
  const ordinales = [
    "Primer piso",
    "Segundo piso",
    "Tercer piso",
    "Cuarto piso",
    "Quinto piso",
    "Sexto piso",
    "Séptimo piso",
    "Octavo piso",
    "Noveno piso",
    "Décimo piso",
  ];
  return ordinales[numero - 1] ?? `Piso ${numero}`;
}

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

  // ── Validación de entrada ──────────────────────────────────────────────────
  const nombreObra = input.nombreObra?.trim();
  if (!nombreObra || nombreObra.length < 2) {
    return { ok: false, error: "Ponle un nombre a tu obra." };
  }

  const esEdificio = input.tipoPropiedad === "EDIFICIO";

  // Normaliza la estructura según el modo.
  let pisos: PisoInput[] = [];
  let edificioInput: { numPisos: number; aptosPorPiso: number; usaDireccion?: boolean; tipos: TipoAptoInput[] } | null = null;

  if (esEdificio) {
    if (!input.edificio) {
      return { ok: false, error: "Define la estructura del edificio." };
    }
    edificioInput = input.edificio;
    const numPisos = Math.round(edificioInput.numPisos);
    const aptosPorPiso = Math.round(edificioInput.aptosPorPiso);
    if (!Number.isFinite(numPisos) || numPisos < 1 || numPisos > MAX_PISOS) {
      return { ok: false, error: `El edificio debe tener entre 1 y ${MAX_PISOS} pisos.` };
    }
    if (!Number.isFinite(aptosPorPiso) || aptosPorPiso < 1 || aptosPorPiso > MAX_APTOS_POR_PISO) {
      return { ok: false, error: `Los apartamentos por piso deben estar entre 1 y ${MAX_APTOS_POR_PISO}.` };
    }
    const tipos = (edificioInput.tipos ?? []).slice(0, MAX_TIPOS_APTO);
    if (tipos.length === 0) {
      return { ok: false, error: "Define al menos un tipo de apartamento." };
    }
    const conEspacios = tipos.some((t) => (t.espacios ?? []).length > 0);
    if (!conEspacios) {
      return { ok: false, error: "Cada tipo de apartamento necesita al menos un espacio." };
    }
    edificioInput = { ...edificioInput, numPisos, aptosPorPiso, tipos };
  } else {
    pisos = (input.pisos ?? []).slice(0, MAX_PISOS);
    if (pisos.length === 0) {
      return { ok: false, error: "Arma al menos un piso con un espacio." };
    }
    const totalEspacios = pisos.reduce((acc, p) => acc + (p.espacios ?? []).length, 0);
    if (totalEspacios === 0) {
      return { ok: false, error: "Elige al menos un espacio." };
    }
  }

  const constructoraId = usuario.constructora_id;

  // ── Tope freemium ──────────────────────────────────────────────────────────
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

  // ── Cliente (solo arquitecto, opcional) ────────────────────────────────────
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

  // ── Número de registro autogenerado (único por constructora) ───────────────
  const totalProyectos = await prisma.proyecto.count({ where: { constructora_id: constructoraId } });
  let numeroRegistro = `OB-${String(totalProyectos + 1).padStart(3, "0")}`;
  const yaExiste = await prisma.proyecto.findFirst({
    where: { constructora_id: constructoraId, numero_registro: numeroRegistro },
    select: { id: true },
  });
  if (yaExiste) numeroRegistro = `OB-${String(totalProyectos + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;

  const subtipo = subtipoDesdePropiedad(input.tipoPropiedad);
  const faseNombre = nombreFaseDesdeObra(input.tipoObra);

  // Contexto / telemetría.
  const fechaInicio = input.fechaInicio ? new Date(input.fechaInicio) : new Date();
  const fechaFin = input.fechaFin ? new Date(input.fechaFin) : null;
  const ciudad = input.ciudad?.trim().slice(0, 120) || null;
  const presupuestoTotal =
    typeof input.presupuestoTotal === "number" && input.presupuestoTotal > 0
      ? Math.round(input.presupuestoTotal)
      : null;

  try {
    const proyecto = await prisma.$transaction(
      async (tx) => {
        // Re-verificación del tope DENTRO de la transacción (race doble clic).
        if (Number.isFinite(limite)) {
          const activas = await tx.proyecto.count({
            where: { constructora_id: constructoraId, estado: "ACTIVO" },
          });
          if (activas >= limite) throw new Error("LIMITE_FREEMIUM");
        }

        // 1. Proyecto (con contexto B2C + telemetría).
        const proyecto = await tx.proyecto.create({
          data: {
            constructora_id: constructoraId,
            cliente_id: clienteId,
            numero_registro: numeroRegistro,
            nombre: nombreObra,
            subtipo,
            dias_habiles_semana: 5,
            estado: "ACTIVO",
            fecha_inicio: fechaInicio,
            fecha_fin_estimada: fechaFin,
            ubicacion_lat: typeof input.ubicacionLat === "number" ? input.ubicacionLat : null,
            ubicacion_lng: typeof input.ubicacionLng === "number" ? input.ubicacionLng : null,
            tipo_obra: input.tipoObra,
            tipo_propiedad: input.tipoPropiedad,
            ciudad,
            presupuesto_total: presupuestoTotal,
          },
        });

        // 2. Fase única (el modelo exige fase en cada tarea).
        const fase = await tx.fase.create({
          data: { proyecto_id: proyecto.id, nombre: faseNombre, orden: 1 },
        });

        // 3. Edificio raíz (siempre 1; el usuario nunca ve esta capa).
        const edificio = await tx.edificio.create({
          data: { proyecto_id: proyecto.id, nombre: "Mi propiedad", num_pisos: 1 },
        });

        const ctx: CrearCtx = {
          tx,
          faseId: fase.id,
          numeroRegistro,
          usuarioId: usuario.id,
          seq: { n: 0 },
        };

        if (esEdificio && edificioInput) {
          // ── EDIFICIO: N pisos → aptos por tipo → espacios/tareas por tipo ──
          edificio.num_pisos = edificioInput.numPisos;
          await tx.edificio.update({
            where: { id: edificio.id },
            data: { num_pisos: edificioInput.numPisos },
          });

          // Un TipoUnidad por tipo de apto; los espacios/tareas se definen UNA
          // vez por tipo y se replican en cada unidad de ese tipo.
          const tiposConId: { tipoUnidadId: string; def: TipoAptoInput }[] = [];
          for (let i = 0; i < edificioInput.tipos.length; i++) {
            const def = edificioInput.tipos[i];
            const tipoUnidad = await tx.tipoUnidad.create({
              data: {
                proyecto_id: proyecto.id,
                nombre: (def.nombre?.trim() || `Tipo ${i + 1}`).slice(0, 100),
              },
            });
            tiposConId.push({ tipoUnidadId: tipoUnidad.id, def });
          }

          // Reparto de las `aptosPorPiso` unidades entre los tipos: usa
          // `cantidadPorPiso` cuando viene; el resto se asigna round-robin para
          // que la suma por piso sea siempre exactamente `aptosPorPiso`.
          const aptosPorPiso = edificioInput.aptosPorPiso;
          const explicit = tiposConId.map((t) =>
            Math.max(0, Math.round(t.def.cantidadPorPiso ?? 0)),
          );
          const explicitSum = explicit.reduce((a, b) => a + b, 0);
          const cuentasPorTipo: number[] = [...explicit];
          let restante = aptosPorPiso - explicitSum;
          if (restante < 0) {
            // Pidieron más de la capacidad: recorta proporcionalmente desde el final.
            let exceso = -restante;
            for (let i = cuentasPorTipo.length - 1; i >= 0 && exceso > 0; i--) {
              const quita = Math.min(cuentasPorTipo[i], exceso);
              cuentasPorTipo[i] -= quita;
              exceso -= quita;
            }
            restante = 0;
          }
          // Distribuye el remanente round-robin entre los tipos.
          let idx = 0;
          while (restante > 0) {
            cuentasPorTipo[idx % cuentasPorTipo.length]++;
            idx++;
            restante--;
          }

          for (let p = 1; p <= edificioInput.numPisos; p++) {
            const piso = await tx.piso.create({
              data: { edificio_id: edificio.id, numero: p },
            });
            let slot = 0;
            for (let ti = 0; ti < tiposConId.length; ti++) {
              const { tipoUnidadId, def } = tiposConId[ti];
              for (let c = 0; c < cuentasPorTipo[ti]; c++) {
                slot++;
                const unitName = `${p}${String(slot).padStart(2, "0")}`;
                const unidad = await tx.unidad.create({
                  data: {
                    piso_id: piso.id,
                    nombre: unitName,
                    tipo_unidad_id: tipoUnidadId,
                  },
                });
                await crearEspaciosYTareas(ctx, unidad.id, def.espacios ?? []);
              }
            }
          }
        } else {
          // ── CASA / LOCAL / APARTAMENTO: N pisos → 1 unidad por piso ──────────
          const totalPisos = pisos.length;
          // Re-numera por seguridad (1..N) ignorando el `numero` provisto.
          for (let i = 0; i < totalPisos; i++) {
            const pisoInput = pisos[i];
            const numero = i + 1;
            const piso = await tx.piso.create({
              data: { edificio_id: edificio.id, numero },
            });
            const unidad = await tx.unidad.create({
              data: { piso_id: piso.id, nombre: nombrePiso(numero, totalPisos, nombreObra) },
            });
            await crearEspaciosYTareas(ctx, unidad.id, pisoInput.espacios ?? []);
          }
        }

        return proyecto;
      },
      { timeout: 60000 },
    );

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
    if (err instanceof Error && err.message === "MAX_TAREAS") {
      return {
        ok: false,
        error: `La obra genera demasiadas tareas (máximo ${MAX_TAREAS_TOTALES}). Reduce pisos, aptos o tareas.`,
      };
    }
    console.error("crearObraPersonal failed:", err);
    return { ok: false, error: "No pudimos crear la obra. Intenta de nuevo." };
  }
}
