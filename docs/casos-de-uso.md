# Casos de uso por rol y módulo

## 🔴 Super Admin
- **CU-SA-01** `/super-admin` — Vista global del sistema (read-only)
- **CU-SA-02** `/super-admin/constructoras[/id|/nueva]` — CRUD constructoras (cascada al eliminar)
- **CU-SA-03** `/super-admin/admins-generales` — Asignar Admin General + email con password temporal
- **CU-SA-04** `/super-admin/obreros` 🆕 — Ranking global con datos sensibles (cédula, EPS, ARL) y filtros por constructora/especialidad
- **CU-SA-05** `/super-admin/contratistas` 🆕 — Ranking global con score gauge
- **CU-SA-06** `/super-admin/proyectos[/id]` — Lista cross-tenant + detalle con equipo
- **CU-SA-07** `/super-admin/roles` — Roles agrupados por constructora, edición inline

## 🟠 Admin General
- **CU-AG-01** `/dashboard` — Stats de SU constructora
- **CU-AG-02** `/dashboard/proyectos/nuevo` — Wizard 3 pasos (número de registro y contratista por defecto obligatorios)
- **CU-AG-03** `/dashboard/proyectos/[id]` — Editar proyecto (con audit log y password reconfirm)
- **CU-AG-04** `/dashboard/proyectos/[id]/equipo` — Asignar Admin Juniors al proyecto
- **CU-AG-05** `/dashboard/usuarios` — Invitar usuarios
- **CU-AG-06** `/dashboard/sugerencias` — Aprobar tareas sugeridas por contratistas
- **CU-AG-07** `/dashboard/reportes` — Exportes Excel/PDF

## 🟡 Admin Junior
- Mismo `/dashboard` pero filtrado: solo proyectos asignados vía `AdminProyectoAccess`
- Sidebar omite Empresa, Configuración
- Solo invita Contratistas/Obreros

## 🟣 Directivo
- **CU-DI-01** `/directivo` — Vista ejecutiva (KPIs, semáforo)
- **CU-DI-02** `/directivo/proyecto/[id]` — Detalle por proyecto

## 🟢 Contratista
- **CU-CT-01** `/contratista` — Mis tareas
- **CU-CT-02** `/contratista/tarea/[id]` — Reportar (2+ fotos)
- **CU-CT-03** `/contratista/sugerir` — Proponer tarea nueva
- **CU-CT-04** `/contratista/obreros` — Registrar obreros (cédula, tel, especialidad, EPS, ARL **obligatorios**)
- **CU-CT-05** `/contratista/historial` — Mi histórico

## 🔵 Obrero (token-based)
- **CU-OB-01** `/o/{token}` — Mis tareas (sin login)
- **CU-OB-02** `/o/{token}/tarea/[id]` — Reportar con foto + GPS

## 👤 Perfil personal (todos los autenticados)
- **CU-PF-01** `/dashboard/perfil` 🆕 — Edita tu nombre. Email/rol/constructora son administrativos (no editables).

## Convenciones del producto
- Mutaciones siempre por `/api/.../route.ts` con validación + log de error real
- Layouts redirigen por rol; páginas hacen segundo guard
- Número de registro = badge mono azul
- Campos `*` rojo bloquean submit
