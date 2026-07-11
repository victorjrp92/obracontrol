# Spec — Landing B2C "Seiricon Go" (en curso)

**Fecha:** 2026-07-11 · **Estado (2026-07-12):** Victor eligió la **Dirección A «Presente»**. Decisiones de build: **CTA = LISTA DE ESPERA** ("Reserva tu cupo" → modal propio con correo + pregunta segmentadora, guardado en nuestra BD — Tally sigue en placeholder y no se usa) y **la página REEMPLAZA a /para-ti** cuando Victor la apruebe (se construye primero oculta en `/go-nueva`, fuera del grupo (public) para que no herede el chrome viejo).
**Nombre de la línea B2C:** **Seiricon Go** (decisión de Victor, "por ahora").
**Mockups v1** (fuentes en scratchpad de sesión `mockup-go-{a,b,c}.html`; fotos como data URIs):
- A «Presente»: https://claude.ai/code/artifact/be387e67-f469-4be9-bce0-176ecb1d812e
- B «Míralo tú mismo» (demo interactiva): https://claude.ai/code/artifact/43f4f0cf-02f9-4018-8d5d-c115b29a812f
- C «La plata clara» (tablero vivo): https://claude.ai/code/artifact/6c7a7dea-3d57-4934-a476-6f8e05ecb2e2

## Proceso seguido
1. Agente estratega (marketing digital + UX/UI + psicología del consumidor + B2C) → brief psicológico por audiencia, arquitectura de página y 3 direcciones creativas.
2. Agente copywriter (solo copy) → copy completo de las 3 direcciones.
3. Mockup profundo SOLO de la dirección A (Victor la eligió leyendo la estrategia; B y C quedan archivadas abajo).

## Decisiones fijas
- **Audiencias:** Propietario persona natural (sub-segmento estrella: **diáspora** — construye en Colombia desde el extranjero) y **contratista independiente** (el **link de transparencia** para su cliente como argumento de venta; además es loop viral de adquisición).
- **Arquitectura:** landing madre con **bifurcación temprana** (dos tarjetas bajo el hero), cuerpo 70/30 a favor del propietario, bloque contratista autocontenido con CTA propio. NO switch/toggle. Sub-páginas indexables después (v2).
- **Relojes del hero:** la ciudad extranjera ROTA **Madrid 22:04 → Nueva York 17:04 → Toronto 17:04**; Cali 16:04 fijo (pedido de Victor).
- **CTA dual sin decidir:** cada CTA tiene variante registro ("Crea tu obra gratis" → /empezar) y variante lista de espera ("Reserva tu cupo" + pregunta segmentadora). El diseño no cambia entre variantes.
- **Assets:** MÁS fotos humanas reales (bancos libres, caras permitidas si la foto es real; IA solo último recurso y NUNCA rostros). Evitar stock corporativo gringo y logos visibles (se descartó una foto por logos "cpac"). Remotion para clips narrativos programáticos (guiones por dirección abajo); grabaciones reales de la app para prueba de producto.
- **Restricciones duras de copy:** "nadie cobra sin factura" VETADA → "No pagas sin factura"; nada de offline, scoring, "importa tu Excel"/"llena nuestra plantilla", ni "arquitecto"; cero emojis; cero métricas/testimonios inventados; primera obra gratis sin tarjeta = única promesa comercial.

## Verdades del producto B2C (verificadas en código)
- `TipoCuenta`: PROPIETARIO (obreros directos, equipo, multiproyecto, reportes, validar, modo simple; SIN pagos/clientes/contratistas) y CONTRATISTA (todo lo anterior + contratistas, clientes y pagos). Planes: PERSONAL/OBRA/PROYECTO/EMPRESA (`src/lib/plan.ts`).
- Avance con foto+GPS+hora; obrero reporta por link `/o/[token]` sin cuenta; cliente ve por link `/c/[token]` sin cuenta; aprobación del dueño; gastos con factura + alarma de plata sin sustentar; semáforo; cronograma con duraciones sugeridas; arranque guiado `/empezar`.
- Primera obra gratis, sin tarjeta (claim ya usado en /para-ti).

