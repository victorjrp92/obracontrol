# Spec — Ajustes de registro/onboarding + pendientes #2/#4

**Fecha:** 2026-06-26 · **Estado:** aprobado para ejecución.
**Ejecución:** backend → migración → frontend → **agente de revisión/corrección de bugs** → commit + push.

---

## 1. Pendientes a corregir

### #2 — No guardar espacios vacíos (edición)
Con "Guardar cambios" disponible en cada paso, un espacio nuevo agregado y guardado antes de tener tareas queda huérfano (sin tareas). 
**Fix:** en `crearObraPersonal`/`editarObraPersonal` (`src/app/(dashboard)/empezar/actions.ts`, ver `mapEspacios`/`sincronizarUnidad`), **no persistir espacios sin ninguna tarea activa** (ignorarlos silenciosamente al guardar). Así no se crean cuartos vacíos. No afecta espacios existentes con historial.

### #4 — Persistir el estado de la obra (puntoPartida)
Hoy `puntoPartida` (NUEVA | MEDIAS | AVANZADA) no se guarda; en edición arranca en "MEDIAS". 
**Fix:**
- Schema: `Proyecto.punto_partida String?`. Migración (ADD COLUMN).
- Persistir en `crearObraPersonal`/`editarObraPersonal`; devolver en `cargarObraParaEditar` → `ObraParaEditar.puntoPartida`.
- En `IntentWizard`, en modo editar, inicializar `puntoPartida` desde `initial.puntoPartida` (sin el default forzado a "MEDIAS" si viene del backend).

---

## 2. Contraseña en el registro (`src/app/(auth)/registro/RegistroWizard.tsx`)
Aplica a **todos los perfiles**:
- Añadir **"Confirmar contraseña"** (segundo campo): el usuario escribe la contraseña **dos veces**. Validar en cliente que coincidan **antes de enviar**; mensaje claro si no coinciden ("Las contraseñas no coinciden"). No enviar el formulario si difieren.
- **Ojito 👁 (mostrar/ocultar)** en el **primer** campo de contraseña (toggle de `type` password↔text con icono `Eye`/`EyeOff` de lucide). El campo de confirmar puede o no tenerlo; mínimo el primero.
- No cambia el backend (sigue enviando `password`); la confirmación es validación de front.

---

## 3. "¿Cómo controlas hoy el trabajo?" → selección múltiple

### Frontend (`src/app/onboarding/*`)
- La pregunta de **control** pasa de selección única a **MÚLTIPLE** (checkboxes; se pueden marcar varias, p. ej. WhatsApp y fotos + Excel).
- Opciones: **WhatsApp y fotos** · **Excel** · **Bloc de notas o cuaderno** · **Otra aplicación** · **No llevo control**.
- **"Otra aplicación"** → al marcarla, aparece un campo de texto **"¿Cuál?"** — **opcional** (no obligatorio para continuar/finalizar).
- **"No llevo control" es EXCLUSIVO:** al marcarla se desmarcan las demás; al marcar cualquier otra, se desmarca "No llevo control".
- Aplica a **Propietario**, **Contratista B2C** y **Empresa** (dejar la pregunta de control consistente en los tres; para Empresa el label puede seguir siendo "¿Cómo controlan hoy el avance?").

### Backend (`prisma/schema.prisma`, `src/app/api/onboarding/route.ts`)
- `PerfilOnboarding.control_actual`: de `String?` a **`String[]`** (varios valores). Nuevo campo **`control_otra String?`** (texto de "¿cuál?", acotado a ~80 chars). Migración (la tabla es nueva, con datos mínimos; convertir columna).
- Valores permitidos (allowlist): `WHATSAPP_FOTOS`, `EXCEL`, `CUADERNO`, `OTRA_APP`, `SIN_CONTROL`. (Se separó el antiguo `EXCEL_CUADERNO` en `EXCEL` + `CUADERNO`.)
- La API valida cada valor del array contra la allowlist, aplica la exclusividad de `SIN_CONTROL` (si viene con otros, se queda solo `SIN_CONTROL` o se rechaza — preferible normalizar a solo `SIN_CONTROL`), y guarda `control_otra` solo si viene `OTRA_APP` (acotado). Mantener el resto del contrato igual.

---

## Criterios de aceptación
- Registrarse pide contraseña dos veces con ojito; no deja continuar si no coinciden.
- El cuestionario permite marcar varias opciones de control; "Bloc de notas o cuaderno" es opción propia; "Otra aplicación" pide un "¿cuál?" opcional; "No llevo control" es exclusivo. Se guarda el array + el texto.
- Editar una obra ya no crea espacios vacíos; el estado de la obra se conserva al editar.
- `tsc`/`eslint` limpios. Migraciones creadas (aplicadas por el humano). Cierre con agente de revisión/corrección de bugs.
