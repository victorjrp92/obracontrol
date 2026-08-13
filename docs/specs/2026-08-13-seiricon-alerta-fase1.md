# Spec: Seiricon Alerta — Fase 1 (sin veredicto de IA)

Fecha: 2026-08-13
Estado: aprobado para implementación (con agentes)
Branch: `feat/seiricon-alerta-fase1`
Línea de producto: **nueva**, pública, sin registro. Vive junto a Seiricon (mismo dominio, mismo layout `(public)`) pero no toca el modelo multi-tenant (`Constructora`/`Proyecto`/`Cliente`).

## Contexto y por qué Fase 1 no incluye IA

Iniciativa de respuesta al terremoto que sacudió a Colombia: ayudar a personas en casas, condominios y locales a saber si una grieta es peligrosa, sin que "la IA se invente el diagnóstico". El diseño completo (documentado por Karen) separa dos cosas:

1. Un modelo de visión que **solo describe** lo que ve (elemento, patrón, ancho, banderas) — JSON estructurado.
2. Un **motor de reglas fijas** (AIS/NSR-10 Título A, ATC-20, FEMA P-154) que un ingeniero firma, y que decide rojo/amarillo/verde.

El propio análisis de priorización marca el checklist (Paso 0) como "el embudo natural para el triage de grietas **cuando esté validado por el ingeniero**" — es decir, el veredicto por foto con IA no debe salir a producción sin ese visto bueno. Por eso esta fase construye:

- Lo que **no necesita IA y no tiene riesgo de responsabilidad**: la guía de habitabilidad (checklist sí/no) y el acta de daños (documentación con evidencia).
- El **motor de reglas** completo, en código, probado — listo para que un ingeniero lo revise y, en Fase 2, se conecte a la salida de un modelo de visión (recomendación técnica: Claude con visión y salida estructurada devolviendo exactamente el JSON que ya definieron, en vez de entrenar un modelo propio con Roboflow/PyTorch — cero dataset propio, cero infraestructura de ML, y el prompt puede forzar el mismo contrato JSON). Esa integración NO se hace en esta fase.

## Decisión de arquitectura: cero tablas nuevas

Este flujo es público, sin cuenta, para gente en emergencia. No es una "obra" ni tiene `Constructora`/`Cliente` detrás. En vez de forzar el modelo multi-tenant existente:

- Todo el flujo (checklist, ubicar grieta, fotos, resultado, acta) vive **en el cliente** (React state), sin persistir nada en Prisma.
- Las fotos se procesan igual que `CameraCapture.tsx` ya hace hoy (comprimir + quemar overlay con fecha/hora/GPS en el canvas) — así la evidencia queda sellada en la imagen misma, no depende de una fila en base de datos.
- El PDF (acta de daños) se genera con `@react-pdf/renderer` a partir del estado en memoria del navegador — un endpoint server-side sin estado (`POST /api/alerta/acta-pdf`) recibe el payload ya armado (fotos en base64 + respuestas) y devuelve el PDF, sin guardar nada.
- Guardar el informe por correo es opcional y explícito: si el usuario lo pide, se envía el PDF adjunto por Resend (mismo proveedor que ya usa `email-templates`) sin crear fila en DB. No hay `MensajeContacto` de por medio.

Esto evita por completo la migración baseline pendiente (ver nota de Fase 2 de migraciones — no se toca `_prisma_migrations`) y permite lanzar en días, no semanas, que es lo que importa en una respuesta de emergencia.

Si más adelante se decide guardar reportes (p. ej. para el puente con ingenieros o la oficina de gestión del riesgo), eso es una decisión de producto explícita y separada, no un efecto colateral de esta fase.

---

## A. Motor de reglas (`src/lib/alerta/`)

TypeScript puro, sin dependencias de UI ni de red. Es la pieza que un ingeniero debe poder leer y auditar de punta a punta.

### A.1 Tipos — contrato de observación (lo que en Fase 2 llenará el modelo de visión)

