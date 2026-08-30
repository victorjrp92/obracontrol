# Gates: leaf-3.4 — CPM y programación con recursos

OWNS: src/lib/cronograma/**, src/lib/estimar-duracion.ts, src/components/personal/LineaTiempoObra.tsx, scripts/verificar-cronograma.ts

Scope: DAG con precedencia POR ESPACIO (no global), camino crítico, y SGS serial con cuadrillas finitas. Es el cambio que arregla el error dominante.

Calibración RE-BARRIDA y CONFIRMADA: **O_0 = 1.6 cd · f = 1.78** — los mismos valores de leaf-3.3. No se heredaron: el barrido del §8 se rehizo sobre el motor nuevo y devolvió la misma región factible (37/273 combinaciones en banda, margen 0.40). Los cuatro casos patrón NO se movieron, y el porqué está al final de este fichero.
Ecuación de cierre: **D = f · O_0 + D_ms**, con D_ms = SGS(f·D_t, Λ) — la misma D = f·(O_0 + D_trabajo) + Λ_ef de siempre, pero con Λ_ef medido por el scheduler en vez de por una fórmula cerrada.

- [x] G1: Se cumple el invariante D_CPM <= D_SGS <= suma de duraciones
  CHECK: npx tsx scripts/verificar-cronograma.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-cronograma.ts → 140/140 verificaciones OK. §6 verifica el invariante en 6 casos × 3 cuadrillas (18 asserts) más 12 asserts de cota: caso · CPM · SGS · Σ D_t · total → Baño 5 m² 5.2 / 6.0 / 6.0 / 9 d · Cocina 9 m² 10.5 / 15.4 / 15.4 / 18 d · Apto 60 m² 13.0 / 58.9 / 78.3 / 62 d · Casa 120 m² 15.7 / 113.5 / 145.9 / 116 d · 6 baños 5.2 / 26.3 / 36.0 / 29 d · 4 salas con...
- [x] G2: La precedencia es por espacio: dos espacios pueden estucarse en paralelo
  CHECK: npx tsx scripts/verificar-cronograma.ts
  EXPECT: verificaciones OK
  EVIDENCE: §1 y §2 — OK el grafo tiene un nodo por (espacio, tarea): 6 nodos · OK y 4 aristas de fase (2 por espacio), no las 9 de una precedencia global · OK NINGUNA arista cruza de un espacio a otro · OK toda arista de fase va de un orden constructivo menor a uno mayor · OK el orden de prioridad es por NIVEL topológico (línea de balance: A0,B0 · A1,B1 · A2,B2) · OK la última tarea del espacio A termina...
- [x] G3: El grafo nunca tiene ciclos y una arista explícita que los cree se rechaza
  CHECK: npx tsx scripts/verificar-cronograma.ts
  EXPECT: verificaciones OK
  EVIDENCE: §3 — OK ordenTopologico (Kahn, O(V+E)) devuelve null ante un ciclo de tres nodos · OK y devuelve un orden completo cuando NO lo hay, que es el control positivo · OK una arista explícita que cierra un ciclo se rechaza (rechazadas = 1) · OK y el grafo sigue siendo utilizable: queda la arista de fase y hay orden topológico · OK un bucle sobre sí misma también se rechaza · OK una arista explícita V...
- [x] G4: La tabla de cordura sigue dentro de banda tras recalibrar
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-duracion-calibracion.ts → 87/87 verificaciones OK, «Motor de duración verificado sin errores». Baño 9 d en [7,15] · Cocina 18 d en [10,20] · Apto 62 d en [60,70] · Casa 116 d en [100,120] — los CUATRO idénticos a antes del cambio. §8 barrido rehecho en esta corrida sobre el motor nuevo: 37/273 combinaciones meten los tres casos patrón en banda (17 también la cocina),...
- [x] G5: `depende_de` se escribe al crear el proyecto — el campo deja de estar muerto
  CHECK: npx tsx scripts/verificar-cronograma.ts
  EXPECT: verificaciones OK
  EVIDENCE: §7 — la cadena pura (src/lib/cronograma/dependencias.ts) reordena a orden constructivo y encadena: «Demolición y retiro de acabados existentes» abre el espacio, «Estuco paredes sala ← Demolición», «Estuco techo sala ← Estuco paredes», «Pintura final sala ← Estuco techo». OK cada eslabón depende del anterior (cadena, no árbol) · OK el predecesor siempre aparece antes, así que se puede crear en e...
- [x] G6: La línea de tiempo es una línea de balance y el overhead se pinta
  CHECK: npx tsx scripts/verificar-cronograma.ts
  EXPECT: verificaciones OK
  EVIDENCE: §8 — el desfase que reportó el leaf anterior está cerrado: OK Baño la última barra cae en el día 8.85 y el total es 9 d · Cocina 18.30 / 18 · Apto 61.73 / 62 · Casa 116.33 / 116 · 6 baños 29.12 / 29 · 4 salas con placa 50.64 / 51 (la tolerancia es el redondeo a día entero) · OK ninguna tarea arranca antes de que acabe el overhead (2.85 d) en los seis casos. Y el componente: OK LineaTiempoObra d...
- [x] G7: Verificación estática, de estilo, y sin regresión en el resto del motor
  CHECK: npx tsc --noEmit && npx eslint src/lib/cronograma src/lib/estimar-duracion.ts src/lib/estimar-presupuesto.ts src/components/personal/LineaTiempoObra.tsx "src/app/(dashboard)/empezar/actions.ts" scripts/verificar-cronograma.ts scripts/verificar-calendario.ts && npx tsx scripts/verificar-medicion-duracion.ts && npx tsx scripts/verificar-espacios.ts && npx tsx scripts/verificar-lint-linea-base.ts && echo TODO-OK
  EXPECT: TODO-OK
  EVIDENCE: $ npx tsc --noEmit → exit 0, sin salida. $ npx eslint (los 7 ficheros) → exit 0, sin salida. $ npx tsx scripts/verificar-medicion-duracion.ts → 83/83 verificaciones OK. $ npx tsx scripts/verificar-espacios.ts → 335/335. $ npx tsx scripts/verificar-calendario.ts → 97/97 (era 96/96: se cambió UN assert y se añadieron dos, ver más abajo). $ npx tsx scripts/verificar-planos.ts → 43/43. $ npx tsx sc...
## Qué se construyó

**`src/lib/cronograma/` (nuevo, 7 ficheros, 0 dependencias del dominio).**
`tipos.ts` (nodo = par espacio-tarea, arista con lag), `orden.ts` (Kahn,
alcanzabilidad, niveles, camino restante, orden de prioridad), `grafo.ts`
(construcción y guardián de ciclos), `cpm.ts` (ES/EF/LS/LF, holguras, ruta
crítica encadenada), `sgs.ts` (scheduler serial con capacidad y tope por
espacio), `dependencias.ts` (la cadena de `depende_de`), `index.ts`.

**El grafo.** Nodos `(espacio, tarea)`. Tres familias de aristas:

- **`E_fase`** — dentro de cada espacio, del nivel constructivo k al k+1. Es el
  cambio central. Dos fases con el mismo `ordenFase` en un espacio (una pareja
  de oficios simultáneos) comparten nivel y no se preceden.
- **`E_secado`** — las esperas, con su lag. Y cada una enganchada donde de
  verdad va, que antes no se podía decir porque no había aristas: el fragüe de
  pañete va de la tarea de pañete a la de estuco DEL MISMO ESPACIO; el secado
  por mano va sobre las aristas que entran a la pintura, espacio por espacio; y
  el fragüe de placa va de TODAS las placas a todo lo que se cargue encima en
  CUALQUIER espacio, porque la losa es una sola. Esa última es la que conserva
  la rigidez que midió leaf-3.3 (con 8 espacios sigue costando ρ·10 = 8.11 d).
- **`E_expl`** — `Tarea.depende_de`. Se traduce del id externo al id de nodo, y
  la que cierra un ciclo se descarta (se cuenta en `aristasRechazadas`) sin
  tumbar la estimación: un `depende_de` mal puesto por el usuario no puede
  dejar sin cronograma a la obra entera.

**CPM (nivel 1).** Dos pasadas topológicas. Devuelve el makespan con recursos
infinitos, ES/EF/LS/LF y holgura por nodo, y una ruta crítica ENCADENADA de
verdad (se reconstruye hacia atrás por el predecesor que empuja), no el conjunto
suelto de nodos con holgura cero. En el apto el CPM vale 13.0 d contra 78.3 de
la suma: ahí está medido cuánto pipeline hay disponible.

**SGS serial (nivel 2).** Orden de prioridad derivado del grafo: nivel
topológico ascendente, desempate por camino restante más largo, luego orden de
fase, luego id. Ordenar por nivel es un orden topológico válido y además es el
que produce la línea de balance (todos los espacios en la fase k antes que
ninguno en la k+1). El reparto de capacidad se rehace en cada evento, así que
la cuadrilla que se libera vuelve al bote.

## La decisión de modelo que hubo que tomar: las cuadrillas son divisibles

Con cuadrillas ENTERAS el modelo no cierra. La capacidad es `c^0.85`, o sea
1.80 con dos cuadrillas: si se redondea abajo el equipo doble no sirve de nada
(y el salón de 100 m² dejaría de acelerar, que es un assert vivo de la suite de
calibración) y si se redondea arriba desaparece el rendimiento decreciente (y
el ×1.80 se convierte en ×2, que es otro assert vivo). Así que una tarea puede
correr a TASA fraccionaria: media cuadrilla tarda el doble. Es la misma
divisibilidad que ya suponía el motor viejo cuando repartía el trabajo de una
fase entre `c_eff` cuadrillas.

Con dos topes, y los dos importan:

- **Ninguna tarea pasa de tasa 1.** Una tarea la hace una cuadrilla; las que
  sobran se van a otras tareas o a otros espacios. Es lo que garantiza
  `D_SGS >= D_CPM`: si una tarea pudiera acelerarse por debajo de su duración,
  el SGS atravesaría el suelo del CPM y el invariante dejaría de ser un teorema
  para ser una casualidad.
- **Tope de congestión por espacio**, `max(1, área ÷ a_min)`, el que ya existía.
  Por eso el baño de 5 m² dura 9 d con una cuadrilla y 9 d con ocho.

Y **pools por gremio**: las dos fases de una pareja paralela tienen capacidad
propia, porque el electricista y el plomero no son la misma persona. Antes esto
era un caso especial al sumar el total (`max(A, B)`); ahora sale solo del modelo
de recursos, y se verifica: con UNA cuadrilla las dos instalaciones ocupan la
misma franja [4.27, 4.57] y añadir la segunda no alarga la obra.

## Λ_ef ya no es una fórmula, es una medición

leaf-3.3 calculaba la absorción del secado con una forma cerrada
(`max(0, ρ·Λ_abs − f·V)`) y se declaraba a sí misma «cota de primer orden, no un
scheduler». Ahora los lags viven en las aristas y el scheduler los sufre, así
que Λ_ef se MIDE: se encienden las esperas de una en una en orden constructivo y
se anota cuánto se alarga el makespan con cada una. Por construcción
Σ(incrementos) = makespan(con todas) − makespan(sin ninguna), y eso se verifica
en 18 combinaciones de caso y cuadrillas.

La consecuencia es que la absorción dejó de estar limitada al trabajo de la
MISMA fase en otros espacios: ahora tapa el secado cualquier tarea que el grafo
deje disponible. Los números heredados aguantan casi todos —baño 1.62 = ρ·2,
apto 0, seis baños 0, placa con 8 espacios 8.11 = ρ·10, jornada 5/6/7 →
1.34/1.62/1.90— y uno se movió, a propósito.

## El assert de leaf-3.3 que hubo que cambiar, y por qué

`verificar-calendario.ts` exigía que el secado del apto siguiera absorbido
«con 1–4 cuadrillas». El scheduler encuentra 0.83 d de cola ya con 4: con 3.48
cuadrillas-equivalente el último espacio SÍ llega a la pintura antes de que su
propio estuco haya fraguado. La curva medida es 0.00 / 0.02 / 0.83 / 2.95 /
3.24 d con 1/2/4/8/12 cuadrillas — misma FORMA que antes (cero con una, crece,
se satura), distinto umbral. El assert pasa a exigir la forma: cero con una
cuadrilla, monótona no decreciente, y por encima del 80% del máximo con doce.
Se añadieron dos asserts, no se relajó ninguno: 96 → 97.

Es el escenario que el propio leaf-3.3 dejó anotado en su punto 5 («la absorción
es una cota de primer orden… al conectarlo hay que re-correr el barrido»).

## La calibración se rehizo, y salió la misma. Eso hay que explicarlo

Los cuatro casos patrón NO se movieron: baño 9 · cocina 18 · apto 62 · casa 116,
antes y después. El barrido §8 se rehizo entero sobre el motor nuevo y devolvió
la misma región (37/273) y el mismo punto fijado.

**No es que el pipeline no funcione: es que con UNA cuadrilla no hay nada que
pipelinear.** El error dominante que describe el spec —«se estuca el espacio 1,
luego el 2, y solo cuando el último está estucado empieza la pintura del
primero»— es real como MODELO, pero su efecto sobre el makespan con `c = 1` es
cero: una cuadrilla hace una cosa a la vez, así que el makespan es la suma del
trabajo, se ordene como se ordene. Y `c = 1` es el único valor que hay en
producción (los dos call sites lo fijan). El motor viejo llegaba al mismo número
por el camino equivocado.

Lo que sí cambia, y es lo que había que construir:

1. **El pipeline existe y está medido.** CPM del apto = 13.0 d contra 78.3 de la
   suma: si el usuario contrata más gente, ahora el motor sabe cuánto puede
   bajar y por qué. Con 64 cuadrillas el apto baja a 13.0 y se para ahí, en el
   camino crítico, en vez de seguir dividiendo hasta el absurdo (el defecto §4.3
   del spec, «apto más rápido que un baño»).
2. **La curva de cuadrillas cambió de forma.** 62 / 36 / 26 / 22 / 18 / 17 d con
   1/2/3/4/6/8: satura contra el CPM en vez de dividir. Antes saturaba contra un
   tope de congestión sumado por fases, que era una aproximación de esto.
3. **Λ_ef se mide en vez de aproximarse** (arriba).
4. **`depende_de` está vivo**, así que el usuario puede ver y editar su
   cronograma, y el motor lo respeta y rechaza los ciclos.
5. **La línea de tiempo es un cronograma**, con franjas por espacio, ruta
   crítica y overhead pintado.

La calibración se rehace, no se hereda — y esta vez el barrido dijo que el punto
no se mueve. Está bien que así sea: significa que el cambio fue de estructura,
no de nivel.

## Fuera de OWNS que hubo que tocar, y por qué

- **`src/lib/estimar-presupuesto.ts`** — dos campos OPCIONALES en `TareaEstim`:
  `id` y `dependeDe`. Sin ellos el motor no puede recibir `E_expl` y el punto 5
  del enunciado (que `depende_de` deje de estar muerto) se queda a medias. El
  estimador de costos los ignora.
- **`src/app/(dashboard)/empezar/actions.ts`** — es donde se crea la obra B2C, o
  sea el único sitio donde se puede escribir `depende_de` al crear el proyecto.
  Las tareas de cada espacio pasan a crearse en ORDEN CONSTRUCTIVO y encadenadas.
- **`scripts/verificar-calendario.ts`** — el assert de umbral explicado arriba.
  Ninguna otra assert se tocó.

## Para el siguiente leaf

1. **El wizard B2B no escribe `depende_de`.** `api/proyectos/[id]/wizard/route.ts`
   inserta las tareas con `createMany` en bloque, así que no hay id del
   predecesor a mano; habría que pre-generar los cuid o hacer una segunda
   pasada de `update`. El flujo B2C (que es el que consume el motor de duración)
   ya queda cubierto.
2. **`ResultadoDuracion.cronograma` está casi sin consumir en el front.** Trae
   `cpmDias`, `sgsDias`, `sumaDias` y la `rutaCritica`, y solo la criticidad se
   dibuja. `ContraPronostico` podría decir «con más gente esto no baja de 13
   días», que es la pregunta que el usuario hace de verdad.
3. **`diasHabilesSemana` sigue sin llegar desde ningún call site** (pendiente
   heredado de leaf-3.3). El motor lo acepta y `Proyecto.dias_habiles_semana` lo
   tiene; son dos líneas.
4. **Nadie llama a `addWorkingDays`** (pendiente heredado). Ahora hay además
   `inicioDias`/`finDias` por tarea, así que convertir el cronograma en FECHAS
   reales es directo.
5. **La prioridad del scheduler es fase-mayor.** La cuadrilla estuca todos los
   espacios antes de pintar ninguno. La alternativa (espacio-mayor: terminar el
   baño 1 entero antes de tocar el baño 2) da el mismo makespan con una
   cuadrilla y una línea de tiempo muy distinta. Si algún día se pregunta al
   usuario cómo prefiere trabajar, el cambio es la función de prioridad de
   `orden.ts` y nada más.
6. **`docs/manual-de-usuario.md` no se tocó**: nada de esto está commiteado ni
   mergeado a `main`, que es el disparador que fija AGENTS.md.
