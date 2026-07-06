# Spec — Excel único de tareas+presupuesto y cronograma con contra-pronóstico (B2C)

**Fecha:** 2026-07-03 · **Estado:** aprobado para ejecución.
**Aplica a:** Propietario y Contratista B2C (wizard `/empezar`).
**Fuera de alcance (siguiente spec):** pestaña "Control de gastos" (presupuesto de materiales avanzado + corte por fase + gráficas), integrada al módulo Gastos existente.

---

## Contexto y decisiones tomadas (debatidas con Victor)

- **Una sola plantilla Excel** (no dos): los ítems del presupuesto real SON tareas (verificado con presupuesto real de constructor: capítulos = fases, ítem + valor total, a veces sin desglose M.O./materiales, valores "opcional", numeración repetida).
- La plantilla se descarga **DESPUÉS de crear los espacios** en el wizard → la generamos dinámicamente con los espacios del usuario como **dropdown bloqueado** (validación de datos de Excel, no texto libre).
- **Nombres de espacio únicos por piso** (regla nueva en el wizard): "Cocina 1"/"Cocina 2"; "Cuarto 1" puede existir en Piso 1 y en Piso 2. El dropdown va calificado: `Piso 1 – Cocina`.
- **Ubicaciones globales**: "Toda la propiedad" y "Piso N (todo el piso)" — para tareas como pintar/estucar todo. Se materializan como espacio especial "General" (a nivel unidad, y por piso) para no romper el modelo progreso/evidencia.
- **Contra-pronóstico SOLO guía** (nunca bloquea).
- **Línea de tiempo simple con ramas paralelas** (carriles), NO Gantt.
- **Flywheel de duraciones** (`RegistroDuracion`): igual patrón que RegistroPrecio — arranca con rendimientos investigados, se corrige con duraciones reales de las obras.
- Preferencia de Victor: criterio y debate con argumentos, no complacencia.

## 1. Plantilla Excel única

**Columnas:**

| Fase | Tarea / Ítem | Ubicación | Ppto. mano de obra | Ppto. materiales | Ppto. total |
|---|---|---|---|---|---|
| dropdown | texto | **dropdown bloqueado** | número (opc.) | número (opc.) | número (opc.) |

**Reglas de presupuesto (en la importación):**
- M.O. + materiales → total = suma (si además viene total distinto, prevalece la suma y se avisa).
- Solo total → en el paso de revisión se pregunta: "¿estimamos la división M.O./materiales?" (usa `pctManoObraDeTarea`) o queda sin desglosar.
- Nada → tarea sin presupuesto (válido).

**Dropdown de Fase:** lista curada (Preliminares/Demolición · Obra gris/Estructura · Instalaciones eléctricas · Instalaciones hidrosanitarias · Repello/Estuco · Pintura · Pisos/Enchapes · Carpintería/Madera · Cocina/Closets · Aparatos y grifería · Detalles y aseo) + se aceptan variantes en la importación (normalización tolerante).

**Dropdown de Ubicación:** `Toda la propiedad` · `Piso N (todo el piso)` · `Piso N – <Espacio>`… generado con los espacios reales del usuario. En APARTAMENTO (un piso) sin prefijo de piso. EDIFICIO: fuera de alcance del import en esta ronda (la plantilla se ofrece solo para CASA/APARTAMENTO/LOCAL; edificio sigue con el flujo actual).

**Generación:** endpoint autenticado que recibe la estructura actual del wizard (espacios por piso) y devuelve el `.xlsx` con dropdowns (data validation). Verificar librería: el repo B2B usa utilidades Excel (`ExcelTemplateUtils.ts`); si la lib actual (SheetJS) no soporta escribir data-validation, agregar `exceljs`. Incluir fila de ejemplo + hoja "Instrucciones" corta.

## 2. Importación con paso de revisión

- Subida en el paso "¿Qué falta?" del wizard (junto a "descargar plantilla"). Parse tolerante: ignora filas vacías, detecta "opcional"/texto en columnas numéricas, valores 0, duplicados.
- **Paso de revisión (modal/paso previo a aplicar):**
  - Resumen: N tareas válidas, X con presupuesto, Y marcadas "opcional" o en 0 → ¿incluir?
  - División M.O./materiales cuando solo hay total → pregunta única ("estimar división para N ítems").
  - **Ubicaciones huérfanas** (renombraron el espacio después de descargar): "'Cocina' ya no existe — ¿asignar a 'Cocina principal' / a 'Toda la propiedad' / descartar fila?".
  - Fases no reconocidas → mapear a la lista curada (sugerencia automática + selección manual).
- Al aplicar: crea tareas en sus espacios (o en "General"), con `precio` (=total), desglose M.O./materiales por tarea si existe, fase.
- **Persistencia del desglose POR TAREA:** agregar a `Tarea` los campos `presupuesto_mano_obra Int?` y `presupuesto_materiales Int?` (cierra el diferido de la fase 5 anterior). Migración.
- Límites: MAX filas (500), textos acotados, montos ≤ INT_CAP, validación de tipos. Tenant-safe.

