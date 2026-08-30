# Gates: leaf-3.5 — Distribución de probabilidad

OWNS: src/lib/cronograma/**, src/components/personal/ContraPronostico.tsx, src/components/personal/LineaTiempoObra.tsx, scripts/verificar-probabilidad.ts

Scope: Pasar de {min, probable, max} a percentiles reales con factor común, y poder responder «qué probabilidad hay de terminar antes del X».

Modelo: **D = K · S**, con K ~ LogNormal(−σ_K²/2, σ_K²) y **σ_K = 0.25** — prior de literatura, NO medición de Seiricon (docs/specs/algoritmo-duracion.md §10.2). PERT por tarea sobre el rango que la semilla de rendimientos ya traía: μ_t = (o + 4·m̃ + p)/6, σ_t = (p − o)/6. CV²[D] = CV_S²·e^{σ_K²} + (e^{σ_K²} − 1). El centro NO se recalcula: E[D] es el total calibrado del motor, así que los cuatro casos patrón (baño 9 · cocina 18 · apto 62 · casa 116) no se han movido.

- [x] G1: El ancho relativo del intervalo DECRECE con el número de tareas (hoy es plano en 74%)
  CHECK: npx tsx scripts/verificar-probabilidad.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-probabilidad.ts → 92/92 verificaciones OK. §5 publica la curva medida con 9/18/36/72/144/288 tareas (obra sintética de 9 tareas por espacio, todas con rendimiento, replicada 1·2·4·8·16·32) — tareas · ANTES (max−min)/prob · AHORA σ_ln · idiosincrático (σ_K=0) · (p95−p10)/p50 · cadena: 9 · 81.5% · 0.2517 · 0.0289 · 78.8% · 9 || 18 · 81.4% · 0.2512 · 0.0249 · 78.7% · 17...
- [x] G2: Monte Carlo y forma cerrada coinciden dentro del 8%
  CHECK: npx tsx scripts/verificar-probabilidad.ts
  EXPECT: verificaciones OK
  EVIDENCE: §6 — cuatro casos patrón (mismos espacios y mismo areaTotal que verificar-duracion-calibracion.ts), caso · p50 cerrada · p50 MC · p80 cerrada · p80 MC · desvío · sesgo de fusión: Baño 5 m² 8.56 · 8.49 · 10.62 · 10.59 · 1.62% · −0.11% || Cocina 9 m² 17.72 · 17.68 · 21.91 · 22.03 · 1.48% · 0.06% || Apto 60 m² 59.82 · 60.13 · 73.86 · 74.76 · 1.89% · 0.09% || Casa 120 m² 112.74 · 112.40 · 139.17 ·...
- [x] G3: Monte Carlo es determinista — misma semilla, misma salida
  CHECK: npx tsx scripts/verificar-probabilidad.ts
  EXPECT: verificaciones OK
  EVIDENCE: §7 — OK dos corridas con la misma semilla dan el MISMO objeto, campo por campo (JSON idéntico) · OK y el mismo p80 hasta el último bit (195.63545228516801) · OK otra semilla da otro resultado, pero solo 0.72% distinto · OK el motor entero sigue siendo puro: dos llamadas idénticas dan el mismo JSON · OK 2000 iteraciones por defecto · OK converge: 500 y 4000 iteraciones dan el mismo p80 dentro de...
- [x] G4: probabilidadFecha es monótona y vale 0.80 exactamente en el P80
  CHECK: npx tsx scripts/verificar-probabilidad.ts
  EXPECT: verificaciones OK
  EVIDENCE: §8 — OK P(D ≤ p80) = 0.80 EXACTO, error 2.2e-16 (no 1e-7: zDe es la inversa de la PROPIA Φ por bisección, así que el ida y vuelta cierra al último bit) · OK lo mismo en p10, p50 y p95 · OK P(D ≤ x) es monótona no decreciente en 1600 pasos de 0.25 días · OK percentiles ordenados p10 66.2 < p50 91.3 < p80 112.7 < p95 137.8 · OK P(D ≤ 0) = 0 y P(D ≤ 10 000 d) = 1 · OK el p50 queda por debajo de la...
- [x] G5: La UI muestra FECHAS, no conteos de días — la ambigüedad hábiles/calendario desaparece
  CHECK: npx tsx scripts/verificar-probabilidad.ts
  EXPECT: verificaciones OK
  EVIDENCE: §8 verifica los dos componentes por inspección de fuente: OK ContraPronostico.tsx y LineaTiempoObra.tsx ya no leen totalDias (el contrato que consumen es probabilidad) · OK los dos enseñan la entrega como FECHA (usan pronosticoFechas + fechaLarga) · OK ninguno vuelve a escribir «días hábiles» en pantalla. Copy nuevo, en el tono de la app: «Lo más probable es que termines el 22 de diciembre. En...
- [x] G6: Verificación estática, de estilo, y sin regresión en el resto del motor
  CHECK: npx tsc --noEmit && npx eslint src/lib/cronograma src/lib/estimar-duracion.ts src/components/personal/ContraPronostico.tsx src/components/personal/LineaTiempoObra.tsx scripts/verificar-probabilidad.ts && npx tsx scripts/verificar-cronograma.ts && npx tsx scripts/verificar-duracion-calibracion.ts && npx tsx scripts/verificar-calendario.ts && npx tsx scripts/verificar-lint-linea-base.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsc --noEmit → exit 0, sin salida. $ npx eslint (los 5 destinos) → exit 0, sin salida. $ npx tsx scripts/verificar-cronograma.ts → 140/140 verificaciones OK (era 140/140). $ npx tsx scripts/verificar-duracion-calibracion.ts → 87/87 (era 87/87; O_0 = 1.6 · f = 1.78 sin tocar, baño 9 · cocina 18 · apto 62 · casa 116 sin moverse). $ npx tsx scripts/verificar-calendario.ts → 97/97 (era 97/97)...
## Qué se construyó

**`src/lib/cronograma/` gana seis ficheros, sin dependencias nuevas.**

- `aleatorio.ts` — xorshift128+ emulado con dos palabras de 32 bits (BigInt
  costaría ~20× y aquí se piden cientos de miles de números), semilla derivada
  de un texto por FNV-1a + splitmix32, y encima Box–Muller, la gamma de
  Marsaglia–Tsang, la Beta-PERT clásica (λ = 4) por cociente de gammas y el
  factor común LogNormal de media 1.
- `normal.ts` — Φ por Abramowitz & Stegun 7.1.26 (~10 líneas, error < 1.5e-7) y
  su inversa por BISECCIÓN SOBRE LA PROPIA Φ, para que `percentil` y
  `probabilidadHasta` sean inversas exactas la una de la otra. Un percentil que
  no cierra con su propia probabilidad es una promesa comercial que no se puede
  auditar.
- `probabilidad.ts` — PERT por tarea, ensanchado de las tareas sin rendimiento
  investigado, la forma cerrada del factor común y el contrato
  `DistribucionDuracion`.
- `flujo.ts` — el GRAFO FIJADO: congela el reparto de cuadrillas que el SGS ya
  decidió en arcos de secuencia. Es la pieza que hace que el ancho relativo
  decrezca de verdad (ver abajo).
- `montecarlo.ts` — 2000 iteraciones, una Beta-PERT por tarea, UNA por espera
  (el fragüe del pañete es el mismo mortero en toda la obra), una pasada CPM
  hacia adelante O(V+E) por iteración y un factor común por obra.
- `fechas.ts` — de días hábiles a FECHA, con el calendario colombiano.

**Por qué había que congelar el reparto de cuadrillas.** El CPM a secas supone
cuadrillas infinitas: en una obra de 32 baños idénticos su camino crítico son
los 9 pasos de UN baño, y no crece con el tamaño de la obra. Medir la
dispersión sobre ese camino habría dejado el ancho relativo PLANO otra vez, con
otra fórmula. Tomando el plan que el SGS ya calculó y añadiendo los arcos de
secuencia del pool (resource-flow network), el camino crítico pasa a ser la
cadena crítica DE RECURSOS —288 tareas con una cuadrilla, no 9— y ahí sí decae
como 1/N. §9 lo verifica: con una cuadrilla el CPM sobre el grafo fijado
reproduce EXACTAMENTE el makespan del SGS (36 = 36) y su cadena son las 20
tareas, no las 5 del CPM libre.

**El centro no se toca.** E[D] sigue siendo el total calibrado del motor; lo que
la capa de probabilidad calcula es la FORMA. El Monte Carlo se ancla igual:
D_i = centro · (T_i / T₀) · K_i, con T₀ el total determinista con las medias
PERT. Por eso la calibración (O_0 = 1.6, f = 1.78) y los cuatro casos patrón
salen intactos de este leaf.

**La banda de `f` NO entra en el término idiosincrático.** Un factor de
productividad es común a la obra entera —es la misma cuadrilla en todas las
tareas—, así que su incertidumbre vive en K. Meterla por tarea habría sido
volver a suponer correlación perfecta, que es justo el defecto que este leaf
borra. La banda de f implica CV 0.05; σ_K = 0.25 la cubre con holgura.

## Hallazgos honestos

**1. El ancho total apenas baja, y eso es el resultado, no un fallo.** Con
σ_K = 0.25 el factor común aporta CV 0.253 y el idiosincrático 0.029 en la obra
más pequeña medida: el común domina en CUALQUIER tamaño. El ancho relativo va de
25.2% (9 tareas) a 25.0% (288). Lo que sí cambia, y es todo lo que se pedía:
(a) esos números YA SON percentiles y se puede decir «80% de probabilidad»;
(b) la parte que se puede promediar se promedia —cae ×5.17 de 9 a 288 tareas—;
(c) el piso queda explícito y es auditable. Si mañana los rendimientos de la
semilla se validaran contra obra real y sus bandas se ensancharan, la curva
tendría más recorrido; con las bandas de hoy (±10–17% por tarea) no lo tiene.

**2. El aviso del encargo no se materializó.** Se avisaba de que el P80 saldría
MAYOR que el `max` actual en obras pequeñas. No ocurre en ninguna de las cuatro:
el `max` viejo estaba en el percentil 92–97, muy por encima de un P80. Lo que sí
se confirma es lo otro: ese par de números no era un intervalo de confianza —su
cobertura real iba del 88% al 95% según el tamaño de la obra.

**3. σ_t = (p−o)/6 es un 13% menor que la σ real de la Beta-PERT que se
muestrea.** Las dos son la PERT clásica: la primera es la aproximación de libro
de texto (la que pide el encargo y la que usa la forma cerrada) y la segunda es
la varianza exacta de la Beta con λ = 4, (μ−o)(p−μ)/7. La diferencia se mide en
§3 y queda muy por debajo del 8% de G2 porque el ancho total lo domina σ_K.

**4. Con más de UNA cuadrilla el grafo fijado queda algo suelto.** El SGS
reparte tasas fraccionarias y dos tareas del mismo pool pueden solaparse; entre
ésas no se puede tender un arco de secuencia. Medido: con capacidad 1 el CPM
fijado reproduce el SGS exactamente; con capacidad 2 o 3 se queda corto (12 vs
18 d en un caso sintético). No afecta al centro —la simulación va anclada al
total del motor— y el desvío contra la forma cerrada se queda en 5.4% en el
barrido de 1 a 16 cuadrillas. Los dos call sites del producto usan una
cuadrilla (`ContraPronostico`, `LineaTiempoObra`), donde el reparto es una
secuencia exacta.

**5. El determinismo llega hasta donde llega la norma de JS.** El generador es
bit a bit idéntico en cualquier motor (solo enteros de 32 bits). `Math.log`,
`Math.cos` y `Math.exp` los deja la norma a discreción de la implementación:
V8 y JavaScriptCore pueden diferir en ~1e-16 en una muestra. A granularidad de
DÍA —que es lo único que se enseña— es irrelevante, pero no se promete igualdad
binaria de percentiles entre motores: se promete la misma fecha.

**6. Un defecto real cazado en la tercera pasada.** La extracción del double de
53 bits del PRNG usaba `(hi >>> 5)·2^26 + (lo >>> 6)`, que concatena los bits
63..37 con los 31..6 y SE SALTA los bits 36..32. El generador pasaba igual las
pruebas de uniformidad (media, varianza, deciles). Se cazó contrastándolo
contra una referencia en BigInt, que ahora vive en la suite: 10000/10000
números idénticos. La fórmula correcta es `hi·2^21 + (lo >>> 11)`.

## Fuera de OWNS que hubo que tocar, y por qué

1. **`src/lib/estimar-duracion.ts`** (OWNS de leaf-3.1/3.2/3.3/3.4, los cuatro
   cerrados). Es donde vive el grafo, el plan del SGS y los rangos por tarea:
   la distribución no se puede calcular en ningún otro sitio. El cambio es
   ADITIVO — `ResultadoDuracion` gana `probabilidad` y `montecarlo`,
   `ResumenCronograma` gana `cadenaRecursos`, `OpcionesDuracion` gana
   `sigmaComun` y `montecarlo` — y `totalDias` se conserva intacto porque es lo
   que la suite de calibración lee e imprime (87/87 sin tocar un assert). Se le
   pone al campo la advertencia de que es cifra INTERNA y de que el contrato de
   interfaz es `probabilidad`.

2. **`src/app/(dashboard)/empezar/IntentWizard.tsx`** (OWNS de leaf-2.1/2.2).
   Dos props nuevas a `ContraPronostico` (`fechaInicio`, `fechaFin`) y una a
   `LineaTiempoObra` (`fechaInicio`). Sin ellas los componentes no tienen a qué
   fecha anclar y caerían a «si arrancas hoy», que es peor información teniendo
   el dato a mano. Nada más.

3. **`src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`** (sin OWNS
   declarado en ningún leaf). Tres props a `LineaTiempoObra`: `proyectoId` —que
   es la SEMILLA del Monte Carlo, sin ella la página del proyecto se quedaría
   con la forma cerrada y sin el sesgo de fusión—, `fechaInicio` y
   `diasHabilesSemana`, que la página ya tenía cargados.

4. **`docs/manual-de-usuario.md`**. Describía literalmente el copy que este leaf
   sustituye («usualmente toma ~N días hábiles — tu plan es más corto de lo
   usual / está dentro de lo normal / es holgado»). Se actualizan esos dos
   bullets de la sección «Cronograma: cuánto debería tardar tu obra».

## Lo que este leaf NO resuelve

- **σ_K = 0.25 no está medido.** Es prior de literatura. Hasta que no haya ~30
  obras terminadas con `dias_motor` guardado no se puede estimar de los datos, y
  es el número que gobierna el 99% del ancho del intervalo. Está expuesto como
  `opts.sigmaComun` para poder barrerlo, y documentado como prior en tres
  sitios distintos del código.
- **C_80 sigue sin poder calcularse.** La métrica que valida la promesa
  comercial (§7 del spec) necesita duraciones reales; `registros_duracion` sigue
  midiendo latencia de aprobación (§1 del spec). Este leaf construye el P80; que
  el 80% se cumpla de verdad no se puede verificar todavía con datos de nadie.
- **El ensanchado ×1.5 de las tareas sin rendimiento es juicio, no medición.**
  Por eso la `cobertura` viaja dentro de la distribución y la interfaz la enseña
  cuando baja del 50%.
