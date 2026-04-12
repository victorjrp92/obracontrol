# Vistas por Rol y Acceso de Obreros — Diseño

## Resumen

Rediseño del sistema de roles y vistas de Seiricon para que cada tipo de usuario vea una interface adaptada a su función real en obra. Se pasa de un dashboard genérico con filtrado a **4 vistas completamente separadas** por nivel de acceso, con roles personalizables por constructora. Incluye acceso simplificado para obreros via link con token, sugerencia de tareas por contratistas, zonas comunes en proyectos, y notificaciones por email/in-app.

---

## 1. Sistema de Roles

### 1.1 Niveles de acceso (fijos en el sistema)

Cuatro niveles de acceso hardcoded que determinan qué vista y qué permisos tiene un usuario:

| Nivel | Vista | Descripción |
|-------|-------|-------------|
| `DIRECTIVO` | Dashboard ejecutivo | Solo métricas y progreso de toda la empresa |
| `ADMINISTRADOR` | Gestión completa | Lo que existe hoy + aprobación de sugerencias |
| `CONTRATISTA` | Sus tareas y obreros | Tareas asignadas, sugerencias, gestión de obreros |
| `OBRERO` | Ultra simplificada | Tareas pendientes, reportar evidencia, ver aprobaciones |

Estos 4 niveles son un enum en la base de datos. No se pueden crear, editar ni eliminar.

### 1.2 Roles personalizables por constructora

Cada constructora puede crear roles con nombres propios (ej: "Gerente General", "Residente de obra", "Maestro de obra"). Cada rol se asigna a exactamente uno de los 4 niveles de acceso.

**Roles por defecto** que Seiricon crea automáticamente al provisionar una constructora:

| Rol por defecto | Nivel |
|----------------|-------|
| Gerente | DIRECTIVO |
| Director de obra | DIRECTIVO |
| Administrador | ADMINISTRADOR |
| Coordinador | ADMINISTRADOR |
| Asistente | ADMINISTRADOR |
| Contratista instalador | CONTRATISTA |
| Contratista lustrador | CONTRATISTA |
| Auxiliar de obra | OBRERO |

La constructora puede:
- **Agregar** nuevos roles con un nombre personalizado asignado a cualquier nivel
- **Editar** el nombre de roles existentes o cambiar su nivel de acceso
- **Eliminar** roles (solo si no hay usuarios asignados a ese rol)

### 1.3 Cambios al schema de Prisma

**Reemplazar** el enum `RolUsuario` con:

```
enum NivelAcceso {
  DIRECTIVO
  ADMINISTRADOR
  CONTRATISTA
  OBRERO
}

model Rol {
  id              String       @id @default(cuid())
  constructora_id String
  nombre          String
  nivel_acceso    NivelAcceso
  es_default      Boolean      @default(false)
  created_at      DateTime     @default(now())

  constructora    Constructora @relation(...)
  usuarios        Usuario[]

  @@unique([constructora_id, nombre])
  @@map("roles")
}
```

**Modificar** el modelo `Usuario`:
- Quitar el campo `rol RolUsuario`
- Agregar `rol_id String` con relación a `Rol`
- Agregar campo calculado `nivel_acceso` vía join

### 1.4 Migración de datos existentes

Los datos actuales son dummy (pruebas). La migración:
1. Crear tabla `Rol` con los roles por defecto para cada constructora existente
2. Mapear cada usuario al rol correspondiente:
   - `ADMIN` → rol "Administrador"
   - `JEFE_OPERACIONES` → rol "Director de obra"
   - `COORDINADOR` → rol "Coordinador"
   - `ASISTENTE` → rol "Asistente"
   - `CONTRATISTA_INSTALADOR` → rol "Contratista instalador"
   - `CONTRATISTA_LUSTRADOR` → rol "Contratista lustrador"
   - `AUXILIAR` → rol "Auxiliar de obra"
3. Eliminar el enum `RolUsuario`
4. Actualizar `onboarding.ts` para crear roles por defecto y asignarlos

---

## 2. Arquitectura de Rutas

### 2.1 Estructura de rutas (Opción A — rutas separadas)

