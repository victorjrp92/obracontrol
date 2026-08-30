# Rediseño del motor de duración

Análisis: 30 de agosto de 2026. Los números son **salidas reales** — el agente
compiló los módulos puros con el `tsc` del repo y los ejecutó.

---

## 0. El motor rompe hoy su propia calibración

| Caso | Objetivo | **Motor hoy** | Desvío |
|---|---|---|---|
| Baño 5 m² | 7–15 d | **16 d** | +7% |
| Cocina 9 m² | 10–20 d | 20 d | límite |
| Apto 60 m² | 60–70 d | **91 d** | **+30%** |
| Casa 120 m² | 100–120 d | **166 d** | **+51%** |

**El error crece con el tamaño de la obra** — lo contrario de lo que debería pasar.

## 1. El hallazgo que invalida «conectar el flywheel»

> **`registros_duracion.dias_reales` no mide duración. Mide latencia de aprobación.**

`Tarea.fecha_inicio` se escribe cuando el obrero **reporta la tarea terminada**
(`api/tareas/[id]/reportar/route.ts:138`). `fecha_fin_real` se escribe cuando el
supervisor **aprueba** (`api/tareas/[id]/aprobar/route.ts:141`). El intervalo
entre ambas es **el tiempo que tarda alguien en mirar dos fotos**.

Y `dias_estimados` tampoco es la predicción del motor: `repartirGlobal()`
(`IntentWizard.tsx:765`) sobrescribe `t.dias` con el reparto del plazo que puso el
usuario. **Mide el plan del usuario, no el algoritmo.**

Conectar `getDuracionMercado` hoy colapsaría todas las duraciones a 0.5–2 días.
La correa no está suelta: **el eje gira al revés.**

**Predicción falsable:** correr el SQL de diagnóstico dará mediana de
`dias_reales` entre 0.5 y 3 días para *todas* las clases, incluida «placa». Si
sale así, queda confirmado.

## 2. Las tres causas del sobreestimado

**2.1 Las fases no tienen pipeline** (`estimar-duracion.ts:227`)
```ts
let dias = Math.max(mayor, suma / cuadrillas);
```
Con `cuadrillas = 1` —el único valor en producción— es la **suma pura** de todas
las tareas de la fase en todos los espacios. Se estuca cada espacio uno tras
otro, y solo cuando el último está estucado empieza la pintura del primero. Una
obra real es una **línea de balance**: la precedencia es **por espacio**, no
global.

**2.2 Factores apilados** — ×1.4 (cuadrilla única) × ×1.2 (imprevistos) = **×1.68**
sobre una base ya pesimista. El factor que reconcilia con la realidad **decrece**
con el tamaño (×1.61 baño · ×1.30 apto · ×1.19 casa): firma de un overhead fijo
que se amortiza. Un ×1.68 constante no ajusta ninguno.

**2.3 Piso de 0.5 día por tarea** (`aMediosDias`, línea 121) — infla el baño un
**21%**. Es un piso, no un redondeo: nunca compensa hacia abajo. **Castiga al
usuario que describe bien su obra.**

## 3. El matcher pierde un tercio del trabajo

`buscarRendimiento` usa `includes` literal. Un «de» intermedio rompe el match.
Verificado contra los nombres que **la propia app genera**:

```
"Retiro de acabados existentes"  → rend=NULL  fase=NULL   ← la genera sugerirTareas()
"Resanar y alisar paredes"       → rend=NULL  fase=NULL   ← la genera sugerirTareas()
"Enchape de pared"               → rend=NULL              ← "enchape pared" ≠ "enchape de pared"
"Cielo raso en drywall"          → rend=NULL
"Mesón de cocina"                → rend=NULL
```

Impacto: **30% del trabajo del apto y 41% del baño cae en la fase `Otros`** — y
`Otros` se agenda en posición 10 de 12 (línea 204). **La demolición se programa
después de instalar la grifería.**

## 4. Otros defectos verificados

