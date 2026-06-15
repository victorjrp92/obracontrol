# Spec: Mapa de proyectos + captura de ubicación + borrar evidencia antes de subir

Fecha: 2026-06-11
Estado: aprobado para implementación
Branch base: `main` (ya con el push de Karen — `22c22ac`)

## Contexto

Tres piezas relacionadas. Karen acaba de mergear a `main`: `TipoCuenta` (CONSTRUCTORA/ARQUITECTO/PROPIETARIO), flujo `/empezar`, tour guiado, consentimiento Habeas Data, `storage.ts` con service-role. Este spec se construye **encima** de eso, sin romperlo.

**Decisiones tomadas:**
- Proveedor de mapas: **Mapbox** (50k cargas/mes gratis, sin tarjeta, geocoding incluido)
- Proyectos viejos sin ubicación: **banner** en dashboard que invita a completarla

**Prerequisito del usuario:** crear cuenta gratis en mapbox.com y dar el **public token** (`pk.xxxx`). Va en env como `NEXT_PUBLIC_MAPBOX_TOKEN`.

## No requiere migración

`Proyecto.ubicacion_lat Float?` y `ubicacion_lng Float?` ya existen en el schema (desde el MVP). Ninguna pieza agrega columnas. Evitamos el drift de migraciones que dejó el `db push` de Karen.

---

## PIEZA 3 — Borrar foto/video antes de enviar (primero: rápido, alto impacto)

### Problema
El botón X para borrar una foto en `CameraCapture.tsx` usa `opacity-0 group-hover:opacity-100`. En móvil (touch) no hay hover → el botón es invisible e intocable. El obrero/contratista no puede borrar una foto mala antes de enviar. El video (`VideoCapture.tsx`) ya funciona porque su X siempre es visible.

### Fix
`src/components/evidencia/CameraCapture.tsx`:
- Botón X de cada foto: quitar `opacity-0 group-hover:opacity-100`, dejarlo **siempre visible**
- Tamaño de toque mínimo 44×44px (estándar Apple HIG / Material). Hoy es `w-7 h-7` (~28px) — subir a `w-9 h-9` o agregar padding táctil
- Contraste fuerte: fondo rojo sólido + borde blanco para que se vea sobre cualquier foto
- Opcional: label de texto "Eliminar" debajo del thumbnail en móvil, no solo el ícono
- Confirmación ligera: al tocar X, micro-confirm ("¿Borrar esta foto?") para evitar borrados accidentales con el dedo — evaluar si estorba; si estorba, quitar

### Alcance
Obrero (`ReportarObrero`) y contratista (`ReportarButton`) usan el mismo `CameraCapture` → un solo cambio arregla ambos. Cero backend, cero schema.

### Verificación
Probar en móvil real (o DevTools device mode): tomar 3 fotos, borrar la del medio, confirmar que se va la correcta y quedan 2.

---

## PIEZA 1 — Captura de ubicación al crear proyecto (todos los perfiles)

### Objetivo
Llenar `ubicacion_lat`/`ubicacion_lng` al crear/editar proyecto, en los 3 `tipo_cuenta`. Ubicación **opcional** pero siempre ofrecida.

### Componente nuevo: `LocationPicker`
`src/components/mapa/LocationPicker.tsx` (client). Tres formas de input en un solo widget:

1. **Dirección de texto** → botón "Buscar" → Mapbox Geocoding API (`/geocoding/v5/mapbox.places/{query}.json?country=co`) → muestra resultado + pin en mini-mapa
2. **Pegar de Google Maps** → input acepta:
   - Coordenadas crudas: `4.6097, -74.0817`
   - Link largo: `https://maps.google.com/?q=4.6097,-74.0817`
   - Link corto `maps.app.goo.gl/...` → estos NO tienen coords en la URL; mostrar mensaje "abre el link, copia las coordenadas y pégalas" (no podemos resolver el short link desde el browser por CORS)
   - Parser en `src/lib/geo.ts`: regex para extraer lat/lng de los formatos soportados
3. **Picker manual** → mini-mapa Mapbox interactivo, click cae pin, draggable para ajustar

Output: `{ lat: number, lng: number, direccion?: string } | null`. Botón "Sin ubicación / agregar después" para saltar.

### Helper: `src/lib/geo.ts`
- `parseGoogleMapsInput(text): {lat,lng} | null` — regex de coords y links largos
- `geocodeDireccion(query): Promise<{lat,lng,label}[]>` — llama Mapbox geocoding (server-side route para no exponer token de geocoding, o usar el public token con URL restriction)

### Dónde se integra
- **Wizard de creación** (`src/app/(dashboard)/dashboard/proyectos/nuevo/` — `WizardStep1.tsx`): agregar campo de ubicación en el paso 1 (junto a nombre/fechas)
- **Wizard de edición** (`/proyectos/[id]/editar`): mismo campo, precargado si ya tiene coords
- **Flujo `/empezar`** de Karen (IntentWizard): si crea proyecto ahí, agregar el picker
- **API** `/api/proyectos/wizard/route.ts`: aceptar y persistir `ubicacion_lat`/`ubicacion_lng` (POST crear y PATCH editar)

