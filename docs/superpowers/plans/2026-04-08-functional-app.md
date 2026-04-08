# ObraControl — App Funcional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer la app funcional end-to-end: un usuario entra, ve proyectos con datos, ve tareas, las puede reportar, aprobar, y el dashboard refleja todo en tiempo real.

**Architecture:** Server Components para las páginas, Client Components solo para botones interactivos (reportar/aprobar). Datos via funciones en `src/lib/data.ts`. API routes existentes para mutaciones.

**Tech Stack:** Next.js 16 (App Router), Prisma 7, Supabase Auth, TypeScript

---

## Inventario del estado actual

### Ya existe y funciona:
- API routes: `POST /api/tareas/[id]/reportar`, `POST /api/tareas/[id]/aprobar`, `GET/POST /api/proyectos`, `GET/POST /api/edificios`, `GET/POST /api/tareas`
- Data functions: `getUsuarioActual`, `getDashboardStats`, `getProyectosConProgreso`, `getTareasRecientes`, `getTopContratistas`, `getContratistas`, `getTareasFiltradas`
- Scoring: `calcularSemaforo`, `calcularProgreso`, `recalcularScoreContratista`
- Dashboard pages (read-only, server components): dashboard, proyectos, tareas, contratistas
- Onboarding: `provisionarUsuario` crea demo data para nuevos registros
- Auth: login, registro, Google OAuth, logout, middleware

### No existe (causa que la app "no haga nada"):
1. **No hay `Usuario` en Prisma para cuentas existentes** → dashboard vacío/redirect
2. **No hay `/dashboard/proyectos/[id]`** → click en proyecto = 404
3. **No hay `/dashboard/tareas/[id]`** → click en tarea = 404
4. **No hay botones de acción** → no se puede reportar ni aprobar tareas
5. **TaskRow no es clickeable** → no enlaza a la tarea
6. **Score no se recalcula tras aprobar** → scoring.ts existe pero nadie lo llama tras aprobar

---

## File Map

### Archivos a CREAR:
| File | Responsibility |
|------|---------------|
| `src/scripts/provision-user.ts` | Script CLI para provisionar un usuario existente en Supabase con datos demo en Prisma |
| `src/lib/data-detail.ts` | Funciones para obtener detalle de proyecto y tarea |
| `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx` | Página de detalle de proyecto (estructura edificio → piso → unidad → tareas) |
| `src/app/(dashboard)/dashboard/tareas/[id]/page.tsx` | Página de detalle de tarea (info + evidencias + historial + acciones) |
| `src/components/dashboard/ReportarButton.tsx` | Client component: botón para reportar tarea (PENDIENTE → REPORTADA) |
| `src/components/dashboard/AprobarButtons.tsx` | Client component: botones aprobar/no aprobar (REPORTADA → APROBADA/NO_APROBADA) |

### Archivos a MODIFICAR:
| File | Change |
|------|--------|
| `src/components/dashboard/TaskRow.tsx` | Envolver en `<Link>` hacia `/dashboard/tareas/[id]` |
| `src/app/api/tareas/[id]/aprobar/route.ts` | Llamar `recalcularScoreContratista` después de aprobar |
| `src/app/(dashboard)/dashboard/contratistas/page.tsx` | Quitar redirect si no hay datos, mostrar estado vacío |
| `src/app/(dashboard)/dashboard/reportes/page.tsx` | Quitar redirect si no hay datos, mantener como placeholder |

---

## Task 1: Provisionar usuario existente

**Files:**
- Create: `src/scripts/provision-user.ts`

Este script permite provisionar cualquier email que ya exista en Supabase Auth pero no tenga datos en Prisma.

- [ ] **Step 1: Crear el script de provisioning**

