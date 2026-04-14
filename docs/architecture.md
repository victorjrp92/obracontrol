# Arquitectura ObraControl

**Versión:** 1.0
**Fecha:** 2026-04-13
**Autor:** Equipo ObraControl (Karen, Víctor + revisión técnica)

---

## 1. Decisión central: monolito SaaS multi-tenant

ObraControl es una aplicación **monolítica full-stack** construida con Next.js 16, desplegada en Vercel, respaldada por Supabase (Postgres + Auth + Storage) y Resend (emails transaccionales).

**No se separa back de front.** Esto es una decisión deliberada, no una deuda técnica.

### ¿Por qué no separar back y front?

1. **Next.js 16 (App Router) con React Server Components + Server Actions** elimina la razón histórica por la que se separaba: ya no hay un contrato REST "entre dos repos". Los componentes servidor consultan Prisma directamente; los Server Actions mutan sin contratos intermedios. Separar introduciría doble auth, CORS, versionado de API, doble deploy y doble CI — todo sin beneficio funcional.
2. **Un solo equipo pequeño.** Mientras no haya equipos distintos "owning" back vs front, separar solo multiplica overhead.
3. **Un solo cliente consumidor** (la PWA). No hay app nativa, no hay terceros integrándose. Las API Routes existen para acciones mutables invocadas desde el cliente y para endpoints que terceros (p.ej. notificaciones push) consumirán en el futuro.
4. **SaaS ≠ separación física.** Salesforce, Shopify, Linear — todos se perciben como SaaS multi-tenant sin que el usuario sepa si back y front están en el mismo proceso. La propiedad "SaaS" se consigue en el **modelo de datos** (tenant id en cada fila) y en el **control de acceso**, no en la topología de despliegue.

### ¿Cuándo reconsideraríamos?

- Cuando exista una app móvil nativa (iOS/Android) consumiendo los mismos endpoints.
- Cuando haya integraciones de terceros importantes (webhooks bidireccionales, APIs públicas para ERPs de clientes).
- Cuando el equipo crezca a dos squads independientes con ownership claro.

Hasta entonces: **monolito**.

---

## 2. Multi-tenancy

### Modelo

- `Constructora` es el **tenant**. Todo dato útil cuelga transitivamente de una Constructora.
- Cadena de pertenencia:
  - `Usuario` → `constructora_id` (directo)
  - `Proyecto` → `constructora_id` (directo)
  - `Edificio` → `proyecto` → `constructora_id`
  - `Piso` → `edificio` → ...
  - `Unidad` → `piso` → ...
  - `Espacio` → `unidad` → ...
  - `Tarea` → `espacio` → ...
  - `Evidencia`, `Aprobacion`, `Retraso`, `Extension`, `ChecklistRespuesta` → `tarea` → ...
  - `Contratista` → `usuario` → `constructora_id`

### Reglas de acceso (invariantes de seguridad)

1. **Toda** query de lectura contra la DB DEBE filtrarse por `constructora_id` del usuario autenticado — directamente o vía relación.
2. **Toda** mutación que reciba un ID externo (`tarea_id`, `proyecto_id`, `espacio_id`, etc.) DEBE verificar que ese ID pertenece a la constructora del usuario antes de modificar.
3. Los roles son **ortogonales** al tenant: un `CONTRATISTA_INSTALADOR` de la Constructora A no puede ver tareas de la Constructora B aunque esté asignado a tareas con el mismo ID.
4. El `middleware.ts` valida autenticación, **no tenant**. La barrera de tenant vive en cada handler.

### Helper centralizado

`src/lib/tenant.ts` expone:

- `requireUser()` — resuelve auth + usuario + `constructoraId` (lanza 401/404).
- `requireRole(usuario, ...roles)` — lanza 403.
- `assertTareaInTenant(id, constructoraId)`, `assertProyectoInTenant(...)`, `assertEdificioInTenant(...)`, `assertEspacioInTenant(...)` — verifican pertenencia o lanzan 404.
- `tenantTareaFilter(constructoraId)` — fragmento Prisma `where` reutilizable.
- `handleTenantError(err)` — convierte `TenantError` en `NextResponse` estándar.

