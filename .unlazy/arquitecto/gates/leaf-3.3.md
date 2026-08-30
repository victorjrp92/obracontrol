# Gates: leaf-3.3 — Calendario colombiano y esperas como lags

OWNS: src/lib/calendario-colombia.ts, src/lib/estimar-duracion.ts, src/lib/scoring.ts, scripts/verificar-calendario.ts

Scope: Festivos colombianos con Ley Emiliani y Pascua algorítmica; esperas convertidas de sumandos a lags de arista; una sola definición de día hábil en todo el repo.

Calibración RE-FIJADA: **O_0 = 1.6 cd · f = 1.78** (antes 2.5 / 1.65). El barrido se rehizo porque el cambio movió los casos patrón: al absorber las esperas el apto se caía a 59 d (banda 60–70). Detalle al final de este fichero.
Ecuación de cierre: **D = f · (O_0 + D_trabajo) + Λ_ef**, con Λ_ef = Σ max(0, ρ·Λ_abs − f·V) + ρ·Λ_rig.

- [x] G1: Los 18 festivos coinciden con el calendario oficial de 2025, 2026 y 2027
  CHECK: npx tsx scripts/verificar-calendario.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-calendario.ts → 96/96 verificaciones OK. §2 Los 18 festivos contra el calendario OFICIAL, escrito a mano: OK 2025 el generador produce 18 festivos (obtuvo 18) · OK 2025 las 18 fechas coinciden UNA A UNA con el calendario oficial · OK 2025 reparto por regla 6/7/2/3 (obtuvo 6/7/2/3) · OK 2026 las 18 fechas coinciden UNA A UNA con el calendario oficial · OK 2026 reparto por regla 6/7/2/3 · OK 2027 las 18 fechas coinciden UNA A UNA con el calendario oficial · OK 2027 reparto por regla 6/7/2/3 · OK 2025 18 festivos en 17 fechas distintas (obtuvo 18 en 17) · OK 2025 el 30 de junio caen DOS festivos (San Pedro y San Pablo + Sagrado Corazón de Jesús) · §1 OK Pascua 2025 = 2025-04-20, 2026 = 2026-04-05, 2027 = 2027-03-28 · OK la Pascua cae SIEMPRE en domingo y entre el 22 mar y el 25 abr (1900–2100). La lista oficial está transcrita A MANO en el script (const OFICIAL), no generada por el módulo.

- [x] G2: La Ley Emiliani traslada al lunes los 7 festivos que corresponde, y no los otros
  CHECK: npx tsx scripts/verificar-calendario.ts
  EXPECT: verificaciones OK
  EVIDENCE: §3 Ley 51 de 1983 («Emiliani») — traslada 10, deja quietos 8: OK los 7 fijos trasladables + los 3 móviles trasladables caen SIEMPRE en lunes (2000–2050, 510 casos) · OK los 6 fijos + Jueves y Viernes Santo NO se trasladan NUNCA (2000–2050, 408 casos) · OK …y por eso caen en cualquier día de la semana (vistos 7 de 7) · OK Reyes Magos 2025 / San Pedro y San Pablo 2026 / Día de la Raza 2026 / Todos los Santos 2027: la base ya era lunes, se queda, sin correr otra semana · OK trasladarALunes suma 1 desde domingo, 6 desde martes, 2 desde sábado y 0 desde lunes · OK 2025, 2026 y 2027: offsets pascuales −3 / −2 / +43 / +64 / +71 exactos.

- [x] G3: Ninguna definición de día hábil es ciega a los festivos
  CHECK: npx tsx scripts/verificar-dias-habiles-unico.ts
  EXPECT: verificaciones OK
  EVIDENCE: 2026-08-30 driver — el CHECK original era FALSO POSITIVO (el \\| colapsaba a | y grep lo leia literal: 0 definiciones, decia ok, habia 3). Y su ENUNCIADO tambien estaba mal: pedia una sola funcion, que era mi proxy de lo que importa. Lo que importa es que ninguna cuente un festivo como dia trabajado. Quedan 2 adaptadores legitimos (IntentWizard: entradas de texto y null; duraciones-mercado: dias fraccionarios) y los DOS delegan en el canonico. Guardia nuevo con control positivo: una copia ciega lo hace fallar. 3/3 OK.
