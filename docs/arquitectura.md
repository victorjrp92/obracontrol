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

## 9. Seiricon Alerta — línea pública sin tenant

`/alerta`, `/alerta/documentar` y `/alerta/grietas` son una línea de producto **nueva,
pública, sin cuenta** (iniciativa de respuesta al terremoto que sacudió a Colombia): una
guía de habitabilidad (filtro de seguridad de 4 preguntas), un acta de daños con fotos con
fecha/hora/GPS quemados, y un triage de grietas foto por foto (con o sin IA), todo
exportable a PDF. Vive dentro del grupo `(public)` (reusa Navbar/Footer) pero **no cruza el
modelo multi-tenant** — no hay `Constructora`/`Proyecto`/`Cliente` detrás.

- **Sin Prisma, sin Supabase, sin tablas nuevas**: todo el flujo (checklist, fotos, acta)
  vive en el cliente (React state); nada se persiste. `src/lib/alerta/`,
  `src/components/alerta/` y `src/app/api/alerta/*` no importan `@/lib/prisma`,
  `@prisma/client` ni `@/lib/supabase` — regla dura, verificable con
  `grep -rn "@/lib/prisma\|@prisma/client\|@/lib/supabase" src/lib/alerta src/components/alerta src/app/api/alerta`.
- **Motor de reglas fijas** (AIS/NSR-10 Título A + ATC-20), Fase 1 sin IA: `src/lib/alerta/reglas.ts`
  (`evaluarGrieta`, `evaluarInmueble`) sobre el contrato `ObservacionGrieta` de
  `src/lib/alerta/tipos.ts` — listo para que en Fase 2 lo alimente un modelo de visión.
  Se verifica regla por regla con `npm run verify:alerta`
  (`scripts/verificar-reglas-alerta.ts`), no hay test runner configurado en el proyecto.
- **Overlay de fotos paralelo**: `src/lib/media/overlay.ts` es un módulo nuevo e
  independiente (no una extracción) que quema fecha/hora/GPS en la foto, con su propio
  perfil de compresión más agresivo (`MAX_DIM=1200`, calidad JPEG 0.65). **No comparte
  código con `src/components/evidencia/CameraCapture.tsx`**, que sigue intacto porque
  alimenta 3 superficies de producción (obrero offline, B2B, B2C) — ver
  [spec Fase 1](./specs/2026-08-13-seiricon-alerta-fase1.md), addendum R2.
- **PDF sin persistencia**: `POST /api/alerta/acta-pdf` (público, sin auth, `maxDuration=60`)
  recibe el payload ya armado (fotos en base64 + datos del inmueble) y devuelve el PDF con
  `renderToBuffer` (`src/lib/pdf/ActaDanosReport.tsx`, consumidor de `pdfStyles`/`pdfColors`
  de `src/lib/pdf/styles.ts`). `POST /api/alerta/acta-email` hace lo mismo y además envía el
  PDF por Resend como adjunto (`SendEmailOptions.attachments`, campo opcional y aditivo en
  `src/lib/email.ts`) — sin fila en DB.
- **Topes de payload** (por debajo del límite de ~4.5MB de Vercel por función serverless):
  10 fotos / 8 espacios por acta, `MAX_BODY_BYTES` en `src/lib/alerta/acta.ts`; ambas rutas
  API validan `content-length` y devuelven `413` en español si se excede.
- **Sin rate limiting**: no hay helper de eso en el repo. Mitigación mínima: honeypot en el
  formulario de correo, botón en single-flight en el cliente, los topes duros de arriba.
- **No se enlaza** desde `Navbar.tsx`/`Footer.tsx` del sitio (tráfico por redes/WhatsApp) y
  **no pasa por `src/proxy.ts`** (no está en el matcher — queda pública sin auth por diseño).

### 9.1 Fase 2 — triage de grietas con visión (`/alerta/grietas`)

Conecta un modelo de visión al motor de reglas de Fase 1 sin tocarlo, y añade el flujo de
usuario (ubicar → dos fotos guiadas → resultado → otra grieta o terminar → puente a
ingenieros). Ver [spec Fase 2](./specs/2026-08-13-seiricon-alerta-fase2.md).

