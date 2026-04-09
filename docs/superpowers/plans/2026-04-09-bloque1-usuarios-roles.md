# Bloque 1: Gestión de Usuarios y Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin puede invitar usuarios con roles, cada rol ve solo lo que le corresponde, gestión de usuarios completa.

**Architecture:** Supabase Admin API (service role) para crear cuentas. Helper `getPermissions(rol)` centraliza permisos. Sidebar se filtra por rol. Resend para emails de invitación.

**Tech Stack:** Next.js 16 App Router, Supabase Auth Admin, Prisma 7, Resend, TypeScript

---

## File Map

### Archivos a CREAR:
| File | Responsibility |
|------|---------------|
| `src/lib/permissions.ts` | Helper `getPermissions(rol)` que retorna permisos por rol |
| `src/lib/supabase/admin.ts` | Supabase client con service_role key para operaciones admin |
| `src/lib/email.ts` | Cliente Resend + función de envío de emails |
| `src/lib/email-templates/invitation.ts` | Template HTML del email de invitación |
| `src/app/api/usuarios/route.ts` | GET (listar) + POST (invitar) usuarios de la constructora |
| `src/app/api/usuarios/[id]/route.ts` | PATCH (cambiar rol) + DELETE (desactivar) usuario |
| `src/app/(dashboard)/dashboard/usuarios/page.tsx` | Página de gestión de usuarios |
| `src/components/dashboard/InviteUserModal.tsx` | Modal para invitar nuevo usuario |
| `src/components/dashboard/RoleSidebar.tsx` | Sidebar filtrado por rol (reemplaza Sidebar.tsx) |

### Archivos a MODIFICAR:
| File | Change |
|------|--------|
| `src/lib/data.ts` | Agregar `getUsuarios(constructoraId)` |
| `src/app/(dashboard)/layout.tsx` | Usar RoleSidebar en vez de Sidebar |
| `src/components/dashboard/Topbar.tsx` | Mostrar nombre real del usuario y rol |

---

## Task 1: Permissions helper

**Files:**
- Create: `src/lib/permissions.ts`

- [ ] **Step 1: Crear el helper de permisos**

```typescript
// src/lib/permissions.ts

export type RolUsuario =
  | "ADMIN"
  | "JEFE_OPERACIONES"
  | "COORDINADOR"
  | "ASISTENTE"
  | "AUXILIAR"
  | "CONTRATISTA_INSTALADOR"
  | "CONTRATISTA_LUSTRADOR";

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

const ROL_LABELS: Record<RolUsuario, string> = {
  ADMIN: "Administrador",
  JEFE_OPERACIONES: "Jefe de operaciones",
  COORDINADOR: "Coordinador",
  ASISTENTE: "Asistente",
  AUXILIAR: "Auxiliar de obra",
  CONTRATISTA_INSTALADOR: "Contratista instalador",
  CONTRATISTA_LUSTRADOR: "Contratista lustrador",
};

export function getRolLabel(rol: string): string {
  return ROL_LABELS[rol as RolUsuario] ?? rol;
}

export function getPermissions(rol: string): Permissions {
  switch (rol) {
    case "ADMIN":
    case "JEFE_OPERACIONES":
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
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "reportes", "usuarios", "configuracion"],
      };
    case "COORDINADOR":
    case "ASISTENTE":
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
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "reportes"],
      };
    case "AUXILIAR":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard", "proyectos", "tareas"],
      };
    case "CONTRATISTA_INSTALADOR":
    case "CONTRATISTA_LUSTRADOR":
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol" && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: helper de permisos por rol"
```

---

## Task 2: Supabase admin client + Resend email client

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/email.ts`
- Create: `src/lib/email-templates/invitation.ts`

- [ ] **Step 1: Install resend**

```bash
cd "/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol" && npm install resend
```

- [ ] **Step 2: Create Supabase admin client**

```typescript
// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

// Client with service_role key — ONLY use server-side for admin operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

- [ ] **Step 3: Create email client and send function**

```typescript
// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const { error } = await resend.emails.send({
    from: "ObraControl <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
```