| # | Defecto | Evidencia |
|---|---|---|
| 4.1 | Las esperas se suman al total como si fueran ruta crítica, mezclando días hábiles con calendario | línea 332; error de unidades del 20–33% |
| 4.2 | El intervalo min/max supone correlación perfecta | ancho **plano en 74%** con 9, 18, 36, 72, 144 y 288 tareas |
| 4.3 | `cuadrillas` da aceleración super-lineal | 1→91d, 2→34d (2.7× con 2× recursos), 4→19d (apto más rápido que un baño) |
| 4.4 | `cuadrillas` está muerto: los dos call sites lo fijan en 1 | `ContraPronostico.tsx:25`, `LineaTiempoObra.tsx:82` |
| 4.5 | `dias_habiles_semana` fijado a 5; la construcción colombiana trabaja Lu–Sá | `actions.ts:427` — **sesgo del 20%** |
| 4.6 | Cero festivos colombianos en todo el repo | 18 festivos = 6–7% del año |
| 4.7 | Sin curva de aprendizaje | 20 habitaciones idénticas = 16.3 d/unidad **constante** |
| 4.8 | `depende_de` existe y **no lo escribe nadie**; `dependencias_habilitadas` no se lee en ninguna parte | schema vs. código |
| 4.9 | Los scores de velocidad se calculan, se guardan y **el estimador los ignora** | `score_velocidad`, `score_cumplimiento` |
| 4.10 | `FACTOR_PARED = 2.4` constante gobierna el **47% del trabajo** | el perímetro escala con √área, no con área |

## 5. La ecuación nueva

```
W_t  = (Q_t · m_t / R_k) · γ_ejec · γ_cond · min(j,20)^(-b)     [cuadrilla-día]
D_t  = W_t / min( c_t^0.85 , A_e / a_min,k )
D_ms = SGS( {D_t}, E_fase ∪ E_expl ∪ E_secado, {c_o}, λ )
D    = f · ( O_0 + D_ms )
fin  = addWorkingDays( inicio, ⌈D⌉, S, H )
```

- **Sin piso por tarea.** El trabajo es aditivo y fraccionario; el piso se aplica
  una sola vez sobre la ruta crítica.
- **Precedencia por espacio** (`E_fase` dentro de cada espacio) — habilita el pipeline.
- **`c^0.85`** continuo en c=1, con tope por congestión física `A_e/a_min`.
  Mata el «apto completo en 19 días con 4 cuadrillas».
- **Esperas como lags de arista**, no sumandos: consumen calendario, no cuadrilla.
  En obra grande se absorben; en un baño único sí empujan la fecha.
- **Curva de Wright** con ℓ=0.92 para unidades repetidas: 20 unidades cuestan
  15.7×W(1), no 20×W(1) → **−21% en torres**.

**Calibración propuesta: `O_0 = 2 cd`, `f = 1.40`**

| Caso | Objetivo | Motor hoy | **Propuesto** |
|---|---|---|---|
| Baño 5 m² | 7–15 | 16 ✗ | **12** ✓ |
| Apto 60 m² | 60–70 | 91 ✗ | **62** ✓ |
| Casa 120 m² | 100–120 | 166 ✗ | **112** ✓ |

31 combinaciones de (O_0, f) caen dentro de banda: la calibración no es frágil.

## 6. Incertidumbre

```
D = K · S,   S = Σ_{t∈CP} D_t + Λ,   K ~ LogNormal(−σ_K²/2, σ_K²)

E[D]  = μ_S
CV²[D] = (σ_S²/μ_S²)·e^{σ_K²}  +  (e^{σ_K²} − 1)
          └─ idiosincrático,      └─ común, NO decae
             decae como 1/N

D_q = exp( μ_ln + z_q · σ_ln )     P(D ≤ x) = Φ( (ln x − μ_ln)/σ_ln )
```

El término común es el **piso irreducible**: por muchas tareas que tenga, si el
cliente no paga, la obra para. Prior σ_K = 0.25.