## Fotos curadas (Unsplash salvo indicación; licencia libre)
- D8NwgmdkgOY — Vitaly Gariev — hombre en videollamada con su familia (conexión a distancia)
- H-n8347I6P0 — Vitaly Gariev — pareja mayor en videollamada (los papás en Colombia)
- zJirqXfJKXU — Julio Lopez — hombre de noche mirando el celular en la ciudad (HERO del mockup A)
- R6dSBkz32B8 — Ghen Mar Cuaño — mujer feliz mirando el celular
- 9gCRnfwSkwo — GN Group — contratista revisando planos en obra
- xdS9XEoKBLY — Emmanuel Ikwuegbu — obrero con casco reportando desde el celular
- x8l4lN6-xd0 — Vitaly Gariev — pareja estrenando casa (payoff del cierre)
- f2-manos-panete (Pexels · Ksenia Chernaya, ya en public/landing/fotos) — reusada: borrosa en el chat mock y nítida en la tarjeta de avance (el contraste "la misma foto, ahora con pruebas").

---

# ESTRATEGIA (agente estratega, 2026-07-11)

## Brief psicológico

### Propietario / diáspora
- Dolor raíz: **asimetría de información** (él pone la plata, el otro tiene el conocimiento). Tres miedos: plata sin rastro; no distinguir avance real de cuento; el costo relacional de desconfiar. En la diáspora se suma culpa por no estar y el peso simbólico de la remesa.
- Momento de búsqueda: al comprometerse a girar mensual (inicio), tras una foto/excusa que no cuadró (crisis — el más caliente: llega a Google de noche), o tras ser quemado antes (cicatriz).
- Busca: "cómo saber si el maestro me está robando", "cómo controlar una obra a distancia", "construir casa en Colombia viviendo en España/Estados Unidos", "app para controlar remodelación". Busca el PROBLEMA, nunca "software de gestión".
- Objeciones en orden letal: (1) "mi maestro no va a usar una app" → muere ANTES del primer CTA (link sin app ni cuenta); (2) "no sé de construcción/software" → modo simple + /empezar; (3) precio → gratis sin tarjeta; (4) "¿daña la relación?" → la evidencia protege la relación, la sospecha la destruye.
- Gatillos: aversión a la pérdida (anclar en plata girada), efecto contraste (chat vs avance con pruebas), zero-price, autoridad prestada honesta ("la misma tecnología que usan constructoras"). El producto ES la prueba social (cero métricas inventadas).

### Contratista independiente
- Dolor: **vender confianza sin poder demostrarla**. Pierde cotizaciones frente a baratos; llamadas a toda hora; cobros tensos; cuentas de cuaderno mezcladas entre obras.
- Motivación profunda: estatus — pasar de "el maestro" a "empresa seria". El link de transparencia NO es control sobre él: es SU argumento de venta.
- Busca: "app para maestros de obra", "informe de avance de obra para cliente", "cómo cotizar una remodelación", "plantilla avance de obra" (interceptar SIN prometer Excel: "deja la plantilla, comparte el link").
- Objeciones: "la transparencia me expone" → el registro también lo protege en disputas; "mis obreros no van a reportar" → link sin cuenta; "no tengo tiempo" → arranque guiado; precio → un cliente ganado la paga (herramienta de ventas, no gasto).
- Gatillos: identidad ("los que trabajan bien no le temen a mostrar"), ventaja demostrable, endowment (primera obra gratis con cliente real), honestidad pratfall heredada de la marca.

## Arquitectura (decidida)
Landing madre + bifurcación temprana + 70/30. Anuncios llegan con query param (`?p=contratista`) que resalta el bloque correspondiente hasta que existan sub-páginas. CTA dual: mismo botón, solo cambia destino/texto; variante lista de espera con pregunta segmentadora (propietario: "¿dónde vives / dónde queda tu obra?"; contratista: "¿cuántas obras manejas?") = investigación de mercado gratis.