- [ ] **Step 4: Create invitation email template**

```typescript
// src/lib/email-templates/invitation.ts

interface InvitationEmailProps {
  nombreInvitado: string;
  nombreConstructora: string;
  rol: string;
  loginUrl: string;
  password: string;
}

export function invitationEmailHtml({
  nombreInvitado,
  nombreConstructora,
  rol,
  loginUrl,
  password,
}: InvitationEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #2563eb; padding: 24px 32px;">
      <h1 style="color: white; font-size: 20px; margin: 0;">ObraControl</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 8px;">Hola ${nombreInvitado},</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te han invitado a <strong>${nombreConstructora}</strong> en ObraControl como <strong>${rol}</strong>.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Tu contraseña temporal es: <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${password}</code>
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te recomendamos cambiarla después de tu primer inicio de sesión.
      </p>
      <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 16px;">
        Ingresar a ObraControl
      </a>
    </div>
    <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Este email fue enviado por ObraControl. Si no esperabas esta invitación, puedes ignorarlo.</p>
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/email.ts src/lib/email-templates/invitation.ts package.json package-lock.json
git commit -m "feat: Supabase admin client + Resend email con template de invitación"
```

---

## Task 3: API routes for users

**Files:**
- Create: `src/app/api/usuarios/route.ts`
- Create: `src/app/api/usuarios/[id]/route.ts`

- [ ] **Step 1: Create GET + POST /api/usuarios**