```typescript
// src/scripts/provision-user.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMAIL = process.argv[2];
const NOMBRE = process.argv[3] ?? "Admin Demo";
const EMPRESA = process.argv[4] ?? "Mi Constructora";

if (!EMAIL) {
  console.error("Uso: npx tsx src/scripts/provision-user.ts <email> [nombre] [empresa]");
  process.exit(1);
}

async function main() {
  const existing = await prisma.usuario.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`✓ El usuario ${EMAIL} ya existe en Prisma (constructora_id: ${existing.constructora_id})`);
    return;
  }

  console.log(`Provisionando ${EMAIL}...`);

  const constructora = await prisma.constructora.create({
    data: { nombre: EMPRESA, nit: `demo-${Date.now()}`, plan_suscripcion: "PROYECTO" },
  });

  const admin = await prisma.usuario.create({
    data: { email: EMAIL, nombre: NOMBRE, constructora_id: constructora.id, rol: "ADMIN" },
  });

  const uid = constructora.id.slice(0, 8);

  const c1 = await prisma.usuario.create({
    data: { email: `carlos.rincon.${uid}@demo.co`, nombre: "Carlos Rincón", constructora_id: constructora.id, rol: "CONTRATISTA_INSTALADOR" },
  });
  const c2 = await prisma.usuario.create({
    data: { email: `mauricio.soto.${uid}@demo.co`, nombre: "Mauricio Soto", constructora_id: constructora.id, rol: "CONTRATISTA_LUSTRADOR" },
  });

  await prisma.contratista.create({
    data: { usuario_id: c1.id, score_cumplimiento: 92, score_calidad: 88, score_velocidad_correccion: 90, score_total: 91 },
  });
  await prisma.contratista.create({
    data: { usuario_id: c2.id, score_cumplimiento: 70, score_calidad: 80, score_velocidad_correccion: 72, score_total: 74 },
  });

  const proyecto = await prisma.proyecto.create({
    data: {
      constructora_id: constructora.id, nombre: "Proyecto Olivo", subtipo: "APARTAMENTOS",
      dias_habiles_semana: 5, fecha_inicio: new Date("2026-01-15"),
      fecha_fin_estimada: new Date("2026-12-15"), estado: "ACTIVO",
    },
  });

  const faseMadera = await prisma.fase.create({ data: { proyecto_id: proyecto.id, nombre: "Madera", orden: 1 } });
  const faseOB = await prisma.fase.create({ data: { proyecto_id: proyecto.id, nombre: "Obra Blanca", orden: 2 } });

  const tipo1 = await prisma.tipoUnidad.create({ data: { proyecto_id: proyecto.id, nombre: "Tipo 1 — 3 hab" } });
  const tipo2 = await prisma.tipoUnidad.create({ data: { proyecto_id: proyecto.id, nombre: "Tipo 2 — 2 hab" } });

  const torre = await prisma.edificio.create({ data: { proyecto_id: proyecto.id, nombre: "Torre 5", num_pisos: 4 } });

  const piezas = [
    { espacio: "Cocina", nombre: "Mueble bajo cocina", codigo: "MBK01", marca: "SAGANO", comp: "estructura + naves", tiempo: 3, asignado: c1.id, fase: faseMadera.id },
    { espacio: "Cocina", nombre: "Mueble alto cocina", codigo: "MBC01", marca: "SAGANO", comp: "estructura + puertas", tiempo: 3, asignado: c1.id, fase: faseMadera.id },
    { espacio: "Baño principal", nombre: "Mueble lavamanos", codigo: "PUM01", marca: "AUSTRAL", comp: "estructura + puerta", tiempo: 2, asignado: c1.id, fase: faseMadera.id },
    { espacio: "Habitación principal", nombre: "Closet tipo 1", codigo: "CLP01", marca: "GRAFFO", comp: "estructura + correderas", tiempo: 4, asignado: c1.id, fase: faseMadera.id },
    { espacio: "Habitación 2", nombre: "Closet tipo 2", codigo: "CLP02", marca: "GRAFFO", comp: "estructura + correderas", tiempo: 3, asignado: c2.id, fase: faseMadera.id },
    { espacio: "Sala-comedor", nombre: "Estuco paredes", codigo: null, marca: null, comp: null, tiempo: 2, asignado: c2.id, fase: faseOB.id },
    { espacio: "Sala-comedor", nombre: "Pintura base", codigo: null, marca: null, comp: null, tiempo: 1, asignado: c2.id, fase: faseOB.id },
    { espacio: "Sala-comedor", nombre: "Pintura final", codigo: null, marca: null, comp: null, tiempo: 1, asignado: c2.id, fase: faseOB.id },
    { espacio: "Cocina", nombre: "Estuco cocina", codigo: null, marca: null, comp: null, tiempo: 1, asignado: c2.id, fase: faseOB.id },
    { espacio: "Cocina", nombre: "Pintura cocina", codigo: null, marca: null, comp: null, tiempo: 1, asignado: c2.id, fase: faseOB.id },
  ];

  const estados: ("APROBADA" | "REPORTADA" | "PENDIENTE" | "NO_APROBADA")[] = [
    "APROBADA", "APROBADA", "REPORTADA", "PENDIENTE", "NO_APROBADA",
    "APROBADA", "REPORTADA", "APROBADA", "PENDIENTE", "NO_APROBADA",
    "REPORTADA", "APROBADA", "PENDIENTE", "REPORTADA", "APROBADA", "APROBADA",
  ];

  let idx = 0;
  for (let p = 1; p <= 4; p++) {
    const piso = await prisma.piso.create({ data: { edificio_id: torre.id, numero: p } });
    for (let u = 1; u <= 4; u++) {
      const estado = estados[idx % estados.length];
      idx++;
      const unidad = await prisma.unidad.create({
        data: { piso_id: piso.id, nombre: `${p}0${u}`, tipo_unidad_id: u <= 2 ? tipo1.id : tipo2.id },
      });
      for (const pieza of piezas) {
        const espacio = await prisma.espacio.create({
          data: { unidad_id: unidad.id, nombre: pieza.espacio, metraje: 15 },
        });
        await prisma.tarea.create({
          data: {
            espacio_id: espacio.id, fase_id: pieza.fase, nombre: pieza.nombre,
            codigo_referencia: pieza.codigo, marca_linea: pieza.marca,
            componentes: pieza.comp, tiempo_acordado_dias: pieza.tiempo,
            asignado_a: pieza.asignado, estado,
            fecha_inicio: estado !== "PENDIENTE" ? new Date("2026-03-01") : null,
            fecha_fin_real: estado === "APROBADA" ? new Date("2026-03-05") : null,
          },
        });
      }
    }
  }

  console.log(`✓ Provisionado: constructora="${EMPRESA}", proyecto="Olivo", 4 pisos × 4 aptos × 10 tareas = 160 tareas`);
  console.log(`  Admin: ${EMAIL}`);
  console.log(`  Contratistas: Carlos Rincón (91pts), Mauricio Soto (74pts)`);
}

main().catch(console.error).finally(() => pool.end());
```