- [x] G4: En obra grande las esperas se absorben; en un baño único empujan la fecha
  CHECK: npx tsx scripts/verificar-calendario.ts
  EXPECT: verificaciones OK
  EVIDENCE: §7 Esperas como LAGS — baño 5 m² (1 espacio): espera cruda 2.00 d calendario → lag efectivo 1.62 d hábiles; apto 60 m² (6 espacios): espera cruda 4.00 d calendario → lag efectivo 0.00 d hábiles. OK en el apto de 6 espacios el secado se ABSORBE con el trabajo paralelo (lag 0.00 = 0) · OK en el baño único el secado EMPUJA la fecha (lag 1.62 > 0) · OK y lo que empuja es ρ·espera, no la espera cruda: 1.62 ≈ 1.62 (era 2.00) · OK la conversión de unidades recorta 19% de la espera del baño · OK apagar las esperas NO mueve el apto (62 = 62 d): ya estaban absorbidas · OK apagar las esperas SÍ acorta el baño (9 → 7 d) · OK seis baños iguales absorben el secado aunque cada uno mida lo mismo que el baño solo · OK y por eso 6 baños (29 d) cuestan menos que 6 × un baño (54 d) · OK el fragüe de placa NO se absorbe ni con 8 espacios: es un lag RÍGIDO, la losa es una sola · OK apto con 1/2/4/8/12 cuadrillas → lag 0.00 / 0.00 / 0.00 / 1.06 / 1.11 d, el secado reaparece cuando las cuadrillas adelantan al mortero · OK baño con jornada 5/6/7 → lag 1.34 / 1.62 / 1.90 d hábiles sobre los mismos 2.00 d calendario, exactamente ρ(jornada)·espera.

- [x] G5: La calibración se rehízo y los CUATRO casos de cordura siguen dentro de banda
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-duracion-calibracion.ts → 87/87 verificaciones OK, «Motor de duración verificado sin errores». OK Baño 5 m²: 9 d dentro de [7, 15] · OK Apto 60 m²: 62 d dentro de [60, 70] · OK Casa 120 m²: 116 d dentro de [100, 120] · OK Cocina 9 m²: 18 d dentro de [10, 20] · OK Σfases + lags + overhead = total en los tres casos (8.85 = 9, 61.74 = 62, 116.32 = 116). §8 Barrido rehecho en cada corrida: 37/273 combinaciones meten los tres casos patrón en banda (17 también la cocina); fijado en rendimientos.ts O_0=1.6 f=1.78 → 9 / 62 / 116 d (margen 0.40) · OK la calibración no es frágil: 37 combinaciones válidas (≥ 20) · OK el punto fijado no está en el borde (margen 0.40 ≥ 0.30 de media banda) · OK y sigue siendo tan bueno como el mejor de la rejilla (0.40 ≥ 0.8 × 0.40).

- [x] G6: Verificación estática, de estilo y sin regresión en el resto del motor
  CHECK: npx tsc --noEmit && npx eslint src/lib/calendario-colombia.ts src/lib/estimar-duracion.ts src/lib/scoring.ts src/lib/rendimientos.ts scripts/verificar-calendario.ts scripts/verificar-duracion-calibracion.ts && npx tsx scripts/verificar-medicion-duracion.ts && echo TODO-OK
  EXPECT: TODO-OK
  EVIDENCE: $ npx tsc --noEmit → exit 0, sin salida. $ npx eslint (los 6 ficheros) → exit 0, sin salida. $ npx tsx scripts/verificar-medicion-duracion.ts → 82/82 verificaciones OK, «Medición de duración verificada sin errores». Nota de la corrida: a mitad del trabajo tsc reportó 3 errores en IntentWizard.tsx (props catalogo y esLocal) que NO son de este leaf — el fichero tenía mtime 20:06:56, posterior a mis ediciones, porque otro leaf lo estaba editando en paralelo; en la verificación final ya estaban resueltos por su dueño.