```ts
// src/lib/alerta/tipos.ts
export type Elemento =
  | "columna" | "viga" | "nudo_viga_columna" | "muro_carga"
  | "muro_divisorio" | "losa_techo" | "piso" | "fachada" | "no_determinado";

export type Patron =
  | "diagonal" | "diagonal_x" | "vertical" | "horizontal"
  | "escalonada" | "craquelado" | "esquina_vano" | "junta_entre_elementos";

export interface Banderas {
  acero_expuesto: boolean;
  concreto_triturado: boolean;
  desplazamiento_caras: boolean;
  elemento_inclinado: boolean;
  separacion_muro_estructura: boolean;
}

export type CalidadFoto = "ok" | "oscura" | "movida" | "muy_lejos" | "sin_referencia_escala";

export interface ObservacionGrieta {
  elemento: Elemento;
  patron: Patron;
  ancho_mm: number | null;
  banderas: Banderas;
  confianza: { elemento: number; patron: number; ancho: number };
  calidad_foto: CalidadFoto;
}

export type Nivel = "rojo" | "amarillo" | "verde";

export interface Veredicto {
  nivel: Nivel;
  razon: string;        // "grieta diagonal en columna con acero expuesto"
  que_hacer: string;
  que_no_hacer: string[];
}
```

### A.2 Reglas (`src/lib/alerta/reglas.ts`)

Función pura `evaluarGrieta(obs: ObservacionGrieta): Veredicto`, en este orden (la primera regla que aplica gana — no hay promedios):

| # | Condición | Nivel |
|---|---|---|
| 1 | `elemento` en {columna, viga, nudo_viga_columna} y (`acero_expuesto` o `concreto_triturado` o `desplazamiento_caras`) | Rojo |
| 2 | `elemento` en {columna, viga, nudo_viga_columna} y `patron` en {diagonal, diagonal_x}, cualquier ancho | Rojo |
| 3 | `elemento_inclinado` o `separacion_muro_estructura` | Rojo |
| 4 | `elemento === muro_carga` y (`ancho_mm > 3` o `patron === escalonada` con indicio de pasante) | Rojo |
| 5 | `elemento` en {columna, viga, nudo_viga_columna, muro_carga} y no cayó en rojo arriba → cualquier grieta | Amarillo |
| 6 | `elemento === muro_divisorio` y (`ancho_mm` ancho, `patron === escalonada`, o riesgo de desprendimiento) | Amarillo |
| 7 | `elemento === no_determinado` o `calidad_foto !== ok` o cualquier `confianza.*` bajo un umbral (ver A.3) | Amarillo |
| 8 | `elemento === muro_divisorio` y `patron` en {craquelado} sin banderas | Verde |
| 9 | cualquier otro caso no cubierto | Amarillo (por defecto conservador — nunca cae a verde por omisión) |

`evaluarInmueble(veredictos: Veredicto[]): Veredicto` — el nivel del inmueble es el **peor** de todas las grietas evaluadas, nunca el promedio.

### A.3 Umbral de confianza

Constante exportada `CONFIANZA_MINIMA = 0.6`. Si `confianza.elemento`, `confianza.patron` o `confianza.ancho` (cuando `ancho_mm` no es null) están por debajo, la observación no puede resolver en verde — cae a regla 7 (amarillo).

### A.4 Copys de nivel (`src/lib/alerta/copys.ts`)

Constantes exactas, en español, tal como las definió el negocio — no se parafrasean en la UI:

- Rojo: `"Salí y buscá evaluación urgente."`
- Amarillo: `"Documentá y que un ingeniero la revise antes de seguir viviendo normal."`
- Verde: `"No vemos señales de alarma en esta foto"` — **nunca** "es seguro".

`que_no_hacer` fijo para todo resultado que no sea verde: `["No taparla", "No pintarla", "No cargar el elemento"]`.

### A.5 Filtro de seguridad Paso 0 (`src/lib/alerta/filtroSeguridad.ts`)

Reglas AIS simplificadas, independientes del motor de grietas — 4 preguntas sí/no:

```ts
export interface FiltroSeguridadRespuestas {
  edificioInclinado: boolean;
  columnaReventadaOVarillaExpuesta: boolean;
  pisosDesnivelados: boolean;
  olorAGas: boolean;
}
export function evaluarFiltroSeguridad(r: FiltroSeguridadRespuestas): boolean; // true = "salí ahora", corta el flujo
```

Cualquier `true` → corta el flujo antes de cualquier foto. Sin excepciones, sin IA de por medio.

---

