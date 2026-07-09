# Copy final — Landing B2B v2 (seiricon.com)

**Fecha:** 2026-07-09 · **Estado:** listo para aplicar · **Fuente:** spec-landing-b2b-v2.md (incl. v2.1) + copy vigente en `src/components/landing-v2/`.
**Audiencia:** gerentes y dueños de constructoras colombianas, escépticos del software. **Tono:** formal-cálido colombiano (tú), frases cortas, primero el dolor o el resultado y después la función.

Este documento es el texto FINAL sección por sección, en el orden de la página. Cada bloque indica el componente donde se aplica. Lo marcado **[SIN CAMBIO]** se conserva tal cual está hoy.

---

## Reglas transversales (para el agente que aplique)

1. **Cero emojis Unicode** en todo texto (📍 🔔 🔗 🔒 ⚠ ⇪ 👷 fuera). Donde hoy hay emoji, va ícono de lucide; en este doc se indica como `[lucide: Nombre]`. El check "✓" de estados también se reemplaza por `[lucide: Check]`.
2. **Alternancia obra/proyecto:** ya está repartida en este copy. No "normalizar" hacia una sola palabra al aplicar. Los nombres de plan (Obra) y la frase de marca "CONTROL DE OBRA" no se tocan.
3. **Semáforo: 5 niveles** y siempre los mismos nombres: **adelantado · a tiempo · alerta · retraso · crítico**. Nunca "ámbar", "iniciando" ni "retrasado" como nombre de nivel.
4. **Prohibido en cualquier variante:** "importa el Excel que ya tienes", "sube tu Excel de siempre", "llena nuestra plantilla", promesas de offline, y cualquier mención a scoring/calificación/historial de desempeño de contratistas u obreros (es información privada del producto).
5. Cifras: solo verdades del producto. Nada que suene a métrica de clientes (no tenemos clientes medibles aún).
6. Tipografía de moneda y hora al estilo del producto: `$4.2M`, `10:42 a. m.`

---

## 0. NavBar (`NavBar.tsx`)

**[SIN CAMBIO]** Enlaces: `Producto · Cómo funciona · Precios`. Botones: `Ingresar` / `Empezar gratis`. Wordmark `SEIRICON` con semáforo.

---

## 1. Hero (`Hero.tsx`)

**Membrete mono [SIN CAMBIO]:**
`SEIRICON — CONTROL DE OBRA` · `COLOMBIA · 2026`

**H1 (titular rotatorio — "Tu" y "bajo control" fijos, el sustantivo rota con fade/slide):**

> Tu **{obra / equipo / proyecto / calidad / progreso / contratista}** bajo control

Orden de rotación sugerido: obra → equipo → proyecto → calidad → progreso → contratista (empieza y "descansa" en "obra": es la palabra que el gerente usa). Recordatorio de la v2.1: corregir el bug de la primera línea del h1 oculta tras el navbar.

**Subtítulo (nuevo):**

> Así trabaja Seiricon: el avance llega con foto, GPS y hora, tú lo apruebas y la plata queda al día — todo en una pantalla.

**CTAs [SIN CAMBIO]:** `Empezar gratis →` / `Agendar demo`

**Microcopy bajo los CTAs (nuevo, línea pequeña):**

> 14 días gratis · Sin tarjeta de crédito

**Chips de casos de uso (reemplazan los actuales; el segundo violaba la regla de Excel):**

- `[lucide: Plus]` Crear un proyecto en minutos
- `[lucide: FileSpreadsheet]` Convertir mi presupuesto en cronograma
- `[lucide: Check]` Aprobar avances con foto y GPS
- `[lucide: CircleDollarSign]` Controlar la plata de la obra

---

## 1b. Demo viva (`LiveDemo.tsx`) — microcopy de las 4 secuencias

Marco del navegador **[SIN CAMBIO]:** `app.seiricon.com — Torre 1`.
Panel izquierdo: `Tareas de hoy · Torre 1`. Panel derecho: `La obra, ahora` (con **doble barra**: leyenda `Reportado` en azul / `Aprobado` en verde, según v2.1).

Filas fijas del panel (sin emoji; el pin es `[lucide: MapPin]`):

