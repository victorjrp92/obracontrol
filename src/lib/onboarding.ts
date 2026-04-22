import { prisma } from "@/lib/prisma";
import { TASK_TEMPLATES } from "@/lib/task-templates";

/**
 * Provisiona una nueva constructora con usuario admin y datos demo realistas.
 * Es idempotente — si el usuario ya existe, no hace nada.
 */
export async function provisionarUsuario(
  email: string,
  nombre: string,
  empresa: string,
  empresaData?: {
    nit?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    sitio_web?: string;
  }
): Promise<void> {
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) return;

  // ── Constructora ──────────────────────────────────────────────────────────
  const constructora = await prisma.constructora.create({
    data: {
      nombre: empresa,
      nit: empresaData?.nit ?? null,
      direccion: empresaData?.direccion ?? null,
      ciudad: empresaData?.ciudad ?? null,
      telefono: empresaData?.telefono ?? null,
      sitio_web: empresaData?.sitio_web ?? null,
      plan_suscripcion: "PROYECTO",
    },
  });

  // ── Default roles for this constructora ────────────────────────────────────
  const defaultRoles = [
    { nombre: "Gerente", nivel_acceso: "DIRECTIVO" as const, es_default: true },
    { nombre: "Director de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
    { nombre: "Administrador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Administrador Proyectos", nivel_acceso: "ADMIN_PROYECTO" as const, es_default: true },
    { nombre: "Coordinador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Asistente", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
    { nombre: "Contratista lustrador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
    { nombre: "Auxiliar de obra", nivel_acceso: "OBRERO" as const, es_default: true },
  ];

  const rolesCreados: Record<string, string> = {};
  for (const rolDef of defaultRoles) {
    const rol = await prisma.rol.upsert({
      where: {
        constructora_id_nombre: {
          constructora_id: constructora.id,
          nombre: rolDef.nombre,
        },
      },
      update: {},
      create: {
        constructora_id: constructora.id,
        nombre: rolDef.nombre,
        nivel_acceso: rolDef.nivel_acceso,
        es_default: rolDef.es_default,
      },
    });
    rolesCreados[rolDef.nombre] = rol.id;
  }

  // ── Admin (el usuario que se registró) ────────────────────────────────────
  await prisma.usuario.create({
    data: {
      email,
      nombre,
      constructora_id: constructora.id,
      rol_id: rolesCreados["Administrador"],
    },
  });

  // ── Contratistas demo ─────────────────────────────────────────────────────
  const uid = constructora.id.slice(0, 8);

  const c1 = await prisma.usuario.create({
    data: {
      email: `carlos.rincon.${uid}@demo.co`,
      nombre: "Carlos Rincón",
      constructora_id: constructora.id,
      rol_id: rolesCreados["Contratista instalador"],
    },
  });

  const c2 = await prisma.usuario.create({
    data: {
      email: `mauricio.soto.${uid}@demo.co`,
      nombre: "Mauricio Soto",
      constructora_id: constructora.id,
      rol_id: rolesCreados["Contratista lustrador"],
    },
  });

  await prisma.contratista.create({
    data: {
      usuario_id: c1.id,
      score_cumplimiento: 92,
      score_calidad: 88,
      score_velocidad_correccion: 90,
      score_total: 91,
    },
  });

  await prisma.contratista.create({
    data: {
      usuario_id: c2.id,
      score_cumplimiento: 70,
      score_calidad: 80,
      score_velocidad_correccion: 72,
      score_total: 74,
    },
  });

  // ── Obrero demo ───────────────────────────────────────────────────────────
  await prisma.obrero.create({
    data: {
      nombre: "Diego Muñoz",
      contratista_id: c1.id,
      constructora_id: constructora.id,
      fecha_inicio: new Date(),
      fecha_expiracion: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      activo: true,
    },
  });

  // ── Proyecto ──────────────────────────────────────────────────────────────
  const proyecto = await prisma.proyecto.create({
    data: {
      constructora_id: constructora.id,
      nombre: "Proyecto Olivo",
      subtipo: "APARTAMENTOS",
      dias_habiles_semana: 5,
      checklists_habilitados: false,
      fecha_inicio: new Date("2026-01-15"),
      fecha_fin_estimada: new Date("2026-12-15"),
      estado: "ACTIVO",
    },
  });

  const tipo1 = await prisma.tipoUnidad.create({
    data: { proyecto_id: proyecto.id, nombre: "Tipo 1 — 3 habitaciones" },
  });
  const tipo2 = await prisma.tipoUnidad.create({
    data: { proyecto_id: proyecto.id, nombre: "Tipo 2 — 2 habitaciones" },
  });

  const faseMadera = await prisma.fase.create({
    data: { proyecto_id: proyecto.id, nombre: "Madera", orden: 1 },
  });
  const faseObraBlanca = await prisma.fase.create({
    data: { proyecto_id: proyecto.id, nombre: "Obra Blanca", orden: 2 },
  });

  const torre = await prisma.edificio.create({
    data: { proyecto_id: proyecto.id, nombre: "Torre 5", num_pisos: 3 },
  });

  // ── Tareas template ───────────────────────────────────────────────────────
  const piezasMadera = [
    { espacio: "Cocina", nombre: "Mueble bajo cocina", codigo: "MBK01", marca: "SAGANO", componentes: "estructura + naves", tiempo: 3, asignado: c1.id },
    { espacio: "Cocina", nombre: "Mueble alto cocina", codigo: "MBC01", marca: "SAGANO", componentes: "estructura + puertas", tiempo: 3, asignado: c1.id },
    { espacio: "Baño principal", nombre: "Mueble flotante lavamanos", codigo: "PUM01", marca: "AUSTRAL", componentes: "estructura + puerta", tiempo: 2, asignado: c1.id },
    { espacio: "Habitación principal", nombre: "Closet tipo 1", codigo: "CLP01", marca: "GRAFFO", componentes: "estructura + correderas", tiempo: 4, asignado: c1.id },
    { espacio: "Habitación 2", nombre: "Closet tipo 2", codigo: "CLP02", marca: "GRAFFO", componentes: "estructura + correderas", tiempo: 3, asignado: c2.id },
  ];

  const tareasObraBlanca = [
    { espacio: "Sala-comedor", nombre: "Estuco paredes sala", tiempo: 2, asignado: c2.id },
    { espacio: "Sala-comedor", nombre: "Pintura base sala", tiempo: 1, asignado: c2.id },
    { espacio: "Sala-comedor", nombre: "Pintura final sala", tiempo: 1, asignado: c2.id },
    { espacio: "Cocina", nombre: "Estuco paredes cocina", tiempo: 1, asignado: c2.id },
    { espacio: "Cocina", nombre: "Pintura cocina", tiempo: 1, asignado: c2.id },
  ];

  // Variedad de estados y fechas para que el demo se vea real
  const estadosCiclo: ("APROBADA" | "REPORTADA" | "PENDIENTE" | "NO_APROBADA")[] = [
    "APROBADA", "APROBADA", "REPORTADA", "PENDIENTE", "NO_APROBADA",
    "APROBADA", "REPORTADA", "APROBADA", "PENDIENTE", "NO_APROBADA",
    "REPORTADA", "APROBADA",
  ];

  const fechaInicioMadera = new Date("2026-03-01");
  const fechaFinMadera = new Date("2026-03-05");
  const fechaInicioOB = new Date("2026-02-15");
  const fechaFinOB = new Date("2026-02-18");

  let aptoIdx = 0;

  for (let p = 1; p <= 3; p++) {
    const piso = await prisma.piso.create({
      data: { edificio_id: torre.id, numero: p },
    });

    for (let u = 1; u <= 4; u++) {
      const tipoUnidad = u <= 2 ? tipo1 : tipo2;
      const estadoBase = estadosCiclo[aptoIdx % estadosCiclo.length];
      aptoIdx++;

      const unidad = await prisma.unidad.create({
        data: {
          piso_id: piso.id,
          nombre: `${p}0${u}`,
          tipo_unidad_id: tipoUnidad.id,
        },
      });

      for (const pieza of piezasMadera) {
        const espacio = await prisma.espacio.create({
          data: { unidad_id: unidad.id, nombre: pieza.espacio, metraje: 12 },
        });
        await prisma.tarea.create({
          data: {
            espacio_id: espacio.id,
            fase_id: faseMadera.id,
            nombre: pieza.nombre,
            codigo_referencia: pieza.codigo,
            marca_linea: pieza.marca,
            componentes: pieza.componentes,
            tiempo_acordado_dias: pieza.tiempo,
            asignado_a: pieza.asignado,
            estado: estadoBase,
            fecha_inicio: estadoBase !== "PENDIENTE" ? fechaInicioMadera : null,
            fecha_fin_real: estadoBase === "APROBADA" ? fechaFinMadera : null,
          },
        });
      }

      for (const t of tareasObraBlanca) {
        const espacio = await prisma.espacio.create({
          data: { unidad_id: unidad.id, nombre: t.espacio, metraje: 20 },
        });
        await prisma.tarea.create({
          data: {
            espacio_id: espacio.id,
            fase_id: faseObraBlanca.id,
            nombre: t.nombre,
            tiempo_acordado_dias: t.tiempo,
            asignado_a: t.asignado,
            estado: estadoBase,
            fecha_inicio: estadoBase !== "PENDIENTE" ? fechaInicioOB : null,
            fecha_fin_real: estadoBase === "APROBADA" ? fechaFinOB : null,
          },
        });
      }
    }
  }

  // ── Zonas Comunes ─────────────────────────────────────────────────────────
  const faseZonasComunes = await prisma.fase.create({
    data: { proyecto_id: proyecto.id, nombre: "Zonas Comunes", orden: 3 },
  });

  const edificioZonasComunes = await prisma.edificio.create({
    data: {
      proyecto_id: proyecto.id,
      nombre: "Zonas Comunes",
      num_pisos: 1,
      es_zona_comun: true,
    },
  });

  const pisoZC = await prisma.piso.create({
    data: { edificio_id: edificioZonasComunes.id, numero: 1 },
  });

  const zonasComunes = ["Lobby", "Piscina"] as const;
  for (const zonaName of zonasComunes) {
    const unidad = await prisma.unidad.create({
      data: { piso_id: pisoZC.id, nombre: zonaName },
    });

    const tareasZona = TASK_TEMPLATES["Zonas Comunes"]?.[zonaName] ?? [];
    for (const tpl of tareasZona) {
      const espacio = await prisma.espacio.create({
        data: { unidad_id: unidad.id, nombre: zonaName, metraje: 50 },
      });
      await prisma.tarea.create({
        data: {
          espacio_id: espacio.id,
          fase_id: faseZonasComunes.id,
          nombre: tpl.nombre,
          codigo_referencia: tpl.codigo_referencia,
          marca_linea: tpl.marca_linea,
          componentes: tpl.componentes,
          tiempo_acordado_dias: tpl.tiempo_acordado_dias,
          asignado_a: c2.id,
          estado: "PENDIENTE",
        },
      });
    }
  }
}