El motor deja de devolver `{min, probable, max}` y devuelve `{p10, p50, p80, p95,
fechaP80, probabilidadFecha}`. Copy: *«Lo más probable es que termines el 14 de
octubre. En 8 de cada 10 obras parecidas, se termina antes del 3 de noviembre.»*

## 7. Métrica: MAPE es la equivocada

MAPE es asimétrico y **premia sistemáticamente subestimar** — justo el sesgo que
queremos evitar en construcción. Se usan tres:

```
MALE = (1/N) Σ | ln( D_real / D_motor ) |        ← primaria. 0.18 → "±20%"
B    = exp( (1/N) Σ ln( D_real / D_motor ) )     ← sesgo. Corregible con f ← f·B
C_80 = (1/N) Σ 1[ D_real ≤ D_P80 ]               ← calibración. Debe valer 0.80
```

`C_80` es **la única que valida la promesa comercial**. Un motor con MALE mediocre
y C_80 = 0.80 es honesto y vendible; uno con MALE excelente y C_80 = 0.45 miente
la mitad de las veces.

Objetivo aceptable: MALE ≤ 0.35 · B ∈ [0.85, 1.20] · C_80 ∈ [0.65, 0.92].
Prometer ±10% sería mentir: σ_K ≈ 0.25 lo hace imposible.

## 8. Variables a capturar

**Nivel A — cero fricción, se hacen sí o sí**

| Variable | Impacto | Por qué es gratis |
|---|---|---|
| Productividad del ejecutor | ±20% | `score_velocidad` **ya se calcula y guarda** |
| Días laborables = 6 | **+20% sistemático** | el campo existe, está fijado en 5 |
| Festivos colombianos | 6–7% | puramente algorítmico |
| Repetición de unidades | **−21%** en torres | derivable de Edificio→Piso→Unidad |

**Nivel B — 3 taps, valen la pena**

1. «¿Cuántas personas van a trabajar?» (chips 1-2 / 3-4 / 5-8 / +8) — **divide todo el estimado**
2. «¿Estará habitada?» (Sí/No) — ×1.15–1.30
3. Altura libre — ±8% sobre el 47% del trabajo; inferida del tipo de propiedad, editable

**Lo que NO se pregunta:** cantidades tarea por tarea (convierte el wizard en un
APU) ni conteos de puntos eléctricos — **son solo el 2% del trabajo**. Se derivan
del área. Contradice la intuición: las cantidades que faltaban no mueven la aguja.

## 9. Fases

```
Fase 0  Arreglar la medición ─────────── 1 día   BLOQUEA todo lo estadístico
Fase 1  Los tres bugs baratos ────────── 1 día   mejor retorno del plan
Fase 2  Recalibrar factores ──────────── 1 día
Fase 3  Calendario y esperas como lags ─ 2 días
Fase 4  CPM/DAG por espacio ──────────── 3 días  arregla el error dominante
Fase 5  Distribución de probabilidad ─── 2 días
Fase 6  Variables Nivel A ────────────── 2 días
Fase 7  Variables Nivel B ────────────── 2 días
Fase 8  Flywheel con shrinkage ───────── 3 días  NO antes de ~50 obras terminadas
```

**Fases 0+1+2 = 3 días y son el 70% del valor.** Llevan el motor de «fuera de
banda en los tres casos» a «dentro de banda en los tres».

## 10. Lo que no se puede saber sin datos que no existen

1. El sesgo real del motor — requiere `dias_motor` y ~30 obras terminadas
2. σ_K — el 0.25 es prior de literatura, no medición de Seiricon
3. n_0 del shrinkage — el 8 es coherente con el umbral que ya usa el código
4. Las tasas de aprendizaje ℓ — el 0.92 es literatura, no torres colombianas
5. Si los rendimientos de la semilla son correctos — ninguno está validado contra ejecución real
6. La jornada base de la semilla (48h vs 44h, Ley 2101 de 2021)
7. Los a_min de congestión — juicio de oficio, requerirían observación de campo
