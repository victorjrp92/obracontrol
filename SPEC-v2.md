# SPEC v2 — ObraControl Mejoras

## Cambio 1: Renombrar "Admin Proyecto" → "Administrador Proyectos"

**Contexto:** El enum `ADMIN_PROYECTO` en la DB se mantiene igual. Solo cambian los labels visibles en UI.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/dashboard/RolesManager.tsx` | `NIVEL_LABELS.ADMIN_PROYECTO` → `"Administrador Proyectos"` |
| `src/lib/permissions.ts` | `getRolLabel` case para ADMIN_PROYECTO → `"Administrador Proyectos"` |
| `src/lib/onboarding.ts` | Nombre del rol default → `"Administrador Proyectos"` |
| `src/components/dashboard/InviteUserModal.tsx` | Si hay texto hardcoded del nombre |

### Sin cambios en DB
El valor del enum `ADMIN_PROYECTO` en `NivelAcceso` no cambia. Es un rename puramente visual.

---

## Cambio 2: Días opcionales por fase y tarea + nueva tabla de tareas

### 2A — Schema: nuevo campo en Fase

```prisma
model Fase {
  ...
  tiempo_estimado_dias  Int?   // Días estimados para completar la fase
}
```

**Migración:** `ALTER TABLE "Fase" ADD COLUMN "tiempo_estimado_dias" INTEGER;`

`Tarea.tiempo_acordado_dias` ya existe (Int, no nullable, default en wizard = 3).

### 2B — Auto-cálculo si no se llenan los días

Cuando el usuario no llena los días manualmente en el wizard:

1. Tomar `proyecto.fecha_inicio` y `proyecto.fecha_fin_estimada`
2. Calcular días totales del proyecto = diferencia en días hábiles
3. Distribuir proporcionalmente entre fases (por defecto equitativo: `totalDias / numFases`)
4. Dentro de cada fase, distribuir equitativamente entre tareas: `diasFase / numTareasEnFase`
5. Redondear a enteros (mínimo 1 día)

Si no hay fecha_inicio o fecha_fin_estimada, dejar `tiempo_acordado_dias` en el default (3 días) y `tiempo_estimado_dias` de fase en null.

### 2C — Wizard Step 2: campo de días por fase

En cada sección de fase (colapsable), agregar un input numérico "Días estimados de la fase" al lado del nombre de fase. Opcional — si se llena, se usa para auto-distribuir entre tareas que no tengan días manuales.

El campo de días por tarea ya existe en el form manual (default 3). No cambia.

### 2D — API Wizard: guardar días de fase

En `POST /api/proyectos/wizard`, el payload de fases pasa de `string[]` a:
```ts
fases: { nombre: string; tiempo_estimado_dias?: number }[]
```

Al crear las fases, guardar `tiempo_estimado_dias`. Al crear tareas, si `tiempo_acordado_dias` no viene en el payload (o es 0), auto-calcular:
- Si la fase tiene `tiempo_estimado_dias`: `diasFase / numTareasFase`
- Si no: `diasTotalesProyecto / numFases / numTareasFase`
- Fallback: 3 días

### 2E — Página de Tareas: nueva tabla con columnas

**Reemplazar** el listado actual de `TaskRow` por una tabla con columnas:

| Tarea | Contratista | Días estimados | Plazo | Estatus |
|---|---|---|---|---|

**Agrupado por fase** (secciones colapsables, una por fase).

Definición de columnas:
- **Tarea**: nombre de la tarea (espacio — nombre). Link clickeable a `/dashboard/tareas/{id}`
- **Contratista**: nombre del contratista asignado. Si no hay, "—"
- **Días estimados**: `tiempo_acordado_dias` del registro
- **Plazo**: columna combinada
  - Si `fecha_limite > hoy`: "X días" en texto gris/verde (días restantes)
  - Si `fecha_limite == hoy`: "Vence hoy" en amarillo
  - Si `fecha_limite < hoy` y estado != APROBADA: "-X días" en rojo (días de retraso)
  - Si estado == APROBADA: "Completada" en verde
  - `fecha_limite = fecha_inicio + tiempo_acordado_dias` (días calendario simples)
- **Estatus**: badge con icono (Pendiente, Reportada, Aprobada, No aprobada)

**Responsive (móvil):** cards en vez de tabla, mostrando la misma info en formato vertical.

### 2F — Data layer: incluir fase en query de tareas

`getTareasFiltradas` en `src/lib/data.ts` debe incluir:
- `fase: { select: { id, nombre, orden } }` en el include de la query
- `fecha_inicio` del tarea (ya se usa para semáforo)
- Ordenar resultado por `fase.orden ASC`, luego por nombre

El TaskRow props se reemplaza por un nuevo tipo:
```ts
interface TareaTablaRow {
  id: string;
  nombre: string;       // "espacio — nombre_tarea"
  contratista: string | null;
  diasEstimados: number;
  fechaInicio: Date | null;
  plazo: number;         // días restantes (negativo = retraso)
  estado: EstadoTarea;
  faseId: string;
  faseNombre: string;
  faseOrden: number;
}
```

---

## Cambio 3: Metros cuadrados opcionales en Wizard Step 1

### 3A — Schema: nuevo campo en Unidad

```prisma
model Unidad {
  ...
  metraje_total  Float?   // m² totales de la unidad
}
```

**Migración:** `ALTER TABLE "Unidad" ADD COLUMN "metraje_total" FLOAT;`

`Espacio.metraje` (Float?) ya existe en el schema — actualmente hardcodeado a 15 en el wizard API. Con este cambio se usará el valor real del usuario.

### 3B — Wizard Step 1: toggle de m²

Agregar un toggle "Incluir metros cuadrados" debajo de la sección de tipos de unidad.

**Cuando está ON:**
- Por cada tipo de unidad: campo "m² totales" (numérico, decimal)
- Por cada espacio del tipo de unidad: campo "m²" (numérico, decimal)
- Misma lógica para zonas comunes: m² por cada zona

**Cuando está OFF:** no se muestran campos de m². Se usa el default (15) como ahora.

### 3C — Wizard types: actualizar interfaces

```ts
interface TipoUnidadInput {
  id: string;
  nombre: string;
  espacios: string[];
  metraje_total?: number;              // m² total de la unidad
  metrajes_espacios?: Record<string, number>;  // espacio_nombre -> m²
}
```

Zonas comunes: agregar `metrajes_zonas?: Record<string, number>` al state del wizard.

### 3D — API Wizard: guardar m²

En el payload del wizard:
```ts
tipos_unidad: {
  nombre: string;
  espacios: string[];
  metraje_total?: number;
  metrajes_espacios?: Record<string, number>;
}[]
zonas_comunes_metrajes?: Record<string, number>;
```

Al crear `Unidad`: guardar `metraje_total`.
Al crear `Espacio`: usar `metrajes_espacios[espacio_nombre]` si existe, sino default 15.

---

## Cambio 4: tareasEnRiesgo en Dashboard

### 4A — Lógica

Una tarea está "en riesgo" si:
- `estado` es `PENDIENTE` o `NO_APROBADA`
- `fecha_inicio` no es null
- `tiempo_acordado_dias` no es null/0
- `fecha_inicio + tiempo_acordado_dias < hoy` (fecha límite ya pasó)

### 4B — Actualizar getDashboardStats

En `src/lib/data.ts`, la query de `tareasEnRiesgo` actualmente cuenta tareas en estado PENDIENTE o NO_APROBADA. Cambiar para filtrar también por la condición de fecha:

```ts
const ahora = new Date();
const tareasEnRiesgoCount = todasTareas.filter(t => 
  (t.estado === "PENDIENTE" || t.estado === "NO_APROBADA") &&
  t.fecha_inicio &&
  t.tiempo_acordado_dias > 0 &&
  new Date(t.fecha_inicio.getTime() + t.tiempo_acordado_dias * 86400000) < ahora
).length;
```

### 4C — Dashboard: mostrar indicador

El dashboard ya muestra `tareasEnRiesgo` como card. Solo asegurar que el cálculo refleje la nueva lógica. El label puede ser "En riesgo" con color rojo/naranja.

---

## Cambio 5: Logo clickeable → Dashboard

### Archivo: `src/components/dashboard/Sidebar.tsx`

Envolver la sección del logo (líneas 56-63) en un `<Link href="/dashboard">`:

```tsx
<Link href="/dashboard" className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-800 flex-shrink-0">
  <img src="/seiricon-icon.png" alt="Seiricon" className="w-9 h-9 flex-shrink-0" />
  {!collapsed && (
    <div className="leading-tight">
      <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">SEIRICON</div>
      <div className="text-[9px] text-blue-300 whitespace-nowrap">construyendo en orden</div>
    </div>
  )}