```
src/app/
├── (auth)/                          # Login, registro (sin cambios)
├── (dashboard)/
│   ├── layout.tsx                   # Detecta nivel_acceso → redirect a vista correcta
│   ├── dashboard/                   # Vista ADMINISTRADOR (la actual)
│   │   ├── page.tsx
│   │   ├── proyectos/
│   │   ├── tareas/
│   │   ├── contratistas/
│   │   ├── reportes/
│   │   ├── usuarios/
│   │   ├── configuracion/
│   │   └── sugerencias/             # NUEVO: aprobar/rechazar sugerencias de tareas
│   ├── directivo/                   # Vista DIRECTIVO (nueva)
│   │   ├── page.tsx                 # Dashboard ejecutivo
│   │   └── proyecto/[id]/page.tsx   # Drill-down de proyecto
│   └── contratista/                 # Vista CONTRATISTA (nueva)
│       ├── page.tsx                 # Mis tareas + progreso
│       ├── sugerir/page.tsx         # Sugerir tarea
│       ├── obreros/page.tsx         # Gestionar obreros
│       ├── reportes/page.tsx        # Descargar reportes propios
│       └── historial/page.tsx       # Historial de aprobaciones
├── o/[token]/                       # Vista OBRERO (nueva, fuera de dashboard)
│   ├── page.tsx                     # Lista de tareas simplificada
│   └── tarea/[id]/page.tsx          # Reportar evidencia
```

### 2.2 Lógica de redirección

En `(dashboard)/layout.tsx`:
- Obtener usuario actual con su `rol.nivel_acceso`
- Si `DIRECTIVO` → redirect a `/directivo`
- Si `ADMINISTRADOR` → continuar en `/dashboard` (actual)
- Si `CONTRATISTA` → redirect a `/contratista`
- Si `OBRERO` → esto no debería pasar (obreros entran por `/o/[token]`), pero por seguridad redirect a `/login`

**Protección de rutas**: cada grupo de rutas valida que el usuario tenga el nivel correcto. Un contratista que intente acceder a `/dashboard/configuracion` manualmente recibe redirect a `/contratista`.

### 2.3 Vista del obrero (`/o/[token]`)

Esta ruta vive **fuera** del grupo `(dashboard)` porque:
- No usa Supabase Auth — usa autenticación por token
- No tiene sidebar ni layout de dashboard
- No necesita la infraestructura de usuario/constructora

El layout de `/o/` es minimal: header con nombre del obrero + logo Seiricon, sin más navegación.

---

## 3. Vista Directivo

### 3.1 Dashboard ejecutivo (`/directivo`)

**Propósito**: vista de alto nivel para gerentes y directores. Solo lectura, no gestiona nada.

**Contenido**:
- **Resumen de la empresa**: total de proyectos activos, progreso promedio global, tareas completadas vs pendientes
- **Progreso por proyecto**: card por cada proyecto activo con barra de progreso aprobado/reportado, semáforo general, fecha estimada de fin
- **Métricas clave**: velocidad de avance (tareas aprobadas por semana), proyectos en riesgo (con muchas tareas en rojo/vinotinto)
- **Sin acceso a**: contratistas, usuarios, configuración, scores, tareas individuales

### 3.2 Drill-down por proyecto (`/directivo/proyecto/[id]`)

- Progreso por edificio/sección
- Distribución de estados de tareas (gráfico tipo donut o barras)
- Tareas en riesgo (rojo/vinotinto) como alertas
- No puede modificar nada, solo ver

### 3.3 Sidebar del directivo

- Inicio (dashboard ejecutivo)
- Proyectos (lista para seleccionar y ver drill-down)

---

## 4. Vista Administrador

### 4.1 Lo que ya existe

La vista actual permanece intacta: dashboard, proyectos, tareas, contratistas, reportes, usuarios, configuración.

### 4.2 Cambios al administrador

**Score de contratistas**: se mantiene visible solo para nivel ADMINISTRADOR. No se muestra a directivos, contratistas ni obreros. Es información interna de Seiricon para acumular datos.

**Gestión de roles** (en Configuración):
- Ver tabla de roles de la constructora
- Agregar rol: nombre + nivel de acceso
- Editar rol: cambiar nombre o nivel
- Eliminar rol: solo si no hay usuarios asignados

**Aprobar sugerencias de tareas** (`/dashboard/sugerencias`):
- Lista de tareas sugeridas por contratistas con estado `PENDIENTE`
- Para cada sugerencia: nombre, proyecto, edificio, unidad(es), descripción, foto (si hay)
- Acciones: aprobar (crea la tarea en el sistema) o rechazar (con motivo)
- Badge de notificación en el sidebar cuando hay sugerencias pendientes

