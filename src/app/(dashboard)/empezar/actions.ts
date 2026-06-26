"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal, limiteObrasActivas } from "@/lib/plan";
import { generarNumeroTarea } from "@/lib/numero-registro";
import { subtipoDesdePropiedad, nombreFaseDesdeObra } from "@/lib/plantillas-personal";
import { normalizarTarea } from "@/lib/normalizar-tarea";
import type { TipoObra, TipoPropiedad } from "@/lib/plantillas-personal";
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

// Topes de valores (sanidad de datos).
const MAX_NOMBRE = 200;
const MAX_METRAJE = 1_000_000; // m² — tope absurdamente alto pero finito
const INT_CAP = 2_000_000_000; // cap seguro para columnas INTEGER (precio/presupuesto en COP)

/** Recorta un precio (COP) al rango válido [0, INT_CAP]; null si no es número válido. */
function precioValido(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.min(Math.round(v), INT_CAP);
}

/** Metraje > 0 y con tope razonable; undefined si no aplica. */
function metrajeValido(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.min(v, MAX_METRAJE);
}

/**
 * Normaliza los 3 campos de presupuesto según el `modoPresupuesto` elegido,
 * para persistirlos de forma consistente (los modos son mutuamente excluyentes):
 *  - "separado" → guarda M.O. + materiales; total = su suma (para compatibilidad
 *                 con lo que ya lee `presupuesto_total`). Limpia nada si vacío.
 *  - "general"  → guarda solo total; limpia las dos bolsas separadas.
 *  - "ninguno"/indefinido → todo null (sin presupuesto). Por retrocompat, si NO
 *                 viene `modoPresupuesto` pero sí `presupuestoTotal`, se trata
 *                 como "general".
 */
function normalizarPresupuesto(input: {
  modoPresupuesto?: "ninguno" | "general" | "separado";
  presupuestoTotal?: number;
  presupuestoManoObra?: number;
  presupuestoMateriales?: number;
}): {
  presupuestoTotal: number | null;
  presupuestoManoObra: number | null;
  presupuestoMateriales: number | null;
} {
  const modo = input.modoPresupuesto
    ?? (typeof input.presupuestoTotal === "number" && input.presupuestoTotal > 0 ? "general" : "ninguno");

  if (modo === "separado") {
    const mo = precioValido(input.presupuestoManoObra);
    const mat = precioValido(input.presupuestoMateriales);
    const total = mo != null || mat != null
      ? Math.min((mo ?? 0) + (mat ?? 0), INT_CAP)
      : null;
    return { presupuestoTotal: total, presupuestoManoObra: mo, presupuestoMateriales: mat };
  }
  if (modo === "general") {
    const total = precioValido(input.presupuestoTotal);
    return { presupuestoTotal: total, presupuestoManoObra: null, presupuestoMateriales: null };
  }
  // "ninguno"
  return { presupuestoTotal: null, presupuestoManoObra: null, presupuestoMateriales: null };
}

/** Una fila de RegistroPrecio acumulada para captura pasiva (flush en batch). */
interface PrecioCapturado {
  tarea_normalizada: string;
  ciudad: string | null;
  tipo_obra: string | null;
  precio: number;
  fuente: string;
  peso: number;
  constructora_id: string | null;
  proyecto_id: string | null;
}

interface CrearCtx {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  faseId: string;
  numeroRegistro: string;
  usuarioId: string;
  /** Contador mutable de tareas creadas (numeración + tope global). */
  seq: { n: number };
  /** Acumulador de precios para captura pasiva (se persiste fuera de la tx). */
  precios: PrecioCapturado[];
  /** Contexto de negocio para los RegistroPrecio. */
  ciudad: string | null;
  tipoObra: string | null;
  constructoraId: string;
}

/**
 * Persiste en batch los RegistroPrecio acumulados durante la creación/edición.
 * SIEMPRE envuelto en try/catch: un fallo aquí (p.ej. tabla aún no migrada)
 * NUNCA debe romper la creación/edición de la obra. Se ejecuta FUERA de la
 * transacción principal.
 */