- [x] G7: El calendario y el motor siguen siendo puros y deterministas
  CHECK: npx tsx scripts/verificar-calendario.ts
  EXPECT: verificaciones OK
  EVIDENCE: §8 El módulo es puro y determinista — OK src/lib/calendario-colombia.ts sin prisma / fetch( / Math.random / Date.now / import, mirando solo líneas de CÓDIGO porque la cabecera menciona Date.now justamente para decir que no lo usa · OK y sin una sola dependencia: el módulo no importa nada, ni siquiera del repo · OK dos llamadas idénticas devuelven lo mismo (el caché no ensucia el resultado) · OK festivosColombia() devuelve una COPIA: mutarla no toca el caché (18 → 18) · OK y el festivo inventado no se coló en esFestivo(). El motor sigue pasando su propia comprobación en la otra suite: OK src/lib/estimar-duracion.ts sin prisma / fetch( / Math.random / Date.now / new Date( — ρ entra como constante derivada importada, nunca como lectura de reloj, y su ventana de promediado es fija (2026–2045) para que no cambie el 1 de enero.

## Qué se construyó

**`src/lib/calendario-colombia.ts` (nuevo · 0 dependencias · 0 lecturas de reloj).**
Pascua por Meeus/Jones/Butcher, aritmética entera. Los 18 festivos GENERADOS de
tres reglas: 6 fijos sin traslado, 7 fijos con traslado al lunes (Ley 51 de 1983),
2 pascuales sin traslado (Pascua−3, Pascua−2) y 3 pascuales con traslado
(Pascua+43, +64, +71). `esHabil` es LA definición de día hábil; `addWorkingDays`,
`diasHabilesEntre` y `rho` son las tres operaciones que necesita el motor.

**Festivos de 2026, como muestra:** 1 ene · 12 ene Reyes (←6 ene) · 23 mar San
José (←19 mar) · 2 abr Jueves Santo · 3 abr Viernes Santo · 1 may · 18 may
Ascensión · 8 jun Corpus · 15 jun Sagrado Corazón · 29 jun San Pedro (ya era
lunes) · 20 jul · 7 ago · 17 ago Asunción (←15 ago) · 12 oct Raza (ya era lunes) ·
2 nov Todos los Santos (←1 nov) · 16 nov Cartagena (←11 nov) · 8 dic · 25 dic.
Salen 295 días hábiles en 2026 con jornada Lu–Sá: 365 − 52 domingos − 18 festivos.

**El caso raro que conviene conocer:** 2025 tiene 18 festivos en 17 FECHAS. El 30
de junio caen a la vez el Sagrado Corazón (Pascua+71) y San Pedro y San Pablo
(29 jun domingo → lunes 30). No es un fallo del generador, es el calendario real,
y la suite lo verifica explícitamente en vez de esconderlo.

## Cómo se convirtieron las esperas

Antes `Λ` se sumaba cruda al total. Eran dos errores compuestos.

**1. UNIDADES.** La espera se mide en días CALENDARIO (el mortero fragua también
el domingo y el 25 de diciembre) y el total de la obra está en días HÁBILES, que
es lo que consume `addWorkingDays`. Sumarlos crudos cobra cada día de secado como
un día de trabajo perdido. La conversión es `Λ_hábiles = ρ · Λ_calendario`, con
ρ = hábiles/365: ρ(5) = 0.670 · **ρ(6) = 0.8105** · ρ(7) = 0.951, promediados
sobre una ventana FIJA (2026–2045) para que el motor no deje de ser puro el 1 de
enero. Recorta un 19% de cada espera con jornada Lu–Sá. Los 18 festivos valen 4.7
puntos de ρ(6): sin ellos sería exactamente 6/7 = 0.857.

**2. ABSORCIÓN.** Un lag solo empuja la fecha si nadie puede trabajar mientras
tanto. Mientras el estuco del baño 1 fragua, la cuadrilla estuca el baño 2. La
ventana de absorción de una fase es `(trabajo de la fase − trabajo del espacio
más cargado) ÷ cuadrillas de la fase`, y lo que sobrevive es
`Λ_ef = max(0, ρ·Λ_abs − f·V) + ρ·Λ_rig`. Con un solo espacio V = 0 y la espera
empuja entera; con seis desaparece del camino crítico. La división por las
cuadrillas NO es cosmética: con 8 cuadrillas los otros espacios se despachan
antes de que seque el primero y el lag REAPARECE (medido: 0.00 / 0.00 / 0.00 /
1.06 / 1.11 d con 1/2/4/8/12 cuadrillas). Sin dividir, «más cuadrillas» borraría
esperas que la física no borra.

Los lags se clasifican en **absorbibles** (secado POR ESPACIO: fragüe de pañete,
secado por mano de pintura) y **rígidos** (fragüe de placa: la losa es UNA en
toda la obra, no hay «otro espacio» donde cargar mientras cura). Verificado: el
fragüe de placa sigue empujando con 8 espacios.

El contrato público gana un campo. `FaseDuracion.esperaDias` sigue siendo la
espera CRUDA en días calendario (lo que hay que DIBUJAR) y el nuevo
`esperaEfectivaDias` es lo que SUMA al total, en días hábiles. En el apto valen
4.00 y 0.00: por eso la línea de tiempo puede seguir pintando la banda de secado
sin que el total la cobre.

**`f` sigue FUERA de Λ.** Se respetó la decisión medida de leaf-3.2 — un factor
de PRODUCTIVIDAD no puede estirar un fragüe. Lo que esta fase cambia es el TAMAÑO
de Λ, no su posición en la ecuación.

## La calibración se movió, y se rehizo

Era inevitable: absorber las esperas quita ~4 d al apto y a la casa y solo ~0.4 d
al baño, o sea quita un término CONSTANTE que estaba haciendo de segundo
overhead. Con (2.5, 1.65) el apto se caía a **59 d**, fuera de la banda 60–70.
Barrido rehecho sobre el motor de hoy:

| Punto | Baño 7–15 | Cocina 10–20 | Apto 60–70 | Casa 100–120 | margen mín. |
|---|---|---|---|---|---|
| (2.5, 1.65) heredado | 10 ok | 19 ok | **59 FUERA** | 109 ok | −0.20 |
| (2.5, 1.75) argmax del script | 10 ok | **20 en el borde** | 62 ok | 116 ok | 0.00 |
| **(1.6, 1.78) FIJADO** | 9 ok | 18 ok | 62 ok | 116 ok | **0.40** |

El criterio del script (maximizar el margen de los TRES casos patrón con la
cocina como restricción) elegía (2.5, 1.75), que deja la cocina clavada en su
techo de 20 d. Se fijó (1.6, 1.78) porque maximiza el margen mínimo de los CUATRO
a la vez y aguanta el mayor desplazamiento sin salirse (±0.06 en `f` y ±1.2 en
`O_0`, contra ±0.5 del otro punto). Pasa igualmente las dos asserts del §8 sin
tocarles la lógica: 0.40 ≥ 0.30 y 0.40 ≥ 0.8 × 0.40.

Los dos parámetros se movieron en direcciones OPUESTAS y el producto apenas
cambió: `f` sube 1.65 → 1.78 (lo que aportaba una espera mal contada tiene que
aportarlo el término que ESCALA con la obra) y `O_0` baja 2.5 → 1.6, con lo que
la apertura y cierre de obra pasa de 4.13 a 2.85 días. Las bandas min/max de las
dos constantes se reescalaron conservando sus proporciones, así que el ancho
RELATIVO del intervalo que ve el usuario no se ha tocado.

## Fuera de OWNS que hubo que tocar, y por qué

- **`src/lib/rendimientos.ts`** — solo los dos valores de calibración y su
  documentación. Lo autoriza el punto 4 del enunciado («re-corre el barrido y
  re-fija los valores»): las constantes viven ahí, no en el motor.
- **`scripts/verificar-duracion-calibracion.ts`** — `sumaVisible()` tenía que
  sumar `esperaEfectivaDias` y no `esperaDias` para que «la obra cuadre consigo
  misma»: desde este leaf son dos números distintos. La tabla de cierre muestra
  ahora las dos columnas (Λ cruda y Λ_ef). Ninguna assert se relajó ni se borró.

## Para el siguiente leaf

1. **`diasHabilesSemana` no llega al motor desde ningún call site.** El motor ya
   acepta la opción y ρ la usa (jornada 5/6/7 → lag 1.34 / 1.62 / 1.90 d sobre la
   misma espera), pero `ContraPronostico.tsx` y `LineaTiempoObra.tsx` no la pasan,
   así que en producción se usa siempre el defecto 6. Es una línea por call site
   y el dato ya está en `Proyecto.dias_habiles_semana`.
2. **Nadie llama todavía a `addWorkingDays`.** El motor devuelve una duración en
   días hábiles; convertirla en FECHA DE FIN —el `fin = addWorkingDays(inicio,
   ⌈D⌉, S, H)` del spec §5— sigue pendiente en el front. Hoy la UI que pinte
   fechas las calcula sin festivos.
3. **`esperaEfectivaDias` no se pinta.** Mismo caso que `overheadDias` del leaf
   anterior: el motor lo devuelve y el total lo incluye, pero
   `LineaTiempoObra.tsx` solo conoce `esperaDias`. Como en el apto valen 4.00 y
   0.00, las barras sumarían 4 días de más si se usa el campo equivocado.
4. **Hay una TERCERA copia de día hábil**, en `scripts/seed-demo-camara.ts:107`
   (`function esHabil`). La suite no la ve porque §6 solo recorre `src/`. Es un
   script de semilla, no producción, pero cuando alguien limpie las duplicadas
   conviene barrerla también.
5. **La absorción es una cota de primer orden, no un scheduler.** Solo tapa con
   trabajo de la MISMA fase en otros espacios; un CPM de verdad (leaf-3.4) podría
   tapar además con otras fases, así que este motor sigue pecando de largo. Al
   conectarlo hay que RE-CORRER el barrido otra vez: la calibración se rehace.