---

## 5. Vista Contratista

### 5.1 Dashboard del contratista (`/contratista`)

**Panel principal con**:
- **Mis tareas**: lista filtrada de todas las tareas asignadas al contratista, agrupadas por proyecto, con semáforo y días restantes
- **Mi progreso**: porcentaje aprobado y reportado (solo de sus tareas), con barra de progreso
- **Filtros**: por estado (todas, pendientes, reportadas, aprobadas, no aprobadas), por proyecto

### 5.2 Historial de aprobaciones (`/contratista/historial`)

- Lista cronológica de tareas que fueron aprobadas o rechazadas
- Cada entrada muestra: tarea, fecha de decisión, estado (aprobada/no aprobada), justificación del administrador
- Filtros: por estado, por proyecto, por fecha

### 5.3 Sugerir tareas (`/contratista/sugerir`)

Cuando el contratista llega a obra y detecta tareas faltantes:

1. Toca "Sugerir tarea"
2. Selecciona proyecto (de los que está asignado)
3. Selecciona edificio/casa (de los del proyecto)
4. Selecciona unidad o unidades
5. Nombre de tarea + descripción breve
6. Foto opcional (usando el componente CameraCapture existente)
7. Envía

**Modelo de datos**:
```
model TareaSugerida {
  id               String   @id @default(cuid())
  contratista_id   String
  proyecto_id      String
  edificio_id      String?
  unidades         Json     // array de unidad_ids
  nombre           String
  descripcion      String?
  foto_url         String?
  estado           EstadoSugerencia @default(PENDIENTE)
  motivo_rechazo   String?
  revisado_por     String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  contratista      Usuario   @relation(...)
  proyecto         Proyecto  @relation(...)
  revisor          Usuario?  @relation(...)

  @@map("tareas_sugeridas")
}

enum EstadoSugerencia {
  PENDIENTE
  APROBADA
  RECHAZADA
}
```

Cuando el admin aprueba, se crean las tareas reales en el sistema (una por cada unidad seleccionada) asignadas al contratista que las sugirió.

### 5.4 Gestión de obreros (`/contratista/obreros`)

- Lista de obreros del contratista con: nombre, estado del link (activo/expirado/desactivado), fecha de expiración
- **Agregar obrero**: nombre + fecha inicio + fecha expiración → genera link único
- **Acciones por obrero**: copiar link, extender fecha, desactivar/reactivar
- Ver progreso del obrero: tareas reportadas por ese obrero

### 5.5 Reportes del contratista (`/contratista/reportes`)

PDFs descargables:
- **Reporte de mis tareas**: todas las tareas, estado, progreso, por proyecto
- **Reporte por proyecto**: detalle de tareas en un proyecto específico
- **Historial de aprobaciones**: tareas aprobadas/rechazadas con fechas y justificación

Los reportes NO incluyen scores.

### 5.6 Sidebar del contratista

- Inicio (mis tareas + progreso)
- Historial (aprobaciones)
- Sugerir tarea
- Mis obreros
- Reportes

---

## 6. Vista Obrero

### 6.1 Principios de diseño

La vista del obrero es radicalmente simple. El usuario típico:
- Tiene un smartphone Android de gama baja
- Puede tener baja educación formal
- Trabaja en obra con las manos sucias y sol fuerte
- Necesita hacer una sola cosa: reportar que terminó una tarea con evidencia

**Reglas de diseño**:
- Máximo 2 niveles de profundidad (lista → detalle)
- Botones y cards grandes (mínimo 48px de alto para touch)
- Texto grande y legible (mínimo 16px)
- Colores tipo semáforo (verde = listo, amarillo = pendiente, rojo = problema)
- Sin sidebar, sin menú complejo
- Iconos grandes y descriptivos
- Contraste alto para sol directo

### 6.2 Acceso por token

**Modelo de datos**:
```
model Obrero {
  id              String    @id @default(cuid())
  nombre          String
  token           String    @unique @default(cuid())
  contratista_id  String
  constructora_id String
  fecha_inicio    DateTime
  fecha_expiracion DateTime
  activo          Boolean   @default(true)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  contratista     Usuario      @relation(...)
  constructora    Constructora @relation(...)
  evidencias      Evidencia[]

  @@map("obreros")
}
```