```typescript
// src/app/api/usuarios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { invitationEmailHtml } from "@/lib/email-templates/invitation";
import { getRolLabel } from "@/lib/permissions";

// GET /api/usuarios — list users of the constructora
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol: true },
    });
    if (!currentUser || !["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      where: { constructora_id: currentUser.constructora_id },
      select: { id: true, email: true, nombre: true, rol: true, created_at: true },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error("GET /api/usuarios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/usuarios — invite a new user
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: { constructora: { select: { id: true, nombre: true } } },
    });
    if (!currentUser || !["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)) {
      return NextResponse.json({ error: "Sin permisos para invitar usuarios" }, { status: 403 });
    }

    const body = await req.json();
    const { email, nombre, rol } = body;

    if (!email || !nombre || !rol) {
      return NextResponse.json({ error: "email, nombre y rol son requeridos" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR", "ASISTENTE", "AUXILIAR", "CONTRATISTA_INSTALADOR", "CONTRATISTA_LUSTRADOR"];
    if (!validRoles.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con este email" }, { status: 409 });
    }

    // Generate temporary password
    const tempPassword = `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Create Supabase Auth user (skips email confirmation)
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json({ error: `Error creando cuenta: ${authError.message}` }, { status: 500 });
    }

    // Create Prisma user
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        constructora_id: currentUser.constructora_id,
        rol: rol as never,
      },
    });

    // If contractor role, create Contratista profile
    if (rol === "CONTRATISTA_INSTALADOR" || rol === "CONTRATISTA_LUSTRADOR") {
      await prisma.contratista.create({
        data: {
          usuario_id: nuevoUsuario.id,
          score_cumplimiento: 80,
          score_calidad: 80,
          score_velocidad_correccion: 80,
          score_total: 80,
        },
      });
    }

    // Send invitation email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://obracontrol-sigma.vercel.app";
    try {
      await sendEmail({
        to: email,
        subject: `Te han invitado a ${currentUser.constructora.nombre} en ObraControl`,
        html: invitationEmailHtml({
          nombreInvitado: nombre,
          nombreConstructora: currentUser.constructora.nombre,
          rol: getRolLabel(rol),
          loginUrl: `${siteUrl}/login`,
          password: tempPassword,
        }),
      });
    } catch {
      // Email failed but user was created — don't block
      console.error("Failed to send invitation email");
    }

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("POST /api/usuarios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PATCH + DELETE /api/usuarios/[id]**

```typescript
// src/app/api/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/usuarios/[id] — change role
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
      select: { constructora_id: true, rol: true },
    });
    if (!currentUser || !["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rol } = body;

    const validRoles = ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR", "ASISTENTE", "AUXILIAR", "CONTRATISTA_INSTALADOR", "CONTRATISTA_LUSTRADOR"];
    if (!rol || !validRoles.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { rol: rol as never },
    });

    // Create Contratista profile if role changed to contractor and doesn't exist
    if ((rol === "CONTRATISTA_INSTALADOR" || rol === "CONTRATISTA_LUSTRADOR")) {
      const existing = await prisma.contratista.findUnique({ where: { usuario_id: id } });
      if (!existing) {
        await prisma.contratista.create({
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/usuarios/
git commit -m "feat: API routes para gestión de usuarios (invitar, listar, cambiar rol)"
```

---

## Task 4: Users management page + invite modal

**Files:**
- Create: `src/app/(dashboard)/dashboard/usuarios/page.tsx`
- Create: `src/components/dashboard/InviteUserModal.tsx`
- Modify: `src/lib/data.ts` — add `getUsuarios()`

- [ ] **Step 1: Add getUsuarios to data.ts**

Add to the end of `src/lib/data.ts`:

```typescript
// Usuarios de la constructora
export async function getUsuarios(constructoraId: string) {
  return prisma.usuario.findMany({
    where: { constructora_id: constructoraId },
    select: { id: true, email: true, nombre: true, rol: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
}
```

- [ ] **Step 2: Create InviteUserModal (client component)**

```typescript
// src/components/dashboard/InviteUserModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Mail, User, Shield } from "lucide-react";

const roles = [
  { value: "COORDINADOR", label: "Coordinador de instalaciones" },
  { value: "ASISTENTE", label: "Asistente de instalaciones" },
  { value: "AUXILIAR", label: "Auxiliar de obra" },
  { value: "CONTRATISTA_INSTALADOR", label: "Contratista instalador" },
  { value: "CONTRATISTA_LUSTRADOR", label: "Contratista lustrador" },
  { value: "JEFE_OPERACIONES", label: "Jefe de operaciones" },
  { value: "ADMIN", label: "Administrador" },
];

export default function InviteUserModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const body = {
      email: form.get("email"),
      nombre: form.get("nombre"),
      rol: form.get("rol"),
    };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
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
                name="rol" required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 appearance-none bg-white cursor-pointer"
              >
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

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

- [ ] **Step 3: Create usuarios page (server component + client wrapper)**

```typescript
// src/app/(dashboard)/dashboard/usuarios/page.tsx
import { redirect } from "next/navigation";
import { getUsuarioActual, getUsuarios } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import { getRolLabel } from "@/lib/permissions";
import UsuariosClient from "./client";

export default async function UsuariosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!["ADMIN", "JEFE_OPERACIONES"].includes(usuario.rol)) redirect("/dashboard");

  const usuarios = await getUsuarios(usuario.constructora_id);

  const mapped = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    rolLabel: getRolLabel(u.rol),
    created_at: u.created_at.toISOString(),
  }));

  return (
    <>
      <Topbar title="Usuarios" subtitle="Gestión del equipo" />
      <UsuariosClient usuarios={mapped} />
    </>
  );
}
```

Create the client part:

```typescript
// src/app/(dashboard)/dashboard/usuarios/client.tsx
"use client";

import { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import InviteUserModal from "@/components/dashboard/InviteUserModal";

interface UserRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rolLabel: string;
  created_at: string;
}

export default function UsuariosClient({ usuarios }: { usuarios: UserRow[] }) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Invitar usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Nombre</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Desde</span>
        </div>
        {usuarios.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-800">{u.nombre}</span>
            </div>
            <span className="text-sm text-slate-500 truncate">{u.email}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3" />
              {u.rolLabel}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
            </span>
          </div>
        ))}
      </div>

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
    </main>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/usuarios/ src/components/dashboard/InviteUserModal.tsx src/lib/data.ts
