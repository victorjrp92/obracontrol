# Mejoras al Wizard de Creacion de Proyecto

**Fecha:** 2026-04-18
**Estado:** Draft

---

## 1. Contexto

El wizard de creacion de proyecto (`/dashboard/proyectos/nuevo`) tiene 3 pasos: Estructura, Tareas, y Asignar y crear. Funciona pero tiene limitaciones que afectan la experiencia del usuario:

- Los espacios de un tipo de unidad son una lista cerrada (no se pueden agregar personalizados)
- Los inputs numericos no permiten borrar el "0" para escribir un nuevo numero
- Las tareas sugeridas se agregan directamente sin que el usuario las revise
- No hay opcion de importar/exportar tareas via Excel durante la creacion
- La asignacion de contratistas es tarea por tarea (tedioso en proyectos grandes)
- Hay un componente ExcelButtons en la vista de proyecto creado que no deberia estar ahi

**Archivos principales afectados:**
- `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx` (~850 lineas)
- `src/lib/task-templates.ts` (templates de tareas sugeridas)
- `src/app/api/proyectos/wizard/route.ts` (API de creacion)
- `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx` (vista de proyecto — quitar ExcelButtons)
- `src/app/(dashboard)/dashboard/proyectos/[id]/ExcelButtons.tsx` (a eliminar)
- `src/app/api/proyectos/[id]/plantilla/route.ts` (mover logica al wizard)
- `src/app/api/proyectos/[id]/importar-tareas/route.ts` (mover logica al wizard)

---

## 2. Cambios

### 2.1 Espacios personalizables en Tipos de Unidad (Step 1)

**Estado actual:** Los chips en cada tipo de unidad provienen de `ESPACIOS_SUGERIDOS` (lista fija de 9 espacios). El usuario solo puede activar/desactivar chips existentes.

**Cambio:** Los chips siguen como sugerencias pero se agrega un input de texto debajo para escribir espacios personalizados (ej: "Patio", "Balcon", "3er bano"). Al escribir y presionar Enter o clic en "+", el espacio se agrega como chip activo al tipo de unidad.

**Detalle adicional:** Renombrar "Zona de labores" a "Zona de lavado" en `ESPACIOS_SUGERIDOS` y en los templates de tareas (`TASK_TEMPLATES`) donde aparezca como key.

**Comportamiento:**
- Los chips sugeridos se muestran siempre (toggle on/off como ahora)
- Los espacios personalizados aparecen como chips activos con un boton X para eliminarlos
- No se permite duplicados (case-insensitive)
- El input se vacia despues de agregar

### 2.2 Inputs numericos sin "0" pegado (Step 1)

**Estado actual:** Los inputs de "pisos" y "unidades por piso" usan `type="number"` con `value={e.pisos}`. Al borrar el valor queda "0" que no se puede eliminar porque el state es numerico.

**Cambio:** Usar string interno para el value del input y convertir a numero solo cuando se usa. Permitir que el campo quede vacio temporalmente.

**Implementacion:**
- Cambiar `pisos: number` a `pisos: number` en el tipo pero manejar el input como string local
- Usar `onChange` que acepte string vacio (mostrar "") y solo convierte a numero en el state cuando hay un valor valido
- Aplicar lo mismo a los inputs de distribucion (unidades por tipo por piso)
- Validacion: si el campo queda vacio al avanzar, tratar como 0 (el boton "Siguiente" ya valida `pisos > 0`)

### 2.3 Step 2 dividido por fases

**Estado actual:** Step 2 muestra todas las tareas en una sola lista, con un badge "M" u "OB" por tarea. "Generar tareas sugeridas" genera todas las tareas de todas las fases de golpe.

**Cambio:** Dividir Step 2 en secciones por fase. Cada fase seleccionada (Obra Blanca, Madera) es una seccion colapsable con:
- Su propio boton "Generar sugeridas" 
- Su propio boton "Agregar manual"
- Su propia lista de tareas
- Su propio boton de descargar/subir plantilla Excel

**Comportamiento:**
- Las fases seleccionadas en los chips superiores determinan que secciones se muestran
- Cada seccion funciona independientemente
- El formulario de agregar tarea manual ya no necesita el dropdown de "Fase" (se infiere de la seccion)
- La lista de tareas por fase muestra: espacio, nombre, dias, boton eliminar

### 2.4 Tareas sugeridas con checkboxes (Step 2)

**Estado actual:** "Generar tareas sugeridas" llama `generarTareasSugeridas()` que reemplaza todas las tareas con las sugeridas de `getTareasSugeridas()`.

**Cambio:** "Generar sugeridas" (por fase) abre un panel/modal con las tareas sugeridas basadas en los espacios definidos. Cada tarea tiene un checkbox. El usuario selecciona las que quiere y confirma con "Agregar seleccionadas".