**Flujo de acceso**:
1. Contratista crea obrero → sistema genera token → URL `seiricon.com/o/{token}`
2. Contratista copia link y lo envía por WhatsApp o email
3. Obrero abre link → sistema valida token, fecha_inicio, fecha_expiracion, activo
4. Si válido: obrero ve su vista. Si no: pantalla de error amigable ("Este enlace ya no es válido. Contacta a tu contratista.")
5. No se requiere login, no se guarda sesión permanente. Cada vez que abre el link, el token se valida

**Seguridad**:
- Token es un cuid (22 chars, no predecible)
- Solo permite ver tareas del contratista que lo creó
- Solo permite subir evidencia a esas tareas
- El contratista puede desactivar el token en cualquier momento
- El token expira automáticamente en la fecha configurada

**Visibilidad de tareas**: el obrero ve TODAS las tareas asignadas a su contratista (campo `asignado_a` en `Tarea`). No hay asignación de tareas específicas a obreros específicos. Si un contratista tiene 3 obreros, los 3 ven las mismas tareas. La diferenciación es por quien reporta: cuando un obrero reporta una tarea, los demás ven "Reportada por [nombre]".

### 6.3 Lista de tareas (`/o/[token]`)

**Layout**: header minimal con logo Seiricon + nombre del obrero + nombre del contratista

**Contenido**:
- Cards grandes, una por tarea
- Cada card muestra:
  - Nombre de la tarea (texto grande)
  - Ubicación: edificio + unidad (texto secundario)
  - Estado con color:
    - Pendiente (gris/azul) — "Por hacer"
    - Reportada (amarillo) — "Esperando aprobación"
    - Aprobada (verde) — "Aprobada"
    - No aprobada (rojo) — "Rechazada" con motivo visible
  - Si hay foto de referencia: ícono indicador
- Ordenadas: pendientes primero, luego reportadas, luego el resto
- Si la tarea ya fue reportada por otro obrero del mismo contratista: muestra "Reportada por [nombre]" con ícono de check

**Toque en tarea pendiente** → navega a pantalla de reporte
**Toque en tarea reportada/aprobada** → muestra detalle de estado (y justificación si fue rechazada)

### 6.4 Reportar tarea (`/o/[token]/tarea/[id]`)

Pantalla con:
1. Nombre de tarea + ubicación (arriba, no editable)
2. Foto de referencia si existe (imagen que muestra cómo debe quedar)
3. **Botón grande "Tomar fotos"** → abre cámara (CameraCapture), mínimo 2, máximo 4 fotos con GPS + timestamp overlay
4. **Botón "Grabar video"** → abre cámara de video (VideoCapture), máximo 30 segundos
5. **Campo de notas** — texto libre, placeholder "Escribe alguna anotación si es necesario"
6. **Botón grande "ENVIAR"** — color azul/verde, prominente

Al enviar:
- Sube evidencia a Supabase Storage (igual que el flujo actual de ReportarButton)
- Cambia estado de tarea a `REPORTADA`
- Registra `tomada_por` como referencia al obrero (requiere ajuste al modelo Evidencia, ver sección 6.5)
- Muestra confirmación: "Enviado. Tu contratista será notificado."
- Regresa a la lista de tareas

### 6.5 Evidencia tomada por obrero

El modelo `Evidencia` actual tiene `tomada_por String` que apunta a `Usuario`. Para obreros (que no son usuarios), necesitamos una de estas opciones:

**Opción elegida**: agregar `obrero_id String?` a `Evidencia` como campo opcional. Si la evidencia fue tomada por un obrero, `tomada_por` queda null y `obrero_id` se llena. Si fue tomada por un usuario (contratista reportando directamente), `tomada_por` se llena y `obrero_id` queda null.

```
model Evidencia {
  ...campos existentes...
  obrero_id  String?
  obrero     Obrero? @relation(fields: [obrero_id], references: [id])
}
```

Esto permite: hacer `tomada_por` nullable, y en la UI mostrar el nombre del obrero o del usuario según corresponda.

---

## 7. Zonas Comunes

### 7.1 Enfoque (Opción A — reutilizar modelo existente)

Las zonas comunes se modelan como una **sección especial** dentro del proyecto, usando el modelo Edificio → Piso → Unidad existente:

