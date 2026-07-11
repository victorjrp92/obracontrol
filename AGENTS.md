<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Seiricon (obracontrol) — SaaS de control de obra

SaaS de gestión de obras de construcción para Colombia (moneda COP, consentimiento de datos Ley 1581). Dos negocios en el mismo código: **B2B** (constructoras con equipos y roles) y **B2C** (Propietario / Contratista independiente). Nombre de producto: Seiricon; el repo se llama obracontrol.

⚠️ La ruta del repo contiene un espacio: el directorio padre `"Saas_construccion "` termina en espacio. SIEMPRE cita las rutas entre comillas en comandos de shell.

## Comandos
```bash
npm run dev        # Next dev
npm run build      # prisma generate && next build
npm run lint       # eslint
npm run db:push    # prisma db push
npm run db:seed    # seed base (tsx prisma/seed.ts)
```
**No hay suite de tests.** Verificación mínima antes de dar algo por terminado: `npm run build` + `npm run lint` + probar el flujo afectado en dev.

## Stack (lo que importa)
- Next.js **16.2.2** (App Router) + React 19 + TypeScript. Gotchas de Next 16 en este repo:
  - El middleware es `src/proxy.ts` (exporta `proxy()`, no `middleware`).
  - Los `params` de rutas son **Promise**: `{ params }: { params: Promise<{ id: string }> }` → `await params`.
- Prisma 7 con driver adapter pg. **El cliente se genera en `src/generated/prisma` (GITIGNORADO, no viaja en git)**: se importa desde `@/generated/prisma` (NO desde `@prisma/client`), nunca se edita a mano, y `prisma generate` ya corre dentro de `npm run build` (el deploy lo regenera). Tras tocar `schema.prisma` en local: `npx prisma generate` para que tsc vea los tipos nuevos.
- Supabase: auth (email/password + Google OAuth) y Postgres. Tailwind v4. ExcelJS, Resend (email), Serwist (PWA — solo se activa en build de producción, incompatible con dev), Mapbox.
- Env vars: la key pública de Supabase que el código lee es `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (el `.env.example` documenta un nombre viejo sin `_DEFAULT` — usa el del código). Las vars `NEXTAUTH_*` son residuos: NO hay NextAuth en este proyecto.

## Auth, tenancy y permisos (lo más fácil de romper)
- Tenant = `Constructora`. TODA query Prisma debe quedar scoped por `constructora_id`, directo o vía relaciones anidadas.
- **Regla para rutas API nuevas:** empezar con `requireUser()` de `src/lib/tenant.ts` y validar pertenencia con los helpers `assert*InTenant()`. La mayoría de las rutas existentes inlinean sus propios checks (patrón viejo) — NO copies ese patrón.
- Roles B2B: enum `NivelAcceso` (SUPER_ADMIN, DIRECTIVO, ADMIN_GENERAL, ADMIN_PROYECTO, CONTRATISTA, OBRERO). B2C: enum `TipoCuenta` (CONSTRUCTORA, CONTRATISTA —antes ARQUITECTO—, PROPIETARIO) con matriz de capacidades en `src/lib/plan.ts`.
- Autorización real: `src/lib/access.ts` (`getAccessibleProjectIds`, `canAccessProject`, predicados de rol). En `src/lib/permissions.ts`, `sidebarItems` es SOLO visibilidad de UI, NO autorización — toda página y API debe validar por su cuenta.
- Permisos granulares por proyecto para admins: tabla `AdminProyectoAccess`.
- Accesos públicos por token SIN login: `/c/[token]` (cliente ve progreso) y `/o/[token]` (obrero). Cuidado con qué datos exponen esas rutas.

## Modelo de datos (jerarquía)
Proyecto → Edificio → Piso → Unidad → Espacio → **Tarea** (Fase y `subfase`, `precio`, presupuestos de mano de obra/materiales, `estado`: PENDIENTE/REPORTADA/APROBADA/NO_APROBADA, dependencias `depende_de`). Hijos de Tarea: Evidencia (foto/video + GPS), Aprobacion, Retraso, ExtensionTiempo, ConsumoMaterial, ChecklistRespuesta, Gasto. Contratista y Obrero tienen campos de scoring (`score_*`). Los filtros de tenant atraviesan esta jerarquía — usa `tenantTareaWhere` / `assertTareaInTenant`.

## Zonas de peligro
- **Eliminación de proyecto** (`api/proyectos/[id]/eliminar`): flujo de dos factores (re-auth con password + código de 6 caracteres por email, registrado en AuditLog) con rate limit de 5 intentos fallidos por 10 min → 429. NO simplificar este flujo.
- **Excel** (ExcelJS): plantillas en `src/app/(dashboard)/dashboard/proyectos/nuevo/ExcelTemplateUtils.ts`; import en `api/proyectos/[id]/importar-tareas`; flujo B2C en `src/components/personal/ImportExcelPanel.tsx`. Al escribir celdas con strings tipeados por el usuario (nombres de espacios, etc.), sanitiza contra inyección de fórmulas (valores que empiezan con `=`, `+`, `-`, `@`).
- **DeepSeek** (`src/lib/deepseek.ts`, server-only, requiere `DEEPSEEK_API_KEY`): usado por `api/sugerencias/*`. Los estimadores deterministas (`src/lib/estimar-duracion.ts`, `estimar-presupuesto.ts`, `scoring.ts`) son el camino primario.
- No hay Zod ni validación centralizada: valida el input manualmente en cada ruta nueva (tipos, longitudes, rangos).

## Convenciones
- Dominio en español (Proyecto, Tarea, Obrero…), infraestructura en inglés (`canAccessProject`). Un componente por archivo, PascalCase, agrupados por dominio en `src/components/`.
- Server Components por defecto; patrón frecuente: `page.tsx` (server, fetch de datos) + `client.tsx` (interactividad). Queries de lectura en `src/lib/data*.ts`.
- Alias de imports: `@/*` → `./src/*`.
- Git: rama por defecto `main`; ramas de trabajo `victor`, `ajustes_*`, `feature/*`.

## Manual de usuario — SIEMPRE actualizado
Cada cambio funcional que quede fijo (commiteado/mergeado a `main`) DEBE reflejarse en `docs/manual-de-usuario.md`:
- Registrar: funcionalidades nuevas, cambios de comportamiento, permisos, límites o flujos que cambien la experiencia del usuario, en la sección correcta (por rol o por módulo).
- Aplica a B2B y B2C (si el cambio es B2C — Propietario/Contratista — va en la sección B2C del mismo manual).
- NO registrar: experimentos, WIP, refactors internos sin impacto en el usuario, o cambios revertidos.

## Documentación
Specs en `docs/specs/` y `SPEC-v2.md`; arquitectura en `docs/arquitectura.md`; casos de uso en `docs/casos-de-uso.md`. Antes de implementar una feature, revisa si ya existe spec.