- [ ] **Step 2: Ejecutar el script para provisionar a Victor**

```bash
cd "/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol"
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/scripts/provision-user.ts vjrp92@gmail.com "Victor Ramos" "ObraControl Demo"
```

Expected: `✓ Provisionado: constructora="ObraControl Demo"...`

- [ ] **Step 3: Verificar en local que el dashboard carga datos**

```bash
npm run dev
```

Abrir http://localhost:3001/dashboard — debe mostrar stats, proyecto Olivo, tareas recientes y contratistas.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/provision-user.ts
git commit -m "feat: script para provisionar usuarios existentes con datos demo"
```

---

## Task 2: Hacer TaskRow clickeable

**Files:**
- Modify: `src/components/dashboard/TaskRow.tsx`

- [ ] **Step 1: Agregar prop `id` y envolver en Link**

Modificar `TaskRowProps` para incluir `id?: string`. Envolver el `<div>` principal en `<Link href={"/dashboard/tareas/" + id}>` cuando `id` existe.

```tsx
// Agregar import
import Link from "next/link";

// Agregar a interface
interface TaskRowProps {
  id?: string;  // <-- NUEVO
  name: string;
  // ... resto igual
}

// Cambiar el wrapper div:
const content = (
  <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50/80 transition-colors cursor-pointer rounded-lg group">
    {/* ... contenido existente sin cambios ... */}
  </div>
);

if (id) {
  return <Link href={`/dashboard/tareas/${id}`}>{content}</Link>;
}
return content;
```

- [ ] **Step 2: Pasar `id` desde las páginas que usan TaskRow**

En `src/app/(dashboard)/dashboard/page.tsx`, donde se renderiza `<TaskRow>`, agregar `id={t.id}`.

En `src/app/(dashboard)/dashboard/tareas/page.tsx`, agregar `id={t.id}`.

- [ ] **Step 3: Verificar navegación**

Abrir dashboard, click en una tarea de "Actividad reciente" → debe navegar a `/dashboard/tareas/[id]` (que por ahora dará 404 — lo creamos en Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/TaskRow.tsx src/app/\(dashboard\)/dashboard/page.tsx src/app/\(dashboard\)/dashboard/tareas/page.tsx
git commit -m "feat: hacer tareas clickeables con enlace al detalle"
```

---

## Task 3: Data functions para detalle

