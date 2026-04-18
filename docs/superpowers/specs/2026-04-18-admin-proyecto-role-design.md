# Rol Admin Proyecto — Nivel de Acceso con Alcance por Proyecto

**Fecha:** 2026-04-18
**Estado:** Draft

---

## 1. Contexto

La plataforma hoy tiene 4 niveles de acceso (`NivelAcceso`): DIRECTIVO, ADMINISTRADOR, CONTRATISTA, OBRERO. El ADMINISTRADOR tiene control total sobre todo lo de la constructora (todos los proyectos, configuracion, usuarios, roles).

Necesitamos distinguir entre:
- Un administrador con poder total sobre la constructora (lo que ya existe)
- Un administrador con poder solo sobre uno o varios proyectos especificos

Esto permite delegar la operacion diaria de un proyecto a una persona sin darle acceso a los demas proyectos ni a la configuracion de la empresa. Ejemplo: Constructora Melendez tiene los proyectos "Safiro" y "Rosa". El Admin General asigna a Maria como Admin Proyecto de Safiro y a Carlos como Admin Proyecto de Rosa. Ninguno de los dos ve el proyecto del otro, ni puede modificar configuracion de la constructora.

**Archivos principales afectados:**
- `prisma/schema.prisma` — agregar nuevo valor al enum + nueva tabla de asignaciones
- `src/lib/permissions.ts` — agregar permisos del nuevo rol
- `src/lib/tenant.ts` o helper equivalente — agregar scoping por proyecto
- `src/app/api/usuarios/route.ts` + `src/app/api/usuarios/[id]/route.ts` — flujo de invitacion con proyectos
- `src/app/api/roles/route.ts` — permitir el nuevo nivel
- ~20 API routes — agregar filtro por proyectos asignados donde aplique
- Paginas del dashboard — filtrar listas por proyectos asignados
- Sidebar — ocultar opciones globales
- `src/lib/data.ts` — incluir asignaciones en `getUsuarioActual()`

---

## 2. Cambios

### 2.1 Schema de Prisma

**Enum `NivelAcceso`:** renombrar `ADMINISTRADOR` a `ADMIN_GENERAL` y agregar `ADMIN_PROYECTO`.

```prisma
enum NivelAcceso {
  DIRECTIVO
  ADMIN_GENERAL      // antes ADMINISTRADOR — control total de la constructora
  ADMIN_PROYECTO     // nuevo — control sobre proyectos asignados
  CONTRATISTA
  OBRERO
}
```

**Nueva tabla `AdminProyectoAccess`:** asociacion many-to-many entre usuarios (con rol Admin Proyecto) y proyectos.

```prisma
model AdminProyectoAccess {
  id           String   @id @default(cuid())
  usuario_id   String
  proyecto_id  String
  asignado_por String?  // id del usuario que lo asigno (Admin General o Directivo)
  created_at   DateTime @default(now())

  usuario      Usuario  @relation("AdminProyectoAccessUsuario", fields: [usuario_id], references: [id], onDelete: Cascade)
  proyecto     Proyecto @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  asignador    Usuario? @relation("AdminProyectoAccessAsignador", fields: [asignado_por], references: [id])

  @@unique([usuario_id, proyecto_id])
  @@map("admin_proyecto_access")
}
```

**Relaciones agregadas en `Usuario`:**
```prisma
proyectos_administrados  AdminProyectoAccess[] @relation("AdminProyectoAccessUsuario")
proyectos_asignados_por  AdminProyectoAccess[] @relation("AdminProyectoAccessAsignador")
```

**Relacion agregada en `Proyecto`:**
```prisma
admins_proyecto  AdminProyectoAccess[]
```

**Migracion de datos existentes:** Los valores del enum en la DB se manejan con una migracion SQL:
1. Alterar el enum: renombrar `ADMINISTRADOR` a `ADMIN_GENERAL` y agregar `ADMIN_PROYECTO`.
2. No se necesita migracion de filas porque todos los ADMINISTRADOR existentes pasan a ser ADMIN_GENERAL (mismo poder).

