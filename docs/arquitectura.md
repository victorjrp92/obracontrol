# ObraControl / Seiricon — Arquitectura del Sistema

> Última actualización: 2026-04-30

## 1. Visión general

SaaS multi-tenant para constructoras: trazabilidad de cada tarea de cada unidad (apto/casa) con fechas, contratista responsable, evidencias fotográficas y aprobaciones.

### Stack

| Capa | Tecnología |
|---|---|
| Frontend / SSR | Next.js 16 (App Router) en Vercel |
| Auth | Supabase Auth |
| Base de datos | Postgres (Supabase) vía Prisma 7 |
| Storage | Supabase Storage (a migrar a Cloudflare R2) |
| Email | Resend |
| PWA | Serwist (modo offline para obreros) |

### Modelo multi-tenant

El **tenant** es la `Constructora`. Todas las entidades pertenecen a ella vía `constructora_id`. Solo `SUPER_ADMIN` cruza tenants.

```
Constructora (1) ──┬── (n) Proyecto ──┬── (n) Edificio ── Piso ── Unidad ── Espacio ── Tarea
                   │                  └── (n) Fase
                   ├── (n) Usuario  (con Rol)
                   ├── (n) Rol
                   └── (n) Obrero ──── (n) Evidencia
```

## 2. Roles y jerarquía

| Rol | Alcance | Ruta base |
|---|---|---|
| 🔴 **SUPER_ADMIN** | Cross-tenant. Único que ve obreros/contratistas con scoring global. | `/super-admin/*` |
| 🟣 **DIRECTIVO** | Tenant completo, vista ejecutiva | `/directivo/*` |
| 🟠 **ADMIN_GENERAL** | Toda su constructora | `/dashboard/*` |
| 🟡 **ADMIN_PROYECTO** (Admin Junior) | Solo proyectos asignados | `/dashboard/*` |
| 🟢 **CONTRATISTA** | Sus tareas + sus obreros | `/contratista/*` |
| 🔵 **OBRERO** | Acceso por token único (sin login) | `/o/{token}/*` |

Login redirige según rol vía `getHomePathForRole()` en `src/lib/access.ts`.

## 3. Permisos (matriz canónica)

| Acción | 🔴 Super | 🟣 Direct | 🟠 AG | 🟡 AJ | 🟢 Cont | 🔵 Obr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Crear constructora | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear / eliminar proyecto | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Aprobar tareas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Invitar usuarios | ✅ | ❌ | ✅ | ✅* | ❌ | ❌ |
| **Lista global Contratistas + scoring** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lista global Obreros + scoring** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver equipo de UN proyecto | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear obreros | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Reportar tarea | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Editar perfil propio | ✅ | ✅ | ✅ | ✅ | ✅ | n/a |

\* Admin Junior solo puede invitar Contratista u Obrero.

> **Decisión clave** (2026-04-30): obreros/contratistas con datos personales + scoring son **exclusivos de Super Admin**. El resto ve el equipo del proyecto vía `/dashboard/proyectos/[id]/equipo` (sin scoring expuesto).

## 4. Trazabilidad

### Por número de registro
- `Proyecto.numero_registro` único por constructora (lo escribe el Admin)
- `Tarea.numero_registro` autogenerado `{PR-2026-001}-T0001`
- Renumera en cascada al editar el proyecto

### Por estado
`PENDIENTE → REPORTADA → (APROBADA | NO_APROBADA → REPORTADA → APROBADA)`. Cada ciclo queda en `Aprobacion`.

### Audit log
`AuditLog { proyecto_id, usuario_id, accion, campo, valor_anterior, valor_nuevo }`.

## 5. Decisiones arquitectónicas

- **Usuario.constructora_id NOT NULL**: SUPER_ADMIN vive en constructora "Sistema Seiricon" (no se muestra como cliente).
- **numero_registro nullable**: compat legacy. Backfill con `npm run db:backfill-numeros`.
- **contratista_default_id onDelete:SetNull**: si se elimina al contratista, el proyecto sobrevive y el Admin reasigna.
- **Scoring eventual consistency**: solo se recalcula al aprobar/rechazar tarea.

## 6. Performance

Índices ya creados: ver [auditoria-bd.md](./auditoria-bd.md).

## 7. Cómo agregar una feature

1. **DB**: schema.prisma + migración SQL idempotente
2. **Apply**: `npx tsx apply-mig.ts` + `npx prisma generate`
3. **Permisos**: helper en `src/lib/access.ts`
4. **API**: ruta con validación + error logging real
5. **UI**: server component + client al lado
6. **Sidebar**: agregar item a `permissions.sidebarItems`
7. **Documentar**: actualizar este archivo + `casos-de-uso.md`

## 8. Archivos clave

- Schema: [prisma/schema.prisma](../prisma/schema.prisma)
- Permisos: [src/lib/permissions.ts](../src/lib/permissions.ts) · [src/lib/access.ts](../src/lib/access.ts)
- Wizard proyecto: [src/app/api/proyectos/wizard/route.ts](../src/app/api/proyectos/wizard/route.ts)
- Scoring: [src/lib/scoring.ts](../src/lib/scoring.ts) · [src/lib/obrero.ts](../src/lib/obrero.ts)
- Numeración: [src/lib/numero-registro.ts](../src/lib/numero-registro.ts)
