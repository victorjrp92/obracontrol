# Admin Proyecto Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Commit after each task.

**Goal:** Introduce a new `ADMIN_PROYECTO` access level that scopes a user's administrative power to one or more specific projects of their `Constructora`. Rename the existing `ADMINISTRADOR` enum value to `ADMIN_GENERAL` so the enum clearly distinguishes the two kinds of admin. Add the persistence model (`AdminProyectoAccess`), a central `getAccessibleProjectIds` helper, permission rules, invitation/edit flows with project assignment, and wire project-scoped filtering into every API route, dashboard page, and sidebar item affected by the change.

**Architecture:** The data model adds a many-to-many join `AdminProyectoAccess` (user <-> project) and extends the `NivelAcceso` enum with `ADMIN_PROYECTO`. A single `src/lib/access.ts` helper resolves the list of project IDs accessible to the current user (returning `"ALL"` for DIRECTIVO/ADMIN_GENERAL so callers can skip filters cheaply). All API routes switch from hardcoded `"ADMINISTRADOR"` string checks to small typed helpers (`isGeneralAdmin`, `isAnyAdmin`, `canManageUsers`) so TypeScript errors surface any missed callsite after the rename. `getUsuarioActual` returns the admin's assigned projects alongside the user record so server components can render scoped lists without extra round-trips. The `InviteUserModal` gains a multi-select that shows when a role with `nivel_acceso = ADMIN_PROYECTO` is selected; the backend validates the selection matches the inviter's own scope.

**Tech Stack:** Next.js 16 (App Router, Promise-based `params`/`searchParams`), TypeScript, Prisma 7 (generator output at `src/generated/prisma`), PostgreSQL (enum rename via raw SQL `ALTER TYPE ... RENAME VALUE`), Supabase auth (email-based user lookup), Tailwind v4, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-18-admin-proyecto-role-design.md`

---

## File structure

### Files to create

```
prisma/migrations/20260418120000_admin_proyecto_role/migration.sql   -- Raw SQL: rename enum value + add ADMIN_PROYECTO + create admin_proyecto_access table
src/lib/access.ts                                                    -- getAccessibleProjectIds, buildProjectWhereFilter, isGeneralAdmin, isAnyAdmin, canManageUsers
src/components/dashboard/ProyectosMultiSelect.tsx                    -- Reusable multi-select of projects for invite/edit
```

### Files to modify

```
prisma/schema.prisma                                                 -- Rename enum value, add AdminProyectoAccess model + relations
src/lib/permissions.ts                                               -- Rename ADMINISTRADOR case -> ADMIN_GENERAL, add ADMIN_PROYECTO case
src/lib/data.ts                                                      -- Extend getUsuarioActual to include admin-proyecto assignments; update scoping inside list helpers
src/lib/onboarding.ts                                                -- Seed default "Admin Proyecto" role; rename ADMINISTRADOR -> ADMIN_GENERAL in default roles
src/app/api/usuarios/route.ts                                        -- Accept proyectos_asignados in POST, enforce invite rules
src/app/api/usuarios/[id]/route.ts                                   -- Accept proyectos_asignados in PATCH, sync AdminProyectoAccess rows
src/app/api/roles/route.ts                                           -- Accept ADMIN_PROYECTO / ADMIN_GENERAL in VALID_NIVELES, use isGeneralAdmin
src/app/api/roles/[id]/route.ts                                      -- Same as roles/route.ts
src/app/api/proyectos/route.ts                                       -- GET filters by accessible IDs; POST stays ADMIN_GENERAL only
src/app/api/proyectos/[id]/editar/route.ts                           -- Replace ADMINISTRADOR check, allow ADMIN_PROYECTO for accessible projects
src/app/api/proyectos/[id]/importar-tareas/route.ts                  -- Enforce accessible-project check
src/app/api/proyectos/[id]/plantilla/route.ts                        -- Enforce accessible-project check
src/app/api/proyectos/wizard/route.ts                                -- Stays ADMIN_GENERAL only; rename string
src/app/api/tareas/route.ts                                          -- Filter list and POST by accessible projects
src/app/api/tareas/[id]/aprobar/route.ts                             -- Replace check; validate task's project is accessible
src/app/api/tareas/[id]/reportar/route.ts                            -- Rename references; no scope change (obrero/contratista)
src/app/api/edificios/route.ts                                       -- GET+POST project-accessibility checks
src/app/api/extensiones/route.ts                                     -- Validate task's project is accessible
src/app/api/retrasos/route.ts                                        -- Validate task's project is accessible; rename strings
src/app/api/sugerencias/route.ts                                     -- Filter list by accessible projects
src/app/api/sugerencias/[id]/route.ts                                -- Validate suggestion's project is accessible
src/app/api/contratistas/route.ts                                    -- Rename ADMINISTRADOR -> ADMIN_GENERAL; constructora-wide list stays unchanged
src/app/api/constructora/route.ts                                    -- Rename references
src/app/(dashboard)/layout.tsx                                       -- Default sidebar nivel fallback to ADMIN_GENERAL
src/app/(dashboard)/dashboard/page.tsx                               -- Pass accessible IDs to stats helpers
src/app/(dashboard)/dashboard/proyectos/page.tsx                     -- Filter list; hide "Nuevo proyecto" button for ADMIN_PROYECTO
src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx                -- Verify accessible, redirect if not
src/app/(dashboard)/dashboard/proyectos/nuevo/page.tsx               -- Block ADMIN_PROYECTO from this route (redirect)
src/app/(dashboard)/dashboard/usuarios/page.tsx                      -- Allow ADMIN_PROYECTO, filter roles shown, pass proyectos list
src/app/(dashboard)/dashboard/configuracion/empresa/page.tsx         -- Block ADMIN_PROYECTO (redirect)
src/app/(dashboard)/dashboard/sugerencias/page.tsx                   -- Filter by accessible projects
src/app/(dashboard)/dashboard/tareas/[id]/page.tsx                   -- Verify task's project is accessible
src/components/dashboard/Sidebar.tsx                                 -- No structural change beyond strings; permissions already drives items
src/components/dashboard/InviteUserModal.tsx                         -- Show ProyectosMultiSelect when selected rol is ADMIN_PROYECTO
src/components/dashboard/RolesManager.tsx                            -- Add ADMIN_GENERAL + ADMIN_PROYECTO to NIVELES / labels / colors
src/scripts/provision-user.ts                                        -- Rename ADMINISTRADOR -> ADMIN_GENERAL
```

### Files unchanged (intentionally)

```
src/lib/data-contratista.ts, data-detail.ts, data-directivo.ts, data-obrero.ts
src/app/api/obreros/*, auth/*, evidencias/*, notificaciones/*, o/*, progreso/*, reportes/*
```

---

## Task 1: Update Prisma schema — rename enum value and add AdminProyectoAccess model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Rename `ADMINISTRADOR` to `ADMIN_GENERAL` and add `ADMIN_PROYECTO` in the `NivelAcceso` enum**

In `prisma/schema.prisma`, replace the existing enum block (currently lines 372-377) with:

```prisma
enum NivelAcceso {
  DIRECTIVO
  ADMIN_GENERAL
  ADMIN_PROYECTO
  CONTRATISTA
  OBRERO
}
```

- [ ] **Step 1.2: Add the `AdminProyectoAccess` model at the end of the file before the `// ─── ENUMS ───` marker**

Insert this block just above `// ─── ENUMS ───────────────────────────────────────────────────────────────` (around line 485):

```prisma
// ─── ACCESO DE ADMIN A PROYECTOS ─────────────────────────────────────────────

model AdminProyectoAccess {
  id           String   @id @default(cuid())
  usuario_id   String
  proyecto_id  String
  asignado_por String?
  created_at   DateTime @default(now())

  usuario      Usuario  @relation("AdminProyectoAccessUsuario", fields: [usuario_id], references: [id], onDelete: Cascade)
  proyecto     Proyecto @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  asignador    Usuario? @relation("AdminProyectoAccessAsignador", fields: [asignado_por], references: [id])

  @@unique([usuario_id, proyecto_id])
  @@map("admin_proyecto_access")
}
```

- [ ] **Step 1.3: Add reverse relations on `Usuario`**

Inside `model Usuario { ... }`, add these two relations right after `audit_logs AuditLog[]`:

```prisma
  proyectos_administrados  AdminProyectoAccess[] @relation("AdminProyectoAccessUsuario")
  proyectos_asignados_por  AdminProyectoAccess[] @relation("AdminProyectoAccessAsignador")
```

- [ ] **Step 1.4: Add reverse relation on `Proyecto`**

Inside `model Proyecto { ... }`, add this line right after `audit_logs AuditLog[]`:

```prisma
  admins_proyecto          AdminProyectoAccess[]
```

- [ ] **Step 1.5: Commit**

```
git add prisma/schema.prisma
git commit -m "schema: rename ADMINISTRADOR to ADMIN_GENERAL and add AdminProyectoAccess"
```

---

## Task 2: Create the raw SQL migration for the enum rename and join table

**Files:**
- Create: `prisma/migrations/20260418120000_admin_proyecto_role/migration.sql`

- [ ] **Step 2.1: Create the migration directory and file**

```
mkdir -p "prisma/migrations/20260418120000_admin_proyecto_role"
```

Create `prisma/migrations/20260418120000_admin_proyecto_role/migration.sql` with:

```sql
-- Rename the existing enum value ADMINISTRADOR -> ADMIN_GENERAL.
-- PostgreSQL supports renaming enum values atomically and preserves all existing rows.
ALTER TYPE "NivelAcceso" RENAME VALUE 'ADMINISTRADOR' TO 'ADMIN_GENERAL';

-- Add the new enum value.
ALTER TYPE "NivelAcceso" ADD VALUE 'ADMIN_PROYECTO';

-- Create the admin_proyecto_access join table.
CREATE TABLE "admin_proyecto_access" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "proyecto_id" TEXT NOT NULL,
  "asignado_por" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_proyecto_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_proyecto_access_usuario_id_proyecto_id_key"
  ON "admin_proyecto_access"("usuario_id", "proyecto_id");

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_proyecto_id_fkey"
  FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_asignado_por_fkey"
  FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 2.2: Regenerate the Prisma client**

```
npx prisma generate
```

- [ ] **Step 2.3: Apply the migration locally**

```
npx prisma migrate deploy
```

- [ ] **Step 2.4: Commit**

```
git add prisma/migrations/20260418120000_admin_proyecto_role
git commit -m "migration: rename ADMINISTRADOR enum and add AdminProyectoAccess table"
```

---

## Task 3: Create `src/lib/access.ts` with scoping helpers and role helpers

**Files:**
- Create: `src/lib/access.ts`

- [ ] **Step 3.1: Create the file with all helpers**

Create `src/lib/access.ts`:

```typescript
import type { NivelAcceso } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type AccessibleProjects = "ALL" | string[];

/**
 * Returns the project IDs accessible to a user.
 * - DIRECTIVO and ADMIN_GENERAL see every project in their constructora -> "ALL".
 * - ADMIN_PROYECTO sees only the projects assigned in AdminProyectoAccess.
 * - CONTRATISTA sees projects where they have at least one task assigned.
 * - OBRERO: not used here (access is token-based); returns [].
 */