Nota: PostgreSQL permite renombrar valores de enum con `ALTER TYPE ... RENAME VALUE`. La migracion de Prisma se escribe manualmente.

### 2.2 Permisos (`src/lib/permissions.ts`)

Se agrega un case para ADMIN_PROYECTO. Los permisos son intencionalmente amplios dentro del proyecto pero con UI filtrada por proyectos asignados.

Tambien se renombra `ADMINISTRADOR` a `ADMIN_GENERAL` en el switch.

```typescript
case "ADMIN_PROYECTO":
  return {
    canCreate: true,          // puede crear dentro de sus proyectos
    canEdit: true,
    canDelete: true,          // puede borrar dentro de sus proyectos
    canApprove: true,
    canInviteUsers: true,     // pero limitado a roles Contratista/Obrero
    canViewAllProjects: false,// solo ve sus proyectos asignados
    canViewAllTasks: false,   // solo tareas de sus proyectos
    canViewReports: true,     // reportes filtrados a sus proyectos
    canViewConfig: false,     // NO puede ver configuracion de constructora
    canViewContractors: true, // ve contratistas de la constructora (para asignar)
    canViewUsers: true,       // ve usuarios pero limitado
    sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios"],
  };
```

### 2.3 Helper de scoping por proyecto

Se crea (o extiende) un helper que devuelve los IDs de proyectos accesibles para el usuario actual. Este helper se usa en TODAS las API routes y queries que listan/filtran datos por proyecto.

Nueva funcion en `src/lib/access.ts` (o extender tenant.ts):

```typescript
export async function getAccessibleProjectIds(
  usuarioId: string,
  constructoraId: string,
  nivelAcceso: NivelAcceso,
): Promise<string[] | "ALL"> {
  // DIRECTIVO, ADMIN_GENERAL ven todos los proyectos de la constructora
  if (nivelAcceso === "DIRECTIVO" || nivelAcceso === "ADMIN_GENERAL") {
    return "ALL";
  }

  // ADMIN_PROYECTO ve solo sus proyectos asignados
  if (nivelAcceso === "ADMIN_PROYECTO") {
    const accesos = await prisma.adminProyectoAccess.findMany({
      where: { usuario_id: usuarioId },
      select: { proyecto_id: true },
    });
    return accesos.map((a) => a.proyecto_id);
  }

  // CONTRATISTA ve proyectos donde tiene tareas asignadas (logica existente)
  if (nivelAcceso === "CONTRATISTA") {
    const proyectos = await prisma.proyecto.findMany({
      where: {
        constructora_id: constructoraId,
        edificios: {
          some: {
            pisos: {
              some: {
                unidades: {
                  some: {
                    espacios: {
                      some: {
                        tareas: { some: { asignado_a: usuarioId } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return proyectos.map((p) => p.id);
  }

  // OBRERO: no aplica a este helper (acceso por token)
  return [];
}

export function buildProjectWhereFilter(
  accessibleProjectIds: string[] | "ALL",
): object {
  if (accessibleProjectIds === "ALL") return {};
  return { id: { in: accessibleProjectIds } };
}
```

**Uso tipico en una API route:**
```typescript
const { usuario } = await requireAuth();
const accessible = await getAccessibleProjectIds(
  usuario.id,
  usuario.constructora_id,
  usuario.rol_ref.nivel_acceso,
);

// Para rutas que listan proyectos:
const proyectos = await prisma.proyecto.findMany({
  where: {
    constructora_id: usuario.constructora_id,
    ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
  },
});

// Para rutas que reciben un proyecto_id especifico:
if (accessible !== "ALL" && !accessible.includes(proyectoId)) {
  return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
}
```

### 2.4 Flujo de invitacion de usuarios

**Endpoint `POST /api/usuarios`** — se extiende el payload:

