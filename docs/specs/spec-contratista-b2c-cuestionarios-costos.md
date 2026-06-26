# Spec — Contratista B2C, formalización, cuestionarios, IA por fase y motor de costos

**Proyecto:** Seiricon (obracontrol) · **Fecha:** 2026-06-26 · **Estado:** aprobado para ejecución
**Alcance:** B2C (cuentas personales) + formalización transversal + registro/onboarding de todos los perfiles + motor de costos.

---

## 0. Objetivo

1. Formalizar el lenguaje de toda la app (quitar lo coloquial, mantener tono formal-cálido).
2. Convertir el perfil **Arquitecto → Contratista B2C** (emprendedor de oficio con personal que envía a obras de clientes; el cliente ve el avance).
3. Cuestionarios cortos post-registro para **los tres perfiles** (Propietario, Contratista B2C, Empresa) que recolecten datos útiles.
4. Sugerencias de tareas con IA en **lenguaje llano** y **adaptadas a la fase** de la obra.
5. Permitir **guardar desde cualquier paso** en modo edición.
6. **Motor de costos** nuevo: modelo mano de obra / materiales por tarea (con investigación verificada), **3 modos de presupuesto**, repartición inteligente con IA y conexión a gastos/anticipos.
7. **Vista del cliente** (solo lectura del avance) para el Contratista B2C.

## 1. Convenciones de nombres (definitivas)

- **Contratista B2C** = tipo de cuenta nuevo (`tipo_cuenta = CONTRATISTA`). Emprendedor de oficio, administra sus propios proyectos. Es cuenta personal (`esCuentaPersonal = true`).
- **Contratista de empresa** = rol B2B (`nivel_acceso = CONTRATISTA`), atado a una constructora. **No se toca.**
- Estos dos conviven: viven en tablas/enums distintos (`tipo_cuenta` de la cuenta vs. `nivel_acceso` del rol). Sin colisión técnica.
- (Futuro, NO en este spec: landing informativo B2C.)

## 2. Decisiones tomadas (cerradas)

| # | Decisión |
|---|---|
| Roles | Rol B2B Contratista intacto; tipo de cuenta `ARQUITECTO → CONTRATISTA`. |
| Cliente ve avance | SÍ, dentro del alcance (Fase 6). |
| Mostrar desglose de costos | SÍ — al usuario se le muestra "trabajo / materiales" en lenguaje llano. |
| Cuestionarios | Aprobados para los 3 perfiles. |
| Legal (recordar) | NO biométricos/rostro; scoring solo interno. No reintroducir nada de eso. |

---

## FASE 1 — Formalización del lenguaje + perfil Contratista B2C

### 1A. Formalización transversal
- **Objetivo:** reemplazar textos coloquiales en TODA la UI por versión formal-cálida (no robótica), el tono ya usado en el propietario.
- **Método:** un agente inventaría los strings informales de la UI (`src/app`, `src/components`) y propone reemplazo; se aplica y se revisa. Ejemplos a cazar: "Estoy arreglando lo mío", "Apenas arranca", "lo tuyo", muletillas, etc.
- **Criterio de aceptación:** no quedan expresiones coloquiales en pantallas de cara al usuario; tono consistente; `tsc`/`eslint` limpios; sin cambios funcionales.

### 1B. Tarjetas de registro (copy aprobado)
Pantalla "¿Cómo usarás Seiricon?" (sub: "Selecciona el perfil que mejor te describe; adaptamos la plataforma a tu caso."):
- **Gestiono mi propia obra** — Remodelo o construyo mi vivienda y superviso a los obreros que contrato. *(PROPIETARIO)*
- **Soy contratista** — Eres arquitecto o tienes un negocio de pintura, instalación eléctrica, cocinas, carpintería… y envías a tu personal a ejecutar trabajos donde tus clientes. *(CONTRATISTA B2C)*
- **Soy una empresa constructora** — Gestiono varios proyectos con equipo, contratistas y obreros. *(CONSTRUCTORA)*