## B. Landing + Paso 0 — `/alerta`

Ruta: `src/app/(public)/alerta/page.tsx` (usa el layout público existente — Navbar/Footer de Seiricon, refuerza la marca para el remarketing posterior).

### B.1 Contenido

- Hero serio, sin tono comercial: qué es, para quién, que no reemplaza a un ingeniero.
- Filtro de seguridad de 4 preguntas (A.5). Cualquier "sí" → pantalla de corte: "Salí ahora", qué hacer, líneas de emergencia (Cali, Pereira, Manizales — confirmar números vigentes con el usuario antes de publicar, no inventar teléfonos).
- Si todo es "no" → botón a `/alerta/documentar` (Acta de daños, sección C).
- Nota visible y permanente: "Esta herramienta no reemplaza una evaluación de un ingeniero estructural." (evita que "verde" se lea como "es seguro").

### B.2 Componentes nuevos

- `src/components/alerta/FiltroSeguridad.tsx` — las 4 preguntas + pantalla de corte.
- `src/components/alerta/AlertaHero.tsx`.

---

## C. Acta de daños — `/alerta/documentar`

"Es literalmente nuestro módulo de Evidencia reempaquetado" — reusa el patrón de `CameraCapture.tsx` (comprimir + overlay fecha/hora/GPS quemado en la imagen), pero sin atarlo a `proyecto`/`tarea`.

### C.1 Flujo (todo en cliente, un solo `page.tsx` con estado por pasos)

1. Datos básicos: dirección o descripción del inmueble (texto libre, sin geocodificar), tipo de inmueble (casa/apto/edificio/local — mismos íconos que ya existen en `src/components/personal/icons/` si aplica).
2. Por cada habitación/espacio dañado: nombre del espacio + 1-N fotos (reusar lógica de `drawOverlay` de `CameraCapture.tsx`, extraída a un helper compartido en `src/lib/media/overlay.ts` para no duplicarla) + nota corta opcional.
3. "Agregar otro espacio" / "Terminar".
4. Resumen + botón "Generar PDF" y botón opcional "Enviarme una copia por correo".

### C.2 Componente de cámara

`src/components/alerta/ActaCameraCapture.tsx` — envoltorio delgado sobre la lógica compartida de overlay (C.1.2), UI adaptada (sin `proyectoNombre`/`tareaNombre`, con nombre de espacio en su lugar). No modificar `CameraCapture.tsx` existente — extraer solo lo compartible a `src/lib/media/overlay.ts` para no arriesgar el flujo B2B/B2C que ya usa ese componente.

### C.3 Endpoint PDF

`POST /api/alerta/acta-pdf` — recibe `{ inmueble, espacios: [{ nombre, nota, fotos: base64[] }] }`, arma el PDF con `@react-pdf/renderer` (`src/lib/pdf/ActaDanosReport.tsx`, mismo `pdfStyles`/`pdfColors` de `src/lib/pdf/styles.ts`) y lo devuelve como stream (`Content-Type: application/pdf`). Sin persistencia. Límite de tamaño de payload razonable (p. ej. 15 fotos, ya comprimidas a <1MB c/u como hace `drawOverlay`).

### C.4 Envío por correo (opcional)

`POST /api/alerta/acta-email` — mismo payload + `email`. Genera el PDF igual que C.3 y lo envía con Resend como adjunto (reusar `src/lib/email-templates` como referencia de estilo del correo, no de contenido). Sin fila en DB — es un envío efímero. Validar formato de email en el server antes de llamar a Resend.

---

## D. Fuera de alcance de esta fase (explícito)

- Cualquier llamada a un modelo de visión / clasificación automática por foto.
- Persistencia de actas o checklists en base de datos.
- Directorio de ingenieros, protocolo B2B de inspección post-sismo, mapa comunitario — quedan documentados en el doc de producto de Karen, no se tocan aquí.
- Números de línea de emergencia: se dejan como placeholder marcado `TODO(confirmar-telefono)` en el componente hasta que el usuario los confirme — no inventar cifras en un flujo de emergencia.

---

## E. Plan de orquestación con agentes

