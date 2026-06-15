# Spec: Seiricon Personal (B2C) — Propietario & Arquitecto independiente

Fecha: 2026-06-15
Estado: aprobado para implementación (con agentes)
Branch base: `main`
Línea de producto: **B2C** (separada del B2B empresarial). Perfiles `PROPIETARIO` y `ARQUITECTO` (enum `TipoCuenta`, ya creado por Karen).

## Misión del producto (la columna vertebral)

Acabar con el robo en obras propias. La persona sufre porque está lejos, no tiene tiempo de vigilar, y le cobran por trabajo que no existe o por materiales que se desaparecen. Promesa central:

> **"Nadie marca una tarea como hecha —ni te cobra— sin una foto que tú apruebes. Y cada peso de material queda con factura."**

Todo el flujo y el lenguaje giran alrededor de esa promesa. El wizard es solo el setup; el valor real es el ciclo prueba→aprobación y el control de gastos.

## Coordinación con Karen ⚠️

El flujo `/empezar` (IntentWizard, actions.ts, plantillas-personal.ts) es código reciente de Karen. Este spec lo **reescribe sustancialmente**. Antes de mergear: confirmar con Karen que esta zona es nuestra por ahora, o trabajar en branch `feature/personal-b2c` y coordinar el merge. Karen cambió schema con `db push` sin migración (drift conocido) — ver sección de migraciones.

---

## A. Cambios de schema (Prisma)

Sin romper nada del B2B. Todo aditivo.

### A.1 Proyecto — campos para contexto e índice de negocio
```prisma
model Proyecto {
  // ... existentes
  tipo_obra        String?   // "REFORMA" | "MODIFICACION" | "OBRA_NUEVA"
  tipo_propiedad   String?   // "CASA" | "APARTAMENTO" | "EDIFICIO" | "LOCAL"
  ciudad           String?   // para el índice de precios por región (de la ubicación)
  presupuesto_total Int?     // COP, opcional
}
```

### A.2 Gasto (módulo de materiales — nivel simple + detallado)
```prisma
enum EstadoGasto {
  REGISTRADO   // lo registró el obrero, espera aprobación
  APROBADO     // el dueño lo aprobó
  RECHAZADO
}

model Gasto {
  id              String      @id @default(cuid())
  proyecto_id     String
  espacio_id      String?     // a qué espacio aplica (opcional)
  tarea_id        String?     // a qué tarea aplica (opcional)
  descripcion     String      // "Cerámica cocina"
  monto           Int         // COP (total del gasto)
  factura_url     String?     // foto de la factura (storage)
  estado          EstadoGasto @default(REGISTRADO)
  registrado_por  String
  aprobado_por    String?
  fecha           DateTime    @default(now())
  // Nivel detallado (opcional, para el "profi"):
  material        String?     // "Cemento gris 50kg"
  cantidad        Float?
  unidad          String?     // "saco", "m²", "bulto"
  precio_unitario Int?
  created_at      DateTime    @default(now())

  proyecto    Proyecto @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  espacio     Espacio? @relation(fields: [espacio_id], references: [id], onDelete: SetNull)
  tarea       Tarea?   @relation(fields: [tarea_id], references: [id], onDelete: SetNull)
  registrador Usuario  @relation("GastosRegistrados", fields: [registrado_por], references: [id])
  aprobador   Usuario? @relation("GastosAprobados", fields: [aprobado_por], references: [id])

  @@index([proyecto_id])
  @@index([estado])
  @@map("gastos")
}
```

### A.3 Anticipo (dinero entregado al maestro — el mecanismo anti-robo clave)
```prisma
model Anticipo {
  id             String   @id @default(cuid())
  proyecto_id    String
  monto          Int      // COP entregado
  entregado_a    String?  // usuario (obrero/maestro) que recibió, opcional
  nota           String?
  fecha          DateTime @default(now())
  registrado_por String
  created_at     DateTime @default(now())

  proyecto    Proyecto @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  receptor    Usuario? @relation("AnticiposRecibidos", fields: [entregado_a], references: [id])
  registrador Usuario  @relation("AnticiposRegistrados", fields: [registrado_por], references: [id])

  @@index([proyecto_id])
  @@map("anticipos")
}
```