git commit -m "feat: página de gestión de usuarios con invitación por email"
```

---

## Task 5: Role-filtered Sidebar

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Modify the dashboard layout to pass user role**

Read current `src/app/(dashboard)/layout.tsx` and update it to fetch the user and pass the role to Sidebar as a prop.

The layout becomes an async server component that calls `getUsuarioActual()` and passes `rol` to the Sidebar.

- [ ] **Step 2: Update Sidebar to accept `rol` prop and filter nav items**

Add `rol?: string` prop to Sidebar. Import `getPermissions` from `@/lib/permissions`. Filter `navItems` based on `permissions.sidebarItems`. Add "Usuarios" nav item (with UsersRound icon) that only shows for ADMIN/JEFE_OPERACIONES.

The full navItems map becomes:
```typescript
const allNavItems = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { key: "proyectos", icon: FolderOpen, label: "Proyectos", href: "/dashboard/proyectos" },
  { key: "tareas", icon: ClipboardList, label: "Tareas", href: "/dashboard/tareas" },
  { key: "contratistas", icon: Users, label: "Contratistas", href: "/dashboard/contratistas" },
  { key: "reportes", icon: BarChart3, label: "Reportes", href: "/dashboard/reportes" },
  { key: "usuarios", icon: UsersRound, label: "Usuarios", href: "/dashboard/usuarios" },
  { key: "configuracion", icon: Settings, label: "Configuración", href: "/dashboard/configuracion" },
];
```

Filter: `allNavItems.filter(item => permissions.sidebarItems.includes(item.key))`

- [ ] **Step 3: Update Topbar to show real user name**

Read the current Topbar. It's a client component — change it to accept optional `userName` and `userRole` props, and display them in the avatar area instead of hardcoded "Jaramillo Mora / Administrador".

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Test locally**

```bash
npm run dev
```

Open http://localhost:3001/dashboard — sidebar should show all items for admin. Navigate to /dashboard/usuarios — should show user list with invite button.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx src/components/dashboard/Topbar.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: sidebar y topbar filtrados por rol del usuario"
```

---

## Task 6: Filter tasks by assigned user for contractors

**Files:**
- Modify: `src/lib/data.ts` — update `getTareasFiltradas` and `getTareasRecientes`
- Modify: `src/lib/data-detail.ts` — update `getTareaDetalle` to verify access

- [ ] **Step 1: Update getTareasFiltradas to filter by role**

Modify `getTareasFiltradas` in `src/lib/data.ts` to accept an optional `userId` and `rol` parameter. When rol is CONTRATISTA_INSTALADOR or CONTRATISTA_LUSTRADOR, add `asignado_a: userId` to the where clause. Same for getTareasRecientes.

- [ ] **Step 2: Update dashboard page to pass role context**

In `src/app/(dashboard)/dashboard/page.tsx` and `src/app/(dashboard)/dashboard/tareas/page.tsx`, get the user's role from `getUsuarioActual()` and pass it to the data functions.

For contractors: `getTareasRecientes(cid, 8, usuario.id, usuario.rol)`
For admin/coordinador: `getTareasRecientes(cid, 8)` (no filter)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/data.ts src/lib/data-detail.ts src/app/
git commit -m "feat: contratistas solo ven sus tareas asignadas"
```

---

## Task 7: Push and verify

- [ ] **Step 1: Add env vars to Vercel**

Victor needs to add these in Vercel → Settings → Environment Variables:
- `SUPABASE_SERVICE_ROLE_KEY` = the service role key
- `RESEND_API_KEY` = the Resend key

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verify with Playwright**

Open browser, register new account, go to /dashboard/usuarios, invite a test user, verify email received, login as invited user, verify sidebar is filtered by role.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Permissions helper | permissions.ts |
| 2 | Supabase admin + Resend email | admin.ts, email.ts, invitation.ts |
| 3 | API routes usuarios | api/usuarios/route.ts, api/usuarios/[id]/route.ts |
| 4 | Users page + invite modal | usuarios/page.tsx, client.tsx, InviteUserModal.tsx |
| 5 | Role-filtered sidebar + topbar | Sidebar.tsx, Topbar.tsx, layout.tsx |
| 6 | Filter tasks by role | data.ts, data-detail.ts, page files |
| 7 | Deploy + verify | Vercel env vars + Playwright |