### 1C. Renombre del tipo de cuenta y registro flexible
- **Schema:** `enum TipoCuenta { CONSTRUCTORA, CONTRATISTA, PROPIETARIO }` (renombrar `ARQUITECTO → CONTRATISTA`). Migración SQL que renombre el valor del enum y mapee filas existentes `ARQUITECTO → CONTRATISTA`.
- **Backend:** actualizar `esCuentaPersonal` (incluir CONTRATISTA), `provisionarPersonal`, `(auth)/actions.ts` (registro), el callback OAuth (`metadata.tipo_cuenta`), y cualquier `switch`/comparación con "ARQUITECTO".
- **Registro Contratista B2C (flexible):** nombre, **nombre del negocio**, correo (corporativo o personal — sin validación corporativa), contraseña. Más flexible que el resto del B2C.
- **Archivos:** `prisma/schema.prisma`, migración, `src/lib/onboarding.ts`, `src/app/(auth)/actions.ts`, `src/app/api/auth/callback/route.ts`, `src/app/(auth)/registro/RegistroWizard.tsx`, `src/lib/tenant.ts`/helpers de `esCuentaPersonal`.
- **Criterio de aceptación:** registrar como Contratista B2C crea la cuenta personal correcta; cuentas ARQUITECTO previas migran a CONTRATISTA sin romper; nada referencia "ARQUITECTO".

**Agentes Fase 1:** backend (enum/migración/provisión) → frontend (tarjetas + registro + formalización) → revisión.

---

## FASE 2 — Cuestionarios post-registro (3 perfiles)

- **Flujo:** registro → cuestionario (3–4 páginas, opciones de clic, mínima fricción) → entra a la app. Permitir "omitir" donde tenga sentido para no bloquear conversión, pero registrar lo respondido.
- **Ubicación (depto/ciudad):** selector en cascada **departamento → municipio** con dataset estático de Colombia (`src/lib/colombia-divipola.ts` o JSON en `src/data/`). Nada de texto libre.

### Preguntas por perfil
**Contratista B2C**
1. Oficio / tipo de negocio (selección única): Arquitecto · Maestro de obra · Pintor · Carpintero/Ebanista · Electricista · Plomero/Hidrosanitario · Enchapador/Acabados · Instalador de cocinas y closets · Estuco y drywall · Obra gris/mampostería · Cerrajería/estructuras · Otro.
2. Tamaño del equipo: Solo yo · 2 a 5 · 6 a 10 · 11 a 20 · Más de 20.
3. Departamento y ciudad (cascada) **+** ¿Cómo controlas hoy el trabajo? (WhatsApp y fotos · Excel o cuaderno · Otra app · No llevo control).

**Propietario**
1. ¿Primera obra o ya has hecho otras? **+** ¿Ya tienes maestro/contratista o lo estás buscando?
2. Departamento y ciudad (cascada).
3. ¿Cómo llevas hoy el control de tu obra? (WhatsApp · Excel/cuaderno · Otra app · No llevo control).

**Empresa (constructora)**
1. Obras activas (1 · 2–5 · 6–15 · Más de 15) **+** Tipo de obra (VIS/VIP · estrato medio-alto · comercial · remodelación · infraestructura).
2. Tamaño del equipo (rangos) **+** Nº de contratistas que manejas (rangos).
3. Departamento(s)/ciudad(es) donde operan.
4. ¿Cómo controlan hoy el avance? (Excel · WhatsApp · Software dedicado · Otro).

### Persistencia y uso
- **Modelo:** `PerfilOnboarding { id, constructora_id (o usuario_id), tipo_cuenta, oficio?, tamano_equipo?, num_contratistas?, obras_activas?, tipo_obra?, departamento?, ciudad?, control_actual?, primera_obra?, tiene_contratista?, created_at }` (campos opcionales por perfil). Migración.
- **API:** `POST /api/onboarding` (auth) guarda respuestas; idempotente.
- **Uso de datos:** segmentación (pricing/ventas), `ciudad` alimenta el mapa y los precios regionales (flywheel), `control_actual` informa onboarding/marketing.
- **Criterio de aceptación:** cada perfil ve su cuestionario, las respuestas se guardan, y al terminar entra al destino correcto (Propietario/Contratista B2C → `/empezar`; Empresa → `/dashboard`).

**Agentes Fase 2:** backend (modelo/migración/API + dataset DIVIPOLA) → frontend (wizard de cuestionario por perfil + cascada depto/ciudad) → revisión.

---

## FASE 3 — IA de tareas: lenguaje llano + adaptación a la fase