</Link>
```

El botón de cerrar móvil se queda fuera del Link, al mismo nivel.

---

## Cambio 6: Detalle de apartamento separado por fase

### Archivo: `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`

**Actualmente:** el panel de detalle de unidad agrupa tareas por estado (PENDIENTE, REPORTADA, APROBADA, NO_APROBADA).

**Cambio:** agrupar primero por fase, luego dentro de cada fase por estado.

### 6A — Data: incluir fase en query de unidad

En `getProyectoDetalle` (data-detail.ts), el include de tareas debe agregar:
```ts
tareas: {
  include: {
    asignado_usuario: { select: { id: true, nombre: true } },
    fase: { select: { id: true, nombre: true, orden: true } },  // NUEVO
  },
},
```

### 6B — UI del panel de detalle

Estructura:

```
[Fase: Obra Blanca]
  ● Pendientes (3)
    - Baño principal — Enchape piso
    - Cocina — Instalación mesón
  ● Aprobadas (1)
    - Habitación — Pintura

[Fase: Madera]
  ● Pendientes (2)
    - Cocina — Gabinetes
    - Closet — Puertas
```

Cada fase es una sección con su nombre como header. Dentro, se mantiene el agrupamiento por estado que ya existe.

---

## Cambio 7: Roles — click en contador de usuarios

### Archivo: `src/components/dashboard/RolesManager.tsx`

### 7A — Hacer clickeable el contador

Cambiar la celda del contador de usuarios de texto plano a un botón/link. Al hacer click, expandir una fila debajo del rol mostrando la lista de usuarios.

### 7B — Fetch de usuarios por rol

Al expandir, hacer fetch a un nuevo endpoint o reutilizar `/api/usuarios?rol_id={id}` (si no existe, crearlo como query param).

Mostrar: nombre, email, fecha de creación. Diseño simple tipo lista dentro de una fila expandida de la tabla.

### 7C — Alternativa sin endpoint nuevo

El componente RolesManager ya tiene acceso al rol.id. Puede hacer fetch a `/api/roles/{id}/usuarios` (nuevo) o simplemente expandir con la data que ya tiene (la API de roles ya devuelve `_count.usuarios`).

**Decisión:** Crear un estado `expandedRolId` y al hacer click en el contador, hacer fetch a `/api/roles/{rolId}/usuarios` que retorna `[{id, nombre, email, created_at}]`.

### 7D — Nuevo endpoint

```
GET /api/roles/[id]/usuarios
```
- Auth: requiere ADMIN_GENERAL
- Returns: lista de usuarios del rol en la constructora del caller
- Campos: id, nombre, email, created_at

---

## Cambio 8: Detalle de apartamento en panel lateral (desktop)

### Archivo: `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`

### 8A — Layout split-view

**Desktop (md+):** cuando se selecciona una unidad (`?unidad=xxx`), la página se divide en dos columnas:
- **Izquierda (60%):** grid de edificios con pisos y unidades (lo que ya existe)
- **Derecha (40%):** panel de detalle de la unidad seleccionada (sticky, scroll independiente)

**Móvil:** comportamiento actual — el detalle aparece debajo del grid, sin split.

### 8B — Implementación

```tsx
<div className="flex flex-col md:flex-row gap-6">
  {/* Left: buildings grid */}
  <div className={selectedUnidad ? "md:w-[60%]" : "w-full"}>
    {/* edificios, pisos, unidades grids */}
  </div>

  {/* Right: unit detail panel (desktop only) */}
  {selectedUnidad && (
    <div className="hidden md:block md:w-[40%]">
      <div className="sticky top-4">
        {/* Panel de detalle con fases y estados (Cambio 6) */}
      </div>
    </div>
  )}

  {/* Mobile: unit detail below (unchanged behavior) */}
  {selectedUnidad && (
    <div className="md:hidden">
      {/* Mismo panel de detalle */}
    </div>
  )}
