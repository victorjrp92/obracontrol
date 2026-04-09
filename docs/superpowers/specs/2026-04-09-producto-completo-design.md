# ObraControl — Producto Completo para Piloto Jaramillo Mora

**Versión:** 1.0
**Fecha:** 2026-04-09
**Objetivo:** Llevar ObraControl de MVP a producto funcional completo, listo para piloto real con Jaramillo Mora.

---

## Estado actual (lo que YA existe y funciona)

### Auth
- Login con email + contraseña
- Login con Google OAuth
- Recuperar contraseña (/recuperar → email → /nueva-contrasena)
- Middleware protege /dashboard/*
- Registro crea Constructora + Usuario + datos demo automáticamente

### Base de datos (Prisma 7 + Supabase PostgreSQL)
- 17 modelos completos: Constructora, Proyecto, Edificio, Piso, Unidad, TipoUnidad, Espacio, Fase, Tarea, Evidencia, Aprobacion, ChecklistTemplate, ChecklistRespuesta, Retraso, ExtensionTiempo, ConsumoMaterial, Usuario, Contratista, PagoContratista
- Migrations aplicadas, seed script funcional

### API Routes
- GET/POST /api/proyectos
- GET/POST /api/tareas
- POST /api/tareas/[id]/reportar
- POST /api/tareas/[id]/aprobar (con recalculo de score)
- GET/POST /api/edificios
- POST /api/evidencias (multipart, max 4 fotos)
- POST /api/retrasos
- GET/POST /api/contratistas
- GET /api/progreso/[proyectoId]

### Frontend
- Landing page con GSAP
- Dashboard con datos reales (stats, progreso, contratistas, tareas recientes)
- Página de proyectos (lista + detalle con grilla edificio)
- Página de tareas (lista con filtros + detalle con acciones)
- Página de contratistas (scores)
- Botones funcionales: Reportar, Aprobar, No aprobar (con justificación)
- Reportes y Configuración (plantillas estáticas)

### Lógica de negocio
- calcularDiasHabiles (5/6/7 días/semana)
- calcularSemaforo (verde-intenso → vinotinto)
- calcularProgreso (ponderado por número de tareas)
- recalcularScoreContratista (cumplimiento 50%, calidad 30%, velocidad 20%)

### Infraestructura
- Vercel: obracontrol-sigma.vercel.app
- Supabase: nobupxsxtjrluymwqocd (us-east-1)
- Supabase Storage: bucket "evidencias" con RLS policies
- Resend: cuenta victorjrp9 con API key

---

## Lo que FALTA construir

### Bloque 1: Gestión de Usuarios y Roles

**1.1 Invitar usuarios**
- En /dashboard/configuracion (o nueva sección /dashboard/usuarios)
- Formulario: email + nombre + rol (dropdown con los 7 roles)
- Al invitar:
  1. Crear registro en tabla Usuario con constructora_id del admin que invita
  2. Si rol es CONTRATISTA_INSTALADOR o CONTRATISTA_LUSTRADOR → crear registro Contratista asociado
  3. Crear cuenta en Supabase Auth con `supabase.auth.admin.createUser()` usando la service key, con `email_confirm: true` para saltar confirmación
  4. Enviar email via Resend con link a /login + instrucciones
- El invitado entra con email y contraseña temporal → puede cambiarla en /nueva-contrasena

**1.2 Filtro por rol en vistas**
- Middleware o función helper que filtra datos según rol del usuario:
  - ADMIN / JEFE_OPERACIONES: ve todo
  - COORDINADOR / ASISTENTE: ve tareas de las fases asignadas
  - AUXILIAR: ve tareas del edificio/piso asignado
  - CONTRATISTA_INSTALADOR / CONTRATISTA_LUSTRADOR: ve SOLO sus tareas asignadas
- El sidebar muestra/oculta secciones según rol:
  - Contratista: solo ve Dashboard (sus stats), Mis Tareas, Mi Score
  - Auxiliar: ve Dashboard, Tareas (del edificio), Proyectos (sin editar)
  - Coordinador+: ve todo

**1.3 Gestión de usuarios**
- Página /dashboard/usuarios (visible solo para ADMIN/JEFE_OPERACIONES)
- Lista de usuarios de la constructora con: nombre, email, rol, fecha creación
- Acciones: cambiar rol, desactivar usuario
- Badge de invitación pendiente si el usuario no ha iniciado sesión

**1.4 Editar perfil constructora**
- En /dashboard/configuracion, sección "Información de la constructora"
- Editar: nombre, NIT, logo (upload a Supabase Storage)

---

### Bloque 2: Wizard de Creación de Proyecto

**2.1 Wizard multi-paso** — ruta /dashboard/proyectos/nuevo
- Paso 1 — Info básica: nombre, subtipo (APARTAMENTOS/CASAS), días hábiles (5/6/7), fecha inicio, fecha fin estimada
- Paso 2 — Estructura:
  - Si APARTAMENTOS: ¿Cuántas torres? → por torre: nombre, pisos, unidades por piso
  - Si CASAS: ¿Cuántos tipos de casa? → cantidad por tipo
- Paso 3 — Tipos de unidad: nombrar cada tipo → definir espacios por tipo (nombre + metraje). Sugerencias: Cocina, Baño principal, Baño social, Habitación principal, Habitación 2, Habitación 3, Sala-comedor, Zona de labores
- Paso 4 — Asignar tipos a unidades (ej: Aptos 01-04 son Tipo 1, Aptos 05-08 son Tipo 2)
- Paso 5 — Fases y tareas:
  - Seleccionar fases: Madera, Obra Blanca
  - Por cada fase+espacio, la app sugiere tareas (ver sección 12 del plan). El usuario puede editar, agregar, eliminar
  - Por cada tarea: tiempo acordado (días), opcionalmente código/marca/componentes
- Paso 6 — Asignar contratistas: seleccionar contratista (de los ya invitados) por tarea o grupo de tareas
- Paso 7 — Resumen y confirmar → crea todo en una transacción

**2.2 Sugerencias de tareas por fase/espacio**
- Obra Blanca: estucar paredes, estucar techo, sellador, pintura base, pintura final
- Madera Cocina: mueble bajo, mueble alto
- Madera Baño: mueble flotante lavamanos
- Madera Habitación: closet
- Madera Habitación principal: closet + vestier
- Puertas: una por espacio cerrado
- Editables: el admin puede modificar nombres, agregar, eliminar

**2.3 Editar proyecto existente**
- Desde /dashboard/proyectos/[id] → botón "Editar proyecto"
- Puede agregar torres, pisos, unidades, tareas adicionales
- No puede eliminar tareas que ya tienen aprobaciones

---

### Bloque 3: Captura de Evidencia (Fotos y Video)

**3.1 Componente CameraCapture**
- Input con `accept="image/*" capture="environment"` para forzar cámara trasera
- Al capturar foto:
  1. Obtener GPS via `navigator.geolocation.getCurrentPosition()`
  2. Obtener timestamp del dispositivo (`new Date()`)
  3. Dibujar overlay en canvas: fecha, hora, coordenadas GPS, nombre del proyecto/tarea
  4. Exportar como JPEG (calidad 0.8) con el overlay quemado en la imagen
- Mantener foto en memoria (state del componente) hasta upload

**3.2 Componente VideoCapture**
- Usa `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`
- MediaRecorder API para grabar
- Límite de 30 segundos (auto-stop + countdown visual)
- Compresión: grabar en VP8/WebM a bitrate reducido (1Mbps)
- Max 50MB

**3.3 Upload queue (temporal en memoria)**
- Las fotos/videos se mantienen en state React
- Al hacer submit (reportar tarea), se suben secuencialmente a Supabase Storage via /api/evidencias
- Si falla un upload: retry automático 3 veces con backoff
- Indicador visual: "Subiendo 2/4 fotos..."
- Diseñado para migrar a IndexedDB: la interfaz de la queue es un objeto con `.add()`, `.getAll()`, `.remove()` — reemplazar la implementación in-memory por IndexedDB después sin cambiar los consumidores

**3.4 Galería de evidencia en detalle de tarea**
- Mostrar fotos subidas en grid
- Click en foto → modal con imagen completa + metadata (quién, cuándo, GPS)
- Mostrar video con player nativo
- Indicar cuáles son de la versión actual (última reportada) vs anteriores (re-reportes)

**3.5 Validaciones**
- Mínimo 2 fotos para poder reportar tarea
- Máximo 4 fotos por reporte
- Video opcional, máximo 1 por reporte
- Solo cámara, no galería (el input `capture` lo garantiza en móviles)

---

### Bloque 4: Flujo Completo de Ejecución

**4.1 Reportar tarea (mejorado)**
- Obrero entra a /dashboard/tareas → ve solo sus tareas (filtrado por rol)
- Click en tarea PENDIENTE o NO_APROBADA → detalle
- Sección "Reportar": tomar fotos (mínimo 2) → opcionalmente video → si hay checklist: marcar ítems → notas opcionales → "Reportar terminada"
- Estado cambia a REPORTADA, fecha_inicio se establece si es primera vez
- Notificación email al supervisor

**4.2 Aprobar/No aprobar (mejorado)**
- Supervisor ve tareas REPORTADAS en su vista
- Click en tarea → ve fotos/video → verifica checklist si existe
- Aprobar: estado → APROBADA, fecha_fin_real = now, score se recalcula
- No aprobar: modal con checkboxes de ítems no aprobados + textarea de justificación por ítem → estado → NO_APROBADA → notificación email al contratista con las observaciones

**4.3 Checklist de cumplimiento**
- Si el proyecto tiene checklists_habilitados = true:
  - Admin configura ChecklistTemplate por tipo de tarea (ej: "Instalación closet" → items: ["Nivelado", "Fijaciones", "Puertas alineadas"...])
  - Al reportar: obrero ve los items y los marca (checkbox)
  - Al aprobar: supervisor ve cuáles marcó el obrero y puede verificar
- Si checklists_habilitados = false: no aparece nada

**4.4 Clasificación de retrasos**
- Cuando una tarea pasa de amarillo (>15% retraso), aparece un banner en el detalle
- Botón "Registrar retraso" → modal:
  - Tipo: "Por falta de pista" / "Por contratista" / "Otro"
  - Si falta de pista: upload de evidencia (fotos) + justificación → NO afecta score
  - Si contratista/otro: justificación → SÍ afecta score
- Se crea registro en tabla Retraso
- Visible en historial del detalle de tarea

**4.5 Extensiones de tiempo**
- Botón "Solicitar extensión" en detalle de tarea (visible para admin/coordinador)
- Formulario: días adicionales + justificación + upload documentación (PDF/imagen)
- Se guarda en ExtensionTiempo con autorizado_por
- Se suma al tiempo_acordado_dias para el cálculo de semáforo
- Registro visible en historial de la tarea

**4.6 Notas en tareas**
- Campo de texto libre en el detalle de tarea
- Cualquier usuario con acceso puede escribir una nota
- Se guarda como parte del historial (usar campo JSON en tarea o tabla separada)

**4.7 Consumo de materiales**
- En detalle de tarea, si tiene cantidad_material_planeada:
  - Formulario: cantidad real usada + piezas dañadas + notas de daño
  - Se guarda en ConsumoMaterial
  - Visible en reportes

---

### Bloque 5: Emails y Notificaciones (Resend)

**5.1 Configuración**
- Instalar `resend` npm package
- Crear /src/lib/email.ts con cliente Resend
- Plantilla HTML base con logo ObraControl, colores azul, botón CTA

**5.2 Emails a implementar**

| Trigger | Destinatario | Asunto | Contenido |
|---------|-------------|--------|-----------|
| Invitar usuario | Invitado | "Te han invitado a ObraControl" | Link a /login, nombre constructora, rol |
| Tarea reportada | Supervisor (coordinador/admin) | "Tarea reportada: {nombre}" | Link a tarea, proyecto, unidad, quién reportó |
| Tarea aprobada | Contratista asignado | "Tarea aprobada: {nombre}" | Link a tarea, confirmación |
| Tarea no aprobada | Contratista asignado | "Tarea no aprobada: {nombre}" | Link a tarea, observaciones del supervisor |
| Alerta retraso | Admin + coordinador | "Alerta: {nombre} en retraso" | Link a tarea, días de retraso, semáforo |

**5.3 Cuándo enviar alertas de retraso**
- Cron job (o verificación al cargar dashboard) que revisa tareas activas
- Si una tarea pasa de verde a amarillo → email
- Si pasa de amarillo a rojo → email
- Máximo 1 email por tarea por cambio de estado (no spam)

**5.4 Dominio de envío**
- Resend requiere dominio verificado para producción
- Temporal: usar el dominio por defecto de Resend (onboarding@resend.dev)
- Producción: verificar dominio de ObraControl cuando esté disponible

---

### Bloque 6: Reportes PDF

**6.1 Librería**
- Usar `@react-pdf/renderer` para generar PDFs server-side en API routes
- O `jspdf` + `html2canvas` si necesitamos renderizar HTML existente

**6.2 Reportes a implementar**

| Reporte | Contenido | Descarga desde |
|---------|-----------|---------------|
| Progreso por proyecto | Barras reportado/aprobado, semáforo por edificio, tareas por estado | /dashboard/reportes |
| Score de contratistas | 3 ejes por contratista, historial, ranking | /dashboard/reportes |
| Extensión de tiempo | Justificación + documentación adjunta + firmas | Detalle de tarea |
| Consumo de materiales | Planeado vs real, piezas dañadas por fase/espacio | /dashboard/reportes |

**6.3 API route**
- GET /api/reportes/progreso/[proyectoId] → devuelve PDF
- GET /api/reportes/contratistas/[proyectoId] → devuelve PDF
- GET /api/reportes/extension/[extensionId] → devuelve PDF
- GET /api/reportes/materiales/[proyectoId] → devuelve PDF

---

## Agentes de ejecución

| Agente | Bloques | Responsabilidad |
|--------|---------|----------------|
| **Backend** | 1, 4, 5 | APIs, invitaciones, retrasos, extensiones, emails Resend |
| **Frontend** | 2, 3, 4 | Wizard proyecto, cámara/evidencia, UI de retrasos, reportar mejorado |
| **Storage/Cloud** | 3 | Upload fotos/video, queue retry, Supabase Storage policies |
| **Seguridad** | 1 | Roles en middleware + API, validar acceso por constructora y rol |
| **Debug** | Todos | Playwright E2E tras cada bloque en Vercel |
| **Code Review** | Final | Revisión de calidad, consistencia, seguridad de todo el código |

## Orden de ejecución

```
Bloque 1 (Usuarios/Roles) 
  → Bloque 2 (Wizard Proyecto)
  → Bloque 3 (Evidencia/Fotos)
  → Bloque 4 (Flujo Completo)
  → Bloque 5 (Emails Resend)
  → Bloque 6 (Reportes PDF)
  → Debug E2E con Playwright
  → Code Review final
  → Deploy final + verificación en Vercel
```

## Variables de entorno nuevas necesarias

```
RESEND_API_KEY=re_Dru7heAc_4PvGyUgJygm4uE77ZffEzz4b
SUPABASE_SERVICE_ROLE_KEY=<necesario para admin.createUser — Victor debe proveer>
```

## Decisiones técnicas

1. **Fotos con metadata overlay:** Canvas API quema fecha/hora/GPS directamente en el JPEG antes de subir. No es reversible (la foto siempre muestra la info).
2. **Upload queue temporal:** Array en React state con retry. Interfaz abstracta (.add/.getAll/.remove) para migrar a IndexedDB sin reescribir consumidores.
3. **Emails:** Resend con dominio temporal. Sin cron — verificación de retrasos al cargar dashboard.
4. **PDFs:** @react-pdf/renderer server-side en API routes.
5. **Roles:** Helper function `getPermissions(rol)` retorna objeto con booleanos (canCreate, canApprove, canDelete, canViewAll). Se usa en middleware y en componentes.