**Files:**
- Create: `src/lib/data-detail.ts`

- [ ] **Step 1: Crear funciones de detalle**

```typescript
// src/lib/data-detail.ts
import { prisma } from "@/lib/prisma";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";

export async function getProyectoDetalle(proyectoId: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      fases: { orderBy: { orden: "asc" } },
      edificios: {
        orderBy: { nombre: "asc" },
        include: {
          pisos: {
            orderBy: { numero: "asc" },
            include: {
              unidades: {
                orderBy: { nombre: "asc" },
                include: {
                  tipo_unidad: true,
                  espacios: {
                    include: {
                      tareas: {
                        include: {
                          asignado_usuario: { select: { id: true, nombre: true } },
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
  if (!proyecto) return null;

  const todasTareas = proyecto.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
  );
  const progreso = calcularProgreso(todasTareas);

  return { ...proyecto, progreso, totalTareas: todasTareas.length };
}

export async function getTareaDetalle(tareaId: string) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      fase: true,
      asignado_usuario: { select: { id: true, nombre: true, rol: true, contratista_perfil: { select: { id: true } } } },
      evidencias: { orderBy: { created_at: "desc" } },
      aprobaciones: { orderBy: { fecha: "desc" }, include: { aprobador: { select: { nombre: true } } } },
      retrasos: { orderBy: { created_at: "desc" } },
      checklist_respuesta: true,
    },
  });
  if (!tarea) return null;

  const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;
  const inicio = tarea.fecha_inicio ?? tarea.created_at;
  const ahora = new Date();
  const diasTranscurridos = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
  const semaforo = calcularSemaforo(tarea.tiempo_acordado_dias, diasTranscurridos, tarea.estado === "APROBADA");
  const diasRestantes = tarea.tiempo_acordado_dias - diasTranscurridos;

  return {
    ...tarea,
    proyecto,
    ubicacion: `${tarea.espacio.unidad.piso.edificio.nombre} · Piso ${tarea.espacio.unidad.piso.numero} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`,
    semaforo,
    diasTranscurridos,
    diasRestantes,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-detail.ts
git commit -m "feat: funciones de detalle para proyecto y tarea"
```

---

## Task 4: Página de detalle de tarea + botones de acción

**Files:**
- Create: `src/app/(dashboard)/dashboard/tareas/[id]/page.tsx`
- Create: `src/components/dashboard/ReportarButton.tsx`
- Create: `src/components/dashboard/AprobarButtons.tsx`

- [ ] **Step 1: Crear ReportarButton (client component)**

```tsx
// src/components/dashboard/ReportarButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";

export default function ReportarButton({ tareaId }: { tareaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReportar() {
    setLoading(true);
    const res = await fetch(`/api/tareas/${tareaId}/reportar`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al reportar");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleReportar}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
    >
      <Send className="w-4 h-4" />
      {loading ? "Reportando..." : "Reportar como terminada"}
    </button>
  );
}
```

- [ ] **Step 2: Crear AprobarButtons (client component)**

```tsx
// src/components/dashboard/AprobarButtons.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function AprobarButtons({ tareaId }: { tareaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"aprobar" | "rechazar" | null>(null);
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [justificacion, setJustificacion] = useState("");

  async function handleAprobar() {
    setLoading("aprobar");
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "APROBADA" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al aprobar");
    }
    setLoading(null);
  }

  async function handleNoAprobar() {
    if (!showJustificacion) {
      setShowJustificacion(true);
      return;
    }
    setLoading("rechazar");
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "NO_APROBADA",
        justificacion_por_item: { motivo: justificacion || "Sin justificación" },
      }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error");
    }
    setLoading(null);
    setShowJustificacion(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleAprobar}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {loading === "aprobar" ? "Aprobando..." : "Aprobar"}
        </button>
        <button
          onClick={handleNoAprobar}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          {loading === "rechazar" ? "Enviando..." : "No aprobar"}
        </button>
      </div>
      {showJustificacion && (
        <textarea
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          placeholder="Justificación (por qué no se aprueba)..."
          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
          rows={3}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crear página de detalle de tarea**

```tsx
// src/app/(dashboard)/dashboard/tareas/[id]/page.tsx
// Server component que muestra toda la info de la tarea + botones de acción
// Usa getTareaDetalle de data-detail.ts
// Muestra: info general, ubicación, semáforo, estado, historial de aprobaciones
// Botón condicional: ReportarButton si estado PENDIENTE/NO_APROBADA, AprobarButtons si REPORTADA
```

Full implementation: ~120 líneas. Server component con la info y los botones client.

- [ ] **Step 4: Verificar flujo completo**

1. Abrir `/dashboard/tareas` → click en una tarea PENDIENTE
2. Ver la página de detalle con info y botón "Reportar como terminada"
3. Click "Reportar" → estado cambia a REPORTADA → botón desaparece, aparecen Aprobar/No aprobar
4. Click "Aprobar" → estado cambia a APROBADA → la tarea se muestra como completada

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ReportarButton.tsx src/components/dashboard/AprobarButtons.tsx src/app/\(dashboard\)/dashboard/tareas/\[id\]/page.tsx
git commit -m "feat: página detalle de tarea con flujo reportar/aprobar"
```