</div>
```

### 8C — Scroll independiente

El panel derecho usa `sticky top-4` con `max-h-[calc(100vh-120px)] overflow-y-auto` para que sea scrollable de forma independiente al grid de la izquierda.

---

## Cambio 9: signInWithPassword (sin cambios)

Se mantiene como está. Tanto ADMIN_GENERAL como ADMIN_PROYECTO (Administrador Proyectos) pueden editar los proyectos a los que tienen acceso confirmando con contraseña.

---

## Resumen de cambios en DB

| Tabla | Campo nuevo | Tipo | Migración |
|---|---|---|---|
| `Fase` | `tiempo_estimado_dias` | `Int?` | ALTER TABLE ADD COLUMN |
| `Unidad` | `metraje_total` | `Float?` | ALTER TABLE ADD COLUMN |

**Migración SQL:**
```sql
ALTER TABLE "Fase" ADD COLUMN "tiempo_estimado_dias" INTEGER;
ALTER TABLE "Unidad" ADD COLUMN "metraje_total" DOUBLE PRECISION;
```

## Resumen de archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/app/api/roles/[id]/usuarios/route.ts` | GET usuarios de un rol |

## Resumen de archivos modificados

| # | Archivo | Cambios |
|---|---|---|
| 1 | `prisma/schema.prisma` | Campos nuevos en Fase y Unidad |
| 2 | `src/components/dashboard/RolesManager.tsx` | Label ADMIN_PROYECTO, click en contador de usuarios |
| 3 | `src/lib/permissions.ts` | Label ADMIN_PROYECTO |
| 4 | `src/lib/onboarding.ts` | Nombre rol default |
| 5 | `src/components/dashboard/Sidebar.tsx` | Logo clickeable con Link |
| 6 | `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types.ts` | Metrajes en TipoUnidadInput, días en fase |
| 7 | `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep1.tsx` | Toggle m², inputs m² por espacio/unidad |
| 8 | `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep2.tsx` | Input días por fase |
| 9 | `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx` | State para metrajes y días de fase, pasar al API |
| 10 | `src/app/api/proyectos/wizard/route.ts` | Guardar metrajes y días, auto-cálculo |
| 11 | `src/app/(dashboard)/dashboard/tareas/page.tsx` | Nueva tabla con columnas, agrupada por fase |
| 12 | `src/components/dashboard/TaskRow.tsx` | Deprecar o reemplazar con TareasTable |
| 13 | `src/lib/data.ts` | Incluir fase en getTareasFiltradas, corregir tareasEnRiesgo |
| 14 | `src/lib/data-detail.ts` | Incluir fase en getProyectoDetalle |
| 15 | `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx` | Split-view + detalle por fase |
| 16 | `src/components/dashboard/InviteUserModal.tsx` | Label si aplica |
