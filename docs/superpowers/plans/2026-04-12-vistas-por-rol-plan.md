# Vistas por Rol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 role-based views (Directivo, Administrador, Contratista, Obrero), customizable roles per company, token-based worker access, task suggestions, common areas, notifications, and comprehensive security hardening.

**Architecture:** Replace hardcoded RolUsuario enum with a Rol table + NivelAcceso enum. Each nivel gets its own route group with dedicated layouts, pages, and sidebars. Obreros access via token-authenticated routes outside the dashboard. All API routes get authorization middleware. Multi-tenant isolation enforced at every layer.

**Tech Stack:** Next.js 16 (App Router), Prisma 7, Supabase Auth + Storage, Tailwind CSS v4, Resend, @react-pdf/renderer, zod for input validation.

**Spec:** `docs/superpowers/specs/2026-04-12-vistas-por-rol-design.md`

---

## File Structure

### New files to create:
```
prisma/migrations/YYYYMMDD_roles_system/migration.sql

src/lib/auth-guard.ts                          — Shared auth + authorization helpers
src/lib/zod-schemas.ts                         — Zod schemas for all API input validation

src/app/(dashboard)/layout.tsx                 — MODIFY: redirect by nivel_acceso
src/app/(dashboard)/dashboard/sugerencias/page.tsx — Admin: approve/reject task suggestions

src/app/(directivo)/layout.tsx                 — Directivo layout with minimal sidebar
src/app/(directivo)/directivo/page.tsx         — Executive dashboard
src/app/(directivo)/directivo/proyecto/[id]/page.tsx — Project drill-down

src/app/(contratista)/layout.tsx               — Contratista layout with contratista sidebar
src/app/(contratista)/contratista/page.tsx     — Contractor dashboard (tasks + progress)
src/app/(contratista)/contratista/historial/page.tsx — Approval history
src/app/(contratista)/contratista/sugerir/page.tsx   — Suggest task form
src/app/(contratista)/contratista/obreros/page.tsx   — Manage workers
src/app/(contratista)/contratista/reportes/page.tsx  — Download reports

src/app/o/[token]/layout.tsx                   — Obrero minimal layout (no sidebar)
src/app/o/[token]/page.tsx                     — Worker task list
src/app/o/[token]/tarea/[id]/page.tsx          — Worker report evidence

src/app/api/roles/route.ts                     — CRUD roles
src/app/api/sugerencias/route.ts               — Create/list task suggestions
src/app/api/sugerencias/[id]/route.ts          — Approve/reject suggestion
src/app/api/obreros/route.ts                   — CRUD obreros
src/app/api/obreros/[id]/route.ts              — Update/deactivate obrero
src/app/api/o/[token]/tareas/route.ts          — List tasks for obrero (token auth)
src/app/api/o/[token]/tareas/[id]/reportar/route.ts — Obrero report task (token auth)
src/app/api/o/[token]/evidencias/route.ts      — Obrero upload evidence (token auth)
src/app/api/notificaciones/route.ts            — List/mark-read notifications

src/components/dashboard/SidebarDirectivo.tsx   — Directivo sidebar
src/components/dashboard/SidebarContratista.tsx — Contratista sidebar
src/components/dashboard/NotificacionesDropdown.tsx — Notification bell dropdown
src/components/dashboard/SugerirTareaForm.tsx   — Task suggestion form
src/components/dashboard/ObreroManager.tsx      — Manage obreros UI
src/components/obrero/ObreroLayout.tsx          — Minimal header for workers
src/components/obrero/TareaCard.tsx             — Large, simple task card
src/components/obrero/ReportarObrero.tsx        — Simplified report form for workers

src/lib/email-templates/sugerencias.ts          — Email templates for suggestions
src/lib/email-templates/obrero.ts               — Email template for obrero link
src/lib/pdf/ContratistaTareasReport.tsx         — PDF: contractor tasks report
src/lib/pdf/ContratistaHistorialReport.tsx      — PDF: contractor approval history

src/lib/data-contratista.ts                     — Data fetching for contratista views
src/lib/data-directivo.ts                       — Data fetching for directivo views
src/lib/data-obrero.ts                          — Data fetching for obrero views
```

### Files to modify:
```
prisma/schema.prisma                            — New models, modified models, new enums
src/lib/permissions.ts                          — Rewrite for NivelAcceso
src/lib/data.ts                                 — Update queries (rol → nivel_acceso)
src/lib/onboarding.ts                           — Create default roles, assign to users
src/lib/task-templates.ts                       — Add zonas comunes templates
src/components/dashboard/Sidebar.tsx            — Update for ADMINISTRADOR nivel
src/app/(dashboard)/layout.tsx                  — Add redirect logic
src/app/(dashboard)/dashboard/configuracion/page.tsx — Add role management
src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx — Add zonas comunes option
src/app/api/tareas/[id]/reportar/route.ts       — Support obrero reporting
src/app/api/tareas/[id]/aprobar/route.ts        — Use nivel_acceso, send notifications
src/app/api/usuarios/route.ts                   — Use rol_id instead of enum
src/app/api/evidencias/route.ts                 — Support obrero_id
src/lib/email.ts                                — No change (already good)
next.config.ts                                  — Add security headers
```

---

## Task 1: Schema Migration — Roles and NivelAcceso

**Agent model:** opus (schema design, migration strategy, multi-model coordination)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration SQL (via `prisma migrate dev`)
- Modify: `src/generated/prisma/` (auto-generated)

- [ ] **Step 1: Add NivelAcceso enum and Rol model to schema.prisma**

Add BEFORE the existing `RolUsuario` enum:

```prisma
enum NivelAcceso {
  DIRECTIVO
  ADMINISTRADOR
  CONTRATISTA
  OBRERO
}

model Rol {
  id              String       @id @default(cuid())
  constructora_id String
  nombre          String
  nivel_acceso    NivelAcceso
  es_default      Boolean      @default(false)
  created_at      DateTime     @default(now())

  constructora    Constructora @relation(fields: [constructora_id], references: [id], onDelete: Cascade)
  usuarios        Usuario[]

  @@unique([constructora_id, nombre])
  @@map("roles")
}
```

Add `roles Rol[]` relation to `Constructora` model.

- [ ] **Step 2: Add rol_id to Usuario, keep old rol field temporarily**

Add to `Usuario`:
```prisma
rol_id String?
rol_ref Rol? @relation(fields: [rol_id], references: [id])
```

Keep the old `rol RolUsuario` field for now (migration safety).

- [ ] **Step 3: Add Obrero model**

```prisma
model Obrero {
  id               String       @id @default(cuid())
  nombre           String
  token            String       @unique @default(cuid())
  contratista_id   String
  constructora_id  String
  fecha_inicio     DateTime
  fecha_expiracion DateTime
  activo           Boolean      @default(true)
  created_at       DateTime     @default(now())
  updated_at       DateTime     @updatedAt

  contratista      Usuario      @relation("ObrerosDelContratista", fields: [contratista_id], references: [id])
  constructora     Constructora @relation(fields: [constructora_id], references: [id], onDelete: Cascade)
  evidencias       Evidencia[]

  @@map("obreros")
}
```

