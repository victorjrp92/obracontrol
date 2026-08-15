# Spec — «Juntos» (`/go/juntos`) · línea de ayuda post-sismo de Seiricon Go

**Fecha:** 2026-08-14 · **Rama:** `victor` (NO tocar main) · **Estado:** aprobado por Victor, en build.
**Contexto:** sismo 7.4 del 10-ago-2026 (epicentro San José del Palmar, Chocó). Ciudades foco: Cali, Pereira, Manizales, Quibdó.

## Concepto (fijado por Victor)
- **Nombre:** Juntos. **H1 exacto:** «No estás solo frente a estas grietas.»
- Tesis: nadie debería revisar su casa solo. Acompañamiento, NUNCA porno de catástrofe.
- Subtítulo hero: «Te guiamos paso a paso para revisar cómo quedó tu casa y te entregamos un acta con fotos, ubicación y fecha — lista para tu aseguradora. Gratis, sin crear cuenta.»
- CTA hero: «Empezar la revisión» + micro «Toma 5 minutos · No necesitas saber de construcción».
- **El acta se llama «acta de documentación de daños»** — PROHIBIDO: peritaje, dictamen, certificado de habitabilidad, "es seguro", porcentajes de riesgo.
- Papel legal: documentamos hechos (foto+GPS+fecha+declaración del dueño). La evaluación técnica la hacen Bomberos/Cruz Roja. Nosotros somos el notario de los hechos, no el experto.