- **Servicio de visión REST, sin SDK**: `src/lib/alerta/observar-grieta.ts` llama directo a
  `POST https://api.anthropic.com/v1/messages` con `fetch` + `AbortController` (mismo patrón
  que `src/lib/deepseek.ts`), salida forzada con `tools`/`tool_choice` (JSON schema exacto de
  `ObservacionGrieta`). Cero dependencias nuevas — no se instala `@anthropic-ai/sdk`.
- **Doble llave (kill-switch)**: hace falta `ANTHROPIC_API_KEY` presente Y
  `ALERTA_VISION_ENABLED === "true"`. Si falta cualquiera de las dos, la llamada falla, hay
  timeout, o el JSON no es válido, `observarGrieta()` devuelve `{ok:false, motivo:"sin_key"|"error"}`
  — nunca lanza, nunca cae a verde: el cliente pasa a modo manual. `ALERTA_VISION_MODEL` es
  override opcional del modelo (default documentado en el código).
- **El prompt NUNCA recibe el elemento que la persona declaró** (columna/muro/etc.) — si se
  lo diéramos, el modelo se ancla y lo confirma, destruyendo el contraste. La reconciliación
  ocurre después, en TypeScript puro.
- **Capa de reconciliación, no un segundo motor de reglas**: `src/lib/alerta/triage.ts`
  (`evaluarTriageGrieta`) decide qué observación entra a `evaluarGrieta()` (T1: gana el
  elemento con el semáforo más conservador; T2: baja `confianza.elemento` si hubo
  discrepancia) y aplica un puñado de elevaciones explícitas que nunca ablandan un nivel (T3:
  grieta pasante — pendiente de visto bueno de ingeniero; T4: fuente manual nunca resuelve en
  verde). Invariante duro: `RANGO(nivel de triage) >= RANGO(nivel de evaluarGrieta)`, verificado
  con `npm run verify:triage` (`scripts/verificar-triage-alerta.ts`, separado del script de
  Fase 1). `reglas.ts` y `tipos.ts` quedan con diff vacío frente a Fase 1.
- **Modo manual (D4)**: si no hay IA, la llamada falla, o el usuario elige "prefiero
  describirla yo", `DescribirGrietaManual.tsx` arma la `ObservacionGrieta` a mano (patrón por
  menú ilustrado, banderas sí/no, `ancho_mm: null`, confianza alta) con `fuente: "manual"` —
  el flujo /alerta/grietas se completa de punta a punta sin ninguna key configurada.
- **Dos blobs por foto** (`src/lib/media/overlay.ts`, aditivo): `comprimirParaAnalisis()` (sin
  overlay, para el modelo, se descarta tras la respuesta) y `quemarOverlay()` (con overlay,
  evidencia real para el PDF) — el overlay le resta información al modelo.
- **Nuevas rutas API**, mismo patrón sin persistencia que Fase 1: `POST
  /api/alerta/observar-grieta` (responde `{ok:true,...}` o `{ok:false, motivo}` con status 200
  — nunca rompe el flujo del cliente; 413 solo por payload sobredimensionado,
  `MAX_BODY_OBSERVACION_BYTES` en `src/lib/alerta/grietas.ts`) y `POST
  /api/alerta/informe-grietas-pdf` (calcado de `acta-pdf/route.ts`, `MAX_GRIETAS = 5` = 10
  fotos, mismo presupuesto que el acta).

## 10. Seiricon Go — campaña de reparaciones post-sismo (`/repara`)

`/repara` es el landing de campaña de **Seiricon Go**: seis meses gratis del producto
completo para las reparaciones del sismo en Cali, Pereira y Manizales. Es UI pública
(grupo `(public)`, reusa Navbar/Footer), sin cuenta y **sin tenant** — igual que
`/alerta`. Ver [spec](./specs/2026-08-13-seiricon-go-repara.md).