- **planificador**: valida este spec contra las convenciones actuales del repo antes de construir (nombres de archivo, estilo de componentes públicos, `pdfStyles` compartido).
- **constructor**: implementa A (motor de reglas), B (landing + Paso 0) y C (acta de daños + endpoints) en ese orden — A no depende de nada, B depende de A (copys/filtro), C depende de A (para dejar el veredicto listo aunque no se muestre aún) y de la extracción de `overlay.ts`.
- **revisor**: confirma que el motor de reglas cumple la tabla A.2 regla por regla (casos borde: confianza baja, `no_determinado`, ancho exactamente igual al umbral), que no se tocó `CameraCapture.tsx` de forma que rompa el flujo B2B/B2C existente, que no hay escritura a Prisma en ningún archivo nuevo de esta fase, y que `npx tsc --noEmit` + `npm run build` pasan.

## F.0 Addendum — correcciones del planificador + decisiones aprobadas (2026-08-13)

El agente `planificador` validó este spec contra el repo real y encontró correcciones de convención y 2 riesgos. Todo lo siguiente fue aprobado por el usuario y **reemplaza** lo que contradiga en las secciones A-C de arriba.

**Correcciones de nombre/convención (kebab-case, sin excepciones):**
- `src/lib/alerta/filtroSeguridad.ts` → **`src/lib/alerta/filtro-seguridad.ts`**
- Script de verificación va en **`scripts/verificar-reglas-alerta.ts`** (raíz, no `src/scripts/`), registrado como `npm run verify:alerta`
- `src/app/(public)/alerta/documentar/page.tsx` es **server component** (solo `metadata` + composición); todo el estado del wizard vive en **`src/components/alerta/ActaWizard.tsx`** (`"use client"`), no dentro de `page.tsx`
- El PDF se devuelve con **`renderToBuffer`** (no stream) — patrón de las 4 rutas PDF existentes
- `src/components/personal/icons/` es en realidad **`src/components/personal/icons.tsx`** (archivo, no carpeta)

**R1 — tope de payload (decisión del usuario: aprobado tal cual la recomendación):**
- Perfil de compresión propio del acta: `MAX_DIM = 1200`, calidad JPEG `0.65` (~150-250 KB/foto)
- `src/lib/alerta/acta.ts` define `MAX_FOTOS = 10` (total), `MAX_ESPACIOS = 8`, `MAX_BODY_BYTES = 3.5MB` (margen bajo los 4.5MB de Vercel)
- `ActaWizard` cuenta bytes en vivo, deshabilita el botón de captura al llegar al tope, muestra contador "X/10 fotos"
- Ambas rutas API (`acta-pdf`, `acta-email`) validan `content-length` y responden `413` en español si se pasa
- Ambas rutas declaran `export const maxDuration = 60;`
- Fase 2 (si 10 fotos se queda corto en la práctica): mover la generación del PDF al navegador. No se hace ahora.

**R2 — `CameraCapture.tsx`: NO se extrae nada, se duplica (decisión del usuario: aprobado tal cual la recomendación):**
- `CameraCapture.tsx` alimenta 3 superficies de producción (`ReportarObrero.tsx` con cola offline en IndexedDB, `ReportarButton.tsx` B2B, `SugerirTareaForm.tsx` B2C) y el service worker de Serwist. **Cero cambios en ese archivo** — `git diff --stat main -- src/components/evidencia/CameraCapture.tsx` debe quedar vacío.
- `src/lib/media/overlay.ts` nace como módulo **nuevo y autónomo** (no una extracción), con su propio perfil de compresión (ver R1) y una etiqueta de espacio en vez de proyecto/tarea. Comentario de cabecera que declare que es intencionalmente paralelo a `CameraCapture.tsx`, no una versión compartida.

**Decisión — header en `/alerta/documentar` (aprobado):** usa el Navbar de marketing normal del layout `(public)`, igual que el resto del sitio. No se construye un header propio en esta fase.

**Decisión — enlace desde el sitio (aprobado):** `/alerta` **no** se enlaza desde `Navbar.tsx` ni `Footer.tsx` en esta fase. El tráfico llega por fuera (redes, WhatsApp). No tocar esos dos archivos.

**R3 — endpoints públicos sin rate limit (riesgo aceptado, no resuelto):** no existe helper de rate limiting en el repo. Mitigación mínima incluida en el alcance: honeypot oculto en el form de correo, botón en single-flight mientras hay request en vuelo, los topes duros de R1. No se agrega ninguna dependencia nueva para esto.