- Se crea un "Edificio" con nombre "Zonas Comunes" y flag `es_zona_comun Boolean @default(false)` en el modelo
- Dentro, cada zona es una "Unidad": Lobby, Piscina, Salón de eventos, Portería, Pasillos, Baños comunes, Zona de juegos infantiles, etc.
- Se usa un solo "Piso" como contenedor (piso 0 o similar)
- Las tareas funcionan exactamente igual que para unidades residenciales

### 7.2 Cambio al schema

Agregar a `Edificio`:
```
es_zona_comun Boolean @default(false)
```

Esto permite que el UI muestre las zonas comunes de forma diferente (ej: con ícono distinto, agrupadas aparte) sin cambiar la lógica de tareas/progreso.

### 7.3 Zonas comunes sugeridas

Al crear un proyecto, el wizard ofrece "Agregar zonas comunes" con espacios sugeridos:

| Zona | Espacios/Tareas sugeridas (obra blanca) |
|------|---------------------------------------|
| Lobby | Estuco paredes, pintura muros, pintura techo, acabado recepción |
| Piscina | Baldosería borde piscina, baldosería duchas, pintura caseta máquinas |
| Salón de eventos | Estuco paredes, pintura muros, pintura techo, acabado barra |
| Portería | Estuco paredes, pintura, acabado módulo portero |
| Pasillos | Pintura muros, pintura techo por piso |
| Baños comunes | Baldosería pisos, baldosería paredes, pintura techo |
| Zona de juegos infantiles | Pintura muros perimetrales, acabado piso |
| Terraza BBQ | Baldosería piso, pintura muros, acabado mesón |

Estas sugerencias se agregan a `TASK_TEMPLATES` existente en `src/lib/task-templates.ts` bajo una nueva sección "Zonas Comunes".

### 7.4 Nomenclatura en el UI

En el wizard y en la vista de proyecto:
- Para proyectos de apartamentos: "Torre/Edificio" y "Apartamento"
- Para proyectos de casas: "Manzana/Etapa" y "Casa"
- Para zonas comunes: "Zonas Comunes" y el nombre de la zona (Lobby, Piscina, etc.)

No se hace renombramiento global de "Edificio" a "Sección" — se usa la nomenclatura natural del contexto.

---

## 8. Notificaciones

### 8.1 Notificaciones por email

Se envían emails via Resend (infraestructura ya existente) para:

| Evento | Destinatario | Contenido |
|--------|-------------|-----------|
| Tarea aprobada | Contratista asignado | "Tu tarea [nombre] en [proyecto] fue aprobada" |
| Tarea rechazada | Contratista asignado | "Tu tarea [nombre] fue rechazada: [justificación]" |
| Nueva sugerencia de tarea | Admin de la constructora | "El contratista [nombre] sugirió una nueva tarea en [proyecto]" |
| Sugerencia aprobada | Contratista que sugirió | "Tu sugerencia [nombre] fue aprobada y agregada al proyecto" |
| Sugerencia rechazada | Contratista que sugirió | "Tu sugerencia [nombre] fue rechazada: [motivo]" |
| Obrero reportó tarea | Contratista dueño | "Tu obrero [nombre] reportó la tarea [nombre] en [ubicación]" |

### 8.2 Notificaciones in-app

**Modelo de datos**:
```
model Notificacion {
  id          String   @id @default(cuid())
  usuario_id  String
  tipo        TipoNotificacion
  titulo      String
  mensaje     String
  leida       Boolean  @default(false)
  link        String?
  created_at  DateTime @default(now())

  usuario     Usuario  @relation(...)

  @@map("notificaciones")
}

enum TipoNotificacion {
  TAREA_APROBADA
  TAREA_RECHAZADA
  SUGERENCIA_NUEVA
  SUGERENCIA_APROBADA
  SUGERENCIA_RECHAZADA
  OBRERO_REPORTO
}
```

**UI**: el ícono de campana (ya existe en el sidebar) muestra badge con conteo de no leídas. Al hacer clic, dropdown con lista de notificaciones recientes.

---

## 9. Foto de Referencia en Tareas

### 9.1 Implementación

Agregar campo opcional a `Tarea`:
```
foto_referencia_url String?
```

- El administrador puede subir una foto de referencia al crear o editar una tarea
- Se almacena en Supabase Storage bucket "evidencias" bajo ruta `referencia/{tarea_id}/foto.jpg`
- En la vista del obrero, si la tarea tiene foto de referencia, se muestra como imagen arriba del formulario de reporte con texto "Así debe quedar"
- En la vista del contratista, también es visible en el detalle de tarea