## Diseño
Sistema **«Vivo/Aizome»** de /go (Figtree, papel #FBFAF7, tinta #0B1220, índigo #2563EB, ámbar #D97706 escaso; pills borde tinta + sombra dura; tarjetas pastel; verde SOLO en UI real de app). Registro: **español estándar con tuteo** (cero voseo, cero "plata"/"lo mío"). Fotos elegidas en `public/landing/juntos/` (hero: `juntos-hombros.jpg`; secciones: `juntos-manos-taller.jpg`, `juntos-manos-cuidado.jpg`, `juntos-manos-calido.jpg`; secundarias disponibles). Créditos ya en CREDITS.md.

## Arquitectura de páginas (todas bajo `/go/juntos`, layout propio SIN el chrome de (public))
1. **`/go/juntos`** — landing emocional: hero foto `juntos-hombros` full-bleed + H1 + 2 caminos («Revisar una grieta» / «Documentar los daños») + sección "así te acompañamos" (3 pasos) + sección acta (mock del documento + "lo que muchos pierden no es la casa: es la prueba") + "¿Por qué gratis?" (somos empresa colombiana de control de obra; documentar con pruebas es lo que sabemos hacer) + FAQ corto + cierre.
2. **`/go/juntos/revisar`** — wizard de grietas (motor de Karen adaptado).
3. **`/go/juntos/documentar`** — wizard del acta (motor de Karen adaptado).
4. Pantalla post-descarga (paso final de ambos wizards, no ruta aparte): tarjetas-gancho expandibles (ver abajo).

## Flujo obligatorio
**Filtro de seguridad SIEMPRE primero** (4 preguntas, CERO datos personales, sin consentimiento —no se recoge nada—):
- Cualquier "sí" → pantalla roja: «Sal ahora» + **123 grande** + líneas por ciudad (de `telefonos.ts`) + más abajo: «Cuando ya estés afuera y a salvo, documenta lo que pasó — lo vas a necesitar para el seguro y para pedir ayuda» con botón «Enviarme el enlace por WhatsApp» (wa.me con texto prellenado; sin guardar nada) y opción de documentar **desde afuera** (fachada/exterior). Línea explícita: «No vuelvas a entrar por una foto. Ningún documento vale eso.»
- Las 4 respuestas NO llevan default: estado `respondidas` aparte (patrón FiltroSeguridad de Karen, que está bien hecho).

**Wizard de grietas:**
- Ubicar elemento con **ilustraciones didácticas** (ver §Ilustraciones). «No estoy seguro» siempre visible y empujado («si dudas, elige esto — así no se subestima el resultado»).
- Guía de foto con **animación de la moneda** (ver §Moneda).
- Resultado = **prioridad de revisión** (urgente / pronto / cuando puedas) con el porqué en una línea + qué hacer + qué NO hacer + disclaimer compartido. NUNCA "seguro"/"sin riesgo". Verde dice «No vemos señales de alarma en esta foto» + ADVERTENCIA_VERDE.
- Modo manual: las 5 banderas de peligro SIN default (bug de Karen `DescribirGrietaManual` — corregir con patrón `respondidas`).

**Wizard del acta:** espacios → fotos (con GPS/fecha quemados, overlay.ts de Karen) → descripción de pérdidas por espacio → **vista previa del PDF** («Tu acta está lista. Solo falta ponerle tu nombre.») → **gate de datos** → descarga → pantalla post-descarga.

## Gate de datos (el momento de conversión)
- Antes del formulario: preview real del documento + 3 líneas de uso (aseguradora / subsidios / cotizar sin que improvisen el daño).
- Campos con microcopy que los justifica: Nombre y apellido («como aparece en tu cédula») · **Cédula** («**No la guardamos en nuestros servidores** — se imprime en tu documento porque tu aseguradora la va a pedir, y se descarta») · WhatsApp («te enviamos el acta también por ahí, por si pierdes el archivo») · Dirección del inmueble («va en el documento como ubicación del daño») · Ciudad.
- **Dos casillas separadas, ninguna premarcada:**
  1. OBLIGATORIA: autorización de tratamiento de datos (Ley 1581, link a /privacidad) para generar el documento y enviarlo por los canales que él pida + reconocimiento «entiendo que este documento no es una evaluación estructural ni un dictamen técnico».
  2. OPCIONAL: «Quiero que me escriban cuando vaya a reparar, para que me den una mano con eso.» — NO condiciona la descarga.
- Botón: «Descargar mi acta». Bajo el botón: «Gratis. Sin crear cuenta.»
- **Persistencia:** guardar SOLO (tabla nueva `contacto_juntos`): nombre, whatsapp, ciudad, audiencia(propietario/administrador/contratista), acepta_contacto, created_at. **La cédula y la dirección NUNCA se guardan** — viajan en el request del PDF, se imprimen y se descartan. El código debe hacerlo evidente (comentario + ningún log del body).
- Pregunta de rol (para el negocio): «¿Este inmueble es…?» con CINCO opciones — se separa vivir de arrendar (quien arrienda suele estar lejos: perfil diáspora) y administrador de copropiedad de inmobiliaria (negocios distintos; el administrador de conjunto es el lead más valioso por la Ley 675 y porque un edificio son muchas actas): `propietario_habita` («Mi casa o apartamento — vivo ahí») · `propietario_arrienda` («…lo tengo arrendado») · `administrador_ph` («El conjunto o edificio del que soy administrador») · `inmobiliaria` («Inmuebles de otros dueños») · `contratista` («La obra de un cliente»).

## Pantalla post-descarga — tarjetas-gancho (pedido explícito de Victor)
PDF limpio (sin publicidad) + pantalla con **tarjetas cerradas estilo feed** que INVITAN AL CLICK: cada una con gancho + cifra ancla + chevron/»Toca para ver cómo» explícito + microanimación de apertura. Deben verse claramente tocables (affordance: borde, sombra dura, flecha, «+»). Contenido EXACTO de `src/lib/juntos/contenido-legal.ts` (ya escrito, con fuentes):
1. «Tienes 3 días para avisarle a tu aseguradora.» (art. 1075)
2. «Si te dicen que no cubre, ellos tienen que probarlo. No tú.» (art. 1077)
3. «Un mes para pagarte. Después te deben intereses.» (art. 1080)
4. «Las zonas comunes de tu conjunto están aseguradas contra terremoto. Por ley.» (Ley 675 art. 15)
5. «Sin estar en el censo, no hay ayuda. Y el censo va atrasado.» (RUD: pasos, documentos, punto de atención por ciudad, y **botón «Descargar mi derecho de petición»** prellenado con sus datos y pérdidas → segundo PDF)
6. «Nadie puede cobrarte por esto. Es gratis.» (antiestafa)
Cierre: «Si en algún momento vas a reparar, escríbenos. Te damos una mano con eso también.» — sin venta dura.

## Derecho de petición (segundo PDF)
Plantilla formal (es un derecho constitucional, art. 23 C.P.): dirigido a la alcaldía de su ciudad, identifica al peticionario (nombre, cédula), narra los hechos (sismo 10-ago-2026, dirección del inmueble, resumen de daños tomado del acta), solicita inclusión en el censo/RUD y la evaluación técnica de la vivienda, anexa el acta. Recordar en pantalla: la autoridad tiene 15 días hábiles para responder.

## PDF del acta — profesional
Base: `ActaDanosReport.tsx` de Karen (react-pdf, ADAPTAR). Añadir: logo real (`public/seiricon-logo.png` vía `<Image>`), bloque de identidad (nombre, cédula, WhatsApp, dirección, ciudad), **folio** `JT-<AAAAMMDD>-<6 hex>` + **hash SHA-256** del contenido impreso en el pie («Verificación: <folio> · <hash-corto>»), inventario por espacio con fotos `objectFit: "contain"` (no cover), resumen de daños al inicio (para el RUD), **disclaimer de una línea en el pie de CADA página** (7-8pt gris, patrón del InformeGrietasReport) + párrafo sobrio al final. Tipografía: Helvetica está bien (react-pdf no soporta WOFF2; NO bloquear por Figtree — si se quiere, conseguir TTF después).
Informe de grietas: mismo tratamiento + ADVERTENCIA_VERDE también en el PDF cuando el nivel sea verde.

## Motor (ya traído a la rama por Victor/Claude — NO tocar la lógica)
`src/lib/alerta/` (reglas, triage, tipos, filtro-seguridad, observar-grieta, copys), `src/lib/media/overlay.ts`, `scripts/verificar-*.ts`. Los copys de nivel se reescriben en TUTEO (están en voseo: «Salí y buscá…» → «Sal y busca…») — solo strings, la estructura queda. Correr `npx tsx scripts/verificar-reglas-alerta.ts` y `verificar-triage-alerta.ts` tras cualquier cambio: deben dar 43/43 y 37/37.

## Seguridad (obligatorio antes de publicar)
- **Rate limit** en TODAS las rutas API nuevas/adaptadas (en memoria está bien: N por IP por minuto; éxito falso o 429).
- **`acta-email` NO se monta** en el flujo Juntos (conflicto con promesa de cédula). El acta llega por descarga; «enviármelo por WhatsApp» = wa.me link del propio usuario (no enviamos nosotros).
- Ningún `catch` serializa el body (fotos base64/cédula) a logs. Mensajes de error genéricos.
- `observar-grieta` queda tras `ALERTA_VISION_ENABLED` (hoy off) — el flujo funciona 100% en modo manual/reglas.
- Validación estricta ya existente (allowlists, topes) se conserva; tope por imagen además del agregado.
- Aviso en el paso de foto: «La foto se analiza para ayudarte a clasificarla y no se guarda en nuestros servidores.»

## Teléfonos (ya en `src/lib/juntos/telefonos.ts` — usar SOLO estos, tienen fuente y fecha)
123 nacional primero y grande SIEMPRE. Por ciudad: los verificados. Los no confirmados NO se muestran.

## Ilustraciones didácticas (ubicar la grieta)
Nada de fotos (una columna fotografiada parece un muro). **SVG esquemáticos inline propios**: casa en corte con el elemento resaltado en índigo + nota de una línea («suele ser más grueso y sostiene el techo»). 7 tarjetas: columna, viga, muro que sostiene, muro divisorio, techo/losa, piso, «No estoy seguro». Estilo: trazo tinta 2px, relleno índigo suave, esquinas rectas — coherente con Aizome.

## Animación de la moneda (guía de foto)
Micro-demo en código (patrón useLoopGo, ~6s loop): pared con grieta vertical → una mano acerca la moneda ACOSTADA (mal, se marca con X ámbar) → la gira y la apoya PLANA CONTRA LA PARED junto a la grieta, en el mismo plano (bien, check verde índigo) → zoom del encuadre correcto (grieta + moneda nítidas, ~30cm). Texto: «La moneda va pegada a la pared, junto a la grieta — así medimos el ancho real.» prefers-reduced-motion: estado final estático.

## Métricas honestas
Nada de contadores inventados. Si se menciona el sismo, cifras oficiales con fuente o nada.

## Verificación mínima (cada commit)
`npx tsc --noEmit -p tsconfig.json` + `npx eslint` de las carpetas tocadas + los 2 scripts de verificación del motor + QA responsive 360/390 (cero scroll horizontal) + contraste AA en texto pequeño.