- **Enchape baño ppal — Apto 504** · `GPS · hoy 9:12 a. m.` · pill `Aprobada`
- **Pintura fachada norte — T2** · `GPS · hoy 8:03 a. m.` · pill `Aprobada`

KPIs del panel derecho: `Avance aprobado` · `Entregado a contratistas` · `Sustentado con factura`.

**Secuencia ① — Aprobar evidencia** (la actual, sin emojis):

| Momento | Texto |
|---|---|
| Estado inicial | status: `Obrero reportando…` · meta: `esperando reporte…` · pill: `Pendiente` |
| Llega la foto | status: `Foto recibida — GPS verificado` · meta: `GPS verificado · hoy 10:42 a. m.` · pill: `Reportada` |
| Clic en Aprobar | pill: `Aprobada` · status: `Aprobada — historial guardado` · toast: `Evidencia aprobada — Estuco alcoba 2` |
| Alarma (antes → después) | `$42 M sin sustentar — 3 anticipos` → `Anticipo sustentado — quedan $29 M por revisar` |

**Secuencia ② — Se registra un gasto:**

| Momento | Texto |
|---|---|
| Estado | status: `Registrando gasto…` |
| Toast | `Gasto registrado — $4.2M · Ferretería El Punto` |
| Cierre | status: `Plata al día — factura adjunta` (las barras de plata se actualizan) |

**Secuencia ③ — Llega un reporte:**

| Momento | Texto |
|---|---|
| Estado | status: `Reporte entrando…` |
| Fila nueva/actualizada | `Pañete muro sur — Apto 108` · meta: `GPS verificado · hoy 11:05 a. m.` · pill: `Reportada` |
| Toast | `Nuevo avance por revisar — Apto 108` |

**Secuencia ④ — Se crea un proyecto:**

| Momento | Texto |
|---|---|
| Estado | status: `Creando proyecto…` |
| Toast | `Proyecto creado — Torre 2 · 8 pisos · 48 unidades` |
| Cierre | status: `Listo para asignar tareas` |

Botón de la demo **[SIN CAMBIO]:** `Aprobar`. Nombre de tarea protagonista **[SIN CAMBIO]:** `Estuco alcoba 2 — Apto 302`.

---

## 2. Pasos (`Pasos.tsx`)

**PASO 1**
**H4:** Arma tu proyecto en minutos
**Texto:** Torres, pisos y tareas por fase con un asistente guiado. Y el presupuesto entra por Excel: se convierte en tareas y cronograma sin digitar partida por partida.

**PASO 2 [SIN CAMBIO]**
**H4:** Tu gente reporta con pruebas
**Texto:** Cada avance llega con foto, GPS y hora. Tú apruebas o rechazas con motivo, desde donde estés.

**PASO 3** (solo se ajusta la primera frase al semáforo real)
**H4:** Tú decides con datos
**Texto:** Semáforo de plazos en cinco niveles, plata sustentada y todas tus obras en un mapa. La visita a obra vuelve a ser una decisión.

---

## 3. Ticker (`Ticker.tsx`)

Eventos (se corrige "ÁMBAR" → "EN ALERTA" y se agrega un quinto evento para respirar y alternar obra/proyecto):

1. `10:42 — EVIDENCIA APROBADA · ENCHAPE BAÑO PPAL · T1-504`
2. `10:38 — FOTO + GPS · ESTUCO ALCOBA 2 · T1-302`
3. `10:15 — ANTICIPO SUSTENTADO · $4.2M · FERRETERÍA EL PUNTO`
4. `09:58 — SEMÁFORO EN ALERTA · PINTURA FACHADA · T2`
5. `09:31 — PROYECTO CREADO · CONJUNTO ROBLE · 2 TORRES`

---

## 4. Cifras (`Cifras.tsx`)

Se reemplazan las dos primeras cifras actuales ("1.240 tareas verificadas en una obra típica" y "96% de la evidencia llega con GPS") porque suenan a métricas de clientes y no las tenemos. Estas cuatro son verdades del producto:

| Cifra | Texto |
|---|---|
| **0** | apps que tu gente necesita instalar |
| **3** | sellos en cada foto: GPS, fecha y hora |
| **5** | niveles de semáforo: de adelantado a crítico |
| **14** | días gratis, sin tarjeta de crédito |

---

## 5. FIG. 01 — Dashboard (`FiguraDashboard.tsx`)

**Mono [SIN CAMBIO]:** `FIG. 01 — CAPTURA SIN RETOQUE` · **Eyebrow [SIN CAMBIO]:** Vista gerente
**H2 [SIN CAMBIO]:** Toda la constructora en un tablero — este es el de verdad
**Texto [SIN CAMBIO]:** No es una ilustración: así se ve Seiricon un martes cualquiera. Obras activas, tareas esperando tu aprobación, riesgo de retraso y progreso global.

**Bullets** (solo se alterna obra→proyecto en el primero):
- Semáforo de plazos en cada proyecto y cada tarea
- Mapa con todas tus obras y su avance
- Lo que requiere acción, arriba y de primero **[SIN CAMBIO]**

**Cotas [SIN CAMBIO]:** `← MAPA DE OBRAS` / `SEMÁFORO DE PLAZOS →`
**Barra mono [SIN CAMBIO]:** `APP.SEIRICON.COM — DASHBOARD GERENTE` · `CAPTURA SIN RETOQUE`

---

## 6. FIG. 02 — En la obra (`FiguraObrero.tsx`)

**Mono [SIN CAMBIO]:** `FIG. 02 — VISTA DEL OBRERO` · **Eyebrow [SIN CAMBIO]:** En la obra
**H2 [SIN CAMBIO]:** Tu gente reporta desde el celular, sin instalar nada
**Texto [SIN CAMBIO]:** El obrero abre un enlace, ve sus tareas y sube la foto del avance. La foto llega con ubicación GPS y hora — imposible reportar desde la casa.

**Bullets [SIN CAMBIO]:**
- Cero apps, cero cuentas, cero contraseñas
- Evidencia marcada con GPS, fecha y hora
- Pensado para la mano de obra real de Colombia

**Insignia:** `[lucide: Link]` Entró por un enlace — sin app, sin cuenta **[SIN CAMBIO en el texto; solo cambia el emoji por ícono]**

---

## 7. Arranque + Excel (`SeccionCrearObra.tsx`) — 3 OPCIONES

**Mono [SIN CAMBIO]:** `FIG. 02b — ARRANQUE` · **Barra mono [SIN CAMBIO]:** `APP.SEIRICON.COM — NUEVA OBRA` · `CAPTURA SIN RETOQUE`

Recordatorio duro: nada de "importa el Excel que ya tienes" (falso) ni "llena nuestra plantilla" (vetado). La promesa es el RESULTADO: el presupuesto que hoy vive en Excel termina convertido en proyecto dentro de Seiricon, con mínimo esfuerzo.

### ⭐ OPCIÓN A — "El resultado" (RECOMENDADA)

**Eyebrow:** Arranca en minutos
**H2:** Tu presupuesto en Excel se convierte en proyecto
**Sub:** Define torres, pisos y tipos de apartamento con el asistente. Y el presupuesto que hoy vive en una hoja de cálculo termina dentro de Seiricon: tareas por fase, precios y cronograma, listos para asignar.
**Bullets:**
- Torres, pisos, unidades y espacios con un asistente guiado
- El presupuesto entra por Excel y sale convertido en tareas y cronograma
- Cada tarea nace con su fase, su precio y su plazo

**Insignia del video:** `[lucide: FileSpreadsheet]` De Excel a cronograma — en minutos

*Por qué es la recomendada:* promete el resultado exacto y verificable (Excel entra, proyecto sale), no menciona el mecanismo (plantilla), no miente, y deja al asistente como coprotagonista. Es la que mejor sobrevive a la demo en vivo: lo que el video muestra es literalmente lo que el título promete.

### OPCIÓN B — "El esfuerzo que te ahorras"

**Eyebrow:** Arranca en minutos
**H2:** Del Excel al cronograma, sin digitar tarea por tarea
**Sub:** Excel sigue siendo tu cancha: ahí se arma el presupuesto. La diferencia está en el final — en Seiricon queda montado como proyecto completo, con tareas, fases, precios y plazos.
**Bullets:**
- Cientos de partidas montadas en minutos, no en semanas
- La estructura de torres y pisos la arma un asistente guiado
- Todo queda listo para asignar a contratistas desde el día uno