### Notas técnicas
- El token `NEXT_PUBLIC_MAPBOX_TOKEN` es público por diseño (Mapbox lo permite); restringir por URL en el dashboard de Mapbox a `seiricon.com` y `localhost`
- Geocoding se puede hacer client-side con el public token, pero para no quemar cuota con typos, disparar solo al click de "Buscar", no on-change

---

## PIEZA 2 — Vistas de mapa por rol

### Componente nuevo: `MapaProyectos`
`src/components/mapa/MapaProyectos.tsx` (client). Recibe `proyectos: {id, nombre, lat, lng, estado, avance, tipoCuenta?, constructoraNombre?}[]`. Render:
- Mapbox GL JS con pines por proyecto
- Color del pin por estado/avance:
  - Gris: 0% (por iniciar)
  - Azul: en curso (1–99%)
  - Verde: 100% (terminado)
- Popup al click: nombre, % avance, link al detalle del proyecto
- Cluster automático cuando hay muchos pines cercanos (Mapbox GL soporta nativo)
- Auto-fit bounds a los pines existentes
- Para super admin: el popup además muestra constructora + tipo de cuenta

### Toggle Tabla ↔ Mapa
En cada dashboard donde se lista proyectos, un toggle arriba (botones segmentados). Default: tabla (no romper lo actual). Estado en URL (`?vista=mapa`) para bookmarkable.

### Endpoint: `GET /api/proyectos/mapa`
Devuelve proyectos con coords según rol del usuario:
- **SUPER_ADMIN**: TODOS los proyectos activos de TODA la plataforma (cross-tenant), incluye `constructoraNombre` y `tipoCuenta`
- **DIRECTIVO / ADMIN_GENERAL**: todos los de su `constructora_id`
- **ADMIN_PROYECTO**: solo los de `getAccessibleProjectIds` (asignados)
- Filtra `estado: ACTIVO` por defecto (param `?incluirTerminados=true` opcional)
- Calcula `avance` con la lógica de `calcularProgreso` existente
- Devuelve también `sinUbicacion: count` para el banner

### Dónde se monta el mapa
| Perfil | Ubicación |
|---|---|
| Super Admin | `/super-admin` (dashboard) — sección mapa con TODA la plataforma + toggle en `/super-admin/proyectos` |
| Directivo | dashboard principal `/directivo` |
| Admin General / Junior | dashboard principal `/dashboard` |

### Banner de proyectos sin ubicación
`src/components/mapa/BannerSinUbicacion.tsx`: si `sinUbicacion > 0`, mostrar en el dashboard:
> 📍 Tienes N proyecto(s) sin ubicación. [Completar ubicaciones →]
Link lleva a una lista de esos proyectos con botón "Agregar ubicación" por cada uno (abre el `LocationPicker` en un modal, guarda vía PATCH).

---

## Archivos (resumen)

**Nuevos:**
- `src/lib/geo.ts` — parser + geocoding helper
- `src/components/mapa/LocationPicker.tsx`
- `src/components/mapa/MapaProyectos.tsx`
- `src/components/mapa/BannerSinUbicacion.tsx`
- `src/app/api/proyectos/mapa/route.ts`

**Modificados:**
- `src/components/evidencia/CameraCapture.tsx` (Pieza 3)
- `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep1.tsx` + wizard types/submit
- `src/app/api/proyectos/wizard/route.ts` (aceptar coords en crear/editar)
- `src/app/(dashboard)/dashboard/proyectos/[id]/editar/` (precargar coords)
- `src/app/(dashboard)/empezar/IntentWizard.tsx` (si crea proyecto)
- Dashboards: `/dashboard/page.tsx`, `/directivo/page.tsx`, `/super-admin/page.tsx` (montar mapa + toggle + banner)
- `.env.local` + Vercel: `NEXT_PUBLIC_MAPBOX_TOKEN`

**Dependencia npm nueva:** `mapbox-gl` + `@types/mapbox-gl` (o `react-map-gl` wrapper)

---

## Orden de implementación

1. **Pieza 3** (botón borrar) — sin dependencias, mergeable hoy, lo prueban ya
2. **Pieza 1** (captura ubicación) — requiere token Mapbox + `LocationPicker` + `geo.ts`
3. **Pieza 2** (mapa + banner) — requiere Pieza 1 para tener datos que mostrar

Pieza 3 puede ir en su propio commit/push inmediato. Piezas 1 y 2 juntas en un segundo ciclo.

---

## Verificación final

- `npx tsc --noEmit` 0 errores tras cada pieza
- Pieza 3: borrar foto en móvil real
- Pieza 1: crear proyecto con las 3 formas de ubicación (dirección, pegar coords, picker)
- Pieza 2: login como cada rol y confirmar scope correcto (super admin ve todo, junior solo asignados)
- Banner aparece solo si hay proyectos sin coords

## Riesgos / notas

- **Mapbox token:** público por diseño, restringir por URL en dashboard Mapbox
- **Short links de Google Maps** (`maps.app.goo.gl`) no resolubles desde browser (CORS) — el usuario debe pegar coords, no el short link. Documentar en el placeholder del input.
- **Migración:** ninguna. No tocar schema.
- **Karen:** coordinar para no chocar en dashboards/sidebar si ella sigue trabajando en `ajustes_karen`.
