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

## 🆘 Seiricon Alerta (público, sin cuenta, sin tenant)
- **CU-AL-01** `/alerta` 🆕 — Filtro de seguridad de 4 preguntas (AIS simplificado). Cualquier
  "sí" corta el flujo a una pantalla "Salí ahora" con líneas de emergencia. Disclaimer
  permanente: no reemplaza a un ingeniero estructural.
- **CU-AL-02** `/alerta/documentar` 🆕 — Acta de daños: datos del inmueble + fotos por espacio
  (fecha/hora/GPS quemados en la imagen) + nota opcional. Genera un PDF (`POST
  /api/alerta/acta-pdf`) y permite enviarlo por correo (`POST /api/alerta/acta-email`). Tope
  de 10 fotos / 8 espacios por acta. Nada se persiste en base de datos.
- **CU-AL-03** `/alerta/grietas` 🆕 — Triage de una o varias grietas (hasta 5 por informe):
  ubicar el elemento (Columna, Viga, "Muro que sostiene la casa", "Muro divisorio", "Techo o
  losa", Piso, "No estoy seguro") → dos fotos guiadas (acercamiento con moneda de $500 COP +
  elemento completo) → resultado en semáforo (rojo/amarillo/verde) con qué hacer y qué no
  hacer → agregar otra grieta o terminar → puente con ingenieros (correo, WhatsApp si está
  configurado, canal oficial de la ciudad). Genera un PDF (`POST
  /api/alerta/informe-grietas-pdf`). Funciona con o sin IA: si `ANTHROPIC_API_KEY` y
  `ALERTA_VISION_ENABLED=true` están configurados, un modelo de visión (Claude, vía REST sin
  SDK) lee las fotos; si no, o si el usuario prefiere describirla él mismo, un formulario
  manual arma la observación — en modo manual el resultado nunca llega a verde. Nada se
  persiste en base de datos. Ver [spec Fase 2](./specs/2026-08-13-seiricon-alerta-fase2.md).

## 🛠️ Seiricon Go (público, campaña de reparaciones post-sismo)
- **CU-GO-01** `/repara` 🆕 — Landing de campaña: Seiricon Go gratis 6 meses para las
  reparaciones del sismo en Cali, Pereira y Manizales. La persona lee el problema (el
  reparador que cobra el anticipo y desaparece), las tres pruebas que ya da el producto
  (foto con fecha/hora/GPS, gastos sustentados con factura, link de transparencia sin
  cuenta), elige su puerta (voy a mandar a arreglar / yo soy el que repara) y pide el cupo
  en el formulario `#cupo`. **No hay alta automática**: la captación es por formulario y el
  super-admin activa la cuenta a mano — cero tablas, cero `PlanTipo` nuevo, cero pasarela.
  La elegibilidad se comunica pero **no se verifica** (no se piden papeles) y quien no
  califica tiene salida explícita. Si el formulario aún no está configurado, la sección
  `#cupo` muestra el correo real de contacto. `/go` es alias 308 de esta ruta. Enlaza dos
  veces a `/alerta` (gratis, sin cuenta). Ver
  [spec](./specs/2026-08-13-seiricon-go-repara.md).

## Convenciones del producto
- Mutaciones siempre por `/api/.../route.ts` con validación + log de error real
- Layouts redirigen por rol; páginas hacen segundo guard
- Número de registro = badge mono azul
- Campos `*` rojo bloquean submit