Add `obreros Obrero[]` relation to `Constructora`.
Add `obreros_a_cargo Obrero[] @relation("ObrerosDelContratista")` to `Usuario`.

- [ ] **Step 4: Add TareaSugerida model**

```prisma
enum EstadoSugerencia {
  PENDIENTE
  APROBADA
  RECHAZADA
}

model TareaSugerida {
  id             String            @id @default(cuid())
  contratista_id String
  proyecto_id    String
  edificio_id    String?
  unidades       Json
  nombre         String
  descripcion    String?
  foto_url       String?
  estado         EstadoSugerencia  @default(PENDIENTE)
  motivo_rechazo String?
  revisado_por   String?
  created_at     DateTime          @default(now())
  updated_at     DateTime          @updatedAt

  contratista    Usuario           @relation("SugerenciasContratista", fields: [contratista_id], references: [id])
  proyecto       Proyecto          @relation(fields: [proyecto_id], references: [id])
  revisor        Usuario?          @relation("SugerenciasRevisadas", fields: [revisado_por], references: [id])

  @@map("tareas_sugeridas")
}
```

Add `sugerencias_hechas TareaSugerida[] @relation("SugerenciasContratista")` to `Usuario`.
Add `sugerencias_revisadas TareaSugerida[] @relation("SugerenciasRevisadas")` to `Usuario`.
Add `tareas_sugeridas TareaSugerida[]` to `Proyecto`.

- [ ] **Step 5: Add Notificacion model**

```prisma
enum TipoNotificacion {
  TAREA_APROBADA
  TAREA_RECHAZADA
  SUGERENCIA_NUEVA
  SUGERENCIA_APROBADA
  SUGERENCIA_RECHAZADA
  OBRERO_REPORTO
}

model Notificacion {
  id         String            @id @default(cuid())
  usuario_id String
  tipo       TipoNotificacion
  titulo     String
  mensaje    String
  leida      Boolean           @default(false)
  link       String?
  created_at DateTime          @default(now())

  usuario    Usuario           @relation(fields: [usuario_id], references: [id], onDelete: Cascade)

  @@map("notificaciones")
}
```

Add `notificaciones Notificacion[]` to `Usuario`.

- [ ] **Step 6: Modify Edificio — add es_zona_comun**

```prisma
model Edificio {
  ...existing fields...
  es_zona_comun Boolean @default(false)
}
```

- [ ] **Step 7: Modify Tarea — add foto_referencia_url**

```prisma
model Tarea {
  ...existing fields...
  foto_referencia_url String?
}
```

- [ ] **Step 8: Modify Evidencia — add obrero_id, make tomada_por nullable**

```prisma
model Evidencia {
  ...existing fields...
  tomada_por  String?          // was required, now optional
  obrero_id   String?
  obrero      Obrero?          @relation(fields: [obrero_id], references: [id])
}
```

- [ ] **Step 9: Run prisma migrate dev**

```bash
cd "/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol"
npx prisma migrate dev --name roles_system
```

Expected: Migration creates all new tables and columns. Existing data preserved.

- [ ] **Step 10: Write data migration script to populate roles and update usuarios**

Create `prisma/migrate-roles.ts`:

```typescript
import { prisma } from "../src/lib/prisma";

const DEFAULT_ROLES = [
  { nombre: "Gerente", nivel_acceso: "DIRECTIVO", es_default: true },
  { nombre: "Director de obra", nivel_acceso: "DIRECTIVO", es_default: true },
  { nombre: "Administrador", nivel_acceso: "ADMINISTRADOR", es_default: true },
  { nombre: "Coordinador", nivel_acceso: "ADMINISTRADOR", es_default: true },
  { nombre: "Asistente", nivel_acceso: "ADMINISTRADOR", es_default: true },
  { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA", es_default: true },
  { nombre: "Contratista lustrador", nivel_acceso: "CONTRATISTA", es_default: true },
  { nombre: "Auxiliar de obra", nivel_acceso: "OBRERO", es_default: true },
];

const OLD_ROL_MAP: Record<string, string> = {
  ADMIN: "Administrador",
  JEFE_OPERACIONES: "Director de obra",
  COORDINADOR: "Coordinador",
  ASISTENTE: "Asistente",
  AUXILIAR: "Auxiliar de obra",
  CONTRATISTA_INSTALADOR: "Contratista instalador",
  CONTRATISTA_LUSTRADOR: "Contratista lustrador",
};

async function main() {
  const constructoras = await prisma.constructora.findMany();
  for (const c of constructoras) {
    // Create default roles for each constructora
    for (const r of DEFAULT_ROLES) {
      await prisma.rol.upsert({
        where: { constructora_id_nombre: { constructora_id: c.id, nombre: r.nombre } },
        update: {},
        create: {
          constructora_id: c.id,
          nombre: r.nombre,
          nivel_acceso: r.nivel_acceso as any,
          es_default: r.es_default,
        },
      });
    }
    // Map existing users to new roles
    const usuarios = await prisma.usuario.findMany({ where: { constructora_id: c.id } });
    for (const u of usuarios) {
      const rolNombre = OLD_ROL_MAP[u.rol];
      if (!rolNombre) continue;
      const rol = await prisma.rol.findUnique({
        where: { constructora_id_nombre: { constructora_id: c.id, nombre: rolNombre } },
      });
      if (rol) {
        await prisma.usuario.update({ where: { id: u.id }, data: { rol_id: rol.id } });
      }
    }
  }
  console.log("Migration complete");
}

main().catch(console.error);
```

- [ ] **Step 11: Run the data migration**

```bash
npx tsx prisma/migrate-roles.ts
```

Expected: All existing users have `rol_id` set.

- [ ] **Step 12: Make rol_id required, drop old rol field**

Update `schema.prisma`:
- Change `rol_id String?` to `rol_id String`
- Change `rol_ref Rol?` to `rol_ref Rol`
- Remove `rol RolUsuario`
- Remove enum `RolUsuario`

```bash
npx prisma migrate dev --name drop_old_rol_enum
```

- [ ] **Step 13: Commit**

```bash
git add prisma/ src/generated/
git commit -m "feat: migrate to Rol table + NivelAcceso enum, add Obrero, TareaSugerida, Notificacion models"
```

---

## Task 2: Auth Guard and Permissions Rewrite

**Agent model:** sonnet (focused rewrite of existing module, clear spec)

**Files:**
- Modify: `src/lib/permissions.ts`
- Create: `src/lib/auth-guard.ts`
- Create: `src/lib/zod-schemas.ts`

- [ ] **Step 1: Rewrite permissions.ts**