## Direcciones
- **A «Presente» (ELEGIDA):** tesis "la distancia dejó de ser excusa". Hero de dos mundos (noche extranjero / día obra en Cali) con feed vivo y relojes. Riesgo: excluye emocionalmente al local y al contratista de entrada (mitigado con bifurcación y bloque espejo); un grado más de sentimentalismo = melodrama de comercial de remesas.
- **B «Míralo tú mismo» (archivada):** demo interactiva antes de registrarte; continuidad B2B. Riesgo: no marcar distancia de temperatura con el B2B; exige demo impecable.
- **C «La plata clara» (archivada):** tablero de cuentas vivo + pacto dueño/contratista ("Si pones la plata, ves dónde está / Si pones el trabajo, cobras sin pelear"). Riesgo: mal ejecutada se lee "los contratistas roban"; la menos memorable.

## Guiones Remotion (1 por dirección)
- **A "La foto que sí dice la verdad" (5 escenas):** mapa nocturno arco Madrid→Cali "Giras plata cada mes." → burbuja "todo va bien" + foto borrosa "Y esto es todo lo que ves." → la foto se transforma en avance Seiricon (nítida, chip GPS Cali, hora) → tap "Aprobar", semáforo a verde → cierre azul "Nadie va a cuidar tu obra como tú. Ahora puedes." + "Primera obra gratis".
- **B "Un avance completo en 40 segundos" (6):** obrero recibe link "Sin app. Sin cuenta." → foto + GPS/hora se estampan → otra ciudad, el dueño aprueba → gasto con factura suma en verde → plata sin sustentar = alarma "No pagas sin factura." → semáforo verde + gratis.
- **C "¿Dónde está la plata?" (5):** cifra que crece giro a giro → se disuelve en niebla "¿Dónde está?" → tablero: cada gasto aterriza con su factura → un pago sin sustento = rojo "Lo ves a tiempo, no al final." → pantalla partida dueño aprueba / contratista cobra "Transparencia para los dos."

---

# COPY (agente copywriter, 2026-07-11)