```typescript
interface InviteUserPayload {
  email: string;
  nombre: string;
  rol_id: string;
  proyectos_asignados?: string[]; // IDs de proyectos, solo requerido si el rol es ADMIN_PROYECTO
}
```

**Validaciones:**
1. Quien invita debe tener permiso:
   - ADMIN_GENERAL o DIRECTIVO: pueden invitar cualquier rol
   - ADMIN_PROYECTO: solo puede invitar Contratista u Obrero; los demas roles son rechazados con 403
2. Si el rol a asignar es ADMIN_PROYECTO: `proyectos_asignados` debe tener al menos 1 ID
3. Si el que invita es ADMIN_PROYECTO: los `proyectos_asignados` que pase deben estar dentro de sus propios proyectos accesibles (para invitar contratistas, por ejemplo)
4. Los proyectos_asignados deben pertenecer a la constructora del invitador

**Logica:** crear el Usuario como hoy + crear los registros en `AdminProyectoAccess` si el rol es ADMIN_PROYECTO.

**Endpoint `PATCH /api/usuarios/[id]`** — extender para cambiar asignaciones de proyectos:

```typescript
interface UpdateUserPayload {
  rol_id?: string;
  proyectos_asignados?: string[]; // reemplaza la lista actual
}
```

Solo ADMIN_GENERAL o DIRECTIVO pueden modificar `proyectos_asignados`. Si se cambia el rol a ADMIN_PROYECTO o desde ADMIN_PROYECTO se hacen los ajustes correspondientes en la tabla.

### 2.5 API routes afectadas por scoping

Se debe agregar validacion de acceso por proyecto en:

**Listas filtradas por proyectos accesibles:**
- `GET /api/proyectos` — filtrar por IDs accesibles
- `GET /api/tareas` — filtrar por proyecto del tarea
- `GET /api/edificios` — filtrar por proyecto
- `GET /api/sugerencias` — filtrar por proyecto de la sugerencia
- `GET /api/contratistas` — NO filtrar (contratistas son a nivel constructora)
- Rutas de reportes (si existen) — filtrar

**Rutas que reciben un ID especifico (validar acceso):**
- `GET/PATCH /api/proyectos/[id]/editar` — validar que `[id]` este en los accesibles
- `POST /api/proyectos/[id]/importar-tareas` — idem
- `GET /api/proyectos/[id]/plantilla` — idem
- `POST /api/tareas` — validar que el proyecto (derivado del espacio_id) este accesible
- `POST /api/tareas/[id]/aprobar` — validar que el proyecto de la tarea este accesible
- `POST /api/tareas/[id]/reportar` — idem
- `POST /api/edificios` — validar el proyecto_id del body
- `POST /api/retrasos` — validar
- `POST /api/extensiones` — validar

**Rutas donde ADMIN_PROYECTO NO tiene acceso (mantener 403):**
- `POST /api/proyectos` — crear proyectos (solo ADMIN_GENERAL; Directivo no crea proyectos hoy)
- `POST /api/roles`, `PATCH /api/roles/[id]`, `DELETE /api/roles/[id]` — gestion de roles
- Configuracion de empresa
- Invitar usuarios con rol distinto a Contratista/Obrero

### 2.6 Paginas del dashboard

**Paginas que filtran proyectos/tareas por accesibles:**
- `/dashboard` — cards de resumen
- `/dashboard/proyectos` — lista
- `/dashboard/proyectos/[id]` — validar acceso al entrar
- `/dashboard/tareas` — lista
- `/dashboard/tareas/[id]` — validar acceso
- `/dashboard/reportes` — filtrado
- `/dashboard/sugerencias` — filtrado

**Paginas bloqueadas para ADMIN_PROYECTO:**
- `/dashboard/configuracion/*` — redirigir a `/dashboard`
- `/dashboard/proyectos/nuevo` — ADMIN_PROYECTO no puede crear proyectos