```typescript
export type NivelAcceso = "DIRECTIVO" | "ADMINISTRADOR" | "CONTRATISTA" | "OBRERO";

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canInviteUsers: boolean;
  canManageRoles: boolean;
  canViewAllProjects: boolean;
  canViewAllTasks: boolean;
  canViewReports: boolean;
  canViewConfig: boolean;
  canViewContractors: boolean;
  canViewUsers: boolean;
  canSuggestTasks: boolean;
  canManageObreros: boolean;
  sidebarItems: string[];
  homeRoute: string;
}

export function getPermissions(nivelAcceso: string): Permissions {
  switch (nivelAcceso) {
    case "DIRECTIVO":
      return {
        canCreate: false, canEdit: false, canDelete: false, canApprove: false,
        canInviteUsers: false, canManageRoles: false,
        canViewAllProjects: true, canViewAllTasks: false, canViewReports: true,
        canViewConfig: false, canViewContractors: false, canViewUsers: false,
        canSuggestTasks: false, canManageObreros: false,
        sidebarItems: ["inicio", "proyectos"],
        homeRoute: "/directivo",
      };
    case "ADMINISTRADOR":
      return {
        canCreate: true, canEdit: true, canDelete: true, canApprove: true,
        canInviteUsers: true, canManageRoles: true,
        canViewAllProjects: true, canViewAllTasks: true, canViewReports: true,
        canViewConfig: true, canViewContractors: true, canViewUsers: true,
        canSuggestTasks: false, canManageObreros: false,
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios", "configuracion"],
        homeRoute: "/dashboard",
      };
    case "CONTRATISTA":
      return {
        canCreate: false, canEdit: false, canDelete: false, canApprove: false,
        canInviteUsers: false, canManageRoles: false,
        canViewAllProjects: false, canViewAllTasks: false, canViewReports: false,
        canViewConfig: false, canViewContractors: false, canViewUsers: false,
        canSuggestTasks: true, canManageObreros: true,
        sidebarItems: ["inicio", "historial", "sugerir", "obreros", "reportes"],
        homeRoute: "/contratista",
      };
    default: // OBRERO never hits sidebar
      return {
        canCreate: false, canEdit: false, canDelete: false, canApprove: false,
        canInviteUsers: false, canManageRoles: false,
        canViewAllProjects: false, canViewAllTasks: false, canViewReports: false,
        canViewConfig: false, canViewContractors: false, canViewUsers: false,
        canSuggestTasks: false, canManageObreros: false,
        sidebarItems: [],
        homeRoute: "/o",
      };
  }
}
```

- [ ] **Step 2: Create auth-guard.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NivelAcceso } from "./permissions";

interface AuthResult {
  usuario: {
    id: string;
    email: string;
    nombre: string;
    constructora_id: string;
    rol_id: string;
    nivel_acceso: NivelAcceso;
  };
}

// For authenticated pages/API routes
export async function getAuthenticatedUser(): Promise<AuthResult | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { email: user.email! },
    include: { rol_ref: { select: { nivel_acceso: true } } },
  });
  if (!usuario || !usuario.rol_ref) return null;

  return {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      constructora_id: usuario.constructora_id,
      rol_id: usuario.rol_id,
      nivel_acceso: usuario.rol_ref.nivel_acceso as NivelAcceso,
    },
  };
}

// API route guard: require auth + specific niveles
export async function requireNivel(
  ...niveles: NivelAcceso[]
): Promise<AuthResult | NextResponse> {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!niveles.includes(auth.usuario.nivel_acceso)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  return auth;
}

// Verify resource belongs to same constructora (tenant isolation)
export function verifySameTenant(
  userConstructoraId: string,
  resourceConstructoraId: string
): boolean {
  return userConstructoraId === resourceConstructoraId;
}

// For obrero token-based routes
export async function getObreroByToken(token: string) {
  const obrero = await prisma.obrero.findUnique({ where: { token } });
  if (!obrero) return null;
  if (!obrero.activo) return null;

  const now = new Date();
  if (now < obrero.fecha_inicio || now > obrero.fecha_expiracion) return null;

  return obrero;
}
```

- [ ] **Step 3: Create zod-schemas.ts**

```typescript
import { z } from "zod";

export const crearRolSchema = z.object({
  nombre: z.string().min(2).max(50).trim(),
  nivel_acceso: z.enum(["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"]),
});

export const editarRolSchema = z.object({
  nombre: z.string().min(2).max(50).trim().optional(),
  nivel_acceso: z.enum(["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"]).optional(),
});

export const crearObreroSchema = z.object({
  nombre: z.string().min(2).max(100).trim(),
  fecha_inicio: z.string().datetime(),
  fecha_expiracion: z.string().datetime(),
});

export const sugerirTareaSchema = z.object({
  proyecto_id: z.string().cuid(),
  edificio_id: z.string().cuid().optional(),
  unidades: z.array(z.string().cuid()).min(1),
  nombre: z.string().min(3).max(200).trim(),
  descripcion: z.string().max(1000).trim().optional(),
});

export const aprobarSugerenciaSchema = z.object({
  estado: z.enum(["APROBADA", "RECHAZADA"]),
  motivo_rechazo: z.string().max(500).trim().optional(),
  tiempo_acordado_dias: z.number().int().min(1).max(365).optional(),
  fase_id: z.string().cuid().optional(),
});

export const invitarUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(100).trim(),
  rol_id: z.string().cuid(),
});
```

- [ ] **Step 4: Install zod dependency**

```bash
npm install zod
```

- [ ] **Step 5: Run existing tests to verify no regression**

```bash
npm run build
```

Expected: Build succeeds (will have type errors because of rol → rol_id change, but we fix those in Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions.ts src/lib/auth-guard.ts src/lib/zod-schemas.ts package.json package-lock.json
git commit -m "feat: rewrite permissions for NivelAcceso, add auth guard and zod validation"
```

---

## Task 3: Update Existing Code for New Role System