## Dirección A «Presente» — copy aplicado en el mockup v1
- **H1:** Nadie cuida tu obra como tú.
- **Sub:** Y ya no necesitas estar ahí para hacerlo. Cada avance te llega con foto, ubicación y hora — y tú lo apruebas desde tu celular, así estés a diez mil kilómetros.
- **CTA:** registro "Crea tu obra gratis" / espera "Reserva tu cupo" · micro: "Primera obra gratis · Sin tarjeta".
- **Hero UI:** "Casa familiar — Cali, La Buitrera" · tarjeta "Enchape baño social" · chips "GPS: Cali — La Buitrera" / "Hoy, 4:02 p. m." · "Reportó: don Álvaro (maestro)" · Aprobar/Rechazar · "Aprobado por ti — 4:04 p. m. Quedó en el registro de la obra." · "A tiempo".
- **Bifurcación:** "Construyo o remodelo lo mío — La casa que estás pagando tú, vista con tus propios ojos, estés donde estés." / "Manejo obras de clientes — Eres maestro o remodelador y quieres clientes tranquilos que paguen sin pelear."
- **S2 ASÍ SE VE HOY — "Todo va bien." ¿Y tú cómo sabes?** + chat (Don Álvaro): "¿cómo vamos con el baño?" / "Todo va bien" / [foto borrosa] / "¿Esa foto es de esta semana?" / Visto — sin respuesta. Cuerpo: "No es mala fe. Es que un chat no se hizo para llevar una obra…".
- **S3 ASÍ SE VE CON SEIRICON GO — El mismo avance. Ahora con pruebas.** (misma foto del chat, nítida, con chips; "Pañete y estuco de fachada", "Esperando tu aprobación").
- **S4 LA PREGUNTA OBLIGADA — ¿Y mi maestro qué tiene que hacer?** "Abrir un link y tomar una foto. Eso es todo… Si sabe mandar una foto por chat, ya sabe reportar en Seiricon Go." Pasos: le llega el link → toma la foto (GPS y hora se estampan solos) → envía.
- **S5 TU PLATA — No pagas sin factura.** Gastos: "Bulto de cemento gris x10 — $342.000 — Factura adjunta" · "Viaje de arena de río — $220.000 — Factura adjunta" · "Plata entregada al maestro — $800.000 — Sin sustentar hace 4 días" (rojo) · alarma "Tienes $800.000 entregados sin factura."
- **S6 EL PANORAMA — Sabes qué va bien, qué está en riesgo y cuándo termina.** Semáforo: Vaciado de placa segundo piso (A tiempo) · Instalación eléctrica de cocina (En riesgo) · Ventanería en aluminio (Crítico).
- **S7 ¿MANEJAS OBRAS DE CLIENTES? — El mismo link que tranquiliza a un dueño es tu mejor carta de presentación.** Bullets: un link por cliente / el registro también habla por ti en disputas / varias obras en una pantalla. Mock del link público: "Remodelación apto de Marcela R. — Cali · Avance general: 68% · TERMINADO/EN CURSO/FALTA · Obra llevada en Seiricon Go por Norbey Quintero". CTA "Crea tu primera obra gratis" / "Reserva tu cupo de contratista".
- **S8 PRECIO — Tu primera obra es gratis.** "Creas tu obra hoy y la llevas hasta el final sin pagar. Sin tarjeta, sin letra pequeña." + "Cuando necesites llevar más obras al tiempo, pasas a un plan pago. Así de simple."
- **S9 FAQ (5):** app del maestro / no sé de construcción / precio / confianza / "Estoy fuera del país. ¿De verdad me sirve?" → "Es para quien está lejos que más sirve…".
- **Cierre:** "Tu obra te está esperando." / "Está allá, avanzando con o sin tus ojos. Mejor con ellos."

## Banco de tareas/gastos (para demos)
Vaciado de placa segundo piso · Enchape baño social · Pañete y estuco de fachada · Instalación eléctrica de cocina · Pintura habitación principal (dos manos) · Mampostería muro divisorio · Ventanería en aluminio · Bulto de cemento gris x10 $342.000 · Viaje de arena de río $220.000 · Varilla de hierro 1/2" x20 $640.000 · Cerámica 60x60 $1.180.000.

## Copy direcciones B y C (archivado, resumen)
- **B:** H1 "No te contamos cómo funciona. Tócalo." — demo con instrucciones ("Toca Aprobar" → "Quedó registrado con tu nombre y la hora"; gasto sin factura → "$600.000 sin sustentar hace 3 días. Pide la factura antes del siguiente pago."). Tres verdades: foto+GPS+hora / tú apruebas / no pagas sin factura. Bifurcación "Es mi casa" / "Son mis clientes". Cierre: "Ya lo probaste. Ahora con tu obra de verdad."
- **C:** H1 "Cuentas claras, obra tranquila." — tablero "Plata entregada $12,4M · Sustentada $11,1M · Sin sustentar $1,3M" + frases espejo. "Tres preguntas dañan más obras que el invierno: ¿En qué va? ¿En qué se fue la plata? ¿Cuándo termina?" Sección espejo "Pones la plata / Pones el trabajo". Cierre: "La transparencia no se promete. Se muestra."

## Pendientes
1. Revisión de Victor del mockup v1 (artifact) → iteración.
2. Decisión CTA: registro directo vs lista de espera (Tally).
3. Decidir destino de la página: reemplaza `/para-ti` (ruta sugerida `/go` o `/mi-obra`) — resolver de paso los 3 problemas conocidos del /para-ti de Karen (claim offline falso, naming "arquitecto", conflicto waitlist).
4. Producción: fotos definitivas a `public/landing/fotos/` con CREDITS.md, video Remotion "La foto que sí dice la verdad", build real en el repo (componentes `landing-go/`), gate bugs+seguridad, deploy.