**Regla de oro:** ninguna ruta nueva toca `prisma` sin pasar por `requireUser()` primero.

### Defensa en profundidad

- **Capa 1 (app):** helper `tenant.ts` en cada handler. Es lo que estamos usando hoy.
- **Capa 2 (DB, futuro):** habilitar **Row Level Security (RLS) en Supabase** con políticas basadas en `auth.uid()` y `constructora_id`. Esto elimina la clase de bug "se me olvidó filtrar".
- **Capa 3 (auditoría, futuro):** modelo `AuditLog { user_id, constructora_id, action, entity, entity_id, payload, created_at }` escrito desde cada mutación.

Hoy tenemos Capa 1. Capa 2 y 3 son roadmap cercano.

---

## 3. Roles y permisos

### Roles del sistema

| Rol | Alcance |
|---|---|
| `ADMIN` | Todo el tenant |
| `JEFE_OPERACIONES` | Todo el tenant |
| `COORDINADOR` | Aprobaciones, gestión de tareas |
| `ASISTENTE` | Similar a coordinador, sin gestión de usuarios |
| `AUXILIAR` | Edificio/piso asignado, sin aprobaciones |
| `CONTRATISTA_INSTALADOR` | Solo sus tareas asignadas |
| `CONTRATISTA_LUSTRADOR` | Solo sus tareas asignadas |

### Evaluación

- **Cliente:** `src/lib/permissions.ts` → `getPermissions(rol)` devuelve flags booleanos y `sidebarItems`. Úsalo para ocultar UI y para rutear menús.
- **Servidor:** `requireRole(usuario, ...roles)` en cada handler. **Ocultar en UI no es seguridad** — la puerta de verdad está en el handler.
- **Contratistas:** filtro adicional `asignado_a: usuario.id` además del `constructora_id`. Ver `src/lib/data.ts:getTareasFiltradas`.

---

## 4. Capas del código

```
src/
├── app/                          # App Router (Next 16)
│   ├── (auth)/                   # Grupo: login, registro, recuperar
│   ├── (dashboard)/              # Grupo: dashboard/* (protegido por middleware)
│   └── api/                      # API Routes (handlers JSON)
├── components/                   # React Client/Server components
│   ├── dashboard/
│   ├── evidencia/
│   └── landing/
├── lib/
│   ├── prisma.ts                 # Cliente Prisma singleton
│   ├── supabase/                 # Clientes Supabase (client, server, admin)
│   ├── tenant.ts                 # ← Helper de tenant + auth (NUEVO)
│   ├── permissions.ts            # Matriz rol → permisos
│   ├── data.ts                   # Queries de listados (scoped por constructoraId)
│   ├── data-detail.ts            # Queries de detalle (scoped por constructoraId)
│   ├── scoring.ts                # Días hábiles, semáforo, scores
│   ├── storage.ts                # Supabase Storage wrapper (bucket "evidencias")
│   ├── email.ts                  # Resend wrapper
│   ├── email-templates/          # HTML templates
│   └── onboarding.ts             # Provisionar demo al registrar
├── middleware.ts                 # Solo auth gate (no tenant)
└── scripts/                      # CLIs administrativos
```

### Reglas de capa

- **`api/*`** son los únicos endpoints mutables. Siempre pasan por `requireUser`.
- **`lib/data*.ts`** son queries de lectura. **Siempre reciben `constructoraId` como primer argumento** y filtran.
- **Server Components** en `app/(dashboard)/**/page.tsx` llaman `getUsuarioActual()` y pasan el `constructoraId` a los helpers de `data*.ts`. Nunca hacen `prisma.findMany` sin filtrar.
- **Client Components** (`"use client"`) solo consumen `/api/*` — nunca importan `prisma`.

---

## 5. Stack y dependencias