async function flushPreciosCapturados(
  precios: PrecioCapturado[],
  proyectoId: string,
  /**
   * Si true (modo EDICIÓN), borra primero los rastros "sugerido" previos de este
   * proyecto antes de reinsertar. Evita que editar la misma obra N veces genere N
   * filas por tarea (spam) y sesgue la mediana del flywheel. En CREACIÓN no hay
   * nada previo, así que se deja en false (insert puro).
   */
  reemplazarSugeridosDelProyecto = false,
): Promise<void> {
  if (precios.length === 0 && !reemplazarSugeridosDelProyecto) return;
  try {
    // Dedupe en edición: una sola "foto" de precios sugeridos por proyecto.
    if (reemplazarSugeridosDelProyecto) {
      await prisma.registroPrecio.deleteMany({
        where: { proyecto_id: proyectoId, fuente: "sugerido" },
      });
    }
    if (precios.length === 0) return;
    await prisma.registroPrecio.createMany({
      data: precios.map((p) => ({ ...p, proyecto_id: p.proyecto_id ?? proyectoId })),
    });
  } catch (err) {
    // No es crítico: el flywheel de precios es telemetría, no parte del flujo.
    console.warn("flushPreciosCapturados falló (no crítico):", err);
  }
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
      const precio = precioValido(t.precio);
      await ctx.tx.tarea.create({
        data: {
          espacio_id: espacio.id,
          fase_id: ctx.faseId,
          numero_registro: generarNumeroTarea(ctx.numeroRegistro, ctx.seq.n),
          nombre: nombreTarea.slice(0, MAX_NOMBRE),
          tiempo_acordado_dias: Math.max(1, Math.round(t.tiempo_acordado_dias || 1)),
          ...(precio != null ? { precio } : {}),
          // Las tareas se asignan al dueño de la cuenta: sus obreros (que cuelgan
          // de él como contratista) las reportan y él mismo las valida.
          asignado_a: ctx.usuarioId,
          estado: "PENDIENTE",
        },
      });

      // Captura pasiva: deja rastro del precio fijado para el flywheel.
      if (precio != null) {
        ctx.precios.push({
          tarea_normalizada: normalizarTarea(nombreTarea),
          ciudad: ctx.ciudad,
          tipo_obra: ctx.tipoObra,
          precio,
          fuente: "sugerido",
          peso: 1,
          constructora_id: ctx.constructoraId,
          proyecto_id: null, // se rellena en el flush con el proyecto creado
        });
      }
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

  // ── Cliente (solo contratista B2C, opcional) ───────────────────────────────
  let clienteId: string | null = null;
  const clienteNombre = input.clienteNombre?.trim();
  if (tipoCuenta === "CONTRATISTA" && clienteNombre) {
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
  const { presupuestoTotal, presupuestoManoObra, presupuestoMateriales } =
    normalizarPresupuesto(input);
  const metrajeTotal = metrajeValido(input.metrajeTotal);

  // Acumulador de precios para captura pasiva (se persiste FUERA de la tx).
  const precios: PrecioCapturado[] = [];

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
            presupuesto_mano_obra: presupuestoManoObra,
            presupuesto_materiales: presupuestoMateriales,
            ...(metrajeTotal != null ? { metraje_total: metrajeTotal } : {}),
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
          precios,
          ciudad,
          tipoObra: input.tipoObra,
          constructoraId,
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

    // Captura pasiva del flywheel de precios (fuera de la tx, no crítica).
    await flushPreciosCapturados(precios, proyecto.id);

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

// ─────────────────────────────────────────────────────────────────────────
// EDICIÓN DE OBRA PERSONAL (B2C)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Forma que devuelve `cargarObraParaEditar`: el contrato `CrearObraInput` (para
 * precargar el wizard) + algunos campos de solo lectura útiles para la UI.
 */
export interface ObraParaEditar extends CrearObraInput {
  proyectoId: string;
  estado: string;
}

/**
 * Carga una obra B2C en la forma de `CrearObraInput` para precargar el wizard de
 * edición. Reconstruye la estructura (pisos/espacios/tareas, o edificio por
 * tipo) desde la jerarquía real Proyecto→Edificio→Piso→Unidad→Espacio→Tarea.
 *
 * Solo se persistieron tareas activas, así que todas vuelven con `activa: true`.
 * Devuelve `null` si la obra no existe o no pertenece a la constructora del
 * usuario (tenant isolation).
 */
export async function cargarObraParaEditar(
  proyectoId: string,
): Promise<ObraParaEditar | null> {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) return null;
  if (!esCuentaPersonal(usuario.constructora.tipo_cuenta)) return null;

  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: usuario.constructora_id },
    include: {
      cliente: { select: { nombre: true } },
      tipos_unidad: { select: { id: true, nombre: true } },
      edificios: {
        orderBy: { created_at: "asc" },
        include: {
          pisos: {
            orderBy: { numero: "asc" },
            include: {
              unidades: {
                orderBy: { nombre: "asc" },
                include: {
                  espacios: {
                    orderBy: { created_at: "asc" },
                    include: { tareas: { orderBy: { created_at: "asc" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!proyecto) return null;

  const tipoObra = (proyecto.tipo_obra as TipoObra) ?? "REFORMA";
  const tipoPropiedad = (proyecto.tipo_propiedad as TipoPropiedad) ?? "CASA";
  const esEdificio = tipoPropiedad === "EDIFICIO";

  const espacioToInput = (esp: {
    nombre: string;
    metraje: number | null;
    tareas: { nombre: string; tiempo_acordado_dias: number; precio: number | null }[];
  }): EspacioInput => ({
    nombre: esp.nombre,
    ...(esp.metraje != null ? { metraje: esp.metraje } : {}),
    tareas: esp.tareas.map((t) => ({
      nombre: t.nombre,
      tiempo_acordado_dias: t.tiempo_acordado_dias,
      ...(t.precio != null ? { precio: t.precio } : {}),
      activa: true,
    })),
  });

  const base = {
    proyectoId: proyecto.id,
    estado: proyecto.estado,
    tipoObra,
    tipoPropiedad,
    nombreObra: proyecto.nombre,
    ...(proyecto.cliente?.nombre ? { clienteNombre: proyecto.cliente.nombre } : {}),
    fechaInicio: proyecto.fecha_inicio?.toISOString().slice(0, 10),
    fechaFin: proyecto.fecha_fin_estimada?.toISOString().slice(0, 10),
    ubicacionLat: proyecto.ubicacion_lat,
    ubicacionLng: proyecto.ubicacion_lng,
    ...(proyecto.ciudad ? { ciudad: proyecto.ciudad } : {}),
    ...(proyecto.presupuesto_total != null ? { presupuestoTotal: proyecto.presupuesto_total } : {}),
    ...(proyecto.presupuesto_mano_obra != null ? { presupuestoManoObra: proyecto.presupuesto_mano_obra } : {}),
    ...(proyecto.presupuesto_materiales != null ? { presupuestoMateriales: proyecto.presupuesto_materiales } : {}),
    // Deriva el modo guardado para precargar el selector del wizard.
    modoPresupuesto: (proyecto.presupuesto_mano_obra != null || proyecto.presupuesto_materiales != null
      ? "separado"
      : proyecto.presupuesto_total != null
        ? "general"
        : "ninguno") as CrearObraInput["modoPresupuesto"],
    ...(proyecto.metraje_total != null ? { metrajeTotal: proyecto.metraje_total } : {}),
  };

  // Raíz: por construcción siempre hay 1 edificio "Mi propiedad".
  const edificioRaiz = proyecto.edificios[0];
  if (!edificioRaiz) {
    // Obra sin estructura (caso defensivo): devuelve base mínima.
    return { ...base, pisos: [] };
  }

  if (esEdificio) {
    // Reconstruye `edificio` por tipo de unidad. Para cada tipo, toma una unidad
    // representativa (la primera con espacios) y deriva los espacios/tareas.
    const repPorTipo = new Map<string, (typeof edificioRaiz.pisos)[0]["unidades"][0]>();
    const conteoPorTipoPrimerPiso = new Map<string, number>();
    const primerPiso = edificioRaiz.pisos[0];
    if (primerPiso) {
      for (const u of primerPiso.unidades) {
        const tid = (u as { tipo_unidad_id?: string | null }).tipo_unidad_id;
        if (tid) conteoPorTipoPrimerPiso.set(tid, (conteoPorTipoPrimerPiso.get(tid) ?? 0) + 1);
      }
    }
    for (const piso of edificioRaiz.pisos) {
      for (const u of piso.unidades) {
        const tid = (u as { tipo_unidad_id?: string | null }).tipo_unidad_id;
        if (!tid || repPorTipo.has(tid)) continue;
        if (u.espacios.length > 0) repPorTipo.set(tid, u);
      }
    }

    const tipos: TipoAptoInput[] = proyecto.tipos_unidad.map((tipo) => {
      const rep = repPorTipo.get(tipo.id);
      return {
        nombre: tipo.nombre,
        cantidadPorPiso: conteoPorTipoPrimerPiso.get(tipo.id) ?? 0,
        espacios: rep ? rep.espacios.map(espacioToInput) : [],
      };
    });

    const aptosPorPiso = primerPiso ? primerPiso.unidades.length : 0;

    return {
      ...base,
      edificio: {
        numPisos: edificioRaiz.num_pisos,
        aptosPorPiso,
        tipos,
      },
    };
  }

  // CASA / LOCAL / APARTAMENTO: cada piso → su (única) unidad → espacios.
  const pisos: PisoInput[] = edificioRaiz.pisos.map((piso, i) => {
    const unidad = piso.unidades[0];
    return {
      numero: i + 1,
      espacios: unidad ? unidad.espacios.map(espacioToInput) : [],
    };
  });

  return { ...base, pisos };
}

/** ¿La tarea tiene historial que prohíbe borrarla en duro? */
function tareaTieneHistorial(t: {
  estado: string;
  fecha_inicio: Date | null;
  fecha_fin_real: Date | null;
  nota_reporte: string | null;
  _count: {
    evidencias: number;
    aprobaciones: number;
    retrasos: number;
    extensiones_tiempo: number;
    reasignaciones: number;
    gastos: number;
  };
  checklist_respuesta: unknown;
  consumo_material: unknown;
}): boolean {
  if (t.estado !== "PENDIENTE") return true;
  if (t.fecha_inicio || t.fecha_fin_real || t.nota_reporte) return true;
  if (t.checklist_respuesta || t.consumo_material) return true;
  const c = t._count;
  return (
    c.evidencias > 0 ||
    c.aprobaciones > 0 ||
    c.retrasos > 0 ||
    c.extensiones_tiempo > 0 ||
    c.reasignaciones > 0 ||
    c.gastos > 0
  );
}

/**
 * Edición TOTAL de una obra personal (B2C): atributos del proyecto + estructura
 * (espacios y tareas). Espeja la seguridad de `crearObraPersonal`:
 *   - cuenta personal (CONTRATISTA/PROPIETARIO)
 *   - rol ADMIN_GENERAL (dueño de la cuenta)
 *   - tenant isolation por `constructora_id`
 * (No exige contraseña: el flujo de creación tampoco la exige; la confirmación
 * por contraseña es del flujo B2B de `/api/proyectos/[id]/editar`.)
 *
 * REGLA CRÍTICA: nunca borra en duro tareas/espacios con historial (reportes,
 * aprobaciones, asignaciones, gastos…). Las tareas quitadas con historial se
 * conservan; sin historial se eliminan. Los cambios estructurales peligrosos
 * (p.ej. cambiar tipo_propiedad sobre estructura con historial) devuelven error.
 */
export async function editarObraPersonal(
  proyectoId: string,
  input: CrearObraInput,
): Promise<CrearObraResult> {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  const tipoCuenta = usuario.constructora.tipo_cuenta;
  if (!esCuentaPersonal(tipoCuenta)) {
    return { ok: false, error: "Este asistente es para cuentas personales." };
  }
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    return { ok: false, error: "No tienes permisos para editar obras." };
  }

  const constructoraId = usuario.constructora_id;

  // ── Validación de entrada (espejo de crearObraPersonal) ───────────────────
  const nombreObra = input.nombreObra?.trim();
  if (!nombreObra || nombreObra.length < 2) {
    return { ok: false, error: "Ponle un nombre a tu obra." };
  }
  if (nombreObra.length > MAX_NOMBRE) {
    return { ok: false, error: "El nombre de la obra es demasiado largo." };
  }

  const esEdificio = input.tipoPropiedad === "EDIFICIO";

  // ── Carga del proyecto con su estructura + historial de cada tarea ────────
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: constructoraId },
    include: {
      cliente: { select: { id: true, nombre: true } },
      edificios: {
        orderBy: { created_at: "asc" },
        include: {
          pisos: {
            orderBy: { numero: "asc" },
            include: {
              unidades: {
                orderBy: { nombre: "asc" },
                include: {
                  espacios: {
                    orderBy: { created_at: "asc" },
                    include: {
                      tareas: {
                        include: {
                          _count: {
                            select: {
                              evidencias: true,
                              aprobaciones: true,
                              retrasos: true,
                              extensiones_tiempo: true,
                              reasignaciones: true,
                              gastos: true,
                            },
                          },
                          checklist_respuesta: { select: { id: true } },
                          consumo_material: { select: { id: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!proyecto) {
    return { ok: false, error: "Obra no encontrada o sin acceso." };
  }

  // ── Guarda: cambio de tipo_propiedad EDIFICIO ↔ no-EDIFICIO ───────────────
  // Pasar de edificio (estructura por tipos × pisos × unidades) a casa/apto (o al
  // revés) implica reconstruir TODA la estructura física, lo que destruiría el
  // historial colgado de las tareas. Es un cambio estructural inseguro: en vez de
  // ejecutar algo peligroso, lo rechazamos con un error claro. (Cambiar entre
  // CASA/APARTAMENTO/LOCAL sí se permite: comparten la misma estructura física.)
  const eraEdificio = proyecto.tipo_propiedad === "EDIFICIO";
  if (eraEdificio !== esEdificio) {
    return {
      ok: false,
      error:
        eraEdificio
          ? "No se puede convertir un edificio en casa o apartamento desde aquí. " +
            "Crea una obra nueva con la estructura que necesitas."
          : "No se puede convertir esta obra en edificio desde aquí. " +
            "Crea una obra nueva de tipo edificio.",
    };
  }

  // ── Atributos de proyecto (siempre actualizables) ─────────────────────────
  const fechaInicio = input.fechaInicio ? new Date(input.fechaInicio) : null;
  const fechaFin = input.fechaFin ? new Date(input.fechaFin) : null;
  const ciudad = input.ciudad?.trim().slice(0, 120) || null;
  const { presupuestoTotal, presupuestoManoObra, presupuestoMateriales } =
    normalizarPresupuesto(input);
  const metrajeTotal = metrajeValido(input.metrajeTotal);

  // Cliente (solo contratista B2C): upsert por nombre.
  let clienteId: string | null = proyecto.cliente?.id ?? null;
  const clienteNombre = input.clienteNombre?.trim();
  if (tipoCuenta === "CONTRATISTA" && clienteNombre) {
    try {
      const cliente = await prisma.cliente.upsert({
        where: { constructora_id_nombre: { constructora_id: constructoraId, nombre: clienteNombre } },
        update: {},
        create: { constructora_id: constructoraId, nombre: clienteNombre },
      });
      clienteId = cliente.id;
    } catch (err) {
      console.error("editarObraPersonal: upsert cliente falló", err);
    }
  }

  const proyectoUpdate = {
    nombre: nombreObra,
    cliente_id: clienteId,
    fecha_inicio: fechaInicio,
    fecha_fin_estimada: fechaFin,
    ubicacion_lat: typeof input.ubicacionLat === "number" ? input.ubicacionLat : null,
    ubicacion_lng: typeof input.ubicacionLng === "number" ? input.ubicacionLng : null,
    tipo_obra: input.tipoObra,
    tipo_propiedad: input.tipoPropiedad,
    ciudad,
    presupuesto_total: presupuestoTotal,
    presupuesto_mano_obra: presupuestoManoObra,
    presupuesto_materiales: presupuestoMateriales,
    metraje_total: metrajeTotal ?? null,
  };

  // Acumulador de precios (captura pasiva, fuera de la tx).
  const precios: PrecioCapturado[] = [];
  // ¿Recalculamos la "foto" de precios de la obra en esta edición? Solo cierto en
  // el camino CASA/APTO/LOCAL (el edificio sale temprano y NO toca precios). Si es
  // false NO debemos borrar los rastros previos, o un edificio editado perdería su
  // snapshot de creación sin reemplazarlo.
  let recomputoPrecios = false;

  // Map: nombre de espacio → su input, por unidad (para emparejar por nombre).
  // Emparejamos tareas por (espacio, nombre) y espacios por nombre.
  const recolectarPreciosDe = (espacios: EspacioInput[]) => {
    for (const esp of espacios) {
      for (const t of esp.tareas ?? []) {
        if (!t.activa) continue;
        const precio = precioValido(t.precio);
        const nombre = t.nombre?.trim();
        if (precio == null || !nombre) continue;
        precios.push({
          tarea_normalizada: normalizarTarea(nombre),
          ciudad,
          tipo_obra: input.tipoObra,
          precio,
          fuente: "sugerido",
          peso: 1,
          constructora_id: constructoraId,
          proyecto_id: proyectoId,
        });
      }
    }
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.proyecto.update({ where: { id: proyectoId }, data: proyectoUpdate });

        // Fase única de la obra (la primera; el modelo exige fase por tarea).
        const fase = await tx.fase.findFirst({
          where: { proyecto_id: proyectoId },
          orderBy: { orden: "asc" },
          select: { id: true },
        });
        if (!fase) throw new Error("SIN_FASE");

        const edificioRaiz = proyecto.edificios[0];
        if (!edificioRaiz) throw new Error("SIN_ESTRUCTURA");

        // Contador global de tareas existentes (para numerar nuevas + tope).
        const tareasExistentes = await tx.tarea.count({
          where: { espacio: { unidad: { piso: { edificio: { proyecto_id: proyectoId } } } } },
        });
        const seq = { n: tareasExistentes };

        if (esEdificio && eraEdificio) {
          // EDIFICIO → EDIFICIO: edición conservadora. Por la complejidad de
          // editar N unidades replicadas por tipo sin romper historial, aquí
          // solo soportamos atributos del proyecto (ya aplicados arriba). Las
          // ediciones estructurales finas de un edificio se hacen en el wizard
          // B2B; aquí no tocamos espacios/tareas para no arriesgar historial.
          // (Cualquier cambio de tareas se ignora de forma segura.)
          return;
        }

        if (!esEdificio && !eraEdificio) {
          // ── CASA / LOCAL / APARTAMENTO: edición total por pisos en orden ──
          const pisosInput = (input.pisos ?? []).slice(0, MAX_PISOS);
          if (pisosInput.length === 0) {
            throw new Error("SIN_PISOS");
          }

          // Unidades existentes en orden de piso (1 unidad por piso por diseño).
          const unidadesExistentes = edificioRaiz.pisos
            .map((p) => ({ piso: p, unidad: p.unidades[0] }))
            .filter((x) => x.unidad);

          for (let i = 0; i < pisosInput.length; i++) {
            const pisoInput = pisosInput[i];
            const existente = unidadesExistentes[i];

            if (!existente) {
              // Piso nuevo: créalo con su unidad y delega en el creador.
              const numero = i + 1;
              const piso = await tx.piso.create({
                data: { edificio_id: edificioRaiz.id, numero },
              });
              const unidad = await tx.unidad.create({
                data: {
                  piso_id: piso.id,
                  nombre: nombrePiso(numero, pisosInput.length, nombreObra),
                },
              });
              const ctx: CrearCtx = {
                tx,
                faseId: fase.id,
                numeroRegistro: proyecto.numero_registro ?? `OB-${proyectoId.slice(0, 6)}`,
                usuarioId: usuario.id,
                seq,
                precios,
                ciudad,
                tipoObra: input.tipoObra,
                constructoraId,
              };
              await crearEspaciosYTareas(ctx, unidad.id, pisoInput.espacios ?? []);
              continue;
            }

            await sincronizarUnidad(tx, {
              unidad: existente.unidad!,
              espaciosInput: (pisoInput.espacios ?? []).slice(0, MAX_ESPACIOS_POR_UNIDAD),
              faseId: fase.id,
              usuarioId: usuario.id,
              numeroRegistro: proyecto.numero_registro ?? `OB-${proyectoId.slice(0, 6)}`,
              seq,
            });
          }

          // Pisos existentes que ya no vienen en el input: solo se borran si NO
          // tienen historial en ninguna de sus tareas (regla crítica).
          for (let i = pisosInput.length; i < unidadesExistentes.length; i++) {
            const { piso, unidad } = unidadesExistentes[i];
            const tieneHist = unidad!.espacios.some((e) =>
              e.tareas.some((t) => tareaTieneHistorial(t)),
            );
            if (tieneHist) continue; // conservar piso con historial
            await tx.piso.delete({ where: { id: piso.id } }); // cascada a unidad/espacios/tareas
          }
        }

        recolectarPreciosDe(extraerEspaciosInput(input));
        recomputoPrecios = true;
      },
      { timeout: 60000 },
    );

    // Edición: reemplaza la "foto" de precios sugeridos del proyecto (anti-spam).
    // Solo cuando recalculamos precios (CASA/APTO/LOCAL): un edificio no toca
    // precios, así que conservamos su snapshot de creación intacto.
    await flushPreciosCapturados(precios, proyectoId, recomputoPrecios);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/proyectos");
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { ok: true, proyectoId };
  } catch (err) {
    if (err instanceof Error && err.message === "MAX_TAREAS") {
      return {
        ok: false,
        error: `La obra genera demasiadas tareas (máximo ${MAX_TAREAS_TOTALES}). Reduce pisos o tareas.`,
      };
    }
    if (err instanceof Error && err.message === "SIN_PISOS") {
      return { ok: false, error: "Arma al menos un piso con un espacio." };
    }
    console.error("editarObraPersonal failed:", err);
    return { ok: false, error: "No pudimos guardar los cambios. Intenta de nuevo." };
  }
}

/** Devuelve todos los EspacioInput del input, sin importar el modo. */
function extraerEspaciosInput(input: CrearObraInput): EspacioInput[] {
  if (input.tipoPropiedad === "EDIFICIO") {
    return (input.edificio?.tipos ?? []).flatMap((t) => t.espacios ?? []);
  }
  return (input.pisos ?? []).flatMap((p) => p.espacios ?? []);
}

interface SyncUnidadArgs {
  unidad: {
    id: string;
    espacios: {
      id: string;
      nombre: string;
      metraje: number | null;
      tareas: {
        id: string;
        nombre: string;
        tiempo_acordado_dias: number;
        precio: number | null;
        estado: string;
        fecha_inicio: Date | null;
        fecha_fin_real: Date | null;
        nota_reporte: string | null;
        checklist_respuesta: unknown;
        consumo_material: unknown;
        _count: {
          evidencias: number;
          aprobaciones: number;
          retrasos: number;
          extensiones_tiempo: number;
          reasignaciones: number;
          gastos: number;
        };
      }[];
    }[];
  };
  espaciosInput: EspacioInput[];
  faseId: string;
  usuarioId: string;
  numeroRegistro: string;
  seq: { n: number };
}

/**
 * Sincroniza los espacios y tareas de UNA unidad contra el input:
 *  - Empareja espacios por nombre → actualiza metraje; crea los nuevos.
 *  - Dentro de cada espacio empareja tareas por nombre → actualiza
 *    tiempo/precio; crea las nuevas; borra las quitadas SOLO si no tienen
 *    historial (regla crítica).
 *  - Espacios quitados: se borran solo si ninguna de sus tareas tiene historial.
 */
async function sincronizarUnidad(
  tx: CrearCtx["tx"],
  args: SyncUnidadArgs,
): Promise<void> {
  const { unidad, espaciosInput, faseId, usuarioId, numeroRegistro, seq } = args;

  const espaciosPorNombre = new Map(unidad.espacios.map((e) => [e.nombre.trim(), e]));
  const nombresInput = new Set<string>();

  for (const espInput of espaciosInput) {
    const nombreEsp = espInput.nombre?.trim();
    if (!nombreEsp) continue;
    nombresInput.add(nombreEsp);
    const metraje = metrajeValido(espInput.metraje);

    const existente = espaciosPorNombre.get(nombreEsp);
    let espacioId: string;
    let tareasExistentes: SyncUnidadArgs["unidad"]["espacios"][0]["tareas"];

    if (existente) {
      espacioId = existente.id;
      tareasExistentes = existente.tareas;
      await tx.espacio.update({
        where: { id: existente.id },
        data: { metraje: metraje ?? null },
      });
    } else {
      const nuevo = await tx.espacio.create({
        data: {
          unidad_id: unidad.id,
          nombre: nombreEsp.slice(0, 100),
          ...(metraje != null ? { metraje } : {}),
        },
      });
      espacioId = nuevo.id;
      tareasExistentes = [];
    }

    // ── Emparejar tareas por nombre dentro del espacio ──────────────────────
    const tareasActivasInput = (espInput.tareas ?? [])
      .filter((t) => t.activa)
      .slice(0, MAX_TAREAS_POR_ESPACIO);
    const tareasPorNombre = new Map(tareasExistentes.map((t) => [t.nombre.trim(), t]));
    const nombresTareaInput = new Set<string>();

    for (const t of tareasActivasInput) {
      const nombreTarea = t.nombre?.trim();
      if (!nombreTarea) continue;
      nombresTareaInput.add(nombreTarea);
      const precio = precioValido(t.precio);
      const dias = Math.max(1, Math.round(t.tiempo_acordado_dias || 1));
      const existenteT = tareasPorNombre.get(nombreTarea);
      if (existenteT) {
        await tx.tarea.update({
          where: { id: existenteT.id },
          data: { tiempo_acordado_dias: dias, precio: precio ?? null },
        });
      } else {
        if (seq.n >= MAX_TAREAS_TOTALES) throw new Error("MAX_TAREAS");
        seq.n++;
        await tx.tarea.create({
          data: {
            espacio_id: espacioId,
            fase_id: faseId,
            numero_registro: generarNumeroTarea(numeroRegistro, seq.n),
            nombre: nombreTarea.slice(0, MAX_NOMBRE),
            tiempo_acordado_dias: dias,
            ...(precio != null ? { precio } : {}),
            asignado_a: usuarioId,
            estado: "PENDIENTE",
          },
        });
      }
    }

    // Tareas quitadas: borrar solo si no tienen historial.
    for (const tEx of tareasExistentes) {
      if (nombresTareaInput.has(tEx.nombre.trim())) continue;
      if (tareaTieneHistorial(tEx)) continue;
      await tx.tarea.delete({ where: { id: tEx.id } });
    }
  }

  // Espacios quitados: borrar solo si ninguna tarea tiene historial.
  for (const esp of unidad.espacios) {
    if (nombresInput.has(esp.nombre.trim())) continue;
    const tieneHist = esp.tareas.some((t) => tareaTieneHistorial(t));
    if (tieneHist) continue;
    await tx.espacio.delete({ where: { id: esp.id } }); // cascada a sus tareas
  }
}
