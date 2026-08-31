# Manual de Usuario - Seiricon (B2B)

> Controla cada tarea, cada contratista y cada peso de tu obra desde un solo lugar.

> **Alcance de este manual:** cubre el producto **B2B** de Seiricon — las cuentas de **constructora** y sus roles (Super Administrador, Administrador General, Administrador de Proyecto, Directivo, Contratista y Obrero). Las cuentas personales (Propietario / Arquitecto) tienen un flujo propio simplificado que se documenta aparte.

_Última actualización: agosto 2026._

---

## Tabla de contenidos

1. [Primeros pasos](#1-primeros-pasos)
2. [Perfiles de usuario y matriz de acceso](#2-perfiles-de-usuario-y-matriz-de-acceso)
3. [Super Administrador](#3-super-administrador)
4. [Administrador General](#4-administrador-general)
5. [Administrador de Proyecto y permisos granulares](#5-administrador-de-proyecto-y-permisos-granulares)
6. [Directivo](#6-directivo)
7. [Contratista](#7-contratista)
8. [Obrero](#8-obrero)
9. [Crear un proyecto paso a paso](#9-crear-un-proyecto-paso-a-paso)
10. [Monitorear un proyecto y el mapa de obras](#10-monitorear-un-proyecto-y-el-mapa-de-obras)
11. [Reportar, aprobar y rechazar tareas](#11-reportar-aprobar-y-rechazar-tareas)
12. [Gastos y anticipos](#12-gastos-y-anticipos)
13. [Reasignar contratistas](#13-reasignar-contratistas)
14. [Retrasos y extensiones de tiempo](#14-retrasos-y-extensiones-de-tiempo)
15. [Sistema de puntuación](#15-sistema-de-puntuacion)
16. [Notificaciones](#16-notificaciones)
17. [Instalar la app (PWA)](#17-instalar-la-app-pwa)
18. [Plan, suscripción y pagos](#18-plan-suscripcion-y-pagos)
19. [Productos técnicos: registro, planos y actas firmadas](#19-productos-tecnicos-registro-planos-y-actas-firmadas)
20. [Cuentas personales (B2C): Propietario y Contratista](#20-cuentas-personales-b2c-propietario-y-contratista)
21. [Juntos: línea pública post-sismo](#21-juntos-linea-publica-post-sismo)
22. [Preguntas frecuentes](#22-preguntas-frecuentes)

---

## 1. Primeros pasos

### Registro

1. Entra a Seiricon y haz clic en **Registrarse**.
2. **Paso 1** — Ingresa los datos de tu empresa: nombre (obligatorio), NIT, dirección, ciudad, teléfono.
3. **Paso 2** — Crea tus credenciales: email y contraseña.
4. Al completar el registro, accedes automáticamente como **Administrador General** de tu constructora.

### Inicio de sesión

- Ingresa con email y contraseña, o usa **Google** para acceso rápido.
- El sistema te redirige automáticamente a tu panel según tu rol.

### Roles disponibles

| Rol | Quién es | Qué puede hacer |
|-----|----------|-----------------|
| Super Administrador | Equipo Seiricon | Gestiona todas las constructoras del sistema |
| Administrador General | Gerente o dueño de la constructora | Control total de su empresa y proyectos |
| Administrador de Proyecto | Coordinador de obra (admin junior) | Gestiona los proyectos que le asignen, con permisos configurables |
| Directivo | Director de obra, coordinador senior | Ve todos los proyectos, aprueba tareas y gastos |
| Contratista | Empresa o persona que ejecuta tareas | Reporta avance, gestiona sus obreros, propone tareas |
| Obrero | Trabajador en campo | Ejecuta tareas individuales y sube evidencia |

---

### La guía interactiva

La primera vez que entras, Seiricon abre una **guía paso a paso** que te muestra para qué sirve cada parte del menú. Puedes saltarla cuando quieras.

Para volver a verla, el botón **«¿Cómo funciona?»** abajo a la derecha, en cualquier momento.

La guía **cambia según tu perfil**: una constructora ve proyectos, sugerencias y usuarios; un propietario o contratista ve su obra y su personal de campo; y un **arquitecto** tiene la suya, que además recorre el registro fotográfico inicial, la firma con matrícula, el acta y los planos versionados.

---

## 2. Perfiles de usuario y matriz de acceso

Cada perfil tiene su propio panel con las herramientas que necesita. Esta es la matriz resumida de quién puede hacer qué:

| Acción | Super Admin | Admin General | Admin Proyecto | Directivo | Contratista | Obrero |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver proyectos | Todos (sistema) | De su constructora | Solo asignados | De su constructora | Solo asignados | Solo asignados |
| Crear proyecto | ✓ | ✓ | — | — | — | — |
| Editar proyecto | ✓ | ✓ | Si tiene el permiso | — | — | — |
| Reportar tarea (evidencia) | — | — | — | — | ✓ | ✓ |
| Aprobar/rechazar tareas | ✓ | ✓ | Si tiene el permiso | ✓ | — | — |
| Reasignar contratistas | ✓ | ✓ | Si tiene el permiso | — | — | — |
| Registrar gasto / anticipo | ✓ | ✓ | ✓ | ✓ | — | — |
| Aprobar gasto | ✓ | ✓ | Si tiene el permiso | ✓ | — | — |
| Invitar usuarios | ✓ | ✓ | Limitado | — | — | — |
| Gestionar obreros | — | ✓ | ✓ | — | ✓ (los suyos) | — |
| Proponer tareas (sugerencias) | — | — | — | — | ✓ | — |
| Ver scoring global de contratistas | ✓ | — | — | — | — | — |

---

## 3. Super Administrador

> El perfil del equipo Seiricon. Gestión global de todas las constructoras que usan la plataforma.

### Menú lateral

| Pestaña | Descripción |
|---------|-------------|
| **Vista global** | Total de constructoras, proyectos, usuarios y tareas en todo el sistema |
| **Constructoras** | Todas las empresas registradas. Crear, editar y ver el detalle de cada una |
| **Proyectos** | Todos los proyectos de todas las constructoras en una sola tabla |
| **Admins Generales** | Gestionar los administradores principales de cada constructora |
| **Contratistas** | Ranking y scoring de contratistas a nivel global |
| **Obreros** | Ranking y scoring de obreros a nivel global |
| **Roles** | Configurar los roles del sistema agrupados por constructora |
| **Reportes** | Analíticas globales |
| **Instalaciones (PWA)** | Métricas de instalación de la app (ver sección 17) |
| **Configuración** | Ajustes del sistema |

### Qué puede hacer

- Crear y administrar constructoras.
- Provisionar Administradores Generales (crea la cuenta en Supabase + envía email de bienvenida).
- Ver y gestionar proyectos de cualquier constructora.
- Acceder al **mapa global de obras**: ve todas las obras activas del sistema con su ubicación y progreso.
- Acceder al scoring de contratistas y obreros como activo estratégico (solo este perfil ve el ranking global).

---

## 4. Administrador General

> El perfil más completo. Crea proyectos, gestiona tu equipo, aprueba tareas y gastos, y controla toda tu constructora.

### Menú lateral

| Pestaña | Descripción |
|---------|-------------|
| **Dashboard** | Panel principal con estadísticas, mapa de obras y tareas que requieren acción |
| **Empresa** | Perfil de tu constructora: nombre, NIT, dirección, ciudad, teléfono, sitio web, logo |
| **Proyectos** | Lista de todos tus proyectos con progreso visual, semáforo de estado y mapa |
| **Tareas** | Vista global de todas las tareas con filtros por estado, fase y proyecto |
| **Equipo** | Gestión de tu equipo de trabajo |
| **Sugerencias** | Propuestas de tareas enviadas por contratistas para tu aprobación |
| **Reportes** | Reportes y analíticas de tus proyectos |
| **Usuarios** | Invitar y gestionar usuarios: admins de proyecto, directivos, contratistas |
| **Configuración** | Datos de empresa, clientes, plan de suscripción |

### Dashboard — Lo que ves al entrar

- **4 tarjetas de resumen**: proyectos activos, tareas esperando aprobación, tareas en riesgo, progreso global aprobado.
- **Mapa de obras**: tus proyectos con ubicación, con pines coloreados según el avance.
- **Proyectos recientes**: grid con barra de progreso doble (azul = reportado, verde = aprobado).
- **Desglose por estado**: aprobadas, reportadas, pendientes y rechazadas.
- **Resumen semanal**: aprobaciones, reportes y rechazos de los últimos 7 días.
- **Requieren acción**: hasta 6 tareas pendientes de aprobación con semáforo de urgencia.

### Qué puede hacer

- **Crear y editar proyectos** completos (la edición pide confirmación con contraseña).
- **Asignar equipo**: vincular admins de proyecto (con permisos granulares) y contratistas.
- **Aprobar o rechazar tareas** con evidencia fotográfica.
- **Gestionar gastos y anticipos** del proyecto (ver sección 12).
- **Reasignar contratistas** cuando sea necesario (con auditoría).
- **Invitar usuarios** y gestionar clientes externos.
- **Importar tareas** desde Excel y reutilizar plantillas aprendidas.

---

## 5. Administrador de Proyecto y permisos granulares

> Coordinador enfocado (admin junior). Solo ve y gestiona los proyectos que le han sido asignados, con los permisos que el Administrador General le otorgue.

### Menú lateral

Dashboard, Proyectos (solo asignados), Tareas, Sugerencias, Reportes, Usuarios (limitado a contratistas y obreros de sus proyectos).

### Permisos granulares (lo nuevo)

El Administrador General puede dar o quitar permisos específicos a cada Administrador de Proyecto, **por proyecto**:

| Permiso | Por defecto | Qué habilita |
|---------|:---:|-------------|
| **Editar el proyecto** (`can_edit_project`) | Apagado | Cambiar estructura, presupuesto y fechas del proyecto |
| **Asignar contratistas** (`can_assign_contractors`) | Apagado | Asignar y reasignar contratistas (la reasignación pide contraseña) |
| **Gestionar el equipo** (`can_manage_team`) | Apagado | Dar o quitar permisos a otros admins de proyecto del mismo proyecto |
| **Aprobar tareas** (`can_approve_tasks`) | Encendido | Aprobar o rechazar reportes de tareas y gastos |

**Reglas de seguridad:**
- Un admin de proyecto con *Gestionar el equipo* puede ajustar los permisos de otros admins del proyecto, pero **no puede auto-modificarse** (evita la auto-escalación de privilegios).
- Cada asignación o cambio de permisos queda registrado (quién lo hizo y cuándo).

### Diferencias con el Administrador General

- **No puede** crear proyectos nuevos ni editar la información de la empresa.
- **No puede** acceder a la configuración del sistema ni ver el scoring global.
- **Solo ve** los proyectos que le fueron asignados.

---

## 6. Directivo

> Visión ejecutiva. Ve todo, aprueba tareas y gastos, pero no crea ni elimina.

### Menú lateral

Inicio (dashboard ejecutivo) y Proyectos.

### Dashboard ejecutivo

- **Métricas clave**: proyectos activos, progreso promedio, tareas aprobadas, proyectos en riesgo (más del 30% de tareas críticas).
- **Mapa de obras** de la constructora y lista de proyectos con semáforo, fecha de fin y barra de progreso.

### Qué puede hacer

- Ver todos los proyectos de la constructora.
- Aprobar y rechazar tareas y gastos.
- Gestionar precios de tareas.
- Ver reportes completos.

### Qué NO puede hacer

- Crear o eliminar proyectos.
- Invitar o gestionar usuarios.
- Acceder a la configuración del sistema.

---

## 7. Contratista

> Tu portal de trabajo. Reporta el avance de tus tareas, gestiona tu equipo de obreros y propone nuevas tareas.

### Menú lateral

| Pestaña | Descripción |
|---------|-------------|
| **Inicio** | Resumen de tus tareas asignadas, progreso y scoring |
| **Reportar tareas** | Tareas pendientes por reportar; aquí subes la evidencia |
| **Historial** | Registro de tus tareas reportadas, aprobadas y rechazadas |
| **Sugerir tarea** | Proponer nuevas tareas al administrador |
| **Mis obreros** | Crear, editar y ver el scoring de los obreros a tu cargo |
| **Reportes** | Tu desempeño: scoring, tiempos y calidad |

### Qué puede hacer el contratista

- **Reportar sus tareas** con evidencia fotográfica (entra a *Reportar tareas → la tarea*).
- **Gestionar sus obreros** y consultar su scoring.
- **Proponer tareas** (sugerencias) que el administrador aprueba o rechaza.
- **Ver el progreso** de sus tareas y su propio desempeño.

### Qué NO puede hacer

- **No aprueba ni rechaza tareas** (eso es de los administradores y el directivo): solo reporta y consulta el avance.
- No ve proyectos ni tareas que no le fueron asignados.

### Flujo de trabajo

```
1. Recibe tareas asignadas (estado: PENDIENTE)
2. Ejecuta el trabajo en campo
3. Sube evidencia fotográfica (mínimo 2 fotos; con GPS y hora)
4. Reporta la tarea (estado: REPORTADA)
5. El supervisor revisa → APROBADA o NO APROBADA
6. Si fue rechazada, corrige y vuelve a reportar
```

---

## 8. Obrero

> Acceso simplificado desde el celular, sin crear cuenta.

El obrero entra mediante un **enlace único (token)** que le comparte su contratista o administrador — no necesita email ni contraseña.

> **El enlace es la llave.** Como no hay usuario ni contraseña, quien tenga el enlace entra. Compártelo solo por un canal privado (WhatsApp directo, no grupos) y avisa a soporte si sospechas que se filtró: se puede regenerar, y el anterior deja de funcionar en el acto.

**Actualización de agosto de 2026.** Los enlaces se generaron de nuevo con un código mucho más largo y aleatorio, para que nadie pueda adivinarlos a partir de otro. Si tus obreros tenían enlaces de antes de esa fecha, **dejaron de funcionar y hay que reenviarles el nuevo** desde la pestaña de obreros. Además, el sistema ahora bloquea de forma temporal a quien pruebe muchos enlaces incorrectos seguidos.

### Qué puede hacer

- Ver, organizadas por jerarquía (proyecto → edificio → piso → apartamento → espacio), las tareas que le asignaron.
- Subir evidencia fotográfica con **GPS y hora de captura**.
- Ver el estado de sus tareas.

### Qué NO puede hacer

- Aprobar o rechazar tareas.
- Ver otros proyectos o tareas.
- Gestionar otros usuarios.

---

## 9. Crear un proyecto paso a paso

> Solo el **Administrador General** puede crear proyectos nuevos.

**Acceso:** Proyectos → **Nuevo proyecto**.

### Paso 1: Datos generales

- **Nombre del proyecto** (mínimo 3 caracteres).
- **Número de registro** (identificador, formato libre).
- **Tipo / subtipo** de obra.
- **Cliente** (opcional) y **contratista por defecto** (opcional, se asigna a las tareas sin asignación específica).
- **Presupuesto total** y **metraje** (opcionales).
- **Ubicación** de la obra (para que aparezca en el mapa de obras).
- **Días hábiles por semana** (1–7, por defecto 5) y **fechas** de inicio y fin estimado.

### Paso 2: Estructura

- **Torres / edificios**: nombre, número de pisos, y si es zona común.
- **Tipos de unidad** (ej. "Tipo A - 65m²", "Penthouse") con los **espacios** que contienen (cocina, baño, habitación, sala…).
- **Distribución**: cuántas unidades de cada tipo hay por piso.
- **Metraje por espacio** (opcional).

### Paso 3: Tareas

Define las tareas que se ejecutarán en cada unidad. Puedes:

- Usar **tareas sugeridas** (plantillas que el sistema aprende de tus proyectos anteriores).
- **Agregar tareas manualmente**, indicando por cada una: fase, **subfase** (ej. Instalación / Detallado y Lustro), espacio, nombre, tipo de unidad (si aplica), tiempo acordado en días y **precio** (COP, opcional).
- **Importar desde Excel** con la plantilla de 9 columnas (Fase, Subfase, Espacio, Nombre de tarea, Días acordados, Valor COP, Marca/Línea, Componentes, Notas).

### Paso 4: Asignar contratistas y crear

El panel de asignación es **granular**:

1. Selecciona un **contratista**.
2. Filtra el alcance con chips multi-selección: **torres → pisos → apartamentos**.
3. Marca las **tareas** (por fase) que le asignas.
4. Haz clic en **Asignar**. El panel se reinicia para el siguiente contratista.

Debajo aparece el **resumen de asignaciones** (agrupado por contratista, con su alcance) y un botón para **eliminar** cualquier grupo y corregir.

También puedes registrar **personas externas** vinculadas al proyecto (ingeniero residente, arquitecto…) que no son usuarios del sistema.

Al **crear el proyecto**, el sistema genera toda la estructura, aplica las asignaciones y aprende las tareas para sugerirlas en el futuro.

---

## 10. Monitorear un proyecto y el mapa de obras

### Mapa de obras (geográfico)

En el dashboard y en la lista de proyectos verás un **mapa con todas las obras que tienen ubicación**:

- **Super Admin**: todas las obras del sistema.
- **Admin General / Directivo**: todas las obras de la constructora.
- **Admin de Proyecto**: solo sus obras asignadas.
- Cada **pin** se colorea según el avance: **gris** (por iniciar), **azul** (en curso), **verde** (terminado). Al hacer clic muestra el nombre, el porcentaje y un enlace al detalle.

### Detalle del proyecto

- **Barra superior**: nombre, número de registro, conteo de tareas/torres y botones de Editar y Gestionar equipo.
- **Progreso general**: porcentaje aprobado (verde) y reportado (azul), fechas, fases activas.
- **Mapa de unidades**: una grilla por torre y piso. Cada apartamento se colorea por estado (verde intenso 100%, verde >50%, amarillo <50%, rojo con tareas pero sin aprobar, gris sin avance). Haz clic en una unidad para ver sus tareas agrupadas por fase.

### Semáforo de tiempo

| Color | Significado |
|-------|-------------|
| Verde intenso | Adelantado |
| Verde | A tiempo |
| Amarillo | Se acerca el plazo |
| Rojo | En retraso |
| Vinotinto | Retraso crítico |

---

## 11. Reportar, aprobar y rechazar tareas

> Reportan: contratista y obrero. Aprueban/rechazan: Administrador General, Administrador de Proyecto (con permiso) y Directivo.

### Evidencia fotográfica (con GPS y hora)

Cuando un contratista u obrero reporta una tarea, la app:

- Toma **fotos** desde la cámara del dispositivo (**mínimo 2 para poder reportar**) y, opcionalmente, video.
- **Comprime y redimensiona** las fotos automáticamente para que pesen poco (las cámaras de celular de alta resolución no bloquean el envío).
- Estampa cada foto con una **marca de agua**: fecha y hora de captura, **coordenadas GPS** y el nombre de la obra/tarea.
- Permite **eliminar una foto o video antes de subirlo** (botón visible en cada miniatura).

Después del reporte, en el detalle de la tarea la evidencia se ve con su **hora** y sus **coordenadas**, y al hacer clic en las coordenadas se abre **Google Maps** en ese punto.

### Flujo de aprobación

```
PENDIENTE → [contratista/obrero reporta] → REPORTADA → [supervisor revisa] → APROBADA o NO_APROBADA
                                                                          ↓
                                                  (si se rechaza, se corrige y se reporta de nuevo)
```

**Al aprobar**: la tarea pasa a APROBADA, se registra la fecha de fin, se recalcula el scoring del contratista y del obrero, y se notifica al contratista.

**Al rechazar**: escribe la **justificación** (y, si quieres, marca los ítems que no cumplen). La tarea pasa a NO_APROBADA y el contratista recibe la notificación con el motivo para corregir.

---

## 12. Gastos y anticipos

> El módulo de control del dinero del proyecto. Accede desde **Proyecto → Gastos**.
> Registran: Administrador General, Administrador de Proyecto y Directivo. Aprueban gastos: Administrador General, Directivo y Admin de Proyecto con permiso de aprobación.

### Registrar un gasto

Cada gasto incluye: **descripción**, **monto** (COP), **foto de la factura**, y opcionalmente el **material** (cantidad, unidad, precio unitario) y el **espacio o tarea** asociado.

Un gasto pasa por tres estados: **Registrado → Aprobado / Rechazado**. Solo los gastos **aprobados** cuentan como dinero efectivamente sustentado.

### Vista 1 — Presupuesto vs. gastado

- **Gastado** = gastos aprobados **+** la mano de obra (suma de los precios de las tareas del proyecto).
- **Presupuesto total** = el definido en el proyecto.
- Muestra el **% usado** y alerta en rojo si se sobrepasa el presupuesto.

### Vista 2 — Dinero entregado vs. sustentado (la alarma)

Esta es la vista que evita fugas de dinero:

- **Anticipos** = dinero entregado a maestros/obreros (cada anticipo lleva monto, nota, a quién se entregó y fecha).
- **Sustentado** = gastos aprobados (con factura).
- **Sin sustentar** = anticipos − gastos aprobados → si hay dinero entregado que nadie ha justificado con factura, aparece una **alerta roja**.

Las **facturas** se guardan de forma segura y se ven con enlaces temporales firmados; nadie de otra constructora puede acceder a ellas.

---

## 13. Reasignar contratistas

> Disponible para Administrador General y Administrador de Proyecto con el permiso *Asignar contratistas*.

1. Ve a **Proyecto → Gestionar equipo**.
2. En la tarjeta del contratista, haz clic en **reasignar**.
3. Indica el **nuevo contratista** (o déjalo sin asignar), el **motivo** (máx. 500 caracteres) y tu **contraseña** para confirmar.

**Qué sucede:**
- Solo se reasignan tareas en estado **PENDIENTE** o **NO_APROBADA**.
- Las tareas **APROBADAS** conservan al contratista original (se preserva el registro histórico).
- Se crea un registro de auditoría permanente (quién, contratista anterior y nuevo, motivo, fecha).
- Máximo 2.000 tareas por operación.

En la sección de equipo puedes ver el **historial completo** de reasignaciones del proyecto.

---

## 14. Retrasos y extensiones de tiempo

Cuando una tarea se atrasa, el contratista o el supervisor puede **registrar un retraso** indicando el tipo:

- **Por el contratista** (cuenta en su scoring).
- **Por falta de pista/insumos** (no penaliza al contratista; puede requerir evidencia).
- **Otro**.

El administrador puede además **autorizar una extensión de tiempo** (días adicionales con su justificación). Tanto los retrasos como las extensiones quedan auditados y alimentan el semáforo y el scoring.

---

## 15. Sistema de puntuación

Seiricon calcula automáticamente el desempeño de contratistas y obreros. Este scoring es un **activo estratégico** de la plataforma.

### Scoring de contratistas (0–100)

| Factor | Peso | Qué mide |
|--------|:---:|----------|
| **Cumplimiento** | 50% | Entregar dentro del plazo acordado (descarta retrasos no atribuibles, como falta de insumos) |
| **Calidad** | 30% | Tareas aprobadas / (aprobadas + rechazadas) |
| **Velocidad de corrección** | 20% | Qué tan rápido corrige las tareas rechazadas |

Se recalcula cada vez que se aprueba/rechaza una tarea o se registra un retraso.

### Scoring de obreros (0–100)

| Factor | Peso | Qué mide |
|--------|:---:|----------|
| **Calidad** | 50% | Evidencias aprobadas / (aprobadas + rechazadas) |
| **Cumplimiento** | 30% | Tareas entregadas a tiempo |
| **Velocidad** | 20% | Penaliza progresivamente por rechazos |

Cada obrero guarda su histórico de scores para ver su evolución.

---

## 16. Notificaciones

Seiricon notifica los eventos importantes **en tiempo real**.

### Cómo llegan

- **En la app**: campana con contador de no leídas (en la barra superior y el menú lateral), con el historial reciente.
- **Aviso emergente + sonido**: si estás conectado, salta un aviso visual con sonido en el momento.
- **Email**: se envían automáticamente para los eventos clave.

### Qué eventos notifican

- **A los supervisores** (Admin General, Directivo y Admin de Proyecto con acceso al proyecto): una tarea fue **reportada**, llegó una **nueva sugerencia** de tarea, o un **obrero reportó** avance.
- **Al contratista / obrero**: su tarea fue **aprobada** o **rechazada** (con el motivo), o su **sugerencia** fue aprobada/rechazada.

---

## 17. Instalar la app (PWA)

> ⚠️ **Averiado desde la migración a Next 16 (detectado el 15-ago-2026).** El
> *service worker* dejó de generarse en el build: Next 16 compila con Turbopack
> y `@serwist/next` todavía no lo soporta — avisa por consola y no emite
> `public/sw.js`. Sin service worker **no hay modo offline y la app no es
> instalable**, aunque el banner y las métricas sigan a la vista. Todo lo que
> describe esta sección está pendiente de que se migre a `@serwist/turbopack` o
> al modo configurador de Serwist. Los obreros con mala señal hoy necesitan
> conexión para reportar.

Seiricon es una **app instalable** (PWA): funciona en el navegador y puedes instalarla en el celular o el computador como una app nativa.

- Aparece un **banner discreto** para instalarla. En **Android/Chrome/Edge** usa el instalador del navegador; en **iPhone (Safari)** muestra las instrucciones (Compartir → Agregar a pantalla de inicio).
- Una vez instalada, se abre a pantalla completa como cualquier app.
- El **Super Admin** tiene un panel de **métricas de instalación** (*Instalaciones / PWA*): total de instalaciones, tasa de conversión, usuarios activos de los últimos 7 días y desglose por plataforma (iOS / Android / escritorio).

---

## 18. Plan, suscripción y pagos

> Aplica a **todas** las cuentas: constructoras (B2B) y cuentas personales (B2C). Se administra desde **Configuración › Suscripción y facturación**.

### Dónde se ve

En **Configuración** hay una tarjeta con tu plan actual y la fecha de renovación. Al entrar (**Configuración › Plan**) verás:

- **Tu plan**: nombre, si está en *Prueba gratis*, *Activo* o *Vencido*, y la fecha de vencimiento.
- Un contador de **días restantes**. En los **últimos 3 días** se pone en ámbar con un aviso.
- El **historial de pagos** de la cuenta.

### Los planes

| Plan | Precio mensual | Obras activas |
|---|---|---|
| **Personal** | Gratis | 1 (Propietario) · 2 (Contratista / Arquitecto) |
| **Obra** | $650.000 | 1 |
| **Proyecto** | $1.500.000 | 5 |
| **Empresa** | $3.500.000 | 15 |

El tope es de obras **activas** al mismo tiempo, no de obras totales: si archivas una obra terminada, liberas el cupo. El plan **Personal** es gratuito y **no vence** — su único límite es la cantidad de obras.

Puedes pagar **mensual, 6 meses o 12 meses**. Al renovar antes de tiempo, el período nuevo **se encadena** al final del actual: no pierdes los días que te quedaban.

### La prueba gratis

Una cuenta nueva de pago arranca con **14 días de prueba**. Antes de que se acabe verás el aviso en Configuración para elegir plan.

### Cómo se paga

El pago se hace con **Wompi** (tarjeta, PSE, Nequi y demás medios de la pasarela):

1. Eliges plan y período, y pulsas pagar.
2. Seiricon te lleva al checkout de Wompi.
3. Al terminar vuelves a Configuración con el mensaje **"Tu pago está en proceso"**.
4. Cuando Wompi confirma el pago, la suscripción se extiende sola y aparece **"Listo, tu pago quedó registrado"**.

El monto lo calcula siempre el servidor a partir del plan y va sellado con firma de integridad: no se puede alterar desde el navegador. La suscripción **solo** se acredita cuando Wompi confirma el pago, nunca al iniciarlo.

Cada cobro queda en el historial con su estado: **Pendiente**, **Aprobado**, **Rechazado**, **Anulado** o **Error**.

### Quién puede comprar o cambiar de plan

Solo **Super Administrador**, **Administrador General** y **Directivo**. Es el mismo nivel que se exige para gestionar usuarios. Un Administrador de Proyecto, Contratista u Obrero no puede tocar la suscripción.

### Qué pasa cuando se vence

**No se pierde nada y no te sacan de la cuenta.** Puedes seguir entrando y consultando todo lo registrado —obras, tareas, evidencias, gastos, reportes—, pero **no puedes crear obras nuevas** hasta renovar. Al intentarlo, el mensaje te manda a *Configuración › Plan*.

Si **cancelas**, la suscripción **sigue valiendo hasta la fecha que ya pagaste**; solo después deja de permitir obras nuevas.

### Te avisamos antes de que se venza

No tienes que estar pendiente de la fecha. Seiricon manda un correo a quien puede renovar —Super Administrador, Administrador General y Directivo— cuando faltan **7 días, 3 días, 1 día** y el mismo **día del vencimiento**.

El correo trae el enlace directo para renovar y recuerda lo importante: aunque se venza, no se pierde nada; solo se dejan de poder crear obras nuevas.

Se avisa a quien puede pagar, no a todo el equipo. Un obrero no recibe estos correos.

### Si llegas al tope de obras del plan

Cuando intentas crear una obra por encima del límite, Seiricon te dice cuántas permite tu plan y te da dos salidas: **archivar una obra terminada** o **subir de plan**.

---

## 19. Productos técnicos: registro, planos y actas firmadas

> Disponible para **Arquitecto** y **Constructora**. Un Propietario o un Contratista B2C no ven este módulo.
>
> Vive **dentro de cada obra**, en la pestaña **Técnicos** — no es una opción del menú lateral.

### Registro fotográfico inicial

Antes de tocar nada, fotografías el estado en que recibes el inmueble. Cada foto lleva **fecha, hora y ubicación grabadas encima de la imagen**.

**Solo se toman con la cámara, ahí mismo.** No hay botón para subir desde la galería, y no es un descuido: una foto guardada no prueba en qué fecha se tomó, y esa fecha es todo el valor del registro.

### Planos y renders

Subes los planos y renders de la obra. Cada vez que reemplazas uno, **se guarda como versión nueva sin borrar la anterior**, así que siempre puedes volver a lo que se entregó antes.

**Cupo: 1 GB por obra.** Cuando se llena, Seiricon te avisa antes de que falle una subida.

### Tu firma y tu matrícula

Se suben **una sola vez** y quedan para todo lo que emitas:

| | |
|---|---|
| Imagen de la firma | PNG, JPG o WEBP · máximo 2 MB |
| Matrícula profesional | entre 3 y 40 caracteres |

Sin cualquiera de las dos no se puede firmar, y Seiricon te lo dice antes de dejarte intentarlo.

Al firmar, **la matrícula se congela en el documento**. Si más adelante la actualizas, lo que ya emitiste no cambia — la matrícula impresa en un papel que está en manos de un cliente tiene que seguir siendo la que se imprimió.

### El acta de estado inicial

Con las fotos y tu firma, emites el acta. Necesitas tener registrada la **matrícula inmobiliaria** del inmueble: sin ella el acta no se emite.

Cada acta queda sellada con un **folio** y una **huella digital** de su contenido. A partir de ahí **nadie puede modificarla, ni tú**.

Si algo salió mal, no se edita: **se emite una corrección**, que es una versión nueva con folio nuevo. La anterior sigue existiendo y sigue verificando. Eso es justamente lo que la hace defendible.

El acta declara también, de forma expresa, **lo que NO incluye** —ensayos de laboratorio, cálculo estructural, elementos ocultos, juicio de habitabilidad—. Delimitar la responsabilidad es lo que la vuelve un documento serio.

### La constancia de tu cliente

Le compartes un **enlace** y tu cliente deja constancia de que recibió el documento. **No necesita crear cuenta ni descargar nada.** Queda registrado con fecha, y es tu respaldo de que entregaste.

### Verificar un documento

Cualquiera con el folio puede comprobar que un documento es auténtico. La verificación responde poco a propósito: que existe, de qué tipo es, cuándo se emitió y si la huella coincide. Nada del contenido — quien consulta suele ser una aseguradora que ya tiene el PDF en la mano.

> **No es firma digital certificada.** Es firma electrónica simple (Ley 527 de 1999 y Decreto 2364 de 2012): vale porque se puede probar quién firmó, cuándo, y que el documento no cambió. Una firma digital certificada exige una entidad de certificación acreditada, y Seiricon no la tiene.

---

## 20. Cuentas personales (B2C): Propietario y Contratista

> Además de las constructoras, Seiricon tiene un flujo simplificado para quien gestiona **su propia obra**:
> - **Propietario** — dueño de una casa o apartamento que remodela o construye lo suyo.
> - **Contratista (B2C)** — emprendedor de un oficio (arquitecto, pintor, carpintero, electricista, instalador de cocinas…) que **envía a su personal a ejecutar trabajos donde sus clientes**. Monitorea a sus trabajadores y, si quiere, comparte el avance con su cliente.
>
> No necesitan estructura de constructora ni equipo: arman su obra en minutos con ayuda de la inteligencia artificial. *(El "Contratista B2C" es distinto del rol "Contratista" dentro de una empresa constructora: aquí tiene su propia cuenta y administra sus propios proyectos.)*

### Al registrarte: un cuestionario rápido

Después de crear la cuenta (y antes de entrar), Seiricon hace un **cuestionario corto** adaptado a tu perfil (oficio, tamaño del equipo, ciudad, cómo controlas hoy el trabajo, etc.). Son pocas preguntas con opciones de clic; puedes omitirlas. Todos los perfiles —incluidas las empresas— tienen su propio cuestionario.

### Asistente para armar la obra

Al entrar, un asistente guía la creación paso a paso:

1. **¿Qué vas a hacer y cómo va?** — tipo de obra (reforma, modificación u obra nueva) y punto de partida (aún no ha iniciado / en proceso / próxima a finalizar).
2. **¿Qué tipo de propiedad?** — casa, apartamento, edificio o local, y el nombre de la obra.
3. **Arma tu obra** — define los espacios (cocina, baños, habitaciones…). Puedes indicar los **m² de toda la obra** o el área **por espacio**, lo que te resulte más cómodo.
4. **¿Cuándo y dónde?** — fechas y ubicación.
5. **¿Qué te falta por hacer?** — por cada espacio, Seiricon **sugiere las tareas relevantes con inteligencia artificial** (solo las que aplican a ese espacio) con sus **días sugeridos**. Marca lo pendiente, **elimina** lo que no aplica y agrega tus propias tareas.
6. **Costos** — define el presupuesto de tres maneras (ver abajo) y Seiricon reparte el dinero entre las tareas de forma inteligente.

### Sugerencias inteligentes (IA)

- **Tareas por espacio**: la IA propone únicamente tareas que aplican a ese espacio **y a la etapa de la obra** (si la obra está por terminar, sugiere acabados —pintura, puertas, cocina—, no estructura). Usa **lenguaje sencillo**, sin tecnicismos ("levantar paredes" en vez de "mampostería"). Si la IA no está disponible, usa plantillas base.

### Importa tus tareas y presupuesto desde Excel

Si ya tienes tu presupuesto en Excel (como acostumbran arquitectos y contratistas), no hace falta redigitarlo:

1. En el paso "¿Qué te falta?", **descarga la plantilla**: viene con listas desplegables de **fase** (obra gris, pintura, instalaciones…) y de **ubicación** con tus propios espacios ("Toda la propiedad", "Piso 2", "Piso 1 – Cocina"…).
2. Copia tus ítems a la plantilla. Del presupuesto puedes dar la **mano de obra y los materiales por separado**, o **solo el valor total** de cada ítem.
3. **Súbela**: Seiricon la revisa contigo antes de aplicar — te muestra qué encontró y te deja decidir (incluir ítems sin valor, estimar la división trabajo/materiales cuando solo diste el total, reasignar ubicaciones que cambiaron). Los montos aceptan los formatos comunes ($1.500.000, $1'500.000).
4. ¿Te equivocaste en el archivo? Corrígelo y **súbelo de nuevo**: lo importado se **reemplaza** con la versión nueva; las tareas que creaste a mano no se tocan.

Las tareas quedan creadas en su espacio con su presupuesto. Los nombres de espacio no se repiten dentro de un mismo piso (si agregas dos cocinas, quedan "Cocina" y "Cocina 2").

### Cronograma: cuánto debería tardar tu obra

- Al definir tus tareas, Seiricon calcula **en qué fecha terminarías**, con rendimientos reales de construcción en Colombia (cuánto avanza un equipo de trabajo por día en cada actividad, más tiempos de secado e imprevistos) y el calendario laboral colombiano (semana de seis días y los 18 festivos).
- Lo que ves es una **fecha, no un número de días**: *"lo más probable es que termines el 14 de octubre; en 8 de cada 10 obras parecidas, se termina antes del 3 de noviembre"*. También te decimos la fecha que casi nunca se pasa, por si necesitas comprometerte con alguien.
- Si pusiste fecha de entrega, te da un **contra-pronóstico que solo guía**: te dice **cuántas veces de cada 10** se cumple una fecha así en obras parecidas. Nunca te bloquea.
- En el resumen y en el detalle de la obra ves una **línea de tiempo por fases**, con las fechas de cada fase, las actividades que pueden avanzar **en paralelo** (por ejemplo, instalaciones eléctricas e hidráulicas a la vez) y los tiempos de secado señalados.
- La línea de tiempo se lee sobre un **calendario**: arriba van los meses, y las barras caen donde les corresponde en el mes real, ya descontados domingos y festivos (por eso un mes con dos festivos se ve más angosto que uno sin ninguno). Dos verticales te ubican sin hacer cuentas: **hoy** (gris, solo si la obra ya arrancó) y la **fecha de entrega** con la que conviene comprometerse (azul punteada). Lo que queda a la derecha de la punteada es el margen de riesgo: si algo se atrasa, ahí es donde se va.
- Arriba de las barras hay una **leyenda** que dice qué significa cada color: ámbar es lo que no tiene holgura (si se atrasa, se atrasa la entrega), azul es lo que se puede mover sin mover la fecha, violeta es otro oficio corriendo en paralelo y gris es el arranque y la entrega.
- Con cada obra que se completa, Seiricon aprende de las duraciones reales para afinar sus estimados.

### Cómo defines el presupuesto (3 modos)

1. **Aún no tengo presupuesto** — Seiricon estima el costo de cada tarea (trabajo + materiales) con precios de referencia reales de Colombia.
2. **Tengo un presupuesto total** — escribes un monto y Seiricon lo reparte entre las tareas según cuánto pesa cada una (no en partes iguales).
3. **Tengo separado: trabajo y materiales** (lo más común) — escribes cuánto es de **mano de obra** y cuánto de **materiales**, y Seiricon reparte cada bolsa.

En todos los casos te muestra, en lenguaje llano, cuánto de tu presupuesto es **trabajo** (lo que pagas a tus trabajadores) y cuánto **materiales** — y eso se conecta con el módulo de gastos y anticipos. Todo es editable.

### Gestión de la obra

- **Edición total**: después puedes editar toda la obra (espacios, tareas, costos, fechas, ubicación) sin perder el historial de lo ya reportado. En edición, puedes **guardar desde cualquier paso**, sin recorrer todo el asistente.
- **Compartir avance con el cliente** (Contratista B2C): generas un **enlace de solo lectura** y tu cliente ve el progreso de la obra (semáforo, tareas y fotos del avance) sin crear cuenta. No ve costos ni datos de tus trabajadores.
- **Mapa de obras**: aparece solo si gestionas **2 o más obras activas** (con una sola obra no hace falta; la ubicación igual se guarda).
- **Mismo control que el B2B** para lo demás: evidencia con foto, GPS y hora aprobada por ti, gastos y anticipos, y acceso por enlace para obreros sin instalar nada.

---

## 21. Juntos: línea pública post-sismo

**Ruta:** `/go/juntos` · **No requiere cuenta ni pago.**

Línea pública abierta tras el sismo del 10 de agosto de 2026. Es la única parte de Seiricon a la que se entra sin registrarse, y funciona en el celular sin instalar nada.

### Cómo se llega

Una franja fija arriba de la landing B2B (`/`) y de Seiricon Go (`/go`) enlaza a Juntos. Es temporal: se retira cuando pase la emergencia quitando los dos `<AvisoEmergencia />`.

### Los dos caminos

| Camino | Qué hace | Usa IA |
|---|---|---|
| **Revisar una grieta** (`/go/juntos/revisar`) | Filtro de seguridad primero; después, grieta por grieta, entrega la **prioridad de revisión** (urgente / pronto / cuando puedas) y un informe en PDF | Sí, si está activa |
| **Documentar los daños** (`/go/juntos/documentar`) | Acta de daños espacio por espacio, con fotos fechadas y geolocalizadas | No |

Ambos terminan igual: un gate que pide los datos, la descarga del PDF, y una pantalla con el **derecho de petición prellenado** más información legal sobre seguros, copropiedades, ayudas del Estado y estafas.

### Qué NO hace

**Nunca dice que una vivienda es segura.** Entrega prioridad de revisión, no diagnóstico. No es peritaje ni evaluación de habitabilidad: eso lo hace un ingeniero estructural o los organismos oficiales.

Dos reglas del motor están pendientes de visto bueno de un ingeniero. Mientras tanto, todas las capas de reconciliación **solo elevan** la severidad, nunca la ablandan — invariante verificado por máquina en `npm run verify:alerta`. Con la lectura automática apagada, ninguna grieta puede resolver en verde.

### Datos

- **La cédula y la dirección NO se guardan.** Viajan con la petición, se imprimen en el documento y se descartan.
- **Las fotos no se almacenan.** Se usan para armar el PDF y se descartan.
- Se conservan nombre, WhatsApp, ciudad, rol y las dos autorizaciones (`contacto_juntos`).
- Detalle completo en la sección 0 de [/privacidad](/privacidad#juntos).

### Verificación de documentos

Cada PDF imprime folio y huella. En `/go/juntos/verificar` una aseguradora o alcaldía puede comprobar que salió de aquí. El registro (`documentos_juntos`) no contiene datos personales.

### Controles de operación

| Variable | Efecto |
|---|---|
| `JUNTOS_PAUSADO=true` | Baja las tres páginas del flujo, las cuatro rutas de API y la franja de las landings. **`/verificar` sigue viva.** Requiere redespliegue (1-2 min). |
| `ALERTA_VISION_ENABLED=true` | Enciende la lectura automática de grietas. Ausente o distinto de `true` = todo el mundo en modo manual. |
| `ALERTA_VISION_PROVEEDOR` | `anthropic` (por defecto) o `gemini`. Cambiar de proveedor es cambiar esta variable; no hace falta desplegar código. **Al cambiarla hay que actualizar la sección 0.2 de /privacidad**, que nombra al proveedor y su país. |
| `ALERTA_VISION_MODEL` | Modelo concreto. Si se omite: `claude-haiku-4-5` o `gemini-3.7-flash` según el proveedor. Ojo: `gemini-2.5-flash` y `gemini-2.5-flash-lite` se retiran el 16 de octubre de 2026. |
| `PDF_MAX_CONCURRENTES` | Renders de PDF simultáneos por instancia (2 por defecto). Al llenarse responde «espera unos segundos», no falla. |

---

## 22. Preguntas frecuentes

### ¿Puedo editar un proyecto después de crearlo?

Sí. El Administrador General (o un Admin de Proyecto con el permiso *Editar el proyecto*) puede editarlo. Al guardar, el sistema pide confirmación con contraseña para evitar cambios accidentales, y los cambios quedan auditados. Por seguridad, no se borran tareas o espacios que ya tengan historial (reportes, aprobaciones, gastos).

### ¿En qué se diferencia un Administrador de Proyecto de un Administrador General?

El Administrador General tiene control total. El Administrador de Proyecto solo ve sus proyectos asignados y actúa según los permisos que le otorguen: editar el proyecto, asignar contratistas, gestionar el equipo y aprobar tareas (ver sección 5).

### ¿El contratista puede aprobar sus propias tareas?

No. El contratista **reporta** con evidencia, pero la aprobación o el rechazo siempre lo hace un administrador o el directivo.

### ¿Cómo controlo que no se pierda dinero en la obra?

Con el módulo de **Gastos y anticipos** (sección 12): la vista "dinero entregado vs. sustentado" te muestra en rojo cualquier anticipo entregado que aún no tenga factura que lo justifique.

### ¿La evidencia trae ubicación y hora?

Sí. Cada foto se estampa con fecha, hora y coordenadas GPS, y en el detalle de la tarea puedes abrir esas coordenadas directamente en Google Maps.

### ¿Puedo importar tareas desde Excel?

Sí. En el paso de Tareas descarga la plantilla de 9 columnas, complétala y súbela; el sistema valida las filas y te avisa si hay errores.

### ¿Es seguro?

Sí. Seiricon implementa:
- **Aislamiento por constructora**: cada empresa solo ve sus propios datos.
- **Confirmación con contraseña** para acciones críticas (editar proyecto, reasignar contratistas).
- **Auditoría permanente** de cambios importantes (reasignaciones, ediciones, permisos).
- **Validación de datos** en todos los formularios y APIs.
- **Autenticación** vía Supabase, con opción de Google.

### ¿Funciona en el celular?

Sí. Es una PWA instalable (sección 17), pensada para el trabajo en campo: cámara con GPS, evidencia con marca de agua y acceso por token para los obreros sin necesidad de cuenta.

---

*Seiricon — Construye con control, entrega con confianza.*