- **Ruta canónica `/repara`, alias `/go` con 308.** El canal real es dictado por voz
  (WhatsApp, radio): `/repara` es español, una palabra, sin tildes ni guiones, y rima con
  `/alerta`; "Seiricon Go" es el **nombre de marca** (badge del hero y copy), no la URL.
  El alias vive en `src/app/go/page.tsx` (server component que llama
  `permanentRedirect("/repara")` de `next/navigation` → 308) y está **fuera** del grupo
  `(public)` para no montar Navbar/Footer antes de redirigir. NO se usa `redirects()` de
  `next.config.ts`: ese archivo está envuelto por el wrapper de Serwist y toca headers
  globales.
- **Cero base de datos, cero schema, cero migraciones.** No hay pasarela de pagos ni motor
  de suscripciones en el repo; `Constructora.plan_suscripcion` es una etiqueta cuyo único
  consumidor funcional es `limiteObrasActivas()` (`src/lib/plan.ts`), y
  `src/lib/onboarding.ts` ya provisiona toda cuenta personal como `PERSONAL` (gratis hoy).
  Un `PlanTipo.GO` con vencimiento sería inventar un motor de suscripciones completo. La
  captación es por formulario (Tally) y **el alta la hace el super-admin a mano**.
  Verificable:
  `grep -rn "@/lib/prisma\|@prisma/client\|@/lib/supabase" src/components/repara "src/app/(public)/repara" src/app/go` sin resultados.
- **Placeholders con guarda de render** (`src/components/repara/config.ts`): mientras
  `TALLY_REPARA_URL`, `FECHA_LIMITE_CUPO` o `CUPOS_GO` sigan sin confirmar, la UI **no
  renderiza** el bloque que los usa. Ninguna cadena `TODO(` llega al usuario. Mejora
  deliberada sobre `/beta`: el fallback del formulario es **para el usuario** (correo real
  `CONTACTO_EMAIL`, y WhatsApp si ya está confirmado); la pista para el desarrollador solo
  se renderiza con `process.env.NODE_ENV !== "production"`.
- **Elegibilidad: se comunica, no se verifica.** No hay forma decente de comprobar que una
  reparación es del sismo. Se nombran las tres ciudades, se dice explícitamente que no se
  piden papeles, y la sección de oferta deja una salida honesta a quien no califica (la
  herramienta sirve igual; lo reservado para las zonas afectadas son los meses).
- **Puente con `/alerta`, una sola línea y siempre al final.**
  `src/components/alerta/PuenteRepara.tsx` es el único punto desde el que `/alerta` enlaza
  a `/repara`, y se monta en exactamente dos sitios, ambos con el flujo ya terminado:
  `PuenteIngenieros.tsx` (paso 6 del triage, reemplaza el enlace previo a `/para-ti`) y el
  paso "resumen" de `ActaWizard.tsx`. Está **prohibido** enlazarlo desde `AlertaHero`,
  `FiltroSeguridad` (y sobre todo desde la pantalla roja "Salí ahora"), `AlertaDisclaimer`,
  `LineasEmergencia`, `UbicarGrieta`, `GrietaCameraCapture` y `ResultadoGrieta` —
  verificable con `grep -rn "/repara" src/components/alerta`. En sentido inverso `/repara`
  devuelve tráfico gratis a `/alerta` dos veces (franja bajo el hero y sección completa
  antes del cierre).
- **Sin dependencias nuevas.** `src/components/repara/*` importa `@/components/beta/Reveal`
  en vez de crear una tercera copia del mismo helper de scroll-reveal. Acoplamiento
  deliberado y documentado en cada archivo: extraer un `ui/Reveal.tsx` común obligaría a
  tocar dos landings ya publicados.
- **Hero oscuro obligatorio** (`bg-slate-900 pt-28 pb-20 sm:pt-32 sm:pb-28`, igual que
  `BetaHero`/`AlertaHero`): el `Navbar` público es `fixed`, arranca transparente con texto
  blanco y solo pasa a tema claro tras `0.85 * innerHeight` de scroll.
- **No se enlaza** desde `Navbar.tsx`/`Footer.tsx` ni desde `Pricing.tsx` (una campaña con
  vencimiento no vive en la tabla de precios permanente) y **no pasa por `src/proxy.ts`**.