---

## Task 5: Recalcular score tras aprobar

**Files:**
- Modify: `src/app/api/tareas/[id]/aprobar/route.ts`

- [ ] **Step 1: Importar y llamar recalcularScoreContratista**

Después de la transacción que crea la aprobación y actualiza la tarea, buscar si la tarea tiene un contratista asignado y recalcular su score:

```typescript
// Agregar import al inicio:
import { recalcularScoreContratista } from "@/lib/scoring";

// Después de la transacción, antes del return:
if (tareaActualizada.asignado_a) {
  const contratista = await prisma.contratista.findUnique({
    where: { usuario_id: tareaActualizada.asignado_a },
  });
  if (contratista) {
    await recalcularScoreContratista(contratista.id);
  }
}
```

- [ ] **Step 2: Verificar**

Aprobar una tarea asignada a Carlos Rincón → verificar que su score cambió en `/dashboard/contratistas`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tareas/\[id\]/aprobar/route.ts
git commit -m "feat: recalcular score del contratista al aprobar tarea"
```

---

## Task 6: Página de detalle de proyecto

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

Server component que muestra:
- Header con nombre del proyecto, semáforo, progreso general
- Listado de edificios → pisos → unidades con conteo de tareas por estado
- Click en una unidad muestra sus tareas (expandible o navegación)
- Usa `getProyectoDetalle` de data-detail.ts

La página muestra la estructura del edificio como una grilla visual donde cada celda es una unidad/apartamento con su color de semáforo.

- [ ] **Step 2: Verificar**

Abrir `/dashboard/proyectos` → click en "Proyecto Olivo" → ver la página con Torre 5, 4 pisos × 4 aptos, con colores de semáforo por unidad.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/\[id\]/page.tsx
git commit -m "feat: página detalle de proyecto con estructura de edificio"
```

---

## Task 7: Push y verificar en Vercel

- [ ] **Step 1: Push todos los cambios**

```bash
git push origin main
```

Vercel auto-deploya. Esperar ~2 minutos.

- [ ] **Step 2: Provisionar cuenta de Victor en producción**

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/scripts/provision-user.ts vjrp92@gmail.com "Victor Ramos" "ObraControl Demo"
```

(Esto corre contra la DB de Supabase directamente via DIRECT_URL)

- [ ] **Step 3: Verificar ciclo completo en Vercel**

1. Ir a `https://obracontrol-sigma.vercel.app/login` → login con vjrp92@gmail.com
2. Dashboard muestra stats reales (160 tareas, Proyecto Olivo, contratistas)
3. Click "Proyectos" → ver Proyecto Olivo → click → ver estructura de Torre 5
4. Click "Tareas" → filtrar por PENDIENTE → click en una → ver detalle
5. Click "Reportar como terminada" → estado cambia a REPORTADA
6. Volver a tareas → filtrar REPORTADA → click → ver detalle
7. Click "Aprobar" → estado cambia a APROBADA
8. Ir a dashboard → stats actualizados

---

## Resumen de entregables

| # | Qué | Resultado |
|---|-----|-----------|
| 1 | Script provisioning | Victor puede entrar al dashboard con datos |
| 2 | TaskRow clickeable | Click en tarea navega al detalle |
| 3 | Data functions | Consultas para detalle de proyecto y tarea |
| 4 | Detalle tarea + acciones | Reportar/Aprobar funcional |
| 5 | Score auto-recalcula | Aprobar → score contratista se actualiza |
| 6 | Detalle proyecto | Estructura visual edificio → pisos → aptos |
| 7 | Deploy + verificación | Todo funciona en producción |
