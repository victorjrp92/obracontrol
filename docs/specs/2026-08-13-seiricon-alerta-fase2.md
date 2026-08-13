# Spec: Seiricon Alerta — Fase 2 (visión + triage de grietas)

Fecha: 2026-08-13
Estado: implementado, sin commitear (pendiente de revisión del usuario)
Branch: `feat/seiricon-alerta-fase1` (misma rama; Fase 1 sin commitear)
Depende de: [`docs/specs/2026-08-13-seiricon-alerta-fase1.md`](./2026-08-13-seiricon-alerta-fase1.md) (implementado, 43/43 en `npm run verify:alerta`)

## 1. Objetivo

Conectar un modelo de visión al motor de reglas ya firmado, y construir el flujo de usuario
de triage de una grieta (ubicar → dos fotos guiadas → resultado → otra grieta o terminar →
puente a ingenieros) sin tocar el motor de reglas, sin persistir nada y de forma que todo
funcione aunque la IA esté apagada.

## 2. Decisión del usuario sobre el kill-switch (ajusta el plan original)

`ALERTA_VISION_ENABLED` **no** arranca en `false` por decisión de producto — el usuario
decidió que la IA quede activa desde el día uno; ella misma pone `ALERTA_VISION_ENABLED=true`
y `ANTHROPIC_API_KEY` en las variables de entorno de producción al desplegar. Esto **no**
cambia el mecanismo del kill-switch en el código: sigue siendo una doble llave
(`ANTHROPIC_API_KEY` presente Y `ALERTA_VISION_ENABLED === "true"`) que degrada a modo manual
si falta cualquiera de las dos — eso es una decisión de seguridad del propio diseño (si no
hay key en dev, debe degradar solo, sin romper nada). Lo único que cambia es que el
kill-switch **no** se documenta como "debe empezar apagado hasta aval de ingeniero": es
simplemente el interruptor operativo normal, y el valor real en producción lo decide el
usuario al desplegar (fuera del alcance de este código).

## 3. Decisiones de arquitectura (y por qué)

### D1 — Proveedor y transporte: REST directo a Anthropic, cero dependencias nuevas

`src/lib/deepseek.ts` ya establece el patrón en este repo: llamada REST con `fetch`, key solo
en `process.env`, timeout con `AbortController`, salida JSON parseada y sanitizada, resultado
como unión discriminada con motivo `"sin_key"`. `src/lib/alerta/observar-grieta.ts` replica
exactamente eso contra `POST https://api.anthropic.com/v1/messages` (header
`anthropic-version: 2023-06-01`), con imágenes como bloques `image` base64.

No se instala `@anthropic-ai/sdk`. Razones: salida estructurada forzada por `tools` +
`tool_choice: { type: "tool", name: "reportar_observacion" }` (el modelo está obligado a
llamar la herramienta con el JSON schema exacto); es un endpoint público sin auth, cada
dependencia nueva es superficie de supply-chain; coherencia con `deepseek.ts` y con R3 de
Fase 1.

Variables de entorno:

- `ANTHROPIC_API_KEY` — misma convención que `RESEND_API_KEY` / `DEEPSEEK_API_KEY`.
- `ALERTA_VISION_MODEL` — override opcional, espejo de `DEEPSEEK_MODEL`. Default hardcodeado:
  `claude-haiku-4-5-20251001` (Claude Haiku 4.5, lanzado oct-2025 — el modelo con visión más
  rápido/económico de la familia Claude vigente al momento de escribir este código, ene-2026).
  **Este ID debe verificarse contra la documentación de Anthropic antes de depender de él en
  producción**: si cambió o dejó de existir, la llamada HTTP falla y el sistema degrada solo a
  modo manual (nunca rompe el flujo). `temperature: 0`, `max_tokens: 700`.
- `ALERTA_VISION_ENABLED` — doble llave junto con la key (ver sección 2 arriba).

Si falta cualquiera de las dos → `{ ok: false, motivo: "sin_key" }`. Nunca lanza, nunca cae a
verde: el cliente pasa a modo manual (D4).

### D2 — El servicio de visión no ve lo que el usuario declaró

El prompt NO recibe el elemento elegido en el Paso 1. Si se lo diéramos, el modelo se ancla y
confirma — se destruye el propósito del contraste. La reconciliación ocurre después, en
TypeScript puro y testeable. Esto es una regla de implementación no negociable, documentada
como comentario de cabecera en `observar-grieta.ts`.