## 3. Unicidad de nombres de espacios (wizard)

- Al agregar/renombrar espacios en el wizard: no permitir nombre duplicado **dentro del mismo piso** → auto-numerar ("Cocina 2") o avisar inline.
- Aplica en creación y edición. Validar también server-side en `crearObraPersonal`/`editarObraPersonal` (normalizar duplicados con sufijo, no rechazar la obra).

## 4. Cronograma: rendimientos, contra-pronóstico y línea de tiempo

### 4a. Investigación de rendimientos (agente)
Rendimientos de construcción en Colombia por tarea (m²/día por cuadrilla típica, unidades/día): estuco, pintura, enchape, mampostería, repello, instalaciones, carpintería, etc. + duraciones típicas de obra completa por tipo (remodelación baño/cocina/apto/casa) — con fuentes y confianza. Salida: tabla codificable `rendimiento` por clave de la base semilla (`precios-semilla` keys) → `src/lib/rendimientos.ts`.

### 4b. Motor de duración (`src/lib/estimar-duracion.ts`)
- Determinista: por tarea → días = cantidad (m²/unidad, ya calculada por el estimador de costos) ÷ rendimiento; con mínimo 0.5 día y redondeos.
- Secuencia por FASES (orden constructivo curado). Tareas de la misma fase y de espacios distintos se paralelizan con un factor de cuadrilla (1 cuadrilla por defecto → parcialmente secuencial; parámetro simple, no simulación).
- Salida: duración total estimada (rango optimista–probable), duración por fase, y qué corre en paralelo.
- IA (DeepSeek) SOLO para clasificar en fase las tareas que el matcher no reconozca (mismo principio que precios: la IA no inventa números).

### 4c. Contra-pronóstico (solo guía)
- En el paso de fechas del wizard (ya existen fechaInicio/fechaFin): al dar fechas (o un "yo creo que tarda X días"), mostramos: "Para lo que planeas, usualmente toma **~N días hábiles** (rango A–B). Tu plan de X días es más corto/está dentro de lo normal/es holgado." NUNCA bloquea.
- Si no dan fechas: ofrecer el estimado como sugerencia de fecha fin.

### 4d. Línea de tiempo con ramas (UI)
- Vista simple por semanas/fases (carriles): línea principal de fases secuenciales; cuando hay paralelo, ramas debajo (como el dibujo de Victor: obra gris → repello → estuco → madera, con "instalar bombillas" colgando en paralelo).
- Se muestra en el resumen del wizard (paso final) y en el detalle del proyecto (solo cuentas personales). Mobile-first, sin Gantt.

### 4e. Flywheel `RegistroDuracion`
- Modelo: `{ id, tarea_normalizada, fase, ciudad, metraje?, dias_estimados, dias_reales, proyecto_id, constructora_id, created_at }` (map `registros_duracion`). Migración.
- Captura pasiva: cuando una tarea pasa a APROBADA y tiene `fecha_inicio` + fecha real de fin → registrar días reales vs. estimados (batch, try/catch, nunca rompe el flujo — mismo patrón que RegistroPrecio).
- Lectura futura: `getDuracionMercado()` (no conectar a UI aún; el motor determinista es la fuente por ahora).

## 5. Pipeline de ejecución

1. **Agente investigación** (rendimientos Colombia) — paralelo con backend.
2. **Agente backend**: plantilla dinámica + endpoint de generación, parser/import + API, unicidad server-side, campos `presupuesto_*` en Tarea, `RegistroDuracion`, motor `estimar-duracion.ts` (con los rendimientos cuando lleguen), captura pasiva. Migraciones (las aplica Victor/el orquestador).
3. **Agente frontend/UX**: botones descargar/subir en "¿Qué falta?", paso de revisión, unicidad en wizard (auto-numerar), contra-pronóstico en fechas, línea de tiempo con ramas (wizard + detalle), textos formales-cálidos y llanos.
4. **Cierre**: agente de bugs (revisa y corrige) + agente de seguridad (upload de archivos = superficie nueva: tamaño máx, tipo, parse seguro, tenant). tsc/eslint limpios. Commit+push tras el gate. Manual de usuario al fijar en main.

## Criterios de aceptación
- Descargo plantilla con MIS espacios en dropdown; lleno 20 filas (algunas solo con total, una "opcional", una con fase rara); subo; el paso de revisión me deja decidir; se crean tareas con ubicación correcta (incluida "Toda la propiedad"), presupuesto y desglose por tarea.
- No puedo tener dos "Cocina" en el mismo piso (auto-numera).
- Al poner fechas, veo el contra-pronóstico guía con rango; en el resumen veo la línea de tiempo con ramas paralelas.
- Las duraciones reales se registran solas al aprobar tareas (`registros_duracion`).
- tsc/eslint limpios; migraciones aplicadas; sin regresión en creación/edición existente ni en B2B.