- **Aplica a:** Contratista B2C y Propietario (flujo `IntentWizard` / `/api/sugerencias/tareas`).
- **Lenguaje llano:** el prompt de `sugerirTareasIA` (en `src/lib/deepseek.ts`) debe devolver **nombres de tarea entendibles, no técnicos**. Ej.: "mampostería" → "levantar paredes (ladrillo/bloque)"; "pañete" → "repello/revoque de paredes"; "enchape" → "instalación de baldosa/cerámica". Formal pero llano.
- **Adaptación a la fase:** pasar al prompt el **estado de la obra** (`puntoPartida`: aún no ha iniciado / en proceso / próxima a finalizar — ya existe) para que sugiera **solo tareas coherentes con la etapa**. Obra por terminar → repello, pintura, instalación de puertas, cocina, acabados, aseo final; NO mampostería/estructura. Obra nueva → desde obra gris.
- **Coherencia de costos:** los nombres llanos deben seguir casando con el motor de costos (mantener la normalización/match con la base semilla; Fase 5 lo considera).
- **Archivos:** `src/lib/deepseek.ts` (prompts), `src/app/api/sugerencias/tareas/route.ts` (pasar estado), `IntentWizard.tsx` (enviar `puntoPartida`).
- **Criterio de aceptación:** en una obra "próxima a finalizar" no aparecen tareas de etapas tempranas; los nombres son comprensibles para un no-técnico; fallback estático sigue funcionando.

**Agentes Fase 3:** backend/IA (prompts + estado) → frontend (envío de estado) → revisión.

---

## FASE 4 — Guardar desde cualquier paso (modo edición)

- **Objetivo:** en `IntentWizard` modo edición (`modo === "editar"`), botón **"Guardar cambios"** visible en **cada paso**, no solo al final. Edité el paso 1 → puedo guardar desde ahí.
- **Comportamiento:** guarda el estado actual completo vía `editarObraPersonal` (que ya hace update total preservando historial); no exige recorrer todos los pasos. En modo crear, el flujo sigue igual (paso a paso).
- **Archivos:** `src/app/(dashboard)/empezar/IntentWizard.tsx`.
- **Criterio de aceptación:** en edición, "Guardar cambios" funciona desde cualquier paso y persiste lo modificado; no rompe la creación normal.

**Agentes Fase 4:** frontend → revisión.

---

## FASE 5 — Motor de costos (mano de obra / materiales) + 3 modos de presupuesto

### 5A. Verificación de la investigación
- Un agente **corrobora/corrige** la investigación aportada (mano de obra vs. materiales, 2026) contra las fuentes (DANE/ICOCED, Camacol, Construdata, PresuCosto, OneEstimate). Salida: tabla validada de **% mano de obra por tarea/capítulo** + factores 2026 (SMMLV +23,7%), con nivel de confianza y correcciones.

### 5B. Modelo de costos
- Extender la base semilla (`src/lib/precios-semilla.ts`) o crear `src/lib/costos-modelo.ts` con, por tarea/categoría: **`pct_mano_obra`** (y por diferencia, materiales). Valores de la investigación validada (ej. estuco ~45-55% M.O., pintura ~50-60%, enchape piso ~35-45%, cocina ~25-35%, sanitarios ~20-30%).
- El estimador (`estimar-presupuesto.ts` / `estimarPreciosIA`) calcula **total + desglose trabajo/materiales** por tarea, con multiplicadores por ciudad y por fase.

### 5C. Tres modos de presupuesto (Propietario + Contratista B2C)
1. **Sin presupuesto** → IA estima costo total por tarea (trabajo + materiales).
2. **Presupuesto general** → un monto; la IA lo reparte por tarea **ponderado por peso real** (no en partes iguales). Reemplaza el reparto parejo actual.
3. **Presupuesto separado** → dos montos: **mano de obra** y **materiales**; la IA reparte **cada bolsa** entre las tareas según su peso de trabajo / de materiales respectivamente.
- UI de presupuesto: selector de modo + el desglose visible en lenguaje llano ("trabajo" / "materiales") como en el mockup aprobado. Editable.