**Pagina `/dashboard/usuarios`:**
- ADMIN_PROYECTO ve la pagina pero solo puede invitar contratistas/obreros. El modal de invitacion esconde los demas roles.
- Solo ve los usuarios que invito ese admin proyecto? No — ve todos los usuarios de la constructora pero sin poder editarlos (solo a los que el mismo invito). Simplificacion: muestra todos pero el boton de editar solo funciona para los que tiene permiso (los que el mismo invito o los que son Contratista/Obrero dentro de sus proyectos). Para no complicar v1: muestra todos en modo lectura, con boton de invitar limitado a Contratista/Obrero.

### 2.7 Sidebar y UI

El sidebar ya usa `getPermissions(nivelAcceso).sidebarItems`. Con el nuevo case para ADMIN_PROYECTO se oculta automaticamente "configuracion".

**Badge de rol:** en el sidebar hoy muestra "Administrador" debajo del nombre. Para ADMIN_GENERAL sigue siendo "Administrador". Para ADMIN_PROYECTO muestra "Admin Proyecto". (El `rol.nombre` es custom por constructora, asi que ya soporta esto — solo hay que ajustar los roles por defecto al crear una constructora nueva.)

**Roles por defecto (`es_default: true`)** — hay que agregar un rol default "Admin Proyecto" al seed/onboarding de constructora nueva, junto con los existentes.

### 2.8 Selector de proyectos en el modal de invitacion

En `InviteUserModal.tsx` (cuando se selecciona un rol con nivel_acceso = ADMIN_PROYECTO):
- Aparece un multi-select con los proyectos de la constructora
- Es obligatorio seleccionar al menos uno
- El form valida antes de enviar

En la pagina de edicion de usuario (si existe, o se agrega): el mismo multi-select se muestra para usuarios ADMIN_PROYECTO, con la lista actual precargada.

### 2.9 Renombrado de referencias "ADMINISTRADOR" en codigo

Todas las referencias hardcoded a `"ADMINISTRADOR"` en el codigo se cambian. Para mantener compatibilidad durante la transicion y reducir errores:

**Opcion A (preferida):** crear un helper `isGeneralAdmin(nivel)` que retorna `nivel === "ADMIN_GENERAL"`. Reemplazar todas las comparaciones con este helper. Similarmente `isAnyAdmin(nivel)` para cuando queremos ambos admin_general y admin_proyecto.

```typescript
export function isGeneralAdmin(nivel: NivelAcceso): boolean {
  return nivel === "ADMIN_GENERAL";
}

export function isAnyAdmin(nivel: NivelAcceso): boolean {
  return nivel === "ADMIN_GENERAL" || nivel === "ADMIN_PROYECTO";
}

export function canManageUsers(nivel: NivelAcceso): boolean {
  return nivel === "ADMIN_GENERAL" || nivel === "DIRECTIVO";
}
```

Esto centraliza la logica y facilita cambios futuros.

**Rutas concretas que cambian** — reemplazar `"ADMINISTRADOR"` con el helper apropiado:
- `POST /api/usuarios` — usar `canManageUsers`
- `GET /api/usuarios` — usar `canManageUsers`
- `PATCH /api/usuarios/[id]` — usar `canManageUsers`
- `POST /api/roles` — usar `isGeneralAdmin`
- `PATCH /api/roles/[id]` — usar `isGeneralAdmin`
- `DELETE /api/roles/[id]` — usar `isGeneralAdmin`
- `POST /api/proyectos` — usar `isGeneralAdmin` (crear proyectos sigue siendo solo Admin General)
- `PATCH /api/proyectos/[id]/editar` — usar `isAnyAdmin` + validar proyecto accesible
- `POST /api/tareas/[id]/aprobar` — aprobar: usar `isAnyAdmin` o incluir DIRECTIVO; validar proyecto
- `POST /api/contratistas` (recalcular score) — usar `isAnyAdmin` + DIRECTIVO; validar proyectos
- `POST /api/edificios` — usar `isAnyAdmin` + validar proyecto
- etc.

