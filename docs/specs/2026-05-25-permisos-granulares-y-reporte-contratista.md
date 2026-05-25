# Spec: Permisos granulares + UI obrero para contratista + bug guardado

Fecha: 2026-05-25
Estado: en implementación

## Contexto

Tres problemas reportados:

1. **Bug:** al editar un proyecto y pedir contraseña, los cambios (especialmente asignar tareas a contratistas) no quedan persistidos.
2. **Falta:** un ADMIN_GENERAL no puede dar permisos granulares a un ADMIN_PROYECTO (admin junior) sobre un proyecto específico.
3. **Falta:** el CONTRATISTA debería poder reportar tareas con evidencia (igual que el OBRERO) para cuando es unipersonal.
4. **Confirmado:** el CONTRATISTA NO puede aprobar tareas (`canApprove: false`). Solo verá progreso.

## Hipótesis del bug (#1)

La UI en `/dashboard/proyectos/[id]/equipo/client.tsx` llama `POST /api/proyectos/[id]/reasignar`, que solo afecta tareas en `PENDIENTE` o `NO_APROBADA` ya asignadas a `contratista_anterior_id`. Si el contratista nunca tuvo tareas → `reasignadas: 0` → UI muestra éxito pero nada cambió. No existe endpoint para "asignar tareas ad-hoc" post-creación.

## Cambios

### 1. Fix: asignar tareas post-creación

- Nuevo endpoint `POST /api/proyectos/[id]/asignar-tareas` con `{ contratista_id, tarea_ids[], password, motivo? }`
- UI en `/equipo`: modal "Asignar tareas a contratista" con selector multi de tareas sin asignar o asignadas a otro
- Registra en `ReasignacionTarea` para auditoría
- Bloquea tareas en estado `APROBADA`

### 2. Permisos granulares para ADMIN_PROYECTO

**Schema:**

```prisma
model AdminProyectoAccess {
  // campos existentes
  can_edit_project       Boolean @default(false)
  can_assign_contractors Boolean @default(false)
  can_manage_team        Boolean @default(false)
  can_approve_tasks      Boolean @default(true)
}
```

**Migración:** `prisma/migrations/20260525120000_admin_permisos_granulares/migration.sql`

**Backend:** helper `checkAdminProjectPermission(userId, projectId, permission)` en `src/lib/access.ts`.

Aplicar en:
- `/api/proyectos/[id]/editar` → `can_edit_project`
- `/api/proyectos/[id]/reasignar` y `/asignar-tareas` → `can_assign_contractors`
- `/api/proyectos/[id]/admins` y `/personas` → `can_manage_team`
- `/api/tareas/[id]/aprobar` → `can_approve_tasks`

**UI:** modal al agregar admin junior con 4 checkboxes. Botón "Editar permisos" en lista de admins.

### 3. UI de reporte para CONTRATISTA

- Nueva ruta `/dashboard/mis-tareas` (sidebar para CONTRATISTA y OBRERO)
- Lista de tareas asignadas con filtro por estado
- Click → vista con `CameraCapture` + `EvidenceGallery` + textarea + geolocalización
- Reutiliza `POST /api/tareas/[id]/reportar` (ya valida `esAsignado || esSupervisor`)
- En `permissions.ts`: agregar `"mis-tareas"` al sidebar de CONTRATISTA y OBRERO

### 4. Vista de progreso CONTRATISTA

Cubierto por `/mis-tareas`: muestra estado y motivo de rechazo si aplica.

## Orden

```
Fase A (paralelo):
  - Bug-hunter: confirma causa del bug y diseña fix exacto
  - Repair: implementa #2, #3, #4

Fase B (secuencial):
  - Aplicar fix #1

Fase C (paralelo):
  - Bug-review: regresiones, race conditions, tenant escapes
  - Functional-review: permisos, flujos UI, auditoría
```