**Insignia del video:** `[lucide: FileSpreadsheet]` Cientos de tareas en minutos

### OPCIÓN C — "El dolor del presupuesto muerto"

**Eyebrow:** De la hoja de cálculo a la obra
**H2:** Que el presupuesto no se quede en una carpeta
**Sub:** Hoy el presupuesto se hace en Excel y ahí se queda: nadie lo compara con lo que pasa en la obra. En Seiricon se vuelve tareas con precio y plazo — y cada avance se mide contra él.
**Bullets:**
- El presupuesto se convierte en tareas, fases y cronograma
- Cada peso gastado se cruza contra lo presupuestado
- La estructura del proyecto la arma un asistente, en minutos

**Insignia del video:** `[lucide: FileSpreadsheet]` El presupuesto, por fin en obra

---

## 8. FIG. 03 — Roles y permisos (`FiguraEquipo.tsx`, reemplaza "Contratistas con historial")

La sección actual (historial/auditoría de contratistas) SE ELIMINA COMPLETA: esa información es privada (Decisiones Seiricon 2026-07-09). Copy nuevo:

**Mono:** `FIG. 03 — ROLES Y PERMISOS`
**Eyebrow:** Tu equipo
**H2:** Cada quien ve exactamente lo que le toca
**Sub:** Tú decides quién entra a qué. Nadie ve de más, nadie queda por fuera de lo suyo — y cada acción queda registrada con nombre y hora.

**Bullets:**
- Tú lo ves todo: cada proyecto, cada peso, cada aprobación
- Tu admin de proyecto, solo sus obras — con permisos que tú le ajustas
- El contratista reporta lo suyo; el obrero entra por un enlace, sin cuenta

**Insignia:** `[lucide: Lock]` Accesos por rol — cada acción, auditada
**Barra mono de la captura:** `APP.SEIRICON.COM — EQUIPO Y PERMISOS` · `CAPTURA SIN RETOQUE`
**Alt de la captura:** Gestión real de roles y permisos del equipo en Seiricon

---

## 9. Mapa vivo (`MapaVivo.tsx`)

**Eyebrow [SIN CAMBIO]:** Multi-obra, en vivo
**H2 [SIN CAMBIO]:** Todas tus obras respirando en un mapa
**Sub (ajustado a la animación nueva de la v2.1: cámara viaja, clic en pin, panel de detalle):**

> Cada pin es un proyecto con su semáforo y su avance. Tocas uno y ves lo reportado contra lo aprobado — sin llamar a nadie.

**Tags de pines:** `Torre Alameda · 71%` · `Conjunto Roble · 46%` · `Casa Pance · en alerta` (antes decía "plazo cerca"; se alinea al nombre del nivel).

**Feed — encabezado [SIN CAMBIO]:** Actividad de tus obras — ahora
**Eventos del feed** (sin emoji; "ámbar" → "alerta"):

| Título | Descripción | Meta |
|---|---|---|
| **Evidencia aprobada** | Enchape baño ppal · T1-504 | hace un momento · GPS verificado |
| **Obrero reportó** | Estuco alcoba 2 · T1-302 | hace 4 min · foto + ubicación |
| **Anticipo sustentado** | $4.2M · Ferretería El Punto | hace 12 min · factura adjunta |
| **Semáforo en alerta** | Pintura fachada · Torre 2 | hace 20 min · plazo a 3 días |

**Panel de detalle del pin (nuevo, para la animación):** título = nombre de la obra; líneas: `Avance aprobado: 71%` · `Reportadas vs. aprobadas: 18 / 14` · `Semáforo: a tiempo`.

---

## 10. FIG. 04 — La plata (`SeccionGastos.tsx`)

Se trae a la landing el lenguaje que ya vive en la app (dashboard de gastos): "¿Te están sustentando?" y "No pagas sin factura". Quien entre a la plataforma va a leer lo mismo que le prometió la página.