### D3 — El veredicto sigue saliendo solo de `evaluarGrieta()`; la reconciliación se expresa como entrada, no como parche del resultado

`src/lib/alerta/triage.ts` es una capa de reconciliación, explícitamente NO un segundo motor
de reglas. Hace cuatro cosas, en orden:

**T1 — `reconciliarElemento(declarado, observado): { elemento, hubo_discrepancia }`**
Gana el elemento que produzca el semáforo más conservador, según este ranking derivado de leer
`reglas.ts` con patrón y banderas fijos:

| Elemento | Rango | Por qué |
|---|---|---|
| `columna`, `viga`, `nudo_viga_columna` | 4 | reglas 1 y 2 → rojo; si no, regla 5 → amarillo. Nunca verde. |
| `muro_carga` | 3 | regla 4 → rojo; si no, regla 5 → amarillo. Nunca verde, pero sin la vía diagonal→rojo. |
| `no_determinado`, `losa_techo`, `piso`, `fachada` | 2 | regla 3 → rojo si hay banderas; si no, reglas 7/9 → amarillo. Nunca verde. |
| `muro_divisorio` | 1 | el único con camino a verde (regla 8). |

Empate → gana lo declarado por el usuario.

**T2 — `construirObservacionEfectiva()`**: `{ ...observacion, elemento: elementoFinal }`, y si
hubo discrepancia, `confianza.elemento = 0`. Bajar esa confianza solo puede activar la regla 7
(amarillo), que va después de las reglas 1-6 — nunca ablanda un rojo. Sin ninguna regla nueva
en `reglas.ts`.

**T3 — Grieta pasante.** `Banderas` NO se toca (no hay campo "pasante" en el contrato de
`reglas.ts`). `pasante: "si" | "no" | "no_se"` es entrada de `triage.ts`, y aplica UNA SOLA
elevación: `pasante === "si"` y `elemento === "muro_carga"` y `patron === "escalonada"` → rojo;
`pasante === "si"` y el nivel ya calculado era verde → amarillo; cualquier otro caso → sin
efecto. **Pendiente de visto bueno de un ingeniero.**

**T4 — Fuente manual nunca resuelve en verde.** Si `fuente === "manual"` y `evaluarGrieta` dio
verde → amarillo, con razón explícita.

**Invariante duro de toda la capa, verificado en el script:**
`RANGO(nivel de triage) >= RANGO(nivel de evaluarGrieta)`. Nunca ablanda.

**Hallazgo durante la implementación (ver sección 8, addendum):** la tabla `SEVERIDAD_ELEMENTO`
de T1, sola, NO garantiza matemáticamente que "el elemento más severo" produzca siempre el
semáforo más severo para cualquier combinación de ancho/patrón/banderas — un caso real:
`muro_carga` con `ancho_mm > 3` (regla 4 → rojo) mal identificado por el modelo como `columna`
(severidad 4 > 3) haría que T1 relabelee a `columna`, cuyas reglas no miran `ancho_mm`,
ablandando el rojo a amarillo. Se agregó una red de seguridad aditiva
(`aplicarCandidatoDescartado`, ver addendum) que cierra ese hueco sin tocar `reglas.ts` ni la
tabla de T1.

### D4 — Modo manual: el flujo funciona con la IA apagada

Si no hay key, la variable está en `false`, la llamada falla, o el usuario elige "prefiero
describirla yo", se arma la `ObservacionGrieta` con lo que declara la persona (patrón desde un
menú ilustrado, banderas como sí/no, `ancho_mm: null`, `calidad_foto: "ok"`, confianza alta) y
`fuente: "manual"` — que por T4 tapa la vía a verde.

### D5 — Dos blobs por foto: uno para el modelo, otro para la evidencia

El overlay quema una franja negra en el ~10% inferior de la imagen — ruido (y posible tapa de
la grieta) para el modelo. Cada captura produce `blobAnalisis` (sin overlay, `MAX_DIM_ANALISIS
= 1400`, calidad `0.8`, se descarta apenas vuelve la respuesta) y `blobEvidencia` (el perfil
existente de Fase 1: `MAX_DIM=1200`, `0.65`, con fecha/hora/GPS quemados — el que va al PDF).

`src/lib/media/overlay.ts` se extiende de forma ADITIVA con `comprimirParaAnalisis()` y dos
constantes nuevas. `quemarOverlay`, `obtenerGPS`, `blobToDataUrl`, `MAX_DIM` y `CALIDAD_JPEG`
no cambian.