> **"Sin sustentar"** = Σ anticipos − Σ gastos APROBADOS. Es un cálculo, no una columna. Es la alarma anti-robo.

### A.4 Migraciones
Crear migración formal `20260615_personal_b2c` con todos los `ALTER TABLE`/`CREATE TABLE`. **Verificar primero el estado real de la BD** (Karen usó `db push`): correr `prisma migrate status` y, si hay drift, resolver con `migrate resolve --applied` antes de aplicar (como ya se hizo en el incidente P3009). Relaciones inversas en `Usuario`, `Espacio`, `Tarea`, `Proyecto`.

---

## B. Wizard de creación (reescritura del IntentWizard)

Solo para cuentas personales (`PROPIETARIO`/`ARQUITECTO`). El B2B (`CONSTRUCTORA`) NO se toca.

### B.1 Iconografía
Quitar TODOS los emojis (`🏠🍳🚿`) de `plantillas-personal.ts` y el wizard. Reemplazar por un **set propio de íconos SVG de línea** (trazo consistente 1.5px, color de marca, en contenedor `rounded-2xl` con fondo suave). Crear `src/components/mapa/../icons/` o `src/components/personal/icons/` con: propiedades (Casa, Apartamento, Edificio, Local) y espacios (Cocina, Baño, Habitación, Sala, Comedor, Zona de lavado, Garaje/Parqueadero, Estudio, Balcón, Fachada, Pasillo, Otro). Estilo serio, único.

### B.2 Tipos de propiedad
Reemplazar "Oficina" → **Edificio**. Orden: **Casa · Apartamento · Edificio · Local**.

### B.3 Flujo por pasos (progressive disclosure, B2C friendly)

| Paso | Pantalla | Contenido |
|---|---|---|
| 1 | **¿Qué vas a hacer y cómo va?** | Reformar / Modificar / Construir desde cero · + punto de partida ("apenas arranca" / "va a medias" / "avanzada") |
| 2 | **¿Qué tipo de propiedad?** | Casa / Apartamento / Edificio / Local + nombre de la obra (íconos propios) |
| 3 | **Arma tu obra** (varía por tipo, ver B.4) | Estructura |
| 4 | **¿Cuándo y dónde?** | Fecha inicio + fin estimado + ubicación (LocationPicker compacto) |
| 5 | **¿Qué te falta por hacer?** | Tareas sugeridas por espacio; el usuario deja solo lo pendiente |
| 6 | **Costos** | Total obra → por espacio (⭐) → por tarea (opcional). Días repartidos del plazo. |
| ✓ | **Listo** | Mensaje que fija la promesa anti-robo |

### B.4 Estructura por tipo (Paso 3)

**Casa / Local** — piso por piso
- ¿Cuántos pisos? (stepper, default 1)
- Por cada piso, tarjeta: # habitaciones (→ "Habitación 1..N"), # baños (→ "Baño 1..N"), toggles de espacios singulares (Cocina, Sala-comedor, Comedor, Zona de lavado, Garaje/Parqueadero, Estudio, Balcón/Terraza, Otro), m² del piso opcional
- **Cada espacio es renombrable** (ej. "Cuarto principal") y con **m² por espacio opcional**
- "Copiar del piso anterior"
- Etiqueta "— Primer piso" **solo si hay 2+ pisos**

**Apartamento** — una unidad
- Espacios directos (habitaciones, baños, cocina, etc.), renombrables, m² opcional. Sin pisos.

**Edificio** — modo híbrido B2B
- ¿Cuántos pisos? ¿Cuántos apartamentos por piso?
- **Tipos de apartamento** (defines los tipos, no apto por apto)
- Toggle opcional **dirección izq/der** (oculto por defecto)
- Por cada tipo de apto: # cuartos, # baños, espacios (igual que casa)
- Las tareas y costos se definen **por tipo de apto** (no por cada apartamento)