**Mono [SIN CAMBIO]:** `FIG. 04 — LA PLATA`
**Eyebrow (nuevo):** ¿Te están sustentando?
**H2 [SIN CAMBIO]:** Cada peso entregado, cruzado con su factura
**Texto** (solo se alterna obra→proyecto): Anticipos, facturas y presupuesto en un mismo lugar. Ves cuánto entregaste a cada contratista, cuánto está sustentado y qué falta por justificar en cada proyecto — sin hojas de cálculo sueltas.

**Bullets:**
- No pagas sin factura: lo no justificado aparece en rojo, de una
- Anticipos y facturas ligados a cada proyecto
- Reportes de gasto listos para presentar

**Barra mono [SIN CAMBIO]:** `APP.SEIRICON.COM — GASTOS Y REPORTES` · `CAPTURA SIN RETOQUE`

---

## 11. Grid denso (`GridDenso.tsx`)

**Eyebrow [SIN CAMBIO]:** Todo lo demás también está
**H2 [SIN CAMBIO]:** Denso donde importa, / simple donde se usa

**Las 6 tarjetas** (micro-demos animadas según v2.1; textos de las mini-visualizaciones sin emoji):

**1. Semáforo de plazos**
> Cinco niveles: adelantado, a tiempo, alerta, retraso, crítico. El riesgo se ve antes de que sea pérdida.
*(La micro-demo recorre los 5 nombres en ese orden.)*

**2. Mapa multi-obra [SIN CAMBIO]**
> Todas tus obras en un mapa con su avance. La ronda de llamadas, jubilada.

**3. De Excel a proyecto** *(antes "Importa tu Excel" — título nuevo por la regla dura)*
> El presupuesto entra por Excel y sale como cronograma. Minutos, no semanas.
*(Tag de la mini-visualización: `XLSX → PROYECTO`.)*

**4. Notificaciones al momento**
> Cuando algo necesita tu decisión, te llega — en la plataforma y al correo.
*(Mini-notificaciones de la demo: `Tarea reportada — T1-302` y `Anticipo sustentado — $4.2M`, con `[lucide: Bell]`.)*

**5. Evidencia con GPS y hora [SIN CAMBIO]**
> Cada foto prueba dónde y cuándo. El historial queda para siempre.
*(Chip de la mini-demo sin emoji: `4.6097, -74.0817 · 10:42` con `[lucide: MapPin]`.)*

**6. Plata sustentada**
> Anticipos, facturas y presupuesto cruzados. Lo que falta por sustentar, en rojo.
*(Mini-demo: `$268M / $310M sustentado`, el número cuenta hacia arriba.)*

---

## 12. Precios (`Precios.tsx`)

**Eyebrow [SIN CAMBIO]:** Precios claros, en pesos
**H2 [SIN CAMBIO]:** Un plan para cada etapa
**Línea bajo el título (nueva):** 14 días gratis en cualquier plan, sin tarjeta de crédito.

| Plan | Precio | Detalle | Bullets | CTA |
|---|---|---|---|---|
| **Obra** | $650.000 | COP/mes · 1 obra activa | Hasta 150 unidades · Evidencia con aprobación · Dashboard + semáforo | Empezar gratis |
| **Pro** ⭐ RECOMENDADO | $1.800.000 | COP/mes · hasta 5 obras | Usuarios ilimitados · Mapa de obras + alertas · Soporte prioritario | Empezar gratis |
| **Empresa** | $3.500.000 | COP/mes · hasta 15 obras | Benchmarking entre obras · Reportes PDF · Onboarding asistido | Empezar gratis |
| **Corporativo** | A convenir | a tu medida | Más de 15 obras · Integraciones a la medida · Gerente de cuenta | Hablemos |

Todo **[SIN CAMBIO]** salvo la línea nueva bajo el título. Los precios coinciden con los reales del spec.

---

## 13. Testimonio (`Testimonio.tsx`)

**[SIN CAMBIO]** — placeholder marcado (`Espacio para beta tester` + cita de ejemplo + `Testimonio de ejemplo · pendiente de beta tester real · Directora de obra, Cali`). Es honesto y ya está señalizado; se reemplaza cuando exista beta tester real. Único ajuste: el avatar emoji `👷‍♀️` pasa a `[lucide: HardHat]` o inicial en círculo.