**R4 — hero oscuro obligatorio:** `Navbar.tsx` es `fixed`, arranca transparente con texto blanco y solo cambia a tema claro pasado `0.85 * innerHeight` de scroll. `AlertaHero.tsx` **debe** seguir el patrón de `BetaHero` (`bg-slate-900 pt-28 pb-20`) o el logo/links quedan ilegibles al cargar.

**R5 — primer PDF con imágenes del repo:** ninguno de los 4 `*.tsx` en `src/lib/pdf/` usa `Image`. `ActaDanosReport.tsx` es el primero en usar `Image` con data-URI base64 en `@react-pdf/renderer` 4.4.1 — falla silenciosamente (imagen en blanco) si el data-URI está mal formado. Verificar temprano generando un PDF de prueba real con al menos 1 foto antes de dar por cerrada la sección C.

**Archivos nuevos confirmados (19) y modificados (4):**

Nuevos — motor de reglas: `src/lib/alerta/tipos.ts`, `copys.ts`, `reglas.ts`, `filtro-seguridad.ts`, `scripts/verificar-reglas-alerta.ts`.
Nuevos — landing/Paso 0: `src/components/alerta/config.ts`, `AlertaHero.tsx`, `AlertaDisclaimer.tsx`, `LineasEmergencia.tsx`, `FiltroSeguridad.tsx`, `src/app/(public)/alerta/page.tsx`.
Nuevos — acta de daños: `src/lib/media/overlay.ts`, `src/lib/alerta/acta.ts`, `src/components/alerta/ActaCameraCapture.tsx`, `src/components/alerta/ActaWizard.tsx`, `src/app/(public)/alerta/documentar/page.tsx`, `src/lib/pdf/ActaDanosReport.tsx`, `src/app/api/alerta/acta-pdf/route.ts`, `src/app/api/alerta/acta-email/route.ts`.
Modificados: `src/lib/email.ts` (agrega `attachments?` opcional a `SendEmailOptions`, pasado tal cual a Resend — ningún llamador existente cambia), `docs/arquitectura.md`, `docs/casos-de-uso.md`, `package.json` (script `verify:alerta`).

**Orden de construcción:** (1) motor de reglas completo, cerrar con `npm run verify:alerta` en verde → (2) landing + Paso 0, cerrar con `/alerta` renderizando y el filtro cortando el flujo → (3) rama de captura (`overlay.ts` → `ActaCameraCapture.tsx`) y rama de PDF (`acta.ts` → `ActaDanosReport.tsx` → `acta-pdf/route.ts` → `email.ts` → `acta-email/route.ts`) en paralelo → (4) `ActaWizard.tsx` uniendo ambas ramas → `documentar/page.tsx` → (5) docs + verificación final.

**Qué NO tocar bajo ninguna circunstancia en esta fase:** `src/components/evidencia/CameraCapture.tsx`, `prisma/schema.prisma`, `prisma/migrations/`, `src/proxy.ts` (no agregar `/alerta` al matcher), `src/lib/access.ts`, `src/lib/permissions.ts`, `src/lib/pdf/styles.ts` (solo consumir, no modificar), `src/components/landing/Navbar.tsx`, `src/components/landing/Footer.tsx`. No correr `npm run db:push` ni ninguna migración.

**Teléfonos de emergencia:** siguen sin confirmar. `LineasEmergencia.tsx` debe dejarlos como placeholder visible marcado `TODO(confirmar-telefono)` — el usuario los completará antes de publicar. No inventar números en un flujo de emergencia real.

## F. Verificación final

- `npx tsc --noEmit` sin errores.
- `npm run build` compila.
- El flujo B2B y el wizard B2C (`CameraCapture.tsx`, `/empezar`) siguen funcionando igual — solo se les extrajo un helper compartido, no se les cambió comportamiento.
- Probar manualmente: las 4 preguntas del filtro cortan el flujo con cualquier "sí"; el acta genera un PDF con fotos + fecha/hora/GPS visibles; el motor de reglas da rojo/amarillo/verde correcto para los casos de la tabla A.2 (se puede probar con un script suelto en `src/scripts/` o casos manuales, ya que el proyecto no tiene test runner configurado).
