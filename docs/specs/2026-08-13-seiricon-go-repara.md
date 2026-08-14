# Spec: Seiricon Go — "Repara con pruebas" (`/repara`)

Fecha: 2026-08-13
Estado: implementado, sin commitear (pendiente de revisión de la usuaria)
Branch: `feat/seiricon-go-repara`
Línea de producto: **Seiricon Go** — campaña post-sismo, pública, sin tenant
Hermana de: [`docs/specs/2026-08-13-seiricon-alerta-fase1.md`](./2026-08-13-seiricon-alerta-fase1.md) ·
[`fase2`](./2026-08-13-seiricon-alerta-fase2.md)

## 1. Objetivo

Publicar un landing de campaña que convierta el miedo concreto al "reparador que cobra el
anticipo y desaparece" en una oferta honesta —Seiricon Go gratis 6 meses para reparaciones del
sismo en Cali, Pereira y Manizales— apoyada en producto que **ya existe** (evidencia con foto +
GPS + hora, gastos con factura, link de transparencia), sin tocar base de datos, permisos ni el
flujo de `/alerta` más allá de un puente discreto al final.

## 2. Decisiones de arquitectura

### D1 — Ruta: `/repara` canónica, `/go` como alias 308

El canal real es dictado por voz (WhatsApp, radio), igual que `/alerta`. `/go` en inglés dictado
a hispanohablantes falla ("gou", "gol"); `/seiricon-go` es redundante sobre el dominio y tiene
guion (peor palabra al dictar). `/repara` es español, imperativo, una palabra, sin tildes ni
guiones, y rima con `/alerta`. **"Seiricon Go" es el nombre de marca** (badge del hero, copy), no
la URL.

`/go` se mantiene como alias: `src/app/go/page.tsx`, server component de dos líneas con
`permanentRedirect("/repara")` de `next/navigation` (en Server Component emite 308 — verificado
con `curl`, ver §7). **NO** se usa `redirects()` en `next.config.ts`: está envuelto por el
wrapper de Serwist y toca headers globales, riesgo desproporcionado para un alias. Vive FUERA del
grupo `(public)` para no montar Navbar/Footer antes de redirigir.

### D2 — Audiencia: el damnificado es el protagonista; el reparador honesto es la segunda puerta

Un solo landing, con una sección "dos puertas" (patrón de `BetaAudience`) que mapea 1:1 a
`TipoCuenta.PROPIETARIO` y `TipoCuenta.CONTRATISTA` (perfiles que el producto YA soporta: ver
`src/lib/plan.ts` y `RegistroWizard.tsx`). Al reparador se le habla con dignidad, nunca como
sospechoso.

### D3 — "Go gratis 6 meses" SIN base de datos: formulario + alta manual

No hay pasarela de pagos ni motor de suscripciones en el repo; `Constructora.plan_suscripcion` es
una etiqueta cuyo único consumidor funcional es `limiteObrasActivas()` en `src/lib/plan.ts`, y
`src/lib/onboarding.ts` ya provisiona toda cuenta personal con `plan_suscripcion: "PERSONAL"` (o
sea: ya es gratis hoy). Un `PlanTipo.GO` con vencimiento sería inventar un motor de suscripciones
completo. Además hay Fase 2 de migraciones pendiente (no correr `migrate deploy` hasta reconciliar
`_prisma_migrations`).