---

## 14. FAQ (`Faq.tsx`)

**P1 [SIN CAMBIO]:** ¿Mis obreros necesitan instalar algo?
> No. Entran por un enlace que les compartes, ven sus tareas y suben las fotos. Sin app, sin cuenta, sin contraseña.

**P2** (la respuesta actual violaba la regla de Excel):
**¿Qué tan difícil es montar mi primer proyecto?**
> Minutos. La estructura de torres, pisos y apartamentos la armas con un asistente, y el presupuesto entra por Excel: queda convertido en tareas, fases y cronograma.

**P3 [SIN CAMBIO]:** ¿La evidencia sirve en una disputa con un contratista?
> Cada foto queda con GPS, fecha y hora; cada aprobación o rechazo con su motivo y autor. El historial es permanente.

**P4 (nueva, apoya la sección de roles):** ¿Puedo controlar qué ve cada persona de mi equipo?
> Sí. Tú lo ves todo; tus administradores de proyecto solo lo suyo, con permisos que tú ajustas; contratistas y obreros, únicamente sus tareas.

**P5 [SIN CAMBIO]:** ¿Mis datos están seguros?
> Cada constructora ve solo sus datos, las acciones críticas exigen doble verificación y cumplimos la Ley 1581 de protección de datos.

---

## 15. Cierre navy (`Cierre.tsx`)

**H2 [SIN CAMBIO]:** Tu próxima obra, bajo control desde el día uno
*(Se queda porque ahora, además, hace eco del titular rotatorio del hero.)*

**Texto (la frase actual violaba la regla de Excel):**
> 14 días gratis, sin tarjeta. Tu primer proyecto puede quedar montado hoy mismo.

**CTA [SIN CAMBIO]:** `Empezar gratis →`

---

## 16. Footer (`Footer.tsx`)

**[SIN CAMBIO]** — `© 2026 Seiricon · construyendo en orden` / `SEIRICON — CONTROL DE OBRA · COLOMBIA 2026`

---

## Anexo — Qué quedó igual y por qué

| Texto | Dónde | Por qué se queda |
|---|---|---|
| "La visita a obra vuelve a ser una decisión" | Pasos | La mejor línea de resultado de la página: convierte control en libertad. |
| "No es una ilustración: así se ve Seiricon un martes cualquiera" | FIG. 01 | Es el ADN "captura sin retoque" dicho en una frase. |
| "imposible reportar desde la casa" + toda la FIG. 02 | FIG. 02 | Nombra el fraude exacto que el gerente teme, sin acusar a nadie. |
| "Cero apps, cero cuentas, cero contraseñas" | FIG. 02 | Ritmo de tres, objeción resuelta antes de formularse. |
| "Todas tus obras respirando en un mapa" | Mapa vivo | "Respirando" hace vivo el mapa; es la sección "producto en vivo". |
| "Cada peso entregado, cruzado con su factura" | FIG. 04 | Promesa concreta y auditable, en lenguaje de plata. |
| "La ronda de llamadas, jubilada." | Grid (mapa) | El gancho más corto de la página; humor seco que aterriza el beneficio. |
| "Cada foto prueba dónde y cuándo. El historial queda para siempre." | Grid (GPS) | Dos frases, dos pruebas. No se puede decir mejor con menos. |
| "Denso donde importa, simple donde se usa" | Grid (head) | Define la filosofía del producto y desarma el "otro software complicado". |
| "Tu próxima obra, bajo control desde el día uno" | Cierre | Cierra el círculo con el hero rotatorio "Tu … bajo control". |
| Nav, precios (planes/CTAs), testimonio placeholder, footer | — | Cumplen su función; los precios son los reales; el placeholder es honesto. |

**Textos de la app que suben a la landing:** "¿Te están sustentando?" (eyebrow de FIG. 04) y "No pagas sin factura" (primer bullet de FIG. 04) — vienen del dashboard de gastos (`src/app/(dashboard)/dashboard/proyectos/[id]/gastos/client.tsx`). La página promete con las mismas palabras con las que la app cumple.