---

## 10. Cambios al Sistema de Permisos

### 10.1 Nuevo permissions.ts

Reemplazar el sistema basado en enum con uno basado en `NivelAcceso`:

```typescript
export function getPermissions(nivelAcceso: string): Permissions {
  switch (nivelAcceso) {
    case "DIRECTIVO": return { /* solo vista */ };
    case "ADMINISTRADOR": return { /* gestión completa */ };
    case "CONTRATISTA": return { /* sus tareas */ };
    case "OBRERO": return { /* solo reportar */ };
  }
}
```

### 10.2 Nuevo sidebar por nivel

Cada nivel tiene su propio conjunto de items en el sidebar (o en el caso del obrero, no tiene sidebar).

### 10.3 Protección de rutas

- El `layout.tsx` de cada grupo de rutas valida el nivel y redirige si no corresponde
- Las API routes también validan el nivel antes de ejecutar operaciones

---

## 11. Componentes Compartidos

Los siguientes componentes se reutilizan entre vistas:
- `CameraCapture` — usado por contratistas y obreros (tal como está)
- `VideoCapture` — usado por contratistas y obreros
- `EvidenceGallery` — visualización de evidencia (admin, contratista, obrero)
- `Topbar` — header responsivo (admin, directivo, contratista)
- `ProgressBar` — barras de progreso (todas las vistas)

La vista del obrero NO usa: Sidebar, Topbar, TaskRow (tiene sus propios componentes simplificados).

---

## 12. Resumen de Cambios al Schema

### Nuevos modelos:
- `Rol` — roles personalizables por constructora
- `Obrero` — acceso por token para obreros
- `TareaSugerida` — sugerencias de tareas por contratistas
- `Notificacion` — notificaciones in-app

### Nuevos enums:
- `NivelAcceso` — DIRECTIVO, ADMINISTRADOR, CONTRATISTA, OBRERO
- `EstadoSugerencia` — PENDIENTE, APROBADA, RECHAZADA
- `TipoNotificacion` — tipos de notificación

### Modelos modificados:
- `Usuario` — quitar `rol RolUsuario`, agregar `rol_id` relación a `Rol`
- `Edificio` — agregar `es_zona_comun Boolean`
- `Tarea` — agregar `foto_referencia_url String?`
- `Evidencia` — agregar `obrero_id String?`, hacer `tomada_por` nullable
- `Constructora` — agregar relación a `Rol[]` y `Obrero[]`

### Enums eliminados:
- `RolUsuario` — reemplazado por tabla `Rol` + enum `NivelAcceso`

---

## 13. Alcance y Fases

Este diseño es una feature grande. Se recomienda implementar en sub-proyectos independientes:

### Sub-proyecto A: Sistema de roles + rutas base
- Migración de schema (Rol, NivelAcceso)
- Nuevo permissions.ts basado en NivelAcceso
- Redirección en layout.tsx por nivel
- Protección de rutas
- Gestión de roles en Configuración (CRUD)
- Actualizar onboarding.ts

### Sub-proyecto B: Vista contratista
- Dashboard del contratista
- Historial de aprobaciones
- Reportes PDF del contratista
- Sidebar del contratista

### Sub-proyecto C: Sugerencia de tareas
- Modelo TareaSugerida
- UI para contratista: formulario de sugerencia
- UI para admin: lista y aprobación/rechazo
- Notificaciones email + in-app para sugerencias

### Sub-proyecto D: Vista directivo
- Dashboard ejecutivo
- Drill-down por proyecto
- Sidebar del directivo

### Sub-proyecto E: Vista obrero + acceso por token
- Modelo Obrero
- Gestión de obreros por contratista
- Acceso por token (`/o/[token]`)
- Vista simplificada de tareas
- Reporte de evidencia
- Ajuste a modelo Evidencia

### Sub-proyecto F: Zonas comunes
- Flag es_zona_comun en Edificio
- Templates de zonas comunes en task-templates.ts
- UI en wizard de proyecto
- Tareas sugeridas para zonas comunes

### Sub-proyecto G: Notificaciones
- Modelo Notificacion
- Emails transaccionales (aprobación, rechazo, sugerencias, obrero reportó)
- UI de campana con dropdown de notificaciones
- Badge de conteo

Cada sub-proyecto produce software funcional y testeable de forma independiente.