**Comportamiento:**
- Al hacer clic en "Generar sugeridas" dentro de una fase, se despliega un panel inline debajo del boton
- Las tareas se agrupan por espacio para facilitar la lectura
- Checkbox "Seleccionar todo" por espacio
- Checkbox "Seleccionar todo" global (todas las tareas sugeridas de esa fase)
- Boton "Agregar X seleccionadas" al final del panel
- Las tareas seleccionadas se agregan a la lista existente (no reemplazan)
- Si una tarea ya existe en la lista (mismo nombre + espacio), no se duplica
- Los checkboxes son toggleables (se puede hacer check y uncheck libremente antes de confirmar)

### 2.5 Plantilla Excel en Step 2

**Estado actual:** No existe plantilla Excel en el wizard. Existe en el proyecto ya creado (ExcelButtons.tsx + API routes).

**Cambio:** Agregar por cada seccion de fase un boton "Descargar plantilla" y "Subir plantilla". La plantilla es un .xlsx generado client-side con ExcelJS.

**Plantilla — estructura del Excel:**
- Hoja "Tareas":
  - Columnas: Espacio | Nombre de la tarea | Dias acordados | Codigo referencia (opcional) | Marca/Linea (opcional) | Componentes (opcional) | Notas (opcional)
  - Columna "Fase" NO se incluye porque la plantilla se descarga por fase (ya se sabe la fase)
  - 3 filas de ejemplo con estilo italica gris y texto "[EJEMPLO]" al inicio del nombre
  - Data validation en "Espacio": dropdown con los espacios del proyecto (union de todos los tipos de unidad)
- Hoja "Instrucciones":
  - Breve explicacion de como llenar la plantilla
  - Lista de espacios validos
  - Nota: "Las filas que empiecen con [EJEMPLO] seran ignoradas al importar"