**Agent model:** sonnet (systematic find-and-replace across many files, clear rules)

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `src/lib/onboarding.ts`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx`
- Modify: `src/app/api/usuarios/route.ts`
- Modify: `src/app/api/tareas/[id]/reportar/route.ts`
- Modify: `src/app/api/tareas/[id]/aprobar/route.ts`
- Modify: All other API routes and pages that reference `rol` or `RolUsuario`

- [ ] **Step 1: Update data.ts — replace all rol-based filtering with nivel_acceso**

Every place that checks `rol === "CONTRATISTA_INSTALADOR"` or `rol === "CONTRATISTA_LUSTRADOR"` must now check `nivel_acceso === "CONTRATISTA"`.

In `getTareasRecientes` and `getTareasFiltradas`, the parameter changes from `rol?: string` to `nivelAcceso?: string`, and the condition changes from checking two enum values to checking one.

In `getDashboardStats`, the contratista count query changes from `rol: { in: [...] }` to joining through rol_ref:
```typescript
prisma.usuario.count({
  where: {
    constructora_id: constructoraId,
    rol_ref: { nivel_acceso: "CONTRATISTA" },
  },
})
```

- [ ] **Step 2: Update onboarding.ts — create default roles and assign via rol_id**

Replace the hardcoded `rol: "ADMIN"` with:
1. Create all 8 default roles for the new constructora
2. Find the "Administrador" role and assign it to the new admin user
3. Find the "Contratista instalador" / "Contratista lustrador" roles and assign to demo contractors

- [ ] **Step 3: Update layout.tsx — redirect by nivel_acceso**

```typescript
import { getAuthenticatedUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");

  const { nivel_acceso } = auth.usuario;

  // Redirect non-admin users to their views
  if (nivel_acceso === "DIRECTIVO") redirect("/directivo");
  if (nivel_acceso === "CONTRATISTA") redirect("/contratista");
  if (nivel_acceso === "OBRERO") redirect("/login"); // obreros use /o/[token]

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        nivelAcceso={nivel_acceso}
        userName={auth.usuario.nombre}
        constructoraId={auth.usuario.constructora_id}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Update Sidebar.tsx — use nivel_acceso instead of rol**

Change props from `rol` to `nivelAcceso`. Update `allNavItems` to match the new sidebar items for ADMINISTRADOR (adding "sugerencias"). Call `getPermissions(nivelAcceso)` instead of `getPermissions(rol)`.

- [ ] **Step 5: Update API route — usuarios/route.ts**

Change role validation from `["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)` to checking `nivel_acceso === "ADMINISTRADOR"` via the user's rol_ref relation.

Change POST to accept `rol_id` instead of `rol` enum value. Validate `rol_id` belongs to the same constructora. Use `invitarUsuarioSchema` from zod-schemas.

- [ ] **Step 6: Update API route — tareas/[id]/reportar/route.ts**

Update email recipients query from `rol: { in: ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR"] }` to `rol_ref: { nivel_acceso: "ADMINISTRADOR" }`.

- [ ] **Step 7: Update API route — tareas/[id]/aprobar/route.ts**

Replace `rolesAprobadores.includes(aprobador.rol)` with checking `aprobador.rol_ref.nivel_acceso === "ADMINISTRADOR"`.

- [ ] **Step 8: Update all remaining API routes and pages**

Search for all remaining references to `RolUsuario`, `.rol`, or old enum values and update. Key files:
- `src/app/api/proyectos/route.ts`
- `src/app/api/contratistas/route.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/tareas/page.tsx`
- `src/app/(dashboard)/dashboard/usuarios/client.tsx`
- `src/app/(dashboard)/dashboard/contratistas/page.tsx`

- [ ] **Step 9: Build and verify**

```bash
npm run build
```

Expected: Build succeeds with zero type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: update all existing code to use NivelAcceso-based role system"
```

---

## Task 4: Role Management UI (Configuración)

**Agent model:** sonnet (UI component work with clear spec)

**Files:**
- Create: `src/app/api/roles/route.ts`
- Modify: `src/app/(dashboard)/dashboard/configuracion/page.tsx`
- Create: `src/components/dashboard/RolesManager.tsx`

- [ ] **Step 1: Create API route for roles CRUD**

`src/app/api/roles/route.ts`:

GET — list roles for the user's constructora
POST — create a new role (validate with `crearRolSchema`)

Both endpoints require `nivel_acceso === "ADMINISTRADOR"` and filter by `constructora_id`.

- [ ] **Step 2: Create API route for single role operations**

`src/app/api/roles/[id]/route.ts`:

PATCH — edit role name or nivel_acceso (validate with `editarRolSchema`)
DELETE — delete role only if no users are assigned to it

Both endpoints check constructora ownership.

- [ ] **Step 3: Create RolesManager client component**

`src/components/dashboard/RolesManager.tsx`:

A "use client" component that:
- Fetches roles from `/api/roles`
- Shows a table: nombre, nivel_acceso, # usuarios, acciones (edit/delete)
- "Agregar rol" button opens modal with nombre + nivel_acceso select
- Edit opens inline editing or modal
- Delete shows confirmation, disabled if users are assigned

- [ ] **Step 4: Add RolesManager to configuracion page**

Add a new section "Gestión de roles" in the configuration page that renders `<RolesManager />`.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/roles/ src/components/dashboard/RolesManager.tsx src/app/\(dashboard\)/dashboard/configuracion/
git commit -m "feat: add role management CRUD in configuration page"
```

---

## Task 5: Vista Directivo

**Agent model:** sonnet (new pages, clear data requirements)

**Files:**
- Create: `src/app/(directivo)/layout.tsx`
- Create: `src/app/(directivo)/directivo/page.tsx`
- Create: `src/app/(directivo)/directivo/proyecto/[id]/page.tsx`
- Create: `src/components/dashboard/SidebarDirectivo.tsx`
- Create: `src/lib/data-directivo.ts`

- [ ] **Step 1: Create data-directivo.ts**

Data fetching functions for the executive view:
- `getDirectivoStats(constructoraId)` — total projects, overall progress, tasks by status, projects at risk
- `getProyectosResumen(constructoraId)` — all active projects with progress bars and semáforo
- `getProyectoDetallado(proyectoId, constructoraId)` — drill-down: progress by edificio, task distribution, risk alerts

All queries filter by `constructora_id` (tenant isolation).

- [ ] **Step 2: Create SidebarDirectivo.tsx**

Minimal sidebar with:
- Logo Seiricon
- User info (nombre + rol name)
- Nav items: Inicio (LayoutDashboard icon), Proyectos (FolderOpen icon)
- Logout button
- Same responsive behavior as existing Sidebar (mobile hamburger)

- [ ] **Step 3: Create directivo layout.tsx**

```typescript
import { getAuthenticatedUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import SidebarDirectivo from "@/components/dashboard/SidebarDirectivo";

export default async function DirectivoLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  if (auth.usuario.nivel_acceso !== "DIRECTIVO") redirect("/dashboard");

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <SidebarDirectivo userName={auth.usuario.nombre} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create directivo dashboard page**

Shows:
- Topbar with "Vista ejecutiva" title
- Stat cards: proyectos activos, progreso promedio, tareas aprobadas total, proyectos en riesgo
- Progreso por proyecto section (reuse ProgressBar component)
- No management actions, read-only

- [ ] **Step 5: Create project drill-down page**

Shows:
- Topbar with project name
- Back button to directivo home
- Progress by edificio/sección (table or card grid)
- Task status distribution (color-coded summary)
- Risk alerts (tareas in rojo/vinotinto)

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(directivo\)/ src/components/dashboard/SidebarDirectivo.tsx src/lib/data-directivo.ts
git commit -m "feat: add directivo (executive) view with dashboard and project drill-down"
```

---

## Task 6: Vista Contratista — Dashboard and Historial

**Agent model:** sonnet (new pages with clear data requirements)

**Files:**
- Create: `src/app/(contratista)/layout.tsx`
- Create: `src/app/(contratista)/contratista/page.tsx`
- Create: `src/app/(contratista)/contratista/historial/page.tsx`
- Create: `src/components/dashboard/SidebarContratista.tsx`
- Create: `src/lib/data-contratista.ts`

- [ ] **Step 1: Create data-contratista.ts**

- `getContratistaTareas(usuarioId, constructoraId, estado?)` — tasks assigned to this contractor, with semáforo, days left, project info, grouped by project
- `getContratistaProgreso(usuarioId)` — aggregate progress (approved %, reported %)
- `getContratistaHistorial(usuarioId)` — approval history: all Aprobacion records for tasks assigned to this user, with justificacion, date, reviewer name
- `getContratistaObreros(usuarioId)` — obreros created by this contractor with status
- `getContratistaProyectos(usuarioId)` — projects where this contractor has assigned tasks (for sugerir form)

All queries include constructora_id check.

- [ ] **Step 2: Create SidebarContratista.tsx**

Nav items:
- Inicio (LayoutDashboard) → `/contratista`
- Historial (History) → `/contratista/historial`
- Sugerir tarea (Plus) → `/contratista/sugerir`
- Mis obreros (Users) → `/contratista/obreros`
- Reportes (BarChart3) → `/contratista/reportes`

Same responsive pattern as existing sidebar.

- [ ] **Step 3: Create contratista layout.tsx**

Same pattern as directivo layout but checking for `CONTRATISTA` nivel_acceso.

- [ ] **Step 4: Create contratista dashboard page**

- Topbar: "Mis tareas"
- Progress summary: approved % and reported % with bars
- Task list with filters (todos, pendientes, reportadas, aprobadas, no aprobadas)
- Each task shows: nombre, proyecto, edificio/unidad, semáforo, días restantes
- Tasks link to the existing task detail page at `/dashboard/tareas/[id]` (contratista can view but not approve)
- If a task was rejected: shows "No aprobada" badge with motivo

- [ ] **Step 5: Create historial page**

- Topbar: "Historial de aprobaciones"
- Chronological list of approval events
- Each entry: task name, date, estado (aprobada/no_aprobada), justificación, reviewer name
- Filters: by estado, by project
- Color-coded: green for approved, red for rejected

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(contratista\)/ src/components/dashboard/SidebarContratista.tsx src/lib/data-contratista.ts
git commit -m "feat: add contratista view with task dashboard and approval history"
```

---

## Task 7: Sugerencia de Tareas

**Agent model:** sonnet (forms + API + notifications)

**Files:**
- Create: `src/app/(contratista)/contratista/sugerir/page.tsx`
- Create: `src/components/dashboard/SugerirTareaForm.tsx`
- Create: `src/app/(dashboard)/dashboard/sugerencias/page.tsx`
- Create: `src/app/api/sugerencias/route.ts`
- Create: `src/app/api/sugerencias/[id]/route.ts`
- Create: `src/lib/email-templates/sugerencias.ts`

- [ ] **Step 1: Create sugerencias API routes**

`src/app/api/sugerencias/route.ts`:
- GET: for ADMINISTRADOR — list pending/all suggestions for the constructora
- POST: for CONTRATISTA — create suggestion (validate with `sugerirTareaSchema`)
  - Verify the contratista has tasks assigned in the selected proyecto
  - Upload foto to Supabase Storage if provided

`src/app/api/sugerencias/[id]/route.ts`:
- PATCH: for ADMINISTRADOR — approve or reject (validate with `aprobarSugerenciaSchema`)
  - If approved: create Tarea records (one per unidad) assigned to the contratista
  - If rejected: save motivo_rechazo
  - Create Notificacion for the contratista
  - Send email notification

- [ ] **Step 2: Create email templates for suggestions**

`src/lib/email-templates/sugerencias.ts`:
- `sugerenciaNuevaEmailHtml()` — sent to admins when contratista suggests
- `sugerenciaAprobadaEmailHtml()` — sent to contratista
- `sugerenciaRechazadaEmailHtml()` — sent to contratista with motivo

Follow the existing pattern from `notifications.ts`.

- [ ] **Step 3: Create SugerirTareaForm client component**

"use client" component with:
- Project selector (dropdown, only projects where contractor is assigned)
- Edificio/Casa selector (populates based on project)
- Unidad multi-selector (checkboxes or multi-select)
- Nombre input
- Descripción textarea
- CameraCapture for optional photo
- Submit button

On success: show confirmation message, clear form.

- [ ] **Step 4: Create sugerir page for contratista**

Server component that renders Topbar + SugerirTareaForm.
Passes the contractor's project list as props.

- [ ] **Step 5: Create sugerencias page for admin**

`src/app/(dashboard)/dashboard/sugerencias/page.tsx`:
- Topbar: "Sugerencias de tareas"
- List of pending suggestions with: contratista name, proyecto, nombre, fecha, foto thumbnail
- Actions per suggestion: Aprobar (opens modal for tiempo_acordado_dias + fase_id) or Rechazar (textarea for motivo)
- Tabs: Pendientes / Aprobadas / Rechazadas

- [ ] **Step 6: Add "Sugerencias" to admin sidebar with badge**

Update `Sidebar.tsx` to include a "Sugerencias" nav item with a badge showing count of pending suggestions. The count comes from a server component or client-side fetch.

- [ ] **Step 7: Build and verify**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/sugerencias/ src/app/\(contratista\)/contratista/sugerir/ src/app/\(dashboard\)/dashboard/sugerencias/ src/components/dashboard/SugerirTareaForm.tsx src/lib/email-templates/sugerencias.ts
git commit -m "feat: add task suggestion system (contratista suggests, admin approves/rejects)"
```

---

## Task 8: Vista Obrero — Token Access and Simplified UI

**Agent model:** opus (critical security + UX design, token auth, new auth pattern)

**Files:**
- Create: `src/app/o/[token]/layout.tsx`
- Create: `src/app/o/[token]/page.tsx`
- Create: `src/app/o/[token]/tarea/[id]/page.tsx`
- Create: `src/app/api/o/[token]/tareas/route.ts`
- Create: `src/app/api/o/[token]/tareas/[id]/reportar/route.ts`
- Create: `src/app/api/o/[token]/evidencias/route.ts`
- Create: `src/components/obrero/ObreroLayout.tsx`
- Create: `src/components/obrero/TareaCard.tsx`
- Create: `src/components/obrero/ReportarObrero.tsx`
- Create: `src/lib/data-obrero.ts`

- [ ] **Step 1: Create data-obrero.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";

export async function getObreroTareas(contratistaId: string) {
  // Fetch all tasks assigned to the contratista (the obrero's boss)
  // Include: espacio > unidad > piso > edificio > proyecto for ubicación
  // Include: evidencias to check "ya reportada por [nombre]"
  // Order: PENDIENTE first, then REPORTADA, then rest
  // Return: id, nombre, ubicacion, estado, semaforo, diasRestantes, reportadaPor, fotoReferencia
}

export async function getObreroTareaDetalle(tareaId: string, contratistaId: string) {
  // Fetch single task with all details for the report form
  // Verify task belongs to the contratista (security check)
  // Include: foto_referencia_url, current evidencias
}
```

- [ ] **Step 2: Create ObreroLayout component**

Minimal header: Seiricon logo (small) + obrero name + contratista name. No sidebar. Full-width content. Light background. Large touch targets.

- [ ] **Step 3: Create obrero layout.tsx**

```typescript
import { getObreroByToken } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import ObreroLayout from "@/components/obrero/ObreroLayout";

export default async function ObreroTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const obrero = await getObreroByToken(token);

  if (!obrero) {
    // Show friendly error — not a redirect to login
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <img src="/seiricon-icon.png" alt="Seiricon" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-800 mb-2">Enlace no válido</h1>
          <p className="text-sm text-slate-500">
            Este enlace ha expirado o fue desactivado. Contacta a tu contratista para obtener un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  // Fetch contratista name for the header
  const contratista = await prisma.usuario.findUnique({
    where: { id: obrero.contratista_id },
    select: { nombre: true },
  });

  return (
    <ObreroLayout
      obreroNombre={obrero.nombre}
      contratistaNombre={contratista?.nombre ?? ""}
    >
      {children}
    </ObreroLayout>
  );
}
```

- [ ] **Step 4: Create TareaCard component**

Large, touch-friendly card for the obrero task list:
- Min height: 80px
- Task name: 18px font, bold
- Location: 14px, muted
- Status badge: colored (verde=aprobada, gris=pendiente, amarillo=reportada, rojo=rechazada)
- If rejected: shows motivo in red text below
- If reported by another obrero: "Reportada por [nombre]" with check icon
- Photo reference indicator icon if exists
- Entire card is clickable

- [ ] **Step 5: Create obrero task list page (/o/[token]/page.tsx)**

Server component:
1. Get obrero from token (via layout context or re-fetch)
2. Fetch tasks via `getObreroTareas(obrero.contratista_id)`
3. Render list of TareaCard components
4. Group: "Por hacer" section, then "En revisión", then "Completadas"
5. If no tasks: friendly message "No tienes tareas asignadas"

- [ ] **Step 6: Create ReportarObrero component**

"use client" component, simplified version of existing ReportarButton:
- Shows foto de referencia if exists ("Así debe quedar")
- Large "TOMAR FOTOS" button → opens CameraCapture (2-4 photos)
- Large "GRABAR VIDEO" button → opens VideoCapture (30s max)
- Notas textarea with large placeholder
- Large "ENVIAR" button (green, prominent)
- Progress states during upload
- Success confirmation screen

Key difference from ReportarButton: uses `/api/o/[token]/evidencias` and `/api/o/[token]/tareas/[id]/reportar` endpoints (token auth, not Supabase Auth).

- [ ] **Step 7: Create obrero task detail page (/o/[token]/tarea/[id]/page.tsx)**

Server component:
1. Fetch task detail via `getObreroTareaDetalle(tareaId, contratistaId)`
2. If task is PENDIENTE or NO_APROBADA: render ReportarObrero form
3. If task is REPORTADA: show "Esperando aprobación" status
4. If task is APROBADA: show "Aprobada" with green check

- [ ] **Step 8: Create obrero API routes**

`/api/o/[token]/tareas/route.ts` — GET: list tasks for the obrero's contratista
`/api/o/[token]/tareas/[id]/reportar/route.ts` — POST: mark task as reported
`/api/o/[token]/evidencias/route.ts` — POST: upload evidence (similar to existing `/api/evidencias` but with token auth and obrero_id instead of tomada_por)

All routes:
- Validate token via `getObreroByToken(token)`
- Verify task belongs to the obrero's contratista
- Use `obrero_id` in Evidencia instead of `tomada_por`

- [ ] **Step 9: Build and verify**

```bash
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/app/o/ src/app/api/o/ src/components/obrero/ src/lib/data-obrero.ts
git commit -m "feat: add obrero view with token-based access, simplified task list and reporting"
```

---

## Task 9: Gestión de Obreros por Contratista

**Agent model:** sonnet (CRUD UI + API)

**Files:**
- Create: `src/app/(contratista)/contratista/obreros/page.tsx`
- Create: `src/components/dashboard/ObreroManager.tsx`
- Create: `src/app/api/obreros/route.ts`
- Create: `src/app/api/obreros/[id]/route.ts`
- Create: `src/lib/email-templates/obrero.ts`

- [ ] **Step 1: Create obreros API routes**

`/api/obreros/route.ts`:
- GET: list obreros for this contratista (require CONTRATISTA nivel)
- POST: create obrero (validate with `crearObreroSchema`), generate token, return URL

`/api/obreros/[id]/route.ts`:
- PATCH: extend fecha_expiracion, toggle activo
- DELETE: remove obrero (only if no evidencias associated)

All routes verify the obrero belongs to the requesting contratista.

- [ ] **Step 2: Create email template for obrero link**

`src/lib/email-templates/obrero.ts`:
- `obreroLinkEmailHtml({ nombre, contratistaName, url, expiracion })` — email contratista can forward to obrero with their access link

- [ ] **Step 3: Create ObreroManager client component**

"use client" component:
- Table/list of obreros: nombre, estado (activo/expirado/desactivado), fecha expiración, acciones
- "Agregar obrero" button → modal: nombre + fecha inicio + fecha expiración
- On create: show the generated link with "Copiar link" button
- Actions: Copiar link, Extender (date picker), Desactivar/Reactivar
- Expired links show warning badge
- Color coding: green=activo, yellow=próximo a expirar, red=expirado, gray=desactivado

- [ ] **Step 4: Create obreros page**

Server component with Topbar "Mis obreros" + ObreroManager.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(contratista\)/contratista/obreros/ src/components/dashboard/ObreroManager.tsx src/app/api/obreros/ src/lib/email-templates/obrero.ts
git commit -m "feat: add obrero management for contractors (create, share link, extend, deactivate)"
```

---

## Task 10: Reportes PDF del Contratista

**Agent model:** sonnet (PDF generation, follows existing pattern)

**Files:**
- Create: `src/lib/pdf/ContratistaTareasReport.tsx`
- Create: `src/lib/pdf/ContratistaHistorialReport.tsx`
- Create: `src/app/(contratista)/contratista/reportes/page.tsx`
- Create: `src/app/api/reportes/contratista/tareas/route.ts`
- Create: `src/app/api/reportes/contratista/historial/route.ts`

- [ ] **Step 1: Create ContratistaTareasReport PDF component**

Follow the pattern of existing `ProgresoReport.tsx`:
- Header with Seiricon branding
- Contractor name + date
- Summary: total tasks, approved, reported, pending, rejected
- Table: task name, project, building/unit, status, days, semáforo color
- Footer with page numbers

- [ ] **Step 2: Create ContratistaHistorialReport PDF component**

- Header with Seiricon branding
- Contractor name + date range
- Table: task name, project, date, estado, justificación
- Color-coded rows (green=approved, red=rejected)

- [ ] **Step 3: Create API routes for PDF generation**

`/api/reportes/contratista/tareas/route.ts`:
- GET: generate PDF of contractor's tasks
- Require CONTRATISTA nivel
- Use `renderToBuffer` from @react-pdf/renderer

`/api/reportes/contratista/historial/route.ts`:
- GET: generate PDF of approval history
- Same auth pattern

- [ ] **Step 4: Create reportes page for contratista**

Shows download buttons for each report type, same pattern as existing `/dashboard/reportes` page.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf/Contratista*.tsx src/app/\(contratista\)/contratista/reportes/ src/app/api/reportes/contratista/
git commit -m "feat: add PDF report generation for contractors (tasks + approval history)"
```

---

## Task 11: Zonas Comunes

**Agent model:** sonnet (data templates + UI additions to existing wizard)

**Files:**
- Modify: `src/lib/task-templates.ts`
- Modify: `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx`
- Modify: existing project views to show zonas comunes differently

- [ ] **Step 1: Add zonas comunes templates to task-templates.ts**

```typescript
export const ZONAS_COMUNES_SUGERIDAS = [
  "Lobby",
  "Piscina",
  "Salón de eventos",
  "Portería",
  "Pasillos",
  "Baños comunes",
  "Zona de juegos infantiles",
  "Terraza BBQ",
];

// Add to TASK_TEMPLATES:
"Zonas Comunes": {
  Lobby: [
    { nombre: "Estuco paredes lobby", tiempo_acordado_dias: 3 },
    { nombre: "Pintura muros lobby", tiempo_acordado_dias: 2 },
    { nombre: "Pintura techo lobby", tiempo_acordado_dias: 2 },
    { nombre: "Acabado recepción", tiempo_acordado_dias: 2 },
  ],
  Piscina: [
    { nombre: "Baldosería borde piscina", tiempo_acordado_dias: 4 },
    { nombre: "Baldosería duchas piscina", tiempo_acordado_dias: 3 },
    { nombre: "Pintura caseta máquinas", tiempo_acordado_dias: 1 },
  ],
  "Salón de eventos": [
    { nombre: "Estuco paredes salón", tiempo_acordado_dias: 3 },
    { nombre: "Pintura muros salón", tiempo_acordado_dias: 2 },
    { nombre: "Pintura techo salón", tiempo_acordado_dias: 2 },
    { nombre: "Acabado barra salón", tiempo_acordado_dias: 2 },
  ],
  Portería: [
    { nombre: "Estuco paredes portería", tiempo_acordado_dias: 1 },
    { nombre: "Pintura portería", tiempo_acordado_dias: 1 },
    { nombre: "Acabado módulo portero", tiempo_acordado_dias: 1 },
  ],
  Pasillos: [
    { nombre: "Pintura muros pasillos", tiempo_acordado_dias: 3 },
    { nombre: "Pintura techo pasillos", tiempo_acordado_dias: 2 },
  ],
  "Baños comunes": [
    { nombre: "Baldosería pisos baños comunes", tiempo_acordado_dias: 2 },
    { nombre: "Baldosería paredes baños comunes", tiempo_acordado_dias: 2 },
    { nombre: "Pintura techo baños comunes", tiempo_acordado_dias: 1 },
  ],
  "Zona de juegos infantiles": [
    { nombre: "Pintura muros perimetrales zona infantil", tiempo_acordado_dias: 2 },
    { nombre: "Acabado piso zona infantil", tiempo_acordado_dias: 2 },
  ],
  "Terraza BBQ": [
    { nombre: "Baldosería piso terraza", tiempo_acordado_dias: 3 },
    { nombre: "Pintura muros terraza", tiempo_acordado_dias: 2 },
    { nombre: "Acabado mesón BBQ", tiempo_acordado_dias: 2 },
  ],
},
```

- [ ] **Step 2: Add "Agregar zonas comunes" to project wizard**

In the wizard step where buildings are configured, add a button/toggle:
"Agregar zonas comunes al proyecto"

When enabled:
- Shows checklist of `ZONAS_COMUNES_SUGERIDAS`
- User selects which zones apply to this project
- These are created as an Edificio with `es_zona_comun: true`, single Piso, and one Unidad per selected zone
- Tasks are auto-populated from the zonas comunes templates

- [ ] **Step 3: Update project detail views to display zonas comunes separately**

In the project detail page, zonas comunes (Edificios with `es_zona_comun: true`) are shown in a separate section below the regular buildings, with a different visual treatment (e.g., different icon, "Zonas Comunes" header).

- [ ] **Step 4: Update the wizard API route to handle zonas comunes**

The `/api/proyectos/wizard` route needs to accept zonas comunes data and create the Edificio with `es_zona_comun: true`.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/task-templates.ts src/app/\(dashboard\)/dashboard/proyectos/
git commit -m "feat: add zonas comunes support with suggested zones and templates"
```

---

## Task 12: Notificaciones In-App

**Agent model:** sonnet (API + UI component)

**Files:**
- Create: `src/app/api/notificaciones/route.ts`
- Create: `src/components/dashboard/NotificacionesDropdown.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx` — wire notification bell
- Modify: `src/app/api/tareas/[id]/aprobar/route.ts` — create notification on approve/reject
- Modify: `src/app/api/sugerencias/[id]/route.ts` — create notification on suggestion approved/rejected

- [ ] **Step 1: Create notificaciones API route**

GET — list notifications for current user (paginated, newest first)
PATCH — mark one or all as read

- [ ] **Step 2: Create NotificacionesDropdown client component**

- Bell icon with red badge showing unread count
- On click: dropdown with list of recent notifications
- Each notification: icon by type, title, message, timestamp, read/unread indicator
- Click notification → navigate to link
- "Marcar todas como leídas" button
- Polls every 30 seconds for new count (or use simpler approach)

- [ ] **Step 3: Wire notifications into Sidebar**

Replace the static Bell button in Sidebar with NotificacionesDropdown component. Pass the userId for fetching.

- [ ] **Step 4: Create notification helper function**

`src/lib/notifications.ts`:
```typescript
export async function crearNotificacion(data: {
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  link?: string;
}) { ... }
```

- [ ] **Step 5: Add notification creation to existing flows**

In `/api/tareas/[id]/aprobar/route.ts`: create notification for contratista when task is approved/rejected.
In `/api/sugerencias/[id]/route.ts`: create notification for contratista when suggestion is approved/rejected.
In obrero report routes: create notification for contratista when obrero reports a task.

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/notificaciones/ src/components/dashboard/NotificacionesDropdown.tsx src/lib/notifications.ts
git commit -m "feat: add in-app notification system with bell dropdown and real-time count"
```

---

## Task 13: Foto de Referencia en Tareas

**Agent model:** haiku (small, focused feature)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/tareas/[id]/page.tsx` — show reference photo
- Modify: `src/app/api/tareas/route.ts` — accept foto_referencia_url
- Modify: task creation in wizard and API

- [ ] **Step 1: Add foto_referencia_url support to task creation**

When creating tasks (in wizard or via API), allow optional `foto_referencia_url`. Upload to Supabase Storage bucket "evidencias" under `referencia/{tarea_id}/`.

- [ ] **Step 2: Show reference photo in task detail page**

In the admin task detail page, if `foto_referencia_url` exists, show it with label "Foto de referencia" in a collapsible section.

- [ ] **Step 3: Show reference photo in obrero view**

In `/o/[token]/tarea/[id]/page.tsx`, if the task has a reference photo, show it at the top with text "Así debe quedar" before the report form.

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/tareas/ src/app/o/ src/app/api/tareas/
git commit -m "feat: add optional reference photo for tasks, visible to obreros and admins"
```

---

## Task 14: Security Hardening

**Agent model:** opus (critical security work, requires judgment)

**Files:**
- Modify: `next.config.ts`
- Modify: All API routes (audit)
- Create: Security tests

- [ ] **Step 1: Add security headers to next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co",
              "media-src 'self' blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Audit all API routes for auth + tenant isolation**

Systematically review every API route and verify:
1. Auth check present (Supabase getUser or token validation)
2. Nivel_acceso check present (via `requireNivel()`)
3. constructora_id filter in all database queries
4. Resource ownership check (contratista can only access own tasks, etc.)
5. Input validation with zod schemas

Routes to audit:
- `/api/proyectos/route.ts`
- `/api/proyectos/wizard/route.ts`
- `/api/tareas/route.ts`
- `/api/tareas/[id]/reportar/route.ts`
- `/api/tareas/[id]/aprobar/route.ts`
- `/api/tareas/[id]/notas/route.ts`
- `/api/edificios/route.ts`
- `/api/evidencias/route.ts`
- `/api/retrasos/route.ts`
- `/api/extensiones/route.ts`
- `/api/contratistas/route.ts`
- `/api/usuarios/route.ts`
- `/api/usuarios/[id]/route.ts`
- `/api/roles/route.ts` (new)
- `/api/sugerencias/route.ts` (new)
- `/api/obreros/route.ts` (new)
- `/api/notificaciones/route.ts` (new)
- `/api/o/[token]/*` routes (new)
- `/api/reportes/*` routes

- [ ] **Step 3: Add rate limiting to public-facing endpoints**

Add simple in-memory rate limiting (or use a lightweight library) for:
- Login / registration
- Obrero token endpoints
- Evidence upload

- [ ] **Step 4: Validate file uploads**

In `/api/evidencias/route.ts` and obrero evidence route:
- Check Content-Type: only `image/jpeg`, `image/png`, `video/mp4`
- Check file size: photos max 10MB, videos max 50MB
- Reject all other types

- [ ] **Step 5: Add Supabase RLS policies**

Create SQL migration to add Row Level Security policies to critical tables:
- `usuarios`: can only select/update own constructora
- `tareas`: can only select via constructora chain
- `evidencias`: can only select via tarea ownership

Note: RLS is a defense-in-depth measure. The app always uses the service role key for DB access via Prisma, so RLS acts as a safety net.

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add next.config.ts src/app/api/ prisma/
git commit -m "security: add security headers, audit API auth, rate limiting, file validation, RLS policies"
```

---

## Task 15: End-to-End Testing and Debug

**Agent model:** opus (comprehensive testing, security verification)

**Files:**
- Create: E2E test files
- Run: manual verification

- [ ] **Step 1: Test role system**

Verify:
- New user registration creates default roles
- Admin can create/edit/delete roles
- Role deletion blocked if users assigned
- User nivel_acceso correctly determines view redirect

- [ ] **Step 2: Test vista directivo**

Verify:
- Directivo user sees executive dashboard
- Can drill down into projects
- Cannot access admin routes (redirect)
- Can only see own constructora's data

- [ ] **Step 3: Test vista contratista**

Verify:
- Contratista user sees their tasks only
- Can filter by estado and project
- Historial shows approval events with justification
- Can suggest tasks
- Can manage obreros (create, copy link, deactivate)
- Can download PDF reports
- Cannot access admin routes (redirect)
- Cannot see other contractors' data

- [ ] **Step 4: Test vista obrero**

Verify:
- Valid token shows task list
- Expired token shows error page
- Deactivated token shows error page
- Invalid token shows error page
- Can take photos and video
- Can submit report (task changes to REPORTADA)
- "Reportada por [nombre]" appears for other obreros
- Cannot access other contractors' tasks
- Reference photo shows when available

- [ ] **Step 5: Test sugerencia de tareas**

Verify:
- Contratista can create suggestion with photo
- Admin sees pending suggestion with notification
- Admin can approve → tasks created
- Admin can reject → contratista sees motivo
- Email notifications sent

- [ ] **Step 6: Test notifications**

Verify:
- Bell shows unread count
- Dropdown shows recent notifications
- Mark as read works
- Notifications created for: approve, reject, suggestion approved/rejected, obrero reported

- [ ] **Step 7: Test security**

Verify each test case from spec section 14.6:
- Cross-tenant access: constructora A cannot see constructora B data
- Cross-role access: contratista cannot access admin routes
- Cross-contractor access: contratista A cannot see contratista B tasks
- Expired token: obrero gets friendly error
- Unauthenticated: all API routes return 401
- Invalid file upload: rejected with 400
- Security headers: present in all responses

- [ ] **Step 8: Test zonas comunes**

Verify:
- Wizard shows "Agregar zonas comunes" option
- Selected zones create edificio with es_zona_comun=true
- Suggested tasks are auto-populated
- Project detail shows zonas comunes section separately
- Progress calculations include zonas comunes

- [ ] **Step 9: Full build verification**

```bash
npm run build
npx prisma generate
```

Expected: Clean build, zero errors.

- [ ] **Step 10: Commit all test files**

```bash
git add -A
git commit -m "test: comprehensive E2E tests for all role views, security, and zonas comunes"
```

---

## Task 16: Update Onboarding and Demo Data

**Agent model:** sonnet (data script update)

**Files:**
- Modify: `src/lib/onboarding.ts`

- [ ] **Step 1: Update onboarding to create default roles**

When a new constructora is provisioned:
1. Create all 8 default roles
2. Assign "Administrador" role to the new user
3. Create demo contractors with "Contratista instalador" and "Contratista lustrador" roles
4. Create a demo obrero linked to one of the contractors

- [ ] **Step 2: Add demo zonas comunes to Proyecto Olivo**

Add a "Zonas Comunes" edificio with Lobby and Piscina, each with a few tasks.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/onboarding.ts
git commit -m "feat: update onboarding to create default roles, demo obrero, and zonas comunes"
```