### D6 — Captura: se mantiene `<input capture="environment">`, no `getUserMedia`

No se puede dibujar una guía encima del visor de la cámara nativa. La "guía en pantalla" es:
tarjeta de instrucción con diagrama ANTES de abrir la cámara (`GuiaFoto.tsx`) + confirmación
DESPUÉS de la captura ("¿se ve nítida, con buena luz, y completa?" → repetir o continuar).
Mismo mecanismo que `ActaCameraCapture.tsx`.

### D7 — El triage es un flujo hermano del acta, no el mismo wizard

Se comparte lo que sirve: `overlay.ts`, `pdfStyles`, `AlertaDisclaimer`, `LineasEmergencia`,
`config.ts` y el patrón de ruta PDF. Nueva ruta `/alerta/grietas`, nuevo
`InformeGrietasReport.tsx`, nueva ruta `POST /api/alerta/informe-grietas-pdf`. Enlaces
cruzados en los dos sentidos (`FiltroSeguridad.tsx` → dos CTAs; `ResumenInmueble.tsx` → enlace
a `/alerta/documentar`).

### D8 — La nota descriptiva del modelo pasa por un filtro de lenguaje

El schema incluye `nota_visual` (una línea de lo que se ve). El prompt prohíbe juicios y
consejos, y además `sanitizarNotaVisual()` corta a 140 caracteres y descarta la nota completa
si matchea una lista negra (`segur`, `peligr`, `rojo/amarillo/verde`, `evacu`, `colaps`,
`tranquil`, `no pasa nada`, `recomiend`).

## 4. Archivos creados / modificados

### Nuevos — lógica pura (`src/lib/alerta/`)

- `src/lib/alerta/triage.ts` — `SEVERIDAD_ELEMENTO`, `reconciliarElemento`,
  `construirObservacionEfectiva`, `evaluarTriageGrieta`, más la red de seguridad
  `aplicarCandidatoDescartado` (ver addendum). Tipos `FuenteObservacion`, `RespuestaPasante`,
  `EntradaTriage`, `ResultadoTriage`, `GrietaEvaluada`.
- `src/lib/alerta/grietas.ts` — espejo de `acta.ts`: `MAX_GRIETAS = 5`, `MAX_BODY_OBSERVACION_BYTES
  = 1.5MB`, reuso de `MAX_BODY_BYTES` de `acta.ts`, `validarObservarGrietaPayload`,
  `validarInformeGrietasPayload`, `mensajeInformeMuyPesado`, `mensajeObservacionMuyPesada`,
  tipos `InformeGrietasPayload`/`ObservarGrietaPayload`.
- `src/lib/alerta/observar-grieta.ts` — cliente de visión server-only. Exporta
  `observarGrieta()`, `normalizarObservacion()`, `sanitizarNotaVisual()`.

### Modificados — lógica pura (solo aditivo)

- `src/lib/alerta/copys.ts` — agrega `TITULO_NIVEL`, `TONO_NIVEL`, `ADVERTENCIA_VERDE`,
  `COPY_DISCREPANCIA`, `COPY_SIN_IA`, `LABEL_ELEMENTO`. `COPY_NIVEL` y
  `QUE_NO_HACER_SI_NO_VERDE` quedan IDÉNTICOS.
- `src/lib/media/overlay.ts` — agrega `MAX_DIM_ANALISIS = 1400`, `CALIDAD_ANALISIS = 0.8`,
  `comprimirParaAnalisis()`. Nada existente cambia.
- `src/components/alerta/config.ts` — agrega `MONEDA_REFERENCIA`, `CONTACTO_EMAIL` (verificado
  contra el valor real usado en `Footer.tsx`/`contacto`/`privacidad`), `CONTACTO_WHATSAPP` +
  placeholder, `CANALES_OFICIALES` + placeholder por ciudad.
- `src/lib/alerta/tipos.ts` y `src/lib/alerta/reglas.ts`: diff vacío.

### Nuevos — API (`src/app/api/alerta/`)

- `src/app/api/alerta/observar-grieta/route.ts` — `POST`, público sin auth, `maxDuration = 60`.
  Valida `content-length`/bytes reales (413 en español), valida las dos fotos, llama a
  `observarGrieta`, devuelve `{ok:true,...}` o `{ok:false, motivo}` con status 200 (nunca 400
  salvo el 413). Chequeo best-effort de `Origin`/`Referer` propio.