- Branding: header azul (#2563EB), nombre "Seiricon" como creator

**Generacion client-side:** La plantilla se genera en el browser con ExcelJS (ya esta en package.json). No necesita API route porque durante la creacion del proyecto aun no existe el proyecto en la DB. Los datos (espacios, fase) vienen del state del wizard.

**Subida:**
- Boton "Subir plantilla" por fase
- Parsea el .xlsx client-side con ExcelJS
- Ignora filas con "[EJEMPLO]" en el nombre
- Valida: espacio existe en los tipos definidos, nombre no vacio, dias > 0
- Muestra errores inline si hay filas invalidas
- Las tareas validas se agregan a la lista de la fase correspondiente

### 2.6 Step 3 — Asignacion por fase con distribucion visual

**Estado actual:** Lista plana de tareas con dropdown de contratista por tarea.

**Cambio:** Reemplazar con asignacion jerarquica por fase.

**Estructura del nuevo Step 3:**

```
Resumen del proyecto (cards existentes — se mantienen)

── Obra Blanca ───────────────────────────────────
Contratistas para esta fase: [+ Agregar contratista]
  Pedro Lopez  [X]
  Juan Garcia  [X]

Distribucion:
  ┌─ Torre 1 ──────────────────────┐
  │  Todas las tareas → [Pedro ▾]  │
  │  > Desglosar por actividad     │
  └────────────────────────────────┘
  ┌─ Torre 2 ──────────────────────┐
  │  Todas las tareas → [Juan ▾]   │
  └────────────────────────────────┘

── Madera ────────────────────────────────────────
Contratistas para esta fase: [+ Agregar contratista]
  Jose Martinez  [X]

Distribucion:
  ┌─ Torre 1 ──────────────────────┐
  │  Todas las tareas → [Jose ▾]   │
  └────────────────────────────────┘
  ┌─ Torre 2 ──────────────────────┐
  │  Todas las tareas → [Jose ▾]   │
  └────────────────────────────────┘
```

**Comportamiento detallado:**

1. **Agregar contratistas por fase:** Boton "+ Agregar contratista" abre un dropdown con los contratistas disponibles (prop `contratistas`). Se pueden agregar multiples. Boton X para quitar.

2. **Distribucion por torre (nivel por defecto):** Por cada torre/edificio se muestra un dropdown con los contratistas asignados a esa fase + "Sin asignar". Por defecto todas las torres estan "Sin asignar" hasta que el usuario seleccione.

3. **Desglose por actividad (opcional):** Si el usuario hace clic en "Desglosar por actividad" en una torre, se expande mostrando los tipos de tarea agrupados por espacio. Cada grupo tiene su propio dropdown de contratista. Esto permite asignar "Cocinas → Pedro, Closets → Juan" dentro de la misma torre.

4. **Si no hay contratistas:** Mostrar el mismo mensaje amarillo actual: "No hay contratistas registrados. Puedes invitarlos despues desde Usuarios y asignarlos a las tareas."

5. **Datos enviados al API:** Las asignaciones se traducen a `asignado_a` por tarea en el payload. La logica: si la torre tiene un contratista global, todas las tareas de esa torre/fase se asignan a ese contratista. Si esta desglosado, cada grupo de actividad tiene su contratista. Las tareas sin asignar tienen `asignado_a: null`.

**State necesario:**
```typescript
// Por fase
interface FaseAssignment {
  fase: string;
  contratistas: string[]; // IDs de contratistas asignados a esta fase
  distribucion: Record<string, TorreAssignment>; // edificio nombre -> assignment
}

interface TorreAssignment {
  contratista_global: string | null; // asignacion a nivel torre
  desglosado: boolean; // si esta expandido por actividad
  por_actividad: Record<string, string | null>; // espacio -> contratista ID
}
```

### 2.7 Quitar ExcelButtons del proyecto creado

**Estado actual:** `ExcelButtons.tsx` se renderiza en la vista del proyecto creado (`[id]/page.tsx` linea 114). Tiene botones de descargar plantilla y subir tareas.

**Cambio:** 
- Eliminar el import y uso de `ExcelButtons` en `[id]/page.tsx`
- Eliminar el archivo `src/app/(dashboard)/dashboard/proyectos/[id]/ExcelButtons.tsx`
- Las API routes `[id]/plantilla/route.ts` y `[id]/importar-tareas/route.ts` se mantienen por ahora (podrian ser utiles en el futuro para edicion con clave admin), pero no se exponen en la UI.

---

## 3. Flujo completo del wizard actualizado

**Step 1 — Estructura:**
1. Nombre, subtipo, dias habiles, fechas
2. Tipos de unidad con chips sugeridos + input personalizado (espacios)
3. Torres/edificios con inputs numericos mejorados (sin "0" pegado)
4. Zonas comunes (sin cambios)

**Step 2 — Tareas (dividido por fase):**
1. Seleccion de fases (chips, sin cambios)
2. Por cada fase seleccionada, seccion colapsable:
   - "Generar sugeridas" → panel con checkboxes → "Agregar seleccionadas"
   - "Agregar manual" → formulario inline (espacio, nombre, dias)
   - "Descargar plantilla" → .xlsx generado client-side
   - "Subir plantilla" → parseo client-side → tareas agregadas
   - Lista de tareas con: espacio, nombre, dias, boton eliminar, checkbox toggle

**Step 3 — Asignar y crear:**
1. Resumen del proyecto (cards, sin cambios)
2. Por cada fase: agregar contratistas → distribuir por torre → opcionalmente desglosar por actividad
3. Boton "Crear proyecto"

---

## 4. Cambios en task-templates.ts

- Renombrar key "Zona de labores" a "Zona de lavado" en `TASK_TEMPLATES["Obra Blanca"]` y `TASK_TEMPLATES["Madera"]`
- Renombrar "Zona de labores" a "Zona de lavado" en `ESPACIOS_SUGERIDOS`
- Actualizar los nombres de las tareas que referencian "zona de labores" a "zona de lavado"

---

## 5. Cambios en el API route (wizard/route.ts)

La estructura del payload no cambia significativamente. Las tareas siguen llegando con `fase`, `espacio`, `nombre`, `tiempo_acordado_dias`, y `asignado_a`. La logica de creacion en la transaccion se mantiene igual.

El unico cambio es que `asignado_a` ahora se resuelve desde la asignacion jerarquica del Step 3 (por fase/torre/actividad), pero el formato del payload sigue siendo el mismo: cada tarea con su `asignado_a` individual.

---

## 6. No hay cambios en el schema de Prisma

Todos los cambios son en la UI del wizard y la generacion client-side del Excel. No se necesitan nuevos modelos ni migraciones.

---

## 7. Dependencias

- `exceljs` (ya instalado, v4.4.0) — para generar y parsear Excel client-side
- No se agregan nuevas dependencias

---

## 8. Riesgos y consideraciones

- **Tamano del archivo wizard.tsx:** Ya tiene ~850 lineas. Con estos cambios creceria significativamente. Se recomienda extraer componentes:
  - `WizardStep1.tsx` — Estructura
  - `WizardStep2.tsx` — Tareas por fase
  - `WizardStep3.tsx` — Asignacion
  - `ExcelTemplateUtils.ts` — Generacion/parseo de Excel
  - `SuggestedTasksPanel.tsx` — Panel de tareas sugeridas con checkboxes
  
- **ExcelJS client-side:** ExcelJS funciona en el browser pero el bundle es pesado (~1MB). Se debe importar dinamicamente (`dynamic import`) para no afectar el bundle inicial.

- **Cantidad de contratistas:** Si no hay contratistas registrados, el Step 3 muestra un mensaje y permite crear el proyecto sin asignaciones (como ahora).