### B.5 "Qué falta" (Paso 5)
Reframe del paso de tareas actual. Mostramos tareas sugeridas (`sugerirTareas`) por espacio. El usuario **apaga lo ya terminado, deja lo pendiente**. Para obra nueva desde 0, todo queda activo. Solo lo activo se trackea y exige foto.

### B.6 Costos (Paso 6)
Niveles según tipo:
- Casa/Apto/Local: **Total obra** → **por espacio** (prominente) → **por tarea** (desplegable, opcional)
- Edificio: **Total obra** → **por tipo de apto** → **por espacio** → **por tarea** (opcional)

Mecánica:
- Total obra → reparte **parejo entre espacios**; dentro de cada espacio **ponderado por días** (un mueble de 3 días cuesta más que un sellador de 1). Sugerencia inicial, editable.
- Editar un espacio o tarea → recalcula hacia arriba (suma).
- **Días por tarea**: repartidos del plazo total (fin − inicio) ponderados por peso de plantilla, editables. Total de días por espacio y global visible.
- Totales siempre visibles arriba (sensación de control del presupuesto).

### B.7 Persistencia (actions.ts)
Reescribir `crearObraPersonal` para crear estructura multi-piso / multi-tipo:
- Casa/Local: 1 edificio → N pisos → 1 unidad por piso → espacios (renombrados, con metraje)
- Apartamento: 1 edificio → 1 piso → 1 unidad → espacios
- Edificio: 1 edificio → N pisos → unidades por tipo → espacios por tipo (reusar lógica de `generateUnitNamesForTorre` / expandTareas del B2B)
- Tareas: solo las pendientes ("qué falta"), con `tiempo_acordado_dias` y `precio` repartidos. `asignado_a` = dueño (como hoy).
- Persistir `tipo_obra`, `tipo_propiedad`, `ciudad` (de la ubicación), `presupuesto_total`, fechas, `ubicacion_lat/lng`.

---

## C. Módulo "Gastos y materiales" (sección aparte, NO en el wizard)

Nueva ruta dentro de la obra. Para perfiles personales y también útil en B2B (evaluar exponerlo allí en v2).

### C.1 Ruta y navegación
`/dashboard/proyectos/[id]/gastos` (o tab dentro del detalle de proyecto). Item en sidebar/tab "Gastos".

### C.2 Nivel simple (default — el 80%)
Registrar un gasto = **3 toques**: foto factura → monto → a qué espacio/tarea va + descripción corta. Cada gasto es una tarjeta visual con la foto grande.

### C.3 Nivel detallado (opcional, toggle "Detallar materiales")
Cantidades por material, unidad, precio unitario. Inventario simple (comprado − consumido si se registra consumo por tarea). Para el profi/arquitecto.

### C.4 Flujo de aprobación (anti-robo)
- El obrero registra un gasto/anticipo (con foto factura obligatoria) → estado `REGISTRADO`
- El dueño aprueba/rechaza desde el celular (igual que las tareas) → `APROBADO`/`RECHAZADO`
- Notificación in-app + email al dueño (reusar `crearNotificacion`)

### C.5 Anticipos
Registrar dinero entregado al maestro: monto, a quién, nota, fecha.

### C.6 Las 2 vistas que dan paz
1. **Presupuesto vs. gastado** (total / por espacio / por tarea): presupuestado vs materiales vs mano de obra vs total. Alerta si se pasa.
2. **Plata entregada vs. sustentada**: Σ anticipos vs Σ gastos aprobados. **Saldo sin sustentar en rojo** = alarma de robo.

### C.7 Comparación con estimado
Si hay materiales sugeridos por plantilla, comparar: "esta cocina suele necesitar ~$X; te piden $Y" → bandera.

### C.8 Endpoints
- `POST/GET /api/proyectos/[id]/gastos` (crear, listar; filtros por espacio/tarea/estado)
- `PATCH /api/proyectos/[id]/gastos/[gastoId]` (aprobar/rechazar — solo dueño/admin)
- `POST/GET /api/proyectos/[id]/anticipos`
- Subida de factura: reusar `uploadEvidencia`/storage (bucket evidencias o nuevo "facturas")
- Tenant isolation + permisos en cada uno (el obrero solo registra en su obra; solo el dueño aprueba)