### 5D. Conexión con gastos y anticipos
- La bolsa/desglose de **mano de obra** alimenta **anticipos/pagos a trabajadores**; la de **materiales** alimenta **gastos con factura**. Definir cómo se prellenan/comparan (presupuestado vs. real) en el módulo de gastos.
- **Archivos:** `precios-semilla.ts`/`costos-modelo.ts`, `estimar-presupuesto.ts`, `deepseek.ts` (estimarPreciosIA + nuevo reparto), `/api/sugerencias/presupuesto`, `IntentWizard.tsx` (selector de modo + desglose), `types.ts` (campos de presupuesto separado), `actions.ts` (persistir), módulo gastos.
- **Criterio de aceptación:** los 3 modos funcionan; el reparto NO es parejo (la cocina pesa más que un baño); el desglose trabajo/materiales se muestra y cuadra; la mano de obra estimada se refleja en anticipos.

**Agentes Fase 5:** investigación/verificación → backend (modelo + estimador + reparto IA) → frontend (modos + desglose) → revisión.

---

## FASE 6 — Vista del cliente (solo lectura del avance) — Contratista B2C

- **Objetivo:** el Contratista B2C comparte con su cliente un **enlace de solo lectura** del avance de la obra (al estilo del token del obrero, pero para **ver**, no reportar).
- **Backend:** token por proyecto (o por cliente) con acceso de solo lectura a progreso/tareas/evidencia (sin datos sensibles, sin costos si así se decide). Tenant-safe.
- **Frontend:** vista pública `/c/[token]` (o similar) con el progreso, semáforo y evidencia del avance; el contratista genera/copia el enlace desde su proyecto.
- **Archivos:** nueva ruta `src/app/c/[token]/`, API `src/app/api/c/[token]/...`, modelo de token, UI para generar el enlace en el proyecto.
- **Criterio de aceptación:** el cliente abre el enlace sin cuenta y ve el avance; no puede editar ni reportar; aislado por proyecto.

**Agentes Fase 6:** backend (token + API read-only) → frontend (vista + generar enlace) → revisión + seguridad (no fugas, read-only estricto).

---

## 3. Modelo de datos (consolidado)

- `TipoCuenta`: `ARQUITECTO → CONTRATISTA` (rename + migración de filas).
- `PerfilOnboarding` (nuevo): respuestas del cuestionario por perfil.
- `Proyecto`: campos de presupuesto separado — `presupuesto_mano_obra Int?`, `presupuesto_materiales Int?` (además del `presupuesto_total` y `metraje_total` ya existentes).
- Costos: `pct_mano_obra` por tarea/categoría (en datos de `precios-semilla`/`costos-modelo`, no necesariamente columna DB).
- `ClienteAccesoToken` (nuevo, Fase 6): token read-only por proyecto.
- Dataset DIVIPOLA (departamentos/municipios) como archivo estático.

## 4. Riesgos y consideraciones

- **Migración del enum** `ARQUITECTO → CONTRATISTA`: hacerla aditiva/segura (renombrar valor + mapear filas). Probar que no rompe sesiones/registro existentes.
- **Conversión de tono** en la formalización: no volver el texto frío/robótico; mantener cercanía.
- **Fricción de cuestionarios:** mantenerlos cortos y con "omitir" donde aplique; medir que no caiga la conversión.
- **Lenguaje llano vs. match de costos:** asegurar que renombrar tareas a términos llanos no rompa el match con la base de precios (mantener normalización/sinónimos).
- **Legal:** respetar lo decidido — sin biométricos, scoring interno; la vista del cliente no debe exponer datos personales de trabajadores ni datos sensibles.
- **DeepSeek/€5:** las llamadas siguen siendo baratas; el reparto de presupuesto es 1 llamada por acción.

## 5. Ejecución

- Orden: **Fase 1 → 2 → 3 → 4 → 5 → 6** (5 y 6 son las más grandes; 1–4 son rápidas y desbloquean).
- Cada fase: agentes **backend → frontend → revisión** (y **seguridad** en la 6), con `tsc`/`eslint` limpios y, donde aplique, migraciones creadas (no aplicadas a producción sin verificación).
- Cierre global: **agente de bugs + agente de seguridad** sobre todo el conjunto antes del commit final.
- Manual de usuario (`docs/manual-de-usuario.md`) se actualiza con cada cambio que quede fijo (regla vigente).

---

*Spec listo para ejecución por fases.*