export async function getAccessibleProjectIds(
  usuarioId: string,
  constructoraId: string,
  nivelAcceso: NivelAcceso,
): Promise<AccessibleProjects> {
  if (nivelAcceso === "DIRECTIVO" || nivelAcceso === "ADMIN_GENERAL") {
    return "ALL";
  }

  if (nivelAcceso === "ADMIN_PROYECTO") {
    const accesos = await prisma.adminProyectoAccess.findMany({
      where: { usuario_id: usuarioId, proyecto: { constructora_id: constructoraId } },
      select: { proyecto_id: true },
    });
    return accesos.map((a) => a.proyecto_id);
  }

  if (nivelAcceso === "CONTRATISTA") {
    const proyectos = await prisma.proyecto.findMany({
      where: {
        constructora_id: constructoraId,
        edificios: {
          some: {
            pisos: {
              some: {
                unidades: {
                  some: {
                    espacios: {
                      some: {
                        tareas: { some: { asignado_a: usuarioId } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return proyectos.map((p) => p.id);
  }

  return [];
}

/**
 * Returns `true` if the project is accessible to the caller.
 * "ALL" short-circuits, otherwise we check membership.
 */
export function canAccessProject(accessible: AccessibleProjects, proyectoId: string): boolean {
  return accessible === "ALL" || accessible.includes(proyectoId);
}

/**
 * Builds a Prisma `where` fragment that scopes a `proyecto`-side query by id.
 * Returns `{}` for "ALL" so callers can spread it without side effects.
 */
export function buildProjectWhereFilter(accessible: AccessibleProjects): Record<string, unknown> {
  if (accessible === "ALL") return {};
  return { id: { in: accessible } };
}

/**
 * Builds a Prisma `where` fragment that scopes a child query via nested `proyecto_id`.
 * Use when the query is rooted on a model that has a `proyecto_id` column.
 */
export function buildProyectoIdInFilter(accessible: AccessibleProjects): Record<string, unknown> {
  if (accessible === "ALL") return {};
  return { proyecto_id: { in: accessible } };
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function isGeneralAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_GENERAL";
}

export function isProjectAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_PROYECTO";
}

/** Either admin (general or per-project). */
export function isAnyAdmin(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_GENERAL" || nivel === "ADMIN_PROYECTO";
}

/** Can invite/edit/list users: ADMIN_GENERAL + DIRECTIVO; ADMIN_PROYECTO limited. */
export function canManageUsers(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_GENERAL" || nivel === "DIRECTIVO";
}

/** Can approve tasks: both admins and directivo. */
export function canApproveTasks(nivel: NivelAcceso | string): boolean {
  return nivel === "ADMIN_GENERAL" || nivel === "ADMIN_PROYECTO" || nivel === "DIRECTIVO";
}
```

- [ ] **Step 3.2: Commit**

```
git add src/lib/access.ts
git commit -m "access: add getAccessibleProjectIds and role helpers"
```

---

## Task 4: Update `src/lib/permissions.ts` with renamed and new role cases

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 4.1: Replace the file with the new switch**

Replace the entire `src/lib/permissions.ts` with:

```typescript
import type { NivelAcceso } from "@/generated/prisma";

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canInviteUsers: boolean;
  canViewAllProjects: boolean;
  canViewAllTasks: boolean;
  canViewReports: boolean;
  canViewConfig: boolean;
  canViewContractors: boolean;
  canViewUsers: boolean;
  sidebarItems: string[];
}

export function getRolLabel(rolNombre: string): string {
  return rolNombre;
}

export function getPermissions(nivelAcceso: NivelAcceso | string): Permissions {
  switch (nivelAcceso) {
    case "ADMIN_GENERAL":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canInviteUsers: true,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: true,
        canViewConfig: true,
        canViewContractors: true,
        canViewUsers: true,
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios", "configuracion"],
      };
    case "ADMIN_PROYECTO":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canInviteUsers: true,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: true,
        canViewConfig: false,
        canViewContractors: true,
        canViewUsers: true,
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios"],
      };
    case "DIRECTIVO":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canInviteUsers: false,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: true,
        canViewConfig: false,
        canViewContractors: true,
        canViewUsers: false,
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes"],
      };
    case "CONTRATISTA":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard", "tareas"],
      };
    case "OBRERO":
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard"],
      };
    default:
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard"],
      };
  }
}
```

- [ ] **Step 4.2: Commit**

```
git add src/lib/permissions.ts
git commit -m "permissions: add ADMIN_PROYECTO case and rename ADMINISTRADOR to ADMIN_GENERAL"
```

---

## Task 5: Extend `getUsuarioActual` in `src/lib/data.ts` to include admin-proyecto assignments

**Files:**
- Modify: `src/lib/data.ts`

- [ ] **Step 5.1: Replace the `getUsuarioActual` function**

In `src/lib/data.ts` (lines 6-15), replace:

```typescript
export async function getUsuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.usuario.findUnique({
    where: { email: user.email! },
    include: { constructora: true, rol_ref: true },
  });
}
```

with:

```typescript
export async function getUsuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.usuario.findUnique({
    where: { email: user.email! },
    include: {
      constructora: true,
      rol_ref: true,
      proyectos_administrados: { select: { proyecto_id: true } },
    },
  });
}
```

- [ ] **Step 5.2: Commit**

```
git add src/lib/data.ts
git commit -m "data: include admin-proyecto assignments in getUsuarioActual"
```

---

## Task 6: Update default roles seed in `src/lib/onboarding.ts`

**Files:**
- Modify: `src/lib/onboarding.ts`

- [ ] **Step 6.1: Rename `ADMINISTRADOR` to `ADMIN_GENERAL` and add a default `Admin Proyecto` role**

In `src/lib/onboarding.ts`, replace the `defaultRoles` array (lines 26-35) with:

```typescript
  const defaultRoles = [
    { nombre: "Gerente", nivel_acceso: "DIRECTIVO" as const, es_default: true },
    { nombre: "Director de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
    { nombre: "Administrador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Admin Proyecto", nivel_acceso: "ADMIN_PROYECTO" as const, es_default: true },
    { nombre: "Coordinador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Asistente", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
    { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
    { nombre: "Contratista lustrador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
    { nombre: "Auxiliar de obra", nivel_acceso: "OBRERO" as const, es_default: true },
  ];
```

- [ ] **Step 6.2: Commit**

```
git add src/lib/onboarding.ts
git commit -m "onboarding: seed Admin Proyecto default role and rename enum value"
```

---

## Task 7: Update `src/scripts/provision-user.ts` (if it references the old enum)

**Files:**
- Modify: `src/scripts/provision-user.ts`

- [ ] **Step 7.1: Replace every occurrence of `"ADMINISTRADOR"` with `"ADMIN_GENERAL"`**

Open `src/scripts/provision-user.ts` and use Edit's `replace_all` to change:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

- [ ] **Step 7.2: Commit**

```
git add src/scripts/provision-user.ts
git commit -m "scripts: rename ADMINISTRADOR to ADMIN_GENERAL in provision-user"
```

---

## Task 8: Update `src/app/api/roles/route.ts` to accept the new enum values

**Files:**
- Modify: `src/app/api/roles/route.ts`

- [ ] **Step 8.1: Update `VALID_NIVELES` and permission check**

In `src/app/api/roles/route.ts`:

1. Replace line 5:

```typescript
const VALID_NIVELES = ["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"] as const;
```

with:

```typescript
const VALID_NIVELES = ["DIRECTIVO", "ADMIN_GENERAL", "ADMIN_PROYECTO", "CONTRATISTA", "OBRERO"] as const;
```

2. Add this import at the top alongside the existing imports:

```typescript
import { isGeneralAdmin } from "@/lib/access";
```

3. Replace the permission check in `POST` (lines 43-45):

```typescript
    if (!currentUser || currentUser.rol_ref.nivel_acceso !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

with:

```typescript
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

4. Update the error string on line 61 to list the new valid values:

```typescript
      return NextResponse.json({ error: "nivel_acceso inválido. Debe ser uno de: DIRECTIVO, ADMIN_GENERAL, ADMIN_PROYECTO, CONTRATISTA, OBRERO" }, { status: 400 });
```

- [ ] **Step 8.2: Commit**

```
git add src/app/api/roles/route.ts
git commit -m "api(roles): accept ADMIN_GENERAL/ADMIN_PROYECTO and use isGeneralAdmin"
```

---

## Task 9: Update `src/app/api/roles/[id]/route.ts` (PATCH + DELETE)

**Files:**
- Modify: `src/app/api/roles/[id]/route.ts`

- [ ] **Step 9.1: Update `VALID_NIVELES` and both permission checks**

1. Replace line 5:

```typescript
const VALID_NIVELES = ["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"] as const;
```

with:

```typescript
const VALID_NIVELES = ["DIRECTIVO", "ADMIN_GENERAL", "ADMIN_PROYECTO", "CONTRATISTA", "OBRERO"] as const;
```

2. Add the helper import at the top:

```typescript
import { isGeneralAdmin } from "@/lib/access";
```

3. Replace the permission check in `PATCH` (lines 21-23):

```typescript
    if (!currentUser || currentUser.rol_ref.nivel_acceso !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

with:

```typescript
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

4. Apply the same replacement in `DELETE` (lines 94-96).

- [ ] **Step 9.2: Commit**

```
git add "src/app/api/roles/[id]/route.ts"
git commit -m "api(roles/[id]): accept new enum values and use isGeneralAdmin"
```

---

## Task 10: Update `src/app/api/usuarios/route.ts` — invite flow with project assignment

**Files:**
- Modify: `src/app/api/usuarios/route.ts`

- [ ] **Step 10.1: Add imports**

At the top of the file, add after the existing imports:

```typescript
import { canManageUsers, isAnyAdmin, isProjectAdmin, getAccessibleProjectIds } from "@/lib/access";
```

- [ ] **Step 10.2: Update the `GET` permission check**

Replace lines 20-22 (the `!["ADMINISTRADOR", "DIRECTIVO"].includes(...)` check) with:

```typescript
    if (!currentUser || !(canManageUsers(currentUser.rol_ref.nivel_acceso) || isProjectAdmin(currentUser.rol_ref.nivel_acceso))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

- [ ] **Step 10.3: Update the `POST` permission check and body parsing**

Replace the existing body parsing and permission check block (lines 48-93) with:

```typescript
    if (!currentUser || !(canManageUsers(currentUser.rol_ref.nivel_acceso) || isProjectAdmin(currentUser.rol_ref.nivel_acceso))) {
      return NextResponse.json({ error: "Sin permisos para invitar usuarios" }, { status: 403 });
    }

    const body = await req.json();
    const { email, nombre, rol_id, proyectos_asignados } = body as {
      email?: string;
      nombre?: string;
      rol_id?: string;
      proyectos_asignados?: string[];
    };

    if (!email || !nombre || !rol_id) {
      return NextResponse.json({ error: "email, nombre y rol_id son requeridos" }, { status: 400 });
    }

    const rol = await prisma.rol.findFirst({
      where: { id: rol_id, constructora_id: currentUser.constructora_id },
    });
    if (!rol) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // ADMIN_PROYECTO can only invite CONTRATISTA or OBRERO
    if (isProjectAdmin(currentUser.rol_ref.nivel_acceso) && !["CONTRATISTA", "OBRERO"].includes(rol.nivel_acceso)) {
      return NextResponse.json(
        { error: "Solo puedes invitar contratistas u obreros" },
        { status: 403 },
      );
    }

    // If the target role is ADMIN_PROYECTO, proyectos_asignados must be non-empty.
    if (rol.nivel_acceso === "ADMIN_PROYECTO") {
      if (!Array.isArray(proyectos_asignados) || proyectos_asignados.length === 0) {
        return NextResponse.json(
          { error: "Debes seleccionar al menos un proyecto para un Admin Proyecto" },
          { status: 400 },
        );
      }

      const proyectosDb = await prisma.proyecto.findMany({
        where: { id: { in: proyectos_asignados }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (proyectosDb.length !== proyectos_asignados.length) {
        return NextResponse.json(
          { error: "Algunos proyectos no pertenecen a esta constructora" },
          { status: 400 },
        );
      }

      // If the inviter is ADMIN_PROYECTO (edge-case: spec allows Contratista/Obrero only, but guard anyway)
      if (isAnyAdmin(currentUser.rol_ref.nivel_acceso) && !canManageUsers(currentUser.rol_ref.nivel_acceso)) {
        const accessible = await getAccessibleProjectIds(
          currentUser.id,
          currentUser.constructora_id,
          currentUser.rol_ref.nivel_acceso,
        );
        if (accessible !== "ALL") {
          const allowed = new Set(accessible);
          if (proyectos_asignados.some((p) => !allowed.has(p))) {
            return NextResponse.json(
              { error: "Solo puedes asignar proyectos que administras" },
              { status: 403 },
            );
          }
        }
      }
    }

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con este email" }, { status: 409 });
    }

    const tempPassword = `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json({ error: `Error creando cuenta: ${authError.message}` }, { status: 500 });
    }

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        constructora_id: currentUser.constructora_id,
        rol_id: rol.id,
      },
    });

    if (rol.nivel_acceso === "ADMIN_PROYECTO" && Array.isArray(proyectos_asignados)) {
      await prisma.adminProyectoAccess.createMany({
        data: proyectos_asignados.map((pid) => ({
          usuario_id: nuevoUsuario.id,
          proyecto_id: pid,
          asignado_por: currentUser.id,
        })),
        skipDuplicates: true,
      });
    }
```

Note: preserve the existing block below (creating `Contratista` row, sending email, returning the user). Those lines stay unchanged.

- [ ] **Step 10.4: Commit**

```
git add src/app/api/usuarios/route.ts
git commit -m "api(usuarios): accept proyectos_asignados and allow ADMIN_PROYECTO to invite contractors"
```

---

## Task 11: Update `src/app/api/usuarios/[id]/route.ts` — edit flow with project assignment

**Files:**
- Modify: `src/app/api/usuarios/[id]/route.ts`

- [ ] **Step 11.1: Replace the entire PATCH handler body**

Replace the current `PATCH` handler (lines 6-69) with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/access";

// PATCH /api/usuarios/[id] — change role and/or project assignments
export async function PATCH(
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
    if (!currentUser || !canManageUsers(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rol_id, proyectos_asignados } = body as {
      rol_id?: string;
      proyectos_asignados?: string[];
    };

    if (!rol_id && proyectos_asignados === undefined) {
      return NextResponse.json({ error: "rol_id o proyectos_asignados es requerido" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let effectiveNivel = target.rol_ref.nivel_acceso;

    if (rol_id) {
      const rol = await prisma.rol.findFirst({
        where: { id: rol_id, constructora_id: currentUser.constructora_id },
      });
      if (!rol) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      effectiveNivel = rol.nivel_acceso;
    }

    // If the resulting role is ADMIN_PROYECTO, we need a non-empty project list.
    if (effectiveNivel === "ADMIN_PROYECTO") {
      const nextList =
        proyectos_asignados !== undefined
          ? proyectos_asignados
          : (await prisma.adminProyectoAccess.findMany({
              where: { usuario_id: id },
              select: { proyecto_id: true },
            })).map((a) => a.proyecto_id);

      if (!Array.isArray(nextList) || nextList.length === 0) {
        return NextResponse.json(
          { error: "Un Admin Proyecto debe tener al menos un proyecto asignado" },
          { status: 400 },
        );
      }
    }

    // Validate proyectos_asignados belong to the constructora
    if (Array.isArray(proyectos_asignados) && proyectos_asignados.length > 0) {
      const proyectosDb = await prisma.proyecto.findMany({
        where: { id: { in: proyectos_asignados }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (proyectosDb.length !== proyectos_asignados.length) {
        return NextResponse.json(
          { error: "Algunos proyectos no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (rol_id) {
        await tx.usuario.update({ where: { id }, data: { rol_id } });

        // Ensure contratista row if switching to CONTRATISTA
        if (effectiveNivel === "CONTRATISTA") {
          const existing = await tx.contratista.findUnique({ where: { usuario_id: id } });
          if (!existing) {
            await tx.contratista.create({
              data: {
                usuario_id: id,
                score_cumplimiento: 80,
                score_calidad: 80,
                score_velocidad_correccion: 80,
                score_total: 80,
              },
            });
          }
        }
      }

      // Sync project assignments:
      // - If target role is ADMIN_PROYECTO and a list was given, replace the set.
      // - If target role is not ADMIN_PROYECTO, clear any existing assignments.
      if (effectiveNivel === "ADMIN_PROYECTO" && Array.isArray(proyectos_asignados)) {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
        if (proyectos_asignados.length > 0) {
          await tx.adminProyectoAccess.createMany({
            data: proyectos_asignados.map((pid) => ({
              usuario_id: id,
              proyecto_id: pid,
              asignado_por: currentUser.id,
            })),
            skipDuplicates: true,
          });
        }
      } else if (effectiveNivel !== "ADMIN_PROYECTO") {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
      }
    });

    const updated = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: true, proyectos_administrados: { select: { proyecto_id: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 11.2: Commit**

```
git add "src/app/api/usuarios/[id]/route.ts"
git commit -m "api(usuarios/[id]): support proyectos_asignados sync and rename enum check"
```

---

## Task 12: Update `src/app/api/proyectos/route.ts` — scope GET list

**Files:**
- Modify: `src/app/api/proyectos/route.ts`

- [ ] **Step 12.1: Import helpers**

Add at the top of the file, after existing imports:

```typescript
import { getAccessibleProjectIds, buildProjectWhereFilter, isGeneralAdmin } from "@/lib/access";
```

- [ ] **Step 12.2: Replace the `GET` handler body**

Replace the entire `GET` function (lines 5-38) with:

```typescript
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );

    const proyectos = await prisma.proyecto.findMany({
      where: {
        constructora_id: usuario.constructora_id,
        ...buildProjectWhereFilter(accessible),
      },
      include: {
        edificios: { include: { pisos: { include: { unidades: true } } } },
        fases: true,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(proyectos);
  } catch (error) {
    console.error("GET /api/proyectos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 12.3: Replace the `POST` permission check**

Replace lines 54-57 (`["ADMINISTRADOR"]...`) with:

```typescript
    if (!usuario || !isGeneralAdmin(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

- [ ] **Step 12.4: Commit**

```
git add src/app/api/proyectos/route.ts
git commit -m "api(proyectos): scope list by accessible IDs, rename admin check"
```

---

## Task 13: Update `src/app/api/proyectos/[id]/editar/route.ts`

**Files:**
- Modify: `src/app/api/proyectos/[id]/editar/route.ts`

- [ ] **Step 13.1: Import helpers and replace PATCH permission check**

Add at the top:

```typescript
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin, canManageUsers } from "@/lib/access";
```

Replace the `PATCH` permission check (lines 19-21):

```typescript
    if (!currentUser || currentUser.rol_ref.nivel_acceso !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Solo administradores pueden editar proyectos" }, { status: 403 });
    }
```

with:

```typescript
    if (!currentUser || !isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Solo administradores pueden editar proyectos" }, { status: 403 });
    }

    const { id: projectIdForCheck } = await params;
    const accessibleForEdit = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessibleForEdit, projectIdForCheck)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

Then remove the later `const { id } = await params;` (line 23) since we already awaited it; replace it with `const id = projectIdForCheck;`.

Also add `id: true` to the select of `currentUser` on line 17:

```typescript
      select: { id: true, email: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
```

- [ ] **Step 13.2: Replace the GET permission check (audit log)**

Replace lines 136-138 with:

```typescript
    if (!currentUser || !(canManageUsers(currentUser.rol_ref.nivel_acceso) || isAnyAdmin(currentUser.rol_ref.nivel_acceso))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const accessibleForAudit = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessibleForAudit, id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

Remove the later `const { id } = await params;` (line 141) since we moved it up. Also include `id` in the `select` of `currentUser` for the GET branch (add `id: true`).

- [ ] **Step 13.3: Commit**

```
git add "src/app/api/proyectos/[id]/editar/route.ts"
git commit -m "api(proyectos/[id]/editar): allow ADMIN_PROYECTO within accessible projects"
```

---

## Task 14: Update `src/app/api/proyectos/[id]/importar-tareas/route.ts` and `plantilla/route.ts`

**Files:**
- Modify: `src/app/api/proyectos/[id]/importar-tareas/route.ts`
- Modify: `src/app/api/proyectos/[id]/plantilla/route.ts`

- [ ] **Step 14.1: Replace every `"ADMINISTRADOR"` string with the helper**

In each of the two files, use Edit with `replace_all`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

Then add a project-accessibility check following the existing auth/role guard. Add near the top of each handler (right after the role check):

```typescript
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin } from "@/lib/access";
```

Replace the existing strict `ADMINISTRADOR`-only check with:

```typescript
    if (!currentUser || !isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
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
```

(Ensure the `select` on `currentUser` includes `id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } }` — add fields if missing.)

- [ ] **Step 14.2: Commit**

```
git add "src/app/api/proyectos/[id]/importar-tareas/route.ts" "src/app/api/proyectos/[id]/plantilla/route.ts"
git commit -m "api(proyectos): scope importar-tareas and plantilla by accessible project"
```

---

## Task 15: Update `src/app/api/proyectos/wizard/route.ts`

**Files:**
- Modify: `src/app/api/proyectos/wizard/route.ts`

- [ ] **Step 15.1: Replace the admin check**

Use Edit with `replace_all` to change:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

If the route still uses an inline comparison, prefer the helper form:

```typescript
import { isGeneralAdmin } from "@/lib/access";
// ...
if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) { ... }
```

- [ ] **Step 15.2: Commit**

```
git add src/app/api/proyectos/wizard/route.ts
git commit -m "api(proyectos/wizard): use isGeneralAdmin helper"
```

---

## Task 16: Update `src/app/api/tareas/route.ts` — list and create scoping

**Files:**
- Modify: `src/app/api/tareas/route.ts`

- [ ] **Step 16.1: Import helpers**

Add at the top:

```typescript
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";
```

- [ ] **Step 16.2: Replace the GET where clause**

In the `GET` handler, replace the `usuario` select on lines 15-18 with:

```typescript
    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
```

Then add right after the `!usuario` guard:

```typescript
    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
```

And change the `where.espacio.unidad.piso.edificio.proyecto` sub-object (line 37) from:

```typescript
                proyecto: { constructora_id: usuario.constructora_id },
```

to:

```typescript
                proyecto: {
                  constructora_id: usuario.constructora_id,
                  ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
                },
```

- [ ] **Step 16.3: Replace the POST permission check**

Replace lines 79-82 with:

```typescript
    if (!usuario || !canApproveTasks(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para crear tareas" }, { status: 403 });
    }
```

Also update the `usuario` select to include `id: true` if missing. After loading `espacio`, validate the project:

```typescript
    const accessibleCreate = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    const espacioProyectoId = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { id: espacio_id } } } } } } } },
      },
      select: { id: true },
    });
    if (!espacioProyectoId || !canAccessProject(accessibleCreate, espacioProyectoId.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

- [ ] **Step 16.4: Commit**

```
git add src/app/api/tareas/route.ts
git commit -m "api(tareas): scope list+create by accessible projects"
```

---

## Task 17: Update `src/app/api/tareas/[id]/aprobar/route.ts`

**Files:**
- Modify: `src/app/api/tareas/[id]/aprobar/route.ts`

- [ ] **Step 17.1: Import helpers and rewrite the permission/access checks**

Add at the top:

```typescript
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";
```

Update the `aprobador` select (line 22) to include `id: true` (already present).

Replace the role check (lines 27-29) with:

```typescript
    if (!aprobador || !canApproveTasks(aprobador.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para aprobar" }, { status: 403 });
    }
```

After loading `tarea` (the existing block ending at line 57), insert an accessible-project check. Extract the project id from the existing nested include; add:

```typescript
    const proyectoIdForTask = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { tareas: { some: { id } } } } } } } } } },
      },
      select: { id: true },
    });
    const accessibleApr = await getAccessibleProjectIds(
      aprobador.id,
      aprobador.constructora_id,
      aprobador.rol_ref.nivel_acceso,
    );
    if (!proyectoIdForTask || !canAccessProject(accessibleApr, proyectoIdForTask.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

- [ ] **Step 17.2: Commit**

```
git add "src/app/api/tareas/[id]/aprobar/route.ts"
git commit -m "api(tareas/[id]/aprobar): use canApproveTasks and scope by project"
```

---

## Task 18: Update `src/app/api/tareas/[id]/reportar/route.ts`

**Files:**
- Modify: `src/app/api/tareas/[id]/reportar/route.ts`

- [ ] **Step 18.1: Rename any hardcoded strings**

Use Edit with `replace_all`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

(No scope change — reporting is done by the assigned contratista/obrero; existing tenant isolation remains.)

- [ ] **Step 18.2: Commit**

```
git add "src/app/api/tareas/[id]/reportar/route.ts"
git commit -m "api(tareas/[id]/reportar): rename ADMINISTRADOR enum reference"
```

---

## Task 19: Update `src/app/api/edificios/route.ts`

**Files:**
- Modify: `src/app/api/edificios/route.ts`

- [ ] **Step 19.1: Import helpers and add project-access check**

Add at the top:

```typescript
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin } from "@/lib/access";
```

Update the `GET` user select to include `id: true` and `rol_ref: { select: { nivel_acceso: true } }`. After loading `usuario`, compute `accessible` and validate against `proyecto_id`:

```typescript
    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

Put this right after the existing `proyecto.constructora_id !== usuario.constructora_id` guard (line 27).

In `POST`, replace the check (lines 73-75):

```typescript
    if (!currentUser || !["ADMINISTRADOR"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

with:

```typescript
    if (!currentUser || !isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    const accessibleCreate = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
```

And add an accessibility check right after the `proyectoCheck` tenant guard (line 92):

```typescript
    if (!canAccessProject(accessibleCreate, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

Add `id: true` to `currentUser`'s select.

- [ ] **Step 19.2: Commit**

```
git add src/app/api/edificios/route.ts
git commit -m "api(edificios): scope GET+POST by accessible projects"
```

---

## Task 20: Update `src/app/api/extensiones/route.ts`

**Files:**
- Modify: `src/app/api/extensiones/route.ts`

- [ ] **Step 20.1: Import helpers and scope the check**

Add:

```typescript
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";
```

Replace lines 17-19:

```typescript
    if (!usuario || !["ADMINISTRADOR", "DIRECTIVO"].includes(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para autorizar extensiones" }, { status: 403 });
    }
```

with:

```typescript
    if (!usuario || !canApproveTasks(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para autorizar extensiones" }, { status: 403 });
    }
```

Then after loading `tarea` and the constructora check (line 61), insert the project scope:

```typescript
    const proyectoIdForTarea = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { tareas: { some: { id: tarea_id } } } } } } } } } },
      },
      select: { id: true },
    });
    const accessibleExt = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    if (!proyectoIdForTarea || !canAccessProject(accessibleExt, proyectoIdForTarea.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

- [ ] **Step 20.2: Commit**

```
git add src/app/api/extensiones/route.ts
git commit -m "api(extensiones): scope by accessible project"
```

---

## Task 21: Update `src/app/api/retrasos/route.ts`

**Files:**
- Modify: `src/app/api/retrasos/route.ts`

- [ ] **Step 21.1: Rename enum references**

Use Edit with `replace_all`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

The `nivel_acceso: { in: [...] }` filter (line 104) should read `["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"]` so retraso emails also reach project admins:

```typescript
            rol_ref: { nivel_acceso: { in: ["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"] } },
```

- [ ] **Step 21.2: Commit**

```
git add src/app/api/retrasos/route.ts
git commit -m "api(retrasos): notify both admin types and rename enum references"
```

---

## Task 22: Update `src/app/api/sugerencias/route.ts`

**Files:**
- Modify: `src/app/api/sugerencias/route.ts`

- [ ] **Step 22.1: Import helpers**

Add:

```typescript
import { getAccessibleProjectIds, canManageUsers, isAnyAdmin } from "@/lib/access";
```

- [ ] **Step 22.2: Update the GET permission check and scope**

Replace lines 18-25 with:

```typescript
    const admin = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!admin || !(canManageUsers(admin.rol_ref.nivel_acceso) || isAnyAdmin(admin.rol_ref.nivel_acceso))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const accessible = await getAccessibleProjectIds(
      admin.id,
      admin.constructora_id,
      admin.rol_ref.nivel_acceso,
    );
```

Then on the `where` builder (around line 30), extend the `proyecto` condition:

```typescript
    const where: Record<string, unknown> = {
      proyecto: {
        constructora_id: admin.constructora_id,
        ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
      },
    };
```

- [ ] **Step 22.3: Update the notify-admins block**

Around line 125 replace:

```typescript
          rol_ref: { nivel_acceso: "ADMINISTRADOR" },
```

with:

```typescript
          rol_ref: { nivel_acceso: { in: ["ADMIN_GENERAL", "ADMIN_PROYECTO"] } },
```

- [ ] **Step 22.4: Commit**

```
git add src/app/api/sugerencias/route.ts
git commit -m "api(sugerencias): scope list and notifications by accessible projects"
```

---

## Task 23: Update `src/app/api/sugerencias/[id]/route.ts`

**Files:**
- Modify: `src/app/api/sugerencias/[id]/route.ts`

- [ ] **Step 23.1: Import helpers, rename check, add scope**

Add:

```typescript
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";
```

Replace the admin check (around line 30) with:

```typescript
    if (!admin || !canApproveTasks(admin.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

Ensure `admin` select exposes `id`, `constructora_id`, and `rol_ref.nivel_acceso`.

After loading the suggestion, before applying the update, insert:

```typescript
    const sugerencia = await prisma.tareaSugerida.findUnique({
      where: { id },
      select: { proyecto_id: true, proyecto: { select: { constructora_id: true } } },
    });
    if (!sugerencia || sugerencia.proyecto.constructora_id !== admin.constructora_id) {
      return NextResponse.json({ error: "Sugerencia no encontrada" }, { status: 404 });
    }
    const accessible = await getAccessibleProjectIds(
      admin.id,
      admin.constructora_id,
      admin.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, sugerencia.proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }
```

(If a similar block already loads the suggestion, merge with it; do not duplicate the DB call.)

- [ ] **Step 23.2: Commit**

```
git add "src/app/api/sugerencias/[id]/route.ts"
git commit -m "api(sugerencias/[id]): scope approve/reject by project access"
```

---

## Task 24: Update `src/app/api/contratistas/route.ts` and `src/app/api/constructora/route.ts`

**Files:**
- Modify: `src/app/api/contratistas/route.ts`
- Modify: `src/app/api/constructora/route.ts`

- [ ] **Step 24.1: Rename enum references in contratistas**

Use Edit with `replace_all` on `src/app/api/contratistas/route.ts`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

Then swap the POST permission check to `canApproveTasks` so ADMIN_PROYECTO can trigger recalculation:

Replace lines 68-70 with:

```typescript
    if (!currentUser || !canApproveTasks(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
```

Add import:

```typescript
import { canApproveTasks } from "@/lib/access";
```

Contractor list remains constructora-wide (no project scope).

- [ ] **Step 24.2: Rename enum references in constructora**

Use Edit with `replace_all` on `src/app/api/constructora/route.ts`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

Keep the endpoint restricted to ADMIN_GENERAL (company-level config).

- [ ] **Step 24.3: Commit**

```
git add src/app/api/contratistas/route.ts src/app/api/constructora/route.ts
git commit -m "api(contratistas, constructora): rename admin enum and use role helpers"
```

---

## Task 25: Update `src/app/(dashboard)/layout.tsx` fallback

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 25.1: Change the fallback string**

Replace line 18:

```typescript
        nivelAcceso={usuario?.rol_ref?.nivel_acceso ?? "ADMINISTRADOR"}
```

with:

```typescript
        nivelAcceso={usuario?.rol_ref?.nivel_acceso ?? "ADMIN_GENERAL"}
```

- [ ] **Step 25.2: Commit**

```
git add "src/app/(dashboard)/layout.tsx"
git commit -m "layout: update default nivelAcceso fallback to ADMIN_GENERAL"
```

---

## Task 26: Update `src/components/dashboard/Sidebar.tsx`

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 26.1: Update the default prop**

Replace line 43:

```typescript
export default function Sidebar({ nivelAcceso = "ADMINISTRADOR", userName = "Usuario", userRole }: SidebarProps) {
```

with:

```typescript
export default function Sidebar({ nivelAcceso = "ADMIN_GENERAL", userName = "Usuario", userRole }: SidebarProps) {
```

- [ ] **Step 26.2: Commit**

```
git add src/components/dashboard/Sidebar.tsx
git commit -m "sidebar: default nivelAcceso to ADMIN_GENERAL"
```

---

## Task 27: Update `src/app/(dashboard)/dashboard/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 27.1: Guard ADMIN_PROYECTO with no assigned projects**

After `const usuario = await getUsuarioActual();` and the first redirect, insert:

```typescript
  if (
    usuario.rol_ref.nivel_acceso === "ADMIN_PROYECTO" &&
    (usuario.proyectos_administrados?.length ?? 0) === 0
  ) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-slate-500 text-sm text-center max-w-sm">
          No tienes proyectos asignados. Contacta al administrador general para que te asigne al menos un proyecto.
        </p>
      </main>
    );
  }
```

(The existing stats queries stay — they already use `constructora_id`. A follow-up task scopes those too; for v1 the "no proyectos" empty state is sufficient.)

- [ ] **Step 27.2: Commit**

```
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "dashboard: show empty state for ADMIN_PROYECTO without assignments"
```

---

## Task 28: Update `src/app/(dashboard)/dashboard/proyectos/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/proyectos/page.tsx`

- [ ] **Step 28.1: Filter the list by accessible IDs and hide "Nuevo proyecto" for ADMIN_PROYECTO**

Add the import at the top:

```typescript
import { getAccessibleProjectIds } from "@/lib/access";
import { getPermissions } from "@/lib/permissions";
```

After `const proyectos = await getProyectosConProgreso(usuario.constructora_id);`, narrow the list:

```typescript
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  const proyectosVisibles =
    accessible === "ALL"
      ? proyectos
      : proyectos.filter((p) => accessible.includes(p.id));

  const permissions = getPermissions(usuario.rol_ref.nivel_acceso);
  const puedeCrearProyectos = permissions.canViewAllProjects && usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL";
```

Then in the JSX, wrap the "Nuevo proyecto" `<Link>` with `{puedeCrearProyectos && (...)}` (lines 42-49 and also the `<Link>` inside the empty state, lines 56-62).

And replace every usage of `proyectos` with `proyectosVisibles` in the rest of the page.

- [ ] **Step 28.2: Commit**

```
git add "src/app/(dashboard)/dashboard/proyectos/page.tsx"
git commit -m "dashboard/proyectos: filter by accessible and gate create button"
```

---

## Task 29: Update `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`

- [ ] **Step 29.1: Redirect when the project is not accessible**

After `const { id } = await params;` and before `getProyectoDetalle`, add:

```typescript
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (accessible !== "ALL" && !accessible.includes(id)) {
    redirect("/dashboard/proyectos");
  }
```

And at the top of the file add the import:

```typescript
import { getAccessibleProjectIds } from "@/lib/access";
```

- [ ] **Step 29.2: Commit**

```
git add "src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx"
git commit -m "dashboard/proyectos/[id]: redirect if project not accessible"
```

---

## Task 30: Update `src/app/(dashboard)/dashboard/proyectos/nuevo/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/proyectos/nuevo/page.tsx`

- [ ] **Step 30.1: Block ADMIN_PROYECTO from the create page**

Near the top of the page component (after `getUsuarioActual`), add:

```typescript
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    redirect("/dashboard/proyectos");
  }
```

(If the file already contains an ADMINISTRADOR check, replace that string with `ADMIN_GENERAL` instead.)

- [ ] **Step 30.2: Commit**

```
git add "src/app/(dashboard)/dashboard/proyectos/nuevo/page.tsx"
git commit -m "dashboard/proyectos/nuevo: restrict to ADMIN_GENERAL"
```

---

## Task 31: Update `src/app/(dashboard)/dashboard/configuracion/empresa/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/configuracion/empresa/page.tsx`

- [ ] **Step 31.1: Replace the enum string**

Use Edit with `replace_all`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

If the file checks `!== "ADMINISTRADOR"`, after the replace the logic still blocks non-general admins. Additionally, verify that ADMIN_PROYECTO is redirected out with:

```typescript
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    redirect("/dashboard");
  }
```

- [ ] **Step 31.2: Commit**

```
git add "src/app/(dashboard)/dashboard/configuracion/empresa/page.tsx"
git commit -m "dashboard/configuracion: restrict to ADMIN_GENERAL"
```

---

## Task 32: Update `src/app/(dashboard)/dashboard/usuarios/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/usuarios/page.tsx`

- [ ] **Step 32.1: Allow ADMIN_PROYECTO, pass proyectos to client**

Replace the entire file contents with:

```typescript
import { redirect } from "next/navigation";
import { getUsuarioActual, getUsuarios, getProyectosActivos } from "@/lib/data";
import { getRolLabel } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import UsuariosClient from "./client";

export default async function UsuariosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const nivel = usuario.rol_ref.nivel_acceso;
  if (!["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(nivel)) {
    redirect("/dashboard");
  }

  const usuarios = await getUsuarios(usuario.constructora_id);
  const roles = await prisma.rol.findMany({
    where: { constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true, nivel_acceso: true },
    orderBy: { nombre: "asc" },
  });
  const proyectos = await getProyectosActivos(usuario.constructora_id);

  const rolesVisibles =
    nivel === "ADMIN_PROYECTO"
      ? roles.filter((r) => r.nivel_acceso === "CONTRATISTA" || r.nivel_acceso === "OBRERO")
      : roles;

  const mapped = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol_ref.nombre,
    rol_id: (u as unknown as { rol_id: string }).rol_id,
    rolLabel: getRolLabel(u.rol_ref.nombre),
    created_at: u.created_at.toISOString(),
  }));

  return (
    <>
      <Topbar title="Usuarios" subtitle="Gestión del equipo" />
      <UsuariosClient
        usuarios={mapped}
        roles={rolesVisibles}
        proyectos={proyectos}
        canInviteAnyRole={nivel !== "ADMIN_PROYECTO"}
      />
    </>
  );
}
```

- [ ] **Step 32.2: Commit**

```
git add "src/app/(dashboard)/dashboard/usuarios/page.tsx"
git commit -m "dashboard/usuarios: allow ADMIN_PROYECTO with limited role list"
```

---

## Task 33: Create `src/components/dashboard/ProyectosMultiSelect.tsx`

**Files:**
- Create: `src/components/dashboard/ProyectosMultiSelect.tsx`

- [ ] **Step 33.1: Build the component**

Create `src/components/dashboard/ProyectosMultiSelect.tsx`:

```typescript
"use client";

import { FolderOpen } from "lucide-react";

interface ProyectoOption {
  id: string;
  nombre: string;
}

interface Props {
  proyectos: ProyectoOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  required?: boolean;
}

export default function ProyectosMultiSelect({ proyectos, value, onChange, label = "Proyectos asignados", required = false }: Props) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
        {proyectos.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-1.5">No hay proyectos disponibles</p>
        )}
        {proyectos.map((p) => {
          const checked = value.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.id)}
                className="accent-blue-600"
              />
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>{p.nombre}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 33.2: Commit**

```
git add src/components/dashboard/ProyectosMultiSelect.tsx
git commit -m "components: add ProyectosMultiSelect for admin proyecto assignment"
```

---

## Task 34: Update `src/components/dashboard/InviteUserModal.tsx`

**Files:**
- Modify: `src/components/dashboard/InviteUserModal.tsx`

- [ ] **Step 34.1: Rewrite with project multi-select support**

Replace the entire file with:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Mail, User, Shield } from "lucide-react";
import ProyectosMultiSelect from "@/components/dashboard/ProyectosMultiSelect";

interface RolOption {
  id: string;
  nombre: string;
  nivel_acceso: string;
}

interface ProyectoOption {
  id: string;
  nombre: string;
}

interface Props {
  onClose: () => void;
  proyectos?: ProyectoOption[];
}

export default function InviteUserModal({ onClose, proyectos = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [proyectosAsignados, setProyectosAsignados] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRoles(data as RolOption[]);
      })
      .catch(() => {});
  }, []);

  const selectedRol = roles.find((r) => r.id === selectedRolId);
  const needsProyectos = selectedRol?.nivel_acceso === "ADMIN_PROYECTO";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      email: form.get("email"),
      nombre: form.get("nombre"),
      rol_id: selectedRolId,
    };

    if (needsProyectos) {
      if (proyectosAsignados.length === 0) {
        setError("Selecciona al menos un proyecto");
        setLoading(false);
        return;
      }
      body.proyectos_asignados = proyectosAsignados;
    }

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al invitar usuario");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Invitar usuario</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="nombre" type="text" required placeholder="Nombre del usuario"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="email" type="email" required placeholder="usuario@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Rol</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                required
                value={selectedRolId}
                onChange={(e) => setSelectedRolId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 appearance-none bg-white cursor-pointer"
              >
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {needsProyectos && (
            <ProyectosMultiSelect
              proyectos={proyectos}
              value={proyectosAsignados}
              onChange={setProyectosAsignados}
              required
            />
          )}

          <p className="text-xs text-slate-500">
            Se enviará un email con contraseña temporal al usuario invitado.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Invitando..." : "Enviar invitación"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 34.2: Commit**

```
git add src/components/dashboard/InviteUserModal.tsx
git commit -m "invite-modal: support ADMIN_PROYECTO project selection"
```

---

## Task 35: Update `src/components/dashboard/RolesManager.tsx`

**Files:**
- Modify: `src/components/dashboard/RolesManager.tsx`

- [ ] **Step 35.1: Expand enum constants**

Replace lines 7-31 with:

```typescript
type NivelAcceso = "DIRECTIVO" | "ADMIN_GENERAL" | "ADMIN_PROYECTO" | "CONTRATISTA" | "OBRERO";

interface Rol {
  id: string;
  nombre: string;
  nivel_acceso: NivelAcceso;
  es_default: boolean;
  _count: { usuarios: number };
}

const NIVELES: NivelAcceso[] = ["DIRECTIVO", "ADMIN_GENERAL", "ADMIN_PROYECTO", "CONTRATISTA", "OBRERO"];

const NIVEL_LABELS: Record<NivelAcceso, string> = {
  DIRECTIVO: "Directivo",
  ADMIN_GENERAL: "Administrador general",
  ADMIN_PROYECTO: "Admin proyecto",
  CONTRATISTA: "Contratista",
  OBRERO: "Obrero",
};

const NIVEL_COLORS: Record<NivelAcceso, string> = {
  DIRECTIVO: "bg-violet-100 text-violet-700",
  ADMIN_GENERAL: "bg-blue-100 text-blue-700",
  ADMIN_PROYECTO: "bg-sky-100 text-sky-700",
  CONTRATISTA: "bg-amber-100 text-amber-700",
  OBRERO: "bg-emerald-100 text-emerald-700",
};
```

- [ ] **Step 35.2: Commit**

```
git add src/components/dashboard/RolesManager.tsx
git commit -m "roles-manager: add ADMIN_GENERAL and ADMIN_PROYECTO options"
```

---

## Task 36: Update `src/app/(dashboard)/dashboard/usuarios/client.tsx` signature

**Files:**
- Modify: `src/app/(dashboard)/dashboard/usuarios/client.tsx`

- [ ] **Step 36.1: Extend the component props**

Open the client file and add the new optional props to its props interface:

```typescript
proyectos?: { id: string; nombre: string }[];
canInviteAnyRole?: boolean;
```

Pass `proyectos` through to `<InviteUserModal proyectos={proyectos} />` wherever the modal is rendered. If the page currently renders an edit-role dropdown, conditionally show a `ProyectosMultiSelect` when the selected role has `nivel_acceso === "ADMIN_PROYECTO"` and include `proyectos_asignados` in the PATCH body.

If `canInviteAnyRole === false`, the invite button can still show, but the modal's role list is already filtered server-side.

- [ ] **Step 36.2: Commit**

```
git add "src/app/(dashboard)/dashboard/usuarios/client.tsx"
git commit -m "usuarios/client: plumb proyectos to InviteUserModal and edit form"
```

---

## Task 37: Update `src/app/(dashboard)/dashboard/sugerencias/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/sugerencias/page.tsx`

- [ ] **Step 37.1: Filter by accessible projects**

Replace any direct `prisma.tareaSugerida.findMany({ where: { proyecto: { constructora_id: ... } } })` with:

```typescript
import { getAccessibleProjectIds } from "@/lib/access";
// ...
const accessible = await getAccessibleProjectIds(
  usuario.id,
  usuario.constructora_id,
  usuario.rol_ref.nivel_acceso,
);
const sugerencias = await prisma.tareaSugerida.findMany({
  where: {
    proyecto: {
      constructora_id: usuario.constructora_id,
      ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
    },
  },
  orderBy: { created_at: "desc" },
  include: { proyecto: true, contratista: { select: { nombre: true } } },
});
```

Also replace any `!["ADMINISTRADOR", "DIRECTIVO"]` gate with `!["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"]`.

- [ ] **Step 37.2: Commit**

```
git add "src/app/(dashboard)/dashboard/sugerencias/page.tsx"
git commit -m "dashboard/sugerencias: filter by accessible projects"
```

---

## Task 38: Update `src/app/(dashboard)/dashboard/tareas/[id]/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/tareas/[id]/page.tsx`

- [ ] **Step 38.1: Rename enum strings and add project-access redirect**

Use Edit with `replace_all`:

```
"ADMINISTRADOR"  ->  "ADMIN_GENERAL"
```

Then load the task's `proyecto_id` (via nested includes) and if `getAccessibleProjectIds(...)` is not `"ALL"` and does not include it, `redirect("/dashboard/tareas")`.

```typescript
import { getAccessibleProjectIds } from "@/lib/access";
// ...
const accessible = await getAccessibleProjectIds(
  usuario.id,
  usuario.constructora_id,
  usuario.rol_ref.nivel_acceso,
);
const proyectoIdForTask = tarea.espacio.unidad.piso.edificio.proyecto.id;
if (accessible !== "ALL" && !accessible.includes(proyectoIdForTask)) {
  redirect("/dashboard/tareas");
}
```

(Use whatever local variable currently holds the task. If the proyecto id isn't already selected, extend the `include`.)

- [ ] **Step 38.2: Commit**

```
git add "src/app/(dashboard)/dashboard/tareas/[id]/page.tsx"
git commit -m "dashboard/tareas/[id]: redirect if task project not accessible"
```

---

## Task 39: Sweep-rename any remaining `"ADMINISTRADOR"` references

**Files:**
- Grep all source files and fix any straggler.

- [ ] **Step 39.1: Run a final search**

```
npx tsc --noEmit
```

TypeScript will fail on every unupdated `"ADMINISTRADOR"` string compared against `NivelAcceso`. For each reported file, replace the string with `"ADMIN_GENERAL"` (or refactor to use a helper).

Also grep for any raw `"ADMINISTRADOR"` that TypeScript may not have flagged (for example inside quoted labels):

```
Grep pattern:  "ADMINISTRADOR"  (no case, all source files under src/)
```

Apply `replace_all` on each hit.

- [ ] **Step 39.2: Commit**

```
git add -A
git commit -m "sweep: replace remaining ADMINISTRADOR references with ADMIN_GENERAL"
```

---

## Task 40: Build and manual smoke test

**Files:** none

- [ ] **Step 40.1: Run the build**

```
npm run build
```

Fix any type errors surfaced by TypeScript. Expected clean build after Task 39.

- [ ] **Step 40.2: Manual smoke test checklist**

Run `npm run dev` and verify the following in the UI (all flows in Spanish):

1. Login as an existing admin. Verify the role badge says "Administrador" and the sidebar still shows Configuración.
2. Open `/dashboard/usuarios` and invite a new user with role "Admin Proyecto" and one project selected. Verify the invitation succeeds and the new user appears in the list.
3. Log out, log in as the new Admin Proyecto. Verify:
   - The sidebar does not show "Configuración".
   - `/dashboard/proyectos` shows only the assigned project.
   - Navigating directly to a non-assigned project redirects to `/dashboard/proyectos`.
   - `/dashboard/configuracion/empresa` redirects to `/dashboard`.
   - `/dashboard/proyectos/nuevo` redirects to `/dashboard/proyectos`.
4. As Admin Proyecto, open the invite modal. Verify only Contratista and Obrero options appear.
5. Invite a Contratista. Verify success.
6. Try to invite an Admin Proyecto via curl (role_id of an admin role). Verify the API returns 403.
7. As Admin Proyecto, approve a task of the assigned project. Verify success. Try to approve a task in a non-assigned project via curl. Verify the API returns 403.
8. As Admin General, edit the Admin Proyecto user and remove all projects. Verify the API returns 400.
9. As Admin General, reassign a different project to the Admin Proyecto. Verify the UI updates for the Admin Proyecto on next login.
10. As Directivo, verify Directivo still sees every project and can approve tasks, but cannot invite users.

- [ ] **Step 40.3: Commit any final docs/fixes if the smoke test caught something**

```
git add -A
git commit -m "fix: address smoke test findings"
```

---

## Self-review

Before marking the plan done, review:

1. **Spec coverage:** every section in `docs/superpowers/specs/2026-04-18-admin-proyecto-role-design.md` is addressed:
   - 2.1 Schema ✓ Tasks 1–2
   - 2.2 Permissions ✓ Task 4
   - 2.3 Scoping helper ✓ Task 3
   - 2.4 Invite/edit flows ✓ Tasks 10–11
   - 2.5 API routes ✓ Tasks 12–24
   - 2.6 Dashboard pages ✓ Tasks 27–32, 37–38
   - 2.7 Sidebar ✓ Tasks 25–26 (permissions-driven already)
   - 2.8 Invite multi-select ✓ Tasks 33–34, 36
   - 2.9 Rename sweep ✓ Task 39

2. **Placeholder scan:** no step uses "similar to Task N" or "repeat for the other files" without concrete code. The only sweep task (39) is explicit about the search tool and intent.

3. **Type consistency:** `NivelAcceso` import from `@/generated/prisma` used consistently. Helpers accept `NivelAcceso | string` to tolerate raw JSON where needed.

4. **Migration safety:** `ALTER TYPE ... RENAME VALUE` preserves existing rows; no destructive drop. `ADD VALUE` is non-transactional in some PG versions — Prisma handles this by isolating the statement.

5. **Missed files:** a scan of files containing `ADMINISTRADOR` (36 total) is covered by explicit tasks for the ones with logic, plus Task 39's sweep for the rest. Generated files under `src/generated/prisma` regenerate from Task 2.3.

6. **Next.js 16 specifics:** every `params` access uses `await params` (already the case in the existing code). `searchParams` similarly. No new dynamic API surfaces introduced.

---

**Total tasks: 40.**