---

## D. Datos de negocio (telemetría interna — Super Admin)

Acumular para monetizar cuando haya volumen. Se capturan **sin fricción** (subproductos del uso). Solo visibles para Super Admin (Victor + Karen), respetando Habeas Data (consentimiento ya montado por Karen).

Dimensiones a garantizar bien estructuradas desde día 1:
1. **Índice de precios**: `Tarea.precio` + `Tarea.nombre` (normalizado) + `Proyecto.ciudad` + `tipo_obra` → precio real por tarea/ciudad
2. **Duración real vs estimada**: `tiempo_acordado_dias` vs días reales (fecha_inicio → fecha_fin_real)
3. **Materiales**: `Gasto` (material, cantidad, monto) por tarea/ciudad → índice de materiales
4. **Patrones de fraude**: rechazos, re-reportes, gastos sin sustentar
5. **Mapa de mercado**: tipo_obra + ciudad + presupuesto (ya hay mapa)

Para v1: asegurar que los campos existen y se llenan. Un panel de analítica en `/super-admin` puede venir después; lo importante es **capturar bien ahora**. Considerar una vista o tabla denormalizada `RegistroPrecioTarea` solo si las queries agregadas se vuelven pesadas (decisión del agente de datos).

---

## E. Plan de orquestación con agentes

**Orquestador:** el hilo principal (yo) coordina fases y revisa entre cada una. No se mergea una fase sin tsc/build verde.

### Fase 1 — Backend / Datos (secuencial primero, es la base)
- **Agente Backend-Schema**: schema Prisma (A.1–A.3), migración formal con verificación de drift (A.4), `prisma generate`. Define modelos Gasto/Anticipo + campos Proyecto.
- **Agente Backend-API**: endpoints de gastos/anticipos (C.8) con tenant isolation + permisos. Reescribe `crearObraPersonal` (B.7) para estructura multi-piso/multi-tipo.

### Fase 2 — Frontend (en paralelo, tras backend)
- **Agente Frontend-Wizard**: reescribe IntentWizard (B.1–B.6): íconos propios, 3 modos de estructura, "qué falta", costos por nivel, fechas+ubicación. Espacios renombrables + m².
- **Agente Frontend-Gastos**: módulo Gastos y materiales (C.1–C.7): registro simple, nivel detallado, aprobación, vistas presupuesto/sustentado.

### Fase 3 — Revisión (en paralelo, adversarial)
- **Agente Bug/Funcionamiento**: verifica los 3 modos del wizard, "qué falta", reparto de costos/días, flujo de aprobación de gastos, cálculo de "sin sustentar". tsc + build. Que el B2B no se haya roto.
- **Agente Seguridad/Datos**: tenant isolation en gastos/anticipos, permisos (obrero registra, solo dueño aprueba), validación de inputs (montos, IDs), foto factura, no fugas cross-tenant, integridad de la migración, y que la telemetría de negocio respete Habeas Data (no exponer datos personales en agregados).

### Fase 4 — Integración
- Orquestador integra hallazgos, corre tsc + build final, commit por fase, push. Actualiza log Obsidian.

---

## F. Verificación final
- `npx tsc --noEmit` 0 errores tras cada fase
- `npm run build` compila
- Migración aplicada en Supabase sin drift
- Probar como PROPIETARIO: crear casa 2 pisos, apartamento, edificio con 2 tipos de apto
- Probar "qué falta" (obra avanzada)
- Registrar un gasto con foto, aprobarlo, ver "sin sustentar"
- Confirmar que el B2B (CONSTRUCTORA) sigue intacto
- El mapa (ya hecho) sigue funcionando

## G. Notas
- Sin tocar el flujo B2B (`CONSTRUCTORA`).
- Reusar lo ya hecho: LocationPicker, MapaProyectos, getProyectosMapa, CameraCapture (foto factura), crearNotificacion, storage service-role.
- Mantener tono B2C: "tú", frases cortas, cero jerga, marco "¿en qué se va mi plata?" y "nadie cobra sin prueba".