| Capa | Tecnología | Razón |
|---|---|---|
| UI | React 19 + Next.js 16 + Tailwind v4 | RSC + Server Actions reducen boilerplate |
| Estado | Servidor (RSC) + `useState` local | No hay Redux/Zustand por ahora; no lo necesitamos |
| DB | Postgres (Supabase us-east-1) | Managed, cerca de Vercel, incluye Auth y Storage |
| ORM | Prisma 7 | Tipos generados, migrations, buen DX |
| Auth | Supabase Auth (email + Google OAuth) | SDK maduro, JWT, RLS compatible |
| Storage | Supabase Storage (bucket `evidencias`) | Signed URLs, RLS policies |
| Email | Resend | Simple, deliverability decente |
| Animación | GSAP (solo landing) | Landing llamativa sin afectar bundle del dashboard |
| Hosting | Vercel | Edge runtime para middleware, CI automático |

### Variables de entorno críticas

- `DATABASE_URL` — Postgres
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase cliente
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin (invitaciones)
- `RESEND_API_KEY` — Emails
- `NEXT_PUBLIC_SITE_URL` — URL pública para links en emails

---

## 6. PWA (Progressive Web App)

### Objetivo

Los contratistas trabajan en obra con señal móvil intermitente. Necesitan:

1. **Instalar** la app en la pantalla de inicio del teléfono (Android/iOS).
2. **Capturar evidencia offline** (foto + GPS + timestamp) y sincronizarla cuando vuelva la red.
3. **Reportar tareas offline** con cola de reintentos.
4. **Ver sus tareas** asignadas aunque no haya red (último estado cacheado).

### Implementación

- **Manifest:** `public/manifest.webmanifest` con íconos 192/512/maskable, `display: standalone`, `start_url: /dashboard`, `theme_color`, `background_color`.
- **Service Worker:** vía [Serwist](https://serwist.pages.dev/) (sucesor de `next-pwa`, compatible con Next 16 + App Router). Se registra automáticamente.
- **Estrategias de cache:**
  - App shell (HTML/JS/CSS): `NetworkFirst` con fallback a cache.
  - Íconos/fonts: `CacheFirst`.
  - `/api/*` GET: `NetworkFirst` con timeout.
  - `/api/*` POST/PATCH: **Background Sync** cuando ofline.
- **Offline queue para evidencias:**
  - Si `navigator.onLine === false` al enviar POST `/api/evidencias`, el cliente guarda el blob en **IndexedDB** y registra un **Background Sync**.
  - Cuando vuelva la red, el Service Worker re-envía automáticamente.
  - UI muestra badge "Pendiente de sincronizar" en evidencias en cola.
- **iOS:** verificar que `getUserMedia` (cámara) y `geolocation` funcionan con la PWA instalada.

### Archivos que se agregan

```
public/
├── manifest.webmanifest
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
src/
├── app/
│   ├── layout.tsx                # ← agregar <link rel="manifest">
│   └── sw.ts                     # ← Service Worker (Serwist)
├── components/
│   └── pwa/
│       ├── InstallPrompt.tsx     # beforeinstallprompt
│       └── OfflineQueue.tsx      # Badge de items en cola
└── lib/
    └── offline-queue.ts          # IndexedDB + Background Sync helpers
```

---

## 7. Roadmap arquitectónico inmediato

1. ✅ **Alinear ramas** (este worktree = `ajustes_karen`)
2. ✅ **Doc de arquitectura** (este archivo)
3. 🔨 **Tapar fugas multi-tenant** (helper `tenant.ts` + fixes en rutas API)
4. 🔨 **PWA base** (manifest + Serwist + offline queue para evidencias)
5. ⏭️ **RLS en Supabase** (Capa 2 de defensa)
6. ⏭️ **AuditLog** (compliance + forensics)
7. ⏭️ **Límites por plan + billing** (Stripe)
8. ⏭️ **Observabilidad** (Sentry/Logtail + tracing)

---

## 8. Principios de decisión

Cuando aparezca una duda del tipo "¿debería separar X?" o "¿agrego microservicio Y?":

1. **¿Lo necesita el piloto de Jaramillo Mora?** Si no → no.
2. **¿Resuelve un problema real medible?** Si es "pureza" arquitectónica → no.
3. **¿Puedo lograr lo mismo con una abstracción dentro del monolito?** Siempre primero.
4. **¿Aumenta el número de cosas que pueden fallar en prod?** Si sí, justifica muy bien el beneficio.

El monolito es el default. Separar tiene que ganarse el derecho.