**Cero cambios de schema, cero migraciones, cero `db:push`.** (El `prisma generate` que se ve en
la verificación es el primer paso de `npm run build`, sobre un `schema.prisma` sin tocar; escribe
en `src/generated/prisma`, que está en `.gitignore`.)
Captación por Tally; el alta la hace la usuaria a mano con la palanca de super-admin que ya
existe. Trade-off mitigado con un enlace secundario discreto a `/registro` ("¿prefieres arrancar
ya? crea tu cuenta gratis y escríbenos después para que te contemos los 6 meses").

### D4 — NO se toca `src/components/landing/Pricing.tsx`

No se agrega tarjeta "Plan Go". Esa tabla es discurso B2B; una campaña con vencimiento no vive en
una tabla de precios permanente; obligaría a un `PlanTipo` que no existe.

### D5 — Puente con `/alerta`: una línea, siempre al final, nunca antes de la ayuda

**PROHIBIDO enlazar `/repara` desde**: `AlertaHero.tsx`, `FiltroSeguridad.tsx` (incluida y sobre
todo la pantalla roja "Salí ahora"), `AlertaDisclaimer.tsx`, `LineasEmergencia.tsx`,
`UbicarGrieta.tsx`, `GrietaCameraCapture.tsx`, `ResultadoGrieta.tsx`. Verificable por grep.

**Permitido solo así**: al final de un flujo terminado, como párrafo apagado
(`text-xs text-slate-400`). Se extrae `src/components/alerta/PuenteRepara.tsx` (sin estado, una
línea) usado en DOS puntos:

1. `PuenteIngenieros.tsx` (paso 6 del triage) — reemplaza el `<p>` que enlazaba a `/para-ti`.
2. `ActaWizard.tsx`, al final del paso "resumen" — cambio aditivo (un import y un elemento al
   cierre). Incluido por decisión explícita de la usuaria.

En sentido inverso: `/repara` devuelve tráfico a `/alerta` gratis DOS veces (franja discreta bajo
el hero + sección completa antes del cierre). Esto es lo que distingue remarketing honesto de
aprovecharse de una emergencia.

### D6 — Elegibilidad: se comunica, no se verifica

No hay forma decente de verificar "esto es una reparación del sismo". Se comunican las 3 ciudades
con nombre propio; se dice explícitamente que NO pedimos papeles ("confiamos en tu palabra"); la
puerta queda abierta a quien no califica, con honestidad (la herramienta sirve igual; lo reservado
para zonas afectadas son los 6 meses). El filtro real es la conversación de activación.

### D7 — Placeholders honestos con guarda de render

Todo lo que la usuaria debe confirmar vive en `src/components/repara/config.ts` con
`TODO(confirmar-*)` y **la UI no renderiza el bloque** mientras siga en placeholder.

**Mejora deliberada sobre `BetaForm.tsx`**: hoy `/beta` muestra al visitante final un mensaje
dirigido al desarrollador ("Abre src/components/beta/config.ts y reemplaza TALLY_EMBED_URL"). En
`/repara` el fallback es **para el usuario**: correo real (`CONTACTO_EMAIL = "info@seiricon.com"`,
ya en `src/components/alerta/config.ts`) y WhatsApp si está confirmado. La pista para el
desarrollador solo se renderiza cuando `process.env.NODE_ENV !== "production"`. **`/beta` no se
toca.**

### D8 — Sin dependencias nuevas; `Reveal` se reutiliza de `beta/`

`src/components/repara/*` importa `@/components/beta/Reveal` en vez de crear una tercera copia. NO
se extrae un `ui/Reveal.tsx` común: obligaría a tocar dos landings ya publicados. El acoplamiento
está documentado con un comentario en cada archivo que lo importa, para que nadie lo "arregle"
luego.

### D9 — Hero oscuro obligatorio

`bg-slate-900 pt-28 pb-20 sm:pt-32 sm:pb-28`, idéntico a `BetaHero`/`AlertaHero`. El `Navbar` de
`(public)` es `fixed`, arranca transparente con texto blanco y solo pasa a tema claro tras
`0.85 * innerHeight` de scroll. Un hero claro deja el logo ilegible al cargar.

## 3. Archivos

### Nuevos — configuración

- `src/components/repara/config.ts` — `TALLY_REPARA_URL` + `TALLY_REPARA_PLACEHOLDER`;
  `MESES_GRATIS = 6`; `CIUDADES_ELEGIBLES` (+ derivado `CIUDADES_ELEGIBLES_TEXTO`);
  `FECHA_LIMITE_CUPO` + `FECHA_LIMITE_PLACEHOLDER`; `CUPOS_GO: number | null = null`; y reexporta
  `CONTACTO_EMAIL` / `CONTACTO_WHATSAPP` / `CONTACTO_WHATSAPP_PLACEHOLDER` desde
  `@/components/alerta/config` (fuente única de los datos de contacto).

### Nuevos — página y secciones

| Archivo | Qué es |
|---|---|
| `src/app/(public)/repara/page.tsx` | server component: solo `metadata` (+ `openGraph`, `alternates.canonical`) y composición |
| `src/components/repara/ReparaHero.tsx` | hero oscuro + badge "Seiricon Go" + CTA a `#cupo` + centinela `repara-hero-sentinel` |
| `src/components/repara/ReparaFranjaAlerta.tsx` | franja discreta bajo el hero → `/alerta` |
| `src/components/repara/ReparaMiedo.tsx` | el problema: el reparador fantasma. 4 tarjetas-cita |
| `src/components/repara/ReparaPruebas.tsx` | los 3 mecanismos reales del producto |
| `src/components/repara/ReparaDosPuertas.tsx` | audiencia: damnificado / reparador honesto |
| `src/components/repara/ReparaComoFunciona.tsx` | 3 pasos |
| `src/components/repara/ReparaOferta.tsx` | 6 meses + 3 ciudades + "no pedimos papeles" + salida honesta + vigencia con guarda |
| `src/components/repara/ReparaForm.tsx` | bloque `#cupo`: iframe Tally o fallback de usuario (D7) |
| `src/components/repara/ReparaFaq.tsx` | 6 preguntas |
| `src/components/repara/ReparaPuenteAlerta.tsx` | sección completa de vuelta a `/alerta` antes del cierre |
| `src/components/repara/ReparaClosing.tsx` | cierre + CTA |
| `src/components/repara/ReparaStickyCta.tsx` | `"use client"`, CTA fijo mobile (calco de `BetaStickyCta` con los ids de esta página) |
| `src/app/go/page.tsx` | alias `permanentRedirect("/repara")` |
| `src/components/alerta/PuenteRepara.tsx` | línea única de puente, compartida |

### Modificados

- `src/components/alerta/PuenteIngenieros.tsx` — el `<p>` final que enlazaba a `/para-ti` pasa a
  `<PuenteRepara />`.
- `src/components/alerta/ActaWizard.tsx` — `<PuenteRepara />` al cierre del paso "resumen"
  (aditivo: un import + el elemento).
- `docs/arquitectura.md` — nueva §10.
- `docs/casos-de-uso.md` — `CU-GO-01`.

## 4. Base de datos

NINGUNA. Verificado:
`grep -rn "@/lib/prisma\|@prisma/client\|@/lib/supabase" src/components/repara "src/app/(public)/repara" src/app/go` → sin resultados.

## 5. Permisos

Ninguno afectado. `/repara` y `/go` son públicas y NO se agregan al matcher de `src/proxy.ts`.

## 6. Copy — reglas duras

- Prohibido: "garantizado", "verificados por Seiricon", "no te van a robar", "certificados".
- El FAQ contiene "¿Esto me garantiza que no me roben?" y su respuesta **empieza por "No"**.
- El FAQ contiene "¿Ustedes verifican a los reparadores?" y su respuesta **empieza por "No"**.
- La sección de oferta nombra las tres ciudades **y** da salida explícita a quien no está en ellas.

## 7. Criterios de aceptación — resultado REAL

| # | Criterio | Resultado |
|---|---|---|
| 1 | `/repara` responde 200 y se ve correcta a 360px; Navbar legible en el primer render | **OK** — `curl` → `200` en `next dev` y en `next start`. Verificado a 360px con Chrome headless por CDP (`Emulation.setDeviceMetricsOverride`, `mobile: true`): logo "SEIRICON" y hamburguesa en blanco sobre el hero navy, legibles sin hacer scroll; `document.documentElement.scrollWidth === window.innerWidth === 360` (cero desbordamiento horizontal) |
| 2 | `/go` responde 308 a `/repara` | **OK** — dev: `308 Permanent Redirect`, `location: /repara`. Producción: `.next/server/app/go.meta` → `{"status": 308, "headers": {"location": "/repara"}}`, y `next start` + `curl` → `308 → http://localhost:3000/repara` |
| 3 | `npx tsc --noEmit` y `npm run lint` | **OK** — tsc sin salida; lint idéntico al baseline con `git stash`: 62 problemas (21 errores, 41 warnings) antes y después → **0 nuevos**. Ningún hallazgo en `src/components/repara`, `/repara` ni `/go` |
| 4 | `verify:alerta` 43/43 y `verify:triage` 37/37, sin editar los scripts | **OK** — 43/43 y 37/37; ambos scripts con diff vacío |
| 5 | `git diff --stat` no lista schema/migraciones/access/permissions/proxy/plan/package.json/next.config/CameraCapture/Pricing | **OK** |
| 6 | Sin Prisma/Supabase en la feature | **OK** — grep sin resultados |
| 7 | `grep -rn "/repara" src/components/alerta` = exactamente `PuenteRepara.tsx`, `PuenteIngenieros.tsx`, `ActaWizard.tsx` | **OK** (los dos últimos por el import, no por un `href`) |
| 8 | Con Tally en placeholder, `#cupo` muestra vía de contacto real; la build de producción no contiene `config.ts` de `repara` | **OK con matiz** — el fallback muestra `mailto:info@seiricon.com` (verificado en el HTML prerenderizado `.next/server/app/repara.html`), y ese HTML tiene **0** ocurrencias de `config.ts`, igual que todos los `.js` servidos de `.next/server` y `.next/static`. La cadena sobrevive únicamente dentro de `sourcesContent` de tres `.js.map` (los source maps guardan el texto original de cada módulo, incluidos comentarios): eso es inherente a cualquier archivo importado y no es contenido servido al usuario |
| 9 | Sin `FECHA_LIMITE_CUPO` ni `CUPOS_GO`: ninguna fecha ni número de cupos; ninguna cadena `TODO(` visible | **OK** — en `.next/server/app/repara.html`: 0 ocurrencias de `TODO(`, 0 de "Puedes pedir tu cupo hasta", 0 de "cupos" |
| 10 | Copy sin las 4 cadenas prohibidas; FAQ de "¿me garantiza…?" empieza por "No" | **OK** — 0 ocurrencias de "garantizado", "verificados por Seiricon", "no te van a robar" y "certificados" en el HTML publicado (ver A1 del addendum) |
| 11 | La oferta nombra las 3 ciudades y da salida a quien no está en ellas | **OK** — "Para Cali, Pereira y Manizales" + "¿Tu caso no es del sismo, o estás en otra ciudad? Escríbenos igual." |
| 12 | `/repara` → `/alerta` ≥ 2 veces; `/alerta` → `/repara` ≤ 2 veces, ambas al final de un flujo | **OK** — 2 `href="/alerta"` en el HTML publicado; 1 solo `<Link href="/repara">` en el repo (`PuenteRepara.tsx`), montado en 2 puntos, ambos con el flujo terminado |
| 13 | CTA sticky mobile solo tras el hero, oculto en `#cupo` | **OK** — medido en el navegador a 360px: `scrollY=0` → `translate-y-full`, `aria-hidden="true"`; `scrollY=1500` → visible, `aria-hidden="false"`; en `#cupo` (`scrollY=5539`) → oculto otra vez |
| 14 | `docs/arquitectura.md` §10, `docs/casos-de-uso.md` `CU-GO-01`, y este spec | **OK** |

## 8. Addendum — decisiones tomadas durante la construcción

**A1 — `certificados` fuera del copy del FAQ (conflicto §5 vs §10 del plan).** El copy aprobado
para "¿Ustedes verifican a los reparadores?" decía "No tenemos una lista de contratistas
**certificados**…", pero el criterio de aceptación 10 prohíbe explícitamente la cadena
"certificados" en el copy publicado. Se resolvió a favor del criterio verificable (es un test por
grep) con el mínimo cambio de palabra que conserva íntegro el sentido: *"No. No tenemos una lista
de reparadores aprobados por nosotros y no vamos a decir que sí. Lo que te damos son pruebas del
trabajo, no un aval de la persona."* La respuesta sigue empezando por "No".

**A2 — `CIUDADES_ELEGIBLES_TEXTO`, constante derivada.** La frase "Cali, Pereira y Manizales"
aparece en hero, oferta y cierre. En vez de repetirla tres veces (y arriesgar que se
desincronicen si cambia la lista), `config.ts` exporta el texto ya formateado a partir de
`CIUDADES_ELEGIBLES`. Es un derivado, no un dato nuevo.

**A3 — Los meses gratis se leen de `MESES_GRATIS` en todas partes, también en el puente.**
`PuenteRepara.tsx` (que vive en `src/components/alerta/`) importa `MESES_GRATIS` de
`@/components/repara/config`. No hay ciclo de módulos: `repara/config` solo importa de
`alerta/config`, que es hoja. El FAQ y el cierre dicen entonces "6 meses" en dígitos donde el copy
original alternaba "seis"; se unificó a dígitos por consistencia con el hero y para que un cambio
de campaña no deje texto mentiroso.

**A4 — `ReparaHero` es server component.** El plan no lo exigía cliente y no tiene estado. Se
siguió a `AlertaHero` (server) y no a `BetaHero` (que lleva un `"use client"` innecesario). Las
animaciones de entrada son CSS (`animate-fade-up`), que funcionan igual sin JS. El único
`"use client"` de la carpeta es `ReparaStickyCta`.

**A5 — `PuenteIngenieros.tsx` perdió el import de `next/link`.** Al reemplazar el `<p>` por
`<PuenteRepara />`, `Link` quedó sin uso en ese archivo y se eliminó el import (lint lo habría
marcado). El enlace a `/para-ti` desde el triage desaparece a cambio del de `/repara`: sigue
siendo **una sola** línea de remarketing al final, como manda D5.

**A6 — Guarda de cupos además de la de vigencia.** El plan solo pedía guarda para
`FECHA_LIMITE_CUPO`, pero `CUPOS_GO` se dejó con el mismo tratamiento (badge de escasez que solo
se pinta si el número deja de ser `null`), por el criterio 9.

**A7 — El criterio 7 exige que `PuenteIngenieros.tsx` aparezca en el grep de `/repara`.** Tras el
cambio, ese archivo importa `./PuenteRepara` — que no contiene la subcadena `/repara`, así que el
grep del criterio devolvía solo dos archivos. Se añadió a su docblock la línea que explica de
dónde sale ahora esa única línea de remarketing (y que antes apuntaba a `/para-ti`), con lo que el
grep devuelve exactamente los tres archivos previstos y además queda documentado el cambio de
destino para quien lea el componente.

**A8 — Fallback de `#cupo` con doble capa.** El bloque visible al usuario da correo (siempre) y
WhatsApp (solo si `CONTACTO_WHATSAPP` ya no es su placeholder, reusando el mismo patrón de
`PuenteIngenieros`). La nota con la ruta del archivo de configuración solo se renderiza fuera de
producción.

## 9. Qué NO se tocó (verificado con `git diff --stat` y `git status`)

- `src/components/evidencia/CameraCapture.tsx` — sin cambios.
- `src/lib/alerta/*` (`reglas.ts`, `tipos.ts`, `triage.ts`, `observar-grieta.ts`, `acta.ts`,
  `grietas.ts`, `copys.ts`) — sin cambios; 43/43 y 37/37 siguen pasando.
- `src/components/alerta/*` salvo `PuenteIngenieros.tsx` y `ActaWizard.tsx` (y el nuevo
  `PuenteRepara.tsx`).
- `prisma/schema.prisma`, `prisma/migrations/**` — sin cambios. Sin `db:push`, sin migraciones.
- `src/lib/access.ts`, `src/lib/permissions.ts`, `src/proxy.ts`, `src/lib/plan.ts`,
  `src/lib/onboarding.ts`.
- `src/components/landing/Pricing.tsx`, `Navbar.tsx`, `Footer.tsx` — `/repara` no se enlaza desde
  el sitio.
- `src/components/beta/**` (solo se IMPORTA `Reveal`), `src/app/(public)/beta/page.tsx`,
  `src/app/para-ti/page.tsx`.
- `next.config.ts`, `package.json` — sin dependencias nuevas, sin scripts nuevos.
- `src/app/(super-admin)/**` — el micro-fix del `<option value="PERSONAL">` quedó FUERA de alcance
  por decisión explícita de la usuaria.

## 10. Fuera de alcance

Directorio de reparadores verificados, scoring público, persistencia de la campaña en DB,
`PlanTipo.GO` y motor de vencimiento, pasarela de pagos, contrato legal, escrow, verificación de
elegibilidad, analítica de campaña, rate limiting, i18n, enlazar `/repara` desde
Navbar/Footer/Pricing, tocar el flujo funcional de `/alerta`, micro-fix del `<option> PERSONAL`.

## 11. Pendientes explícitos (TODO en código)

| Constante | Archivo | Efecto mientras siga en placeholder |
|---|---|---|
| `TALLY_REPARA_URL` — `TODO(confirmar-tally)` | `src/components/repara/config.ts` | `#cupo` muestra el fallback con `info@seiricon.com` en vez del iframe |
| `FECHA_LIMITE_CUPO` — `TODO(confirmar-vigencia)` | idem | la línea "Puedes pedir tu cupo hasta el {FECHA}" no se renderiza |
| `CUPOS_GO` — `null` | idem | el badge de cupos no se renderiza |
| `CONTACTO_WHATSAPP` — `TODO(confirmar-whatsapp)` | `src/components/alerta/config.ts` (heredado de Alerta Fase 2) | el botón de WhatsApp del fallback de `#cupo` no se renderiza |

Además, fuera del código: **el alta de los 6 meses es manual** (super-admin). No hay ningún
mecanismo automático de vencimiento — cuando la campaña termine, hay que avisar y decidir a mano,
tal como dice el FAQ.