- `src/app/api/alerta/informe-grietas-pdf/route.ts` — `POST`, público, `maxDuration = 60`,
  calcado de `acta-pdf/route.ts`.

### Nuevos — PDF

- `src/lib/pdf/InformeGrietasReport.tsx` — consume `pdfStyles`/`pdfColors`/`formatDate` de
  `styles.ts` (no los modifica). Disclaimer arriba y en el pie de cada página, nivel del
  inmueble, y por grieta: nivel, elemento declarado vs. final, razón, qué hacer/no hacer, dos
  fotos con overlay.

### Nuevos — UI (`src/components/alerta/` y `src/app/(public)/alerta/`)

- `src/app/(public)/alerta/grietas/page.tsx` — server component.
- `src/components/alerta/GrietaWizard.tsx` — `"use client"`, todo el estado del wizard.
- `src/components/alerta/UbicarGrieta.tsx` — Paso 1, siete tarjetas.
- `src/components/alerta/GuiaFoto.tsx` — tarjeta de instrucción + diagrama por toma.
- `src/components/alerta/GrietaCameraCapture.tsx` — Paso 2, dos capturas + confirmación +
  pregunta de pasante condicional.
- `src/components/alerta/DescribirGrietaManual.tsx` — **pieza no nombrada explícitamente en
  la lista de archivos del plan original**, agregada porque D4 la requiere ("patrón desde un
  menú ilustrado, banderas como sí/no" en modo manual). Ver addendum.
- `src/components/alerta/SemaforoNivel.tsx` — badge de nivel reutilizable.
- `src/components/alerta/ResultadoGrieta.tsx` — Paso 3.
- `src/components/alerta/ResumenInmueble.tsx` — Paso 4.
- `src/components/alerta/PuenteIngenieros.tsx` — Paso 6.

### Modificados — UI

- `src/components/alerta/FiltroSeguridad.tsx` — el bloque final de "puedes continuar" pasa de
  un CTA a dos: "Revisar una grieta" (primario) y "Documentar los daños" (secundario).

### Verificación y docs

- `scripts/verificar-triage-alerta.ts` — nuevo, separado del script de Fase 1.
- `package.json` — agrega `"verify:triage"`. Ninguna dependencia nueva.
- `docs/arquitectura.md` §9 — bullets de Fase 2.
- `docs/casos-de-uso.md` — `CU-AL-03` para `/alerta/grietas`.
- Este documento.

## 5. Base de datos

Ninguno. Cero cambios en `prisma/schema.prisma`, cero migraciones, cero `db:push`. Verificado:
`grep -rn "@/lib/prisma\|@prisma/client\|@/lib/supabase" src/lib/alerta src/components/alerta src/app/api/alerta`
sin resultados.

## 6. Permisos

Ninguno afectado. `src/lib/access.ts` y `src/lib/permissions.ts` no se tocan. `/alerta/grietas`
y `/api/alerta/observar-grieta` públicos, NO se agregan a `src/proxy.ts`.

## 7. Verificación (`scripts/verificar-triage-alerta.ts`)

37/37 asserts en verde. Cubre: 1a) `reconciliarElemento`/`construirObservacionEfectiva`
aisladas; 1) matriz completa declarado×observado×contexto contra el pipeline completo; 2)
invariante de monotonía (3888 combinaciones); 3) verde solo por el camino único; 4) fuente
manual / `no_determinado` / `pasante="si"` nunca verde, `muro_carga`+escalonada+pasante="si" →
rojo; 5) discrepancia declarado/observado; 6) copys nuevos sin la palabra "segur"; 7)
`normalizarObservacion` (clamps, rechazo por enum desconocido, no nulifica `ancho_mm`); 8)
`sanitizarNotaVisual` (corte a 140 caracteres, lista negra).

## 8. Addendum de implementación (hallazgos durante la construcción)

**A1 — Red de seguridad `aplicarCandidatoDescartado` en `triage.ts` (no estaba en el plan
original, agregada por necesidad matemática).** Al escribir la matriz de verificación (sección
6, punto 1 del plan original) se encontró que T1/T2 tal como estaban descritos literalmente
(un único elemento "gana" por `SEVERIDAD_ELEMENTO` y reemplaza por completo al otro) NO
garantizan el invariante "el resultado reconciliado es al menos tan severo como evaluar
declarado o observado por separado" en todos los casos — ver ejemplo concreto en la sección
D3 de arriba. Se agregó `aplicarCandidatoDescartado()`: si hubo discrepancia, evalúa también
la observación bajo el elemento que NO ganó la reconciliación y, si esa lectura es más severa,
sube el nivel (nunca cambia el elemento mostrado). Es aditiva, no toca `reglas.ts`, no cambia
ningún export ni tipo requerido por el plan, y hace que el invariante se cumpla por
construcción. **Recomendado para revisión de un ingeniero**, igual que T3.