---

## 3. Edge cases y reglas

1. **ADMIN_PROYECTO sin proyectos asignados:** no deberia existir porque la invitacion requiere al menos 1. Pero si llegara a pasar (se borro el ultimo proyecto, por ejemplo), el usuario no ve nada al entrar. Mostrar un mensaje "No tienes proyectos asignados. Contacta al Admin General." en el dashboard.

2. **Eliminacion de proyecto:** cuando se elimina un proyecto (onDelete: Cascade), los registros de `AdminProyectoAccess` asociados se borran automaticamente. Si un ADMIN_PROYECTO se queda sin proyectos, aplica el caso anterior.

3. **Cambio de rol de un usuario existente:** si un usuario ADMIN_GENERAL se cambia a ADMIN_PROYECTO, al hacer el PATCH se debe incluir `proyectos_asignados`. Si no se incluyen, retornar 400. Al reves (de ADMIN_PROYECTO a otro rol), los registros en `AdminProyectoAccess` se borran.

4. **Admin Proyecto invita Contratista:** el contratista queda a nivel constructora (sin cambios al modelo). El Admin Proyecto puede asignar al contratista a tareas de SUS proyectos. En la lista de contratistas, ve todos los de la constructora (para poder asignar tambien los existentes).

5. **Directivo como asignador:** el Directivo puede asignar/remover proyectos a un Admin Proyecto, aunque el Directivo no pueda invitar otros tipos de usuarios. Es decir, la facultad de "asignar proyectos" y la facultad de "invitar usuarios nuevos" son separadas.

6. **Notificaciones:** cuando se aprueba/rechaza una tarea, se notifica a los ADMIN_GENERAL. Con el nuevo rol, tambien se notifica a los ADMIN_PROYECTO del proyecto correspondiente. Las notificaciones de sugerencias igual.

---

## 4. No hay cambios en

- Modelo de Contratista / Obrero (siguen a nivel constructora)
- Enum `NivelAcceso` mas alla de los dos valores mencionados
- Flujo de login / auth
- Estructura de la tabla `Usuario` (solo nuevas relaciones)

---

## 5. Dependencias

- No se agregan librerias nuevas
- Requiere una migracion de Prisma (con SQL manual para el rename del enum)

---

## 6. Riesgos y consideraciones

- **Rename del enum value:** renombrar `ADMINISTRADOR` a `ADMIN_GENERAL` afecta todo el codigo que hardcodea el string. Si no se centraliza con helpers (opcion A de 2.9), quedan referencias rotas que el compilador de TypeScript detecta (porque el tipo del enum cambia). El build va a fallar hasta que se actualicen todas las referencias — esto es bueno porque forza catchar todo.

- **Tests manuales criticos:**
  1. Crear un usuario Admin Proyecto, asignarle un proyecto, verificar que solo vea ese proyecto
  2. Intentar acceder directamente a la URL de un proyecto no asignado → debe dar 403 o redirigir
  3. Admin Proyecto intenta ir a `/dashboard/configuracion` → redirige
  4. Admin Proyecto invita un Contratista → OK. Intenta invitar un Admin Proyecto → rechazado
  5. Admin General cambia los proyectos asignados de un Admin Proyecto → se reflejan inmediatamente
  6. Directivo asigna un proyecto a un Admin Proyecto → funciona
  7. Admin Proyecto aprueba una tarea de su proyecto → OK. Intenta aprobar una tarea de otro proyecto (via curl/postman) → rechazado

- **Performance:** el filtro `{ id: { in: accessibleIds } }` es O(n) donde n es el numero de proyectos asignados. En la practica son pocos (1-10 por admin), asi que no hay problema.

- **Sidebar para Admin Proyecto:** se le oculta "configuracion". Ve "usuarios" pero con la opcion de invitar limitada. Esto puede confundir — considerar agregar un tooltip "Solo puedes invitar contratistas y obreros".