---

## 14. Seguridad, Pruebas y Protección de Datos

### 14.1 Protección de APIs

Toda API route debe validar:
- **Autenticación**: verificar sesión de Supabase Auth (o token de obrero para rutas `/o/`)
- **Autorización por nivel**: verificar que el `nivel_acceso` del usuario permite la operación
- **Aislamiento de datos (tenant isolation)**: toda query incluye `constructora_id` — un usuario de la constructora A NUNCA puede ver datos de la constructora B
- **Validación de propiedad**: un contratista solo puede ver/modificar sus propias tareas, obreros y sugerencias
- **Rate limiting**: protección contra abuso en endpoints públicos (login, registro, token de obrero)
- **Input validation**: sanitizar todos los inputs con zod schemas en cada endpoint

### 14.2 Seguridad de datos

- **Datos en tránsito**: HTTPS obligatorio (Vercel lo provee por defecto)
- **Datos en reposo**: Supabase Storage y PostgreSQL encriptan en reposo
- **Row Level Security (RLS)**: configurar políticas en Supabase para que las queries directas a la DB estén protegidas por constructora_id
- **Tokens de obrero**: no predecibles (cuid), con expiración, revocables, sin acceso a datos sensibles
- **Variables de entorno**: nunca expuestas al client-side (solo `NEXT_PUBLIC_*` llegan al browser)
- **Evidencia fotográfica**: bucket privado con signed URLs temporales (ya implementado)

### 14.3 Privacidad y aislamiento multi-tenant

- Cada constructora es un tenant aislado
- Queries a la DB siempre filtran por `constructora_id`
- Un administrador de la constructora A no puede:
  - Ver proyectos de la constructora B
  - Ver usuarios/contratistas/obreros de otra constructora
  - Acceder a evidencia de otra constructora
- Los obreros solo ven tareas del contratista que los invitó
- Los contratistas solo ven proyectos/edificios donde están asignados

### 14.4 Protección contra ataques comunes (OWASP Top 10)

| Ataque | Mitigación |
|--------|-----------|
| SQL Injection | Prisma ORM con queries parametrizadas (nunca raw SQL) |
| XSS | React escapa automáticamente, no usar `dangerouslySetInnerHTML` |
| CSRF | Next.js Server Actions con tokens automáticos |
| Broken Access Control | Validación de nivel + constructora_id en cada API route |
| Insecure Direct Object Reference (IDOR) | Verificar propiedad del recurso antes de retornar datos |
| File Upload Abuse | Validar tipo MIME y tamaño antes de subir a Storage |
| Broken Authentication | Supabase Auth maneja sesiones, tokens JWT, refresh |
| Security Misconfiguration | Headers de seguridad en next.config (CSP, X-Frame-Options, etc.) |

### 14.5 Headers de seguridad

Configurar en `next.config.ts`:
- `Content-Security-Policy` — restringir fuentes de scripts, estilos, imágenes
- `X-Frame-Options: DENY` — prevenir clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — deshabilitar APIs del browser no usadas

### 14.6 Plan de pruebas

**Por cada sub-proyecto:**
- Tests unitarios para lógica de negocio (permisos, scoring, validaciones)
- Tests de integración para API routes (happy path + casos de error + acceso no autorizado)
- Tests E2E con Playwright para flujos críticos de cada vista

**Tests de seguridad específicos:**
- Test: usuario nivel CONTRATISTA intenta acceder a `/dashboard/configuracion` → redirect
- Test: usuario nivel DIRECTIVO intenta crear proyecto → API retorna 403
- Test: contratista A intenta ver tareas de contratista B → API retorna 403
- Test: obrero con token expirado intenta reportar → error amigable
- Test: obrero intenta acceder a tarea de otro contratista → 403
- Test: request sin autenticación a cualquier API → 401
- Test: constructora A intenta acceder datos de constructora B → 403
- Test: upload de archivo con tipo MIME no permitido → 400
- Test: input con caracteres maliciosos en sugerencia de tarea → sanitizado correctamente

### 14.7 Auditoría

Considerar para futuro (no en este release pero preparar la estructura):
- Log de acciones críticas (aprobaciones, rechazos, creación de obreros, desactivación de tokens)
- Registro de IP y timestamp en accesos de obrero
- Alertas si un token de obrero se usa desde ubicaciones geográficas inconsistentes