**A2 — `DescribirGrietaManual.tsx` (componente no nombrada en la lista de archivos del plan).**
D4 exige un flujo manual con "patrón desde un menú ilustrado, banderas como sí/no", pero la
lista de archivos de la sección 3 del plan original no nombraba un componente para eso. Se creó
como pieza independiente (mismo criterio de un archivo por responsabilidad que el resto de
`alerta/`) en vez de vivir dentro de `GrietaWizard.tsx`.

**A3 — Orden de construcción real.** El plan proponía cerrar el paso 1 ("triage.ts + copys +
verify:triage") antes de construir `observar-grieta.ts` (paso 3), pero los puntos 7 y 8 de la
sección 6 del plan (verificación de `normalizarObservacion`/`sanitizarNotaVisual`) requieren
funciones que viven en `observar-grieta.ts`. Se construyó la lógica pura completa
(`triage.ts`, `copys.ts`, `overlay.ts`, `config.ts`, `grietas.ts`, `observar-grieta.ts`) antes
de correr `verify:triage` por primera vez, en vez de cerrar el script en dos tiempos.

**A4 — `LABEL_ELEMENTO`** se agregó en `src/lib/alerta/copys.ts` (no en
`src/components/alerta/config.ts`, donde se puso en un primer borrador) porque
`InformeGrietasReport.tsx` (capa `lib`) lo necesita, y `lib` no debe depender de `components`.

## 9. Qué NO se tocó (verificado con `git diff --stat`)

- `src/components/evidencia/CameraCapture.tsx` — diff vacío.
- `src/lib/alerta/reglas.ts` y `src/lib/alerta/tipos.ts` — diff vacío. Los 43 casos de
  `npm run verify:alerta` siguen pasando sin editar el script de Fase 1.
- `src/lib/pdf/styles.ts` — solo se consume.
- `src/components/alerta/ActaWizard.tsx`, `ActaCameraCapture.tsx`, `src/lib/alerta/acta.ts`,
  `src/lib/pdf/ActaDanosReport.tsx`, `src/app/api/alerta/acta-pdf/route.ts`,
  `acta-email/route.ts`, `src/lib/email.ts`.
- `prisma/schema.prisma`, `prisma/migrations/`, `src/proxy.ts`, `src/lib/access.ts`,
  `src/lib/permissions.ts`.
- `src/components/landing/Navbar.tsx` y `Footer.tsx` — `/alerta` sigue sin enlazarse desde el
  sitio.
- `src/lib/deepseek.ts` — solo referencia de patrón, no se modificó.
- Sin `npm run db:push` ni migraciones. Sin dependencias nuevas en `package.json`.

## 10. Fuera de alcance (explícito)

Directorio de ingenieros verificado COPNIA, envío del informe de grietas por correo (el acta
ya tiene esa vía), cualquier persistencia, rate limiting real, entrenar/afinar modelo propio,
medición de ancho por visión clásica, mapa comunitario, protocolo B2B, i18n, enlazar `/alerta`
desde Navbar/Footer, cambiar el flujo del acta de Fase 1.

## 11. Pendientes explícitos (TODO en código)

- `CONTACTO_WHATSAPP` en `config.ts` — placeholder `TODO(confirmar-whatsapp)`, botón oculto en
  `PuenteIngenieros.tsx` hasta confirmarlo.
- `CANALES_OFICIALES[*].url` en `config.ts` — placeholder `TODO(confirmar-enlace)` por ciudad,
  enlace oculto hasta confirmarlo.
- `ALERTA_VISION_MODEL` default (`claude-haiku-4-5-20251001`) — verificar contra la
  documentación vigente de Anthropic antes de confiar en él en producción.
- T3 (grieta pasante) y la red de seguridad `aplicarCandidatoDescartado` (A1 del addendum) —
  pendientes de visto bueno de un ingeniero, igual que las interpretaciones de las reglas 4 y 6
  de Fase 1.
