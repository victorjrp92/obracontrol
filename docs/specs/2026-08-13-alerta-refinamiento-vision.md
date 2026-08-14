# Spec: Seiricon Alerta — refinamiento de confiabilidad del triage + arnés de calibración

Fecha: 2026-08-13
Estado: implementado, sin commitear (pendiente de revisión del usuario)
Branch: `feat/alerta-refinamiento-vision` (encima de `08a469f`)
Depende de: [Fase 1](./2026-08-13-seiricon-alerta-fase1.md) (43/43 en `npm run verify:alerta`) y
[Fase 2](./2026-08-13-seiricon-alerta-fase2.md) (37/37 en `npm run verify:triage`)

## 1. Objetivo

Fase 2 conectó un modelo de visión al motor de reglas firmado. Este refinamiento ataca los
cuatro puntos donde ese puente seguía siendo frágil, **sin tocar el motor de reglas** y sin que
nada de lo nuevo pueda ablandar un semáforo. Además deja construido el arnés que permitirá
medir de verdad la lectura cuando haya API key y fotos reales.

**Invariante innegociable, ampliado:** el nivel final NUNCA puede ser más suave que leer la
misma observación bajo cualquiera de los elementos **ni de los patrones** candidatos. Todo lo
que se agregó puede subir el semáforo, jamás bajarlo. El único camino a verde sigue siendo la
regla 8 de `reglas.ts`.

## 2. Restricciones respetadas (verificado con `git diff --stat`)

- `src/lib/alerta/reglas.ts` → **diff vacío**.
- `scripts/verificar-reglas-alerta.ts` → **diff vacío**; `npm run verify:alerta` sigue en 43/43.
- `src/lib/alerta/tipos.ts` → un solo campo nuevo, **opcional** (`ancho_rango?`).
- `src/components/evidencia/CameraCapture.tsx`, `src/proxy.ts`, `src/lib/access.ts`,
  `src/lib/permissions.ts`, `src/components/repara/**` → diff vacío.
- Cero dependencias nuevas, cero Prisma/Supabase/persistencia, cero migraciones, cero `db:push`.
- Todo lo nuevo es verificable **sin `ANTHROPIC_API_KEY` y sin fotos**: la lógica del consenso
  vive en una función pura (`fusionarLecturas`) que se prueba con observaciones inyectadas; el
  `fetch` no se prueba.

## 3. R1 — Doble lectura (consenso)

### Decisión

`observarGrietaConsenso()` dispara **dos** llamadas independientes en paralelo (`Promise.all`)
y fusiona las dos observaciones de forma conservadora. La ruta
`POST /api/alerta/observar-grieta` pasa a usarlo.

### Por qué

La `confianza` que el modelo se autorreporta es exactamente lo que peor hace un LLM: es un
número que sale del mismo proceso generativo que la respuesta, no una medida de nada. La
**varianza entre dos muestras independientes** sí es señal: si dos lecturas de las mismas fotos
no coinciden en el elemento, esa discrepancia es información real, no autoevaluación.

### Temperatura 0.5, deliberado

Las dos llamadas del consenso usan `temperature: 0.5`, **no 0**. Con temperatura 0 las dos
respuestas serían prácticamente la misma y una coincidencia dejaría de significar algo — el
consenso sería teatro. La llamada individual `observarGrieta()` conserva su `temperature: 0`
original (sigue exportada; no mide varianza).

### Reglas de fusión (`fusionarLecturas`, función pura)

| Campo | Fusión | Por qué |
|---|---|---|
| `elemento` | se conserva el de la **primera** lectura; si difieren, `confianza.elemento = 0` | no se inventa un tercer valor; la confianza en 0 solo puede activar la regla 7 (amarillo), que corre después de las reglas 1-6 |
| `patron` | ídem con `confianza.patron` | igual |
| `confianza.elemento`/`.patron` cuando **sí** coinciden | la **menor** de las dos | conservador por defecto |
| `banderas` | unión lógica (**OR**) campo por campo | si cualquiera de las dos vio acero expuesto, cuenta como visto |
| `ancho_mm` | el **máximo** (si una es null, gana la no-null) | es el extremo que dispara la regla 4, nunca el que la apaga |
| `ancho_rango` | unión de los dos rangos | coherente con `ancho_mm = max` |
| `calidad_foto` | la **peor** de las dos | orden explícito: `ok` (0) < `sin_referencia_escala` < `muy_lejos` < `oscura` < `movida` |
| `confianza.ancho` | la **mínima** | conservador |

El orden entre las calidades malas no cambia ninguna regla (`reglas.ts` solo mira
`!== "ok"`): existe para que la fusión y los reportes de calibración sean deterministas.

### Fallos parciales

- Una de las dos falla → se usa la que respondió pero con **todas las confianzas en 0**
  (`sinConsenso`): una sola lectura no es consenso.
- Las dos fallan → `{ok:false, motivo}` como hoy; el cliente cae a modo manual.

### Interruptor y costo

`ALERTA_VISION_CONSENSO="false"` (string exacto) → una sola lectura. Por defecto **activado**.
**El consenso duplica el gasto de tokens por grieta** — documentado en la cabecera de
`observar-grieta.ts` y en el README de calibración.

## 4. R2 — El ancho es un rango; se usa el extremo conservador

- El schema de la tool pasa de `ancho_mm` a **`ancho_mm_min` y `ancho_mm_max`** (ambos
  `["number","null"]`), con descripciones que explican que es el rango de incertidumbre de la
  medición con la moneda de $500.
- `normalizarObservacion` calcula **`ancho_mm = max`**. Usar el mínimo ablandaría la regla 4
  (muro de carga con ancho `> 3mm` → rojo).
- `ObservacionGrieta` gana `ancho_rango?: { min, max }`, **opcional**: es informativo (permite
  decir "entre 2 y 4 mm" en vez de fingir un número exacto) y `reglas.ts` nunca lo lee. Al ser
  opcional, los 43 casos de Fase 1 siguen compilando y pasando sin tocar ese script.
- `min > max` → se **intercambian**, no se rechaza la observación: un modelo que confunde el
  orden de dos campos igual midió algo, y descartarlo apagaría una vía a rojo.
- Si solo llega uno de los dos extremos, ese es el ancho. Si no llega ninguno, `ancho_mm` es
  `null` y `ancho_rango` **no se adjunta** (no se inventa un rango).
- Sigue vigente: `calidad_foto === "sin_referencia_escala"` → `confianza.ancho = 0` pero
  **`ancho_mm` se conserva**.
- **Compatibilidad**: si no llega ningún extremo pero sí un `ancho_mm` plano (schema viejo, o
  un modelo que ignora el schema nuevo), se lee como rango degenerado `min = max = ancho_mm`.
  Decisión tomada para no romper el contrato de nadie y para que los casos de verificación de
  Fase 2 sigan valiendo tal cual.

## 5. R3 — Cerrar el hueco del patrón

El elemento tenía dos fuentes (lo que marca la persona en el Paso 1 y lo que lee el modelo) y
se reconciliaban. El **patrón** venía de una sola fuente y nadie lo contrastaba — y el patrón
es lo que abre la única puerta al verde (regla 8: muro divisorio + craquelado).

### UI

Nuevo paso `ConfirmarPatron.tsx`, entre la lectura de la IA y el veredicto:

> Leímos: una grieta **"Inclinada (en diagonal)"** en **"Columna"**.
> [Sí, así se ve] [No, se ve distinta]

"No, se ve distinta" despliega el mismo menú del modo manual. Las etiquetas **no se
duplicaron ni se inventaron**: las que vivían en `DescribirGrietaManual.tsx` se movieron tal
cual a `LABEL_PATRON` + `ORDEN_PATRON` en `src/lib/alerta/copys.ts` (junto a `LABEL_ELEMENTO`,
que ya estaba ahí por la misma razón: `lib` no puede depender de `components`).
`DescribirGrietaManual.tsx` ahora las consume de ahí.

`LABEL_PATRON` se definió como `Record<Patron, string>` (exhaustividad chequeada por el
compilador) + `ORDEN_PATRON` para el orden de pantalla, en vez de un arreglo de objetos: así
agregar un patrón al contrato rompe la compilación en vez de dejar una etiqueta faltante.

### Reconciliación

**No** se creó una tabla de severidad de patrones: la gravedad de un patrón depende del
elemento (`diagonal` es rojo en columna y neutro en muro divisorio), así que una tabla sería
una regla nueva mal disfrazada. En vez de eso se **generalizó `aplicarCandidatoDescartado()`**:
evalúa la observación bajo el producto de candidatos (elemento declarado × observado, patrón
observado × declarado) y se queda con el nivel más severo vía `elevar()`. Mismo mecanismo ya
probado en Fase 2, conservador por construcción, sin tabla nueva.

- `EntradaTriage` gana `patron_declarado?: Patron` (opcional: sin él, el comportamiento es
  idéntico a Fase 2).
- Si difiere del observado: el patrón **mostrado** sigue siendo el observado,
  `confianza.patron = 0`, y gana el peor de los dos al evaluar.
- `GrietaEvaluada` gana `reconciliacion_patron: { patron, hubo_discrepancia }`. Se agregó como
  campo aparte en vez de meterle campos requeridos a `ResultadoTriage`, para no romper a los
  callers existentes de `reconciliarElemento`/`construirObservacionEfectiva`.
- `ResultadoGrieta.tsx` muestra el banner de discrepancia de patrón junto al de elemento
  (`COPY_DISCREPANCIA_PATRON`, copy nuevo, sin la palabra "segur").
- En **modo manual** no se manda `patron_declarado`: el patrón ya lo puso la persona, no hay
  segunda fuente que contrastar.

## 6. R4 — Umbral asimétrico para el verde

`CONFIANZA_MINIMA_VERDE = 0.85` en `triage.ts`, deliberadamente más alta que
`CONFIANZA_MINIMA = 0.6` de `reglas.ts`. Si el veredicto final es verde y **cualquiera** de
`confianza.elemento` / `confianza.patron` (de la observación efectiva) está por debajo, se
eleva a amarillo con razón explícita, usando la misma función `elevar()`.

Por qué asimétrico: rojo y amarillo, si se equivocan, mandan a alguien a que un ingeniero
revise. Un verde equivocado manda a alguien a dormir bajo una columna partida. El verde es el
único veredicto que puede hacer daño por omisión, así que paga un umbral más caro.

`confianza.ancho` no entra a esta condición: el camino a verde (regla 8) no mira el ancho, y
exigirle confianza de ancho a una grieta sin ancho medible sería ruido.

Nota operativa: `CONFIANZA_MANUAL` de `GrietaWizard.tsx` (0.9) queda por encima del umbral, así
que R4 no cambia nada en modo manual — que de todos modos nunca llega a verde por T4.

## 7. Orden del pipeline (`evaluarTriageGrieta`)

1. `reconciliarElemento` (T1) + `reconciliarPatron` (R3)
2. `construirObservacionEfectiva` (T2 + zeroing de `confianza.patron`)
3. `evaluarGrieta()` ← **el único lugar donde nace un veredicto**
4. `aplicarCandidatoDescartado` (generalizado a elemento × patrón)
5. `aplicarUmbralVerde` (R4)
6. `aplicarPasante` (T3)
7. `aplicarFuenteManual` (T4)

Los pasos 4-7 solo pueden subir el nivel (`elevar()` ignora cualquier nivel igual o más suave).

## 8. Arnés de calibración (`scripts/calibrar-vision.ts`, `npm run calibrar:vision`)

Dos modos:

1. **Simulado** (por defecto si no hay `ANTHROPIC_API_KEY` + `ALERTA_VISION_ENABLED=true`):
   lee `calibracion/manifiesto.simulado.json`, donde cada caso trae la `ObservacionGrieta`
   escrita a mano. Sin red, sin fotos. **Funciona hoy.** El set semilla tiene **17 casos**
   sintéticos: diagonal en columna, escalonada en muro de carga con y sin desplazamiento,
   craquelado limpio en muro divisorio (el único verde), `no_determinado`, confianza baja,
   calidad de foto mala (`oscura`, `movida`, `muy_lejos`, `sin_referencia_escala`), acero
   expuesto, separación muro/estructura, pasante, craquelado en losa, y **tres casos trampa**
   diseñados para intentar arrancar un verde indebido (elemento mal leído, patrón corregido por
   la persona, y confianza en 0.84 justo por debajo del umbral de R4).
2. **Real** (con key + `ALERTA_VISION_ENABLED=true`): lee `calibracion/manifiesto.json` con
   `{ id, foto_cerca, foto_lejos, esperado: { elemento, patron, ancho_mm_real? } }`, carga las
   fotos de disco como data-URI, las pasa por `observarGrietaConsenso()` y luego por
   `evaluarTriageGrieta()`. Casos en serie, no en paralelo (cada caso ya son dos llamadas).

Las observaciones del manifiesto simulado pasan por `normalizarObservacion()`, igual que en
producción: el manifiesto se escribe con las mismas claves que devuelve la tool del modelo
(`ancho_mm_min`/`ancho_mm_max`), no con el tipo interno.

**Reporta:** detalle por caso, matriz de confusión de `elemento` y de `patron`, error absoluto
medio y máximo de `ancho_mm` contra `ancho_mm_real`, % de `no_determinado`, distribución de
`calidad_foto`, distribución de niveles finales, y **FALSOS VERDES uno por uno** (caso en verde
cuyo `esperado` no sea muro divisorio + craquelado).

**Sale con código ≠ 0 si hay un solo falso verde**, o si algún caso del manifiesto está mal
escrito. Todo lo demás es diagnóstico.

Documentación para la usuaria: `calibracion/README.md` (cómo tomar las fotos — moneda de $500
completa y nítida, elemento de piso a techo—, cómo nombrarlas, cómo llenar el manifiesto, qué
significa cada métrica) y `calibracion/manifiesto.ejemplo.json`.
`calibracion/fotos/` y `calibracion/manifiesto.json` están en `.gitignore`: son fotos de casas
reales y no se suben al repo.

## 9. Archivos

### Modificados — lógica pura

- `src/lib/alerta/tipos.ts` — `ancho_rango?` (único cambio, opcional).
- `src/lib/alerta/observar-grieta.ts` — schema con `ancho_mm_min`/`ancho_mm_max`, rango en
  `normalizarObservacion`, `fusionarLecturas`, `sinConsenso`, `consensoActivado`,
  `observarGrietaConsenso`, `llamarModeloVision` (interna, con `temperature` parametrizada).
- `src/lib/alerta/triage.ts` — `patron_declarado`, `ResultadoTriagePatron`,
  `reconciliarPatron`, `construirObservacionEfectiva` con tercer parámetro opcional,
  `aplicarCandidatoDescartado` generalizado, `CONFIANZA_MINIMA_VERDE` + `aplicarUmbralVerde`.
- `src/lib/alerta/copys.ts` — `LABEL_PATRON`, `ORDEN_PATRON`, `COPY_DISCREPANCIA_PATRON`.

### Modificados — UI y API

- `src/app/api/alerta/observar-grieta/route.ts` — usa `observarGrietaConsenso`.
- `src/components/alerta/GrietaWizard.tsx` — paso `"confirmar"`, estado `lecturaIA`,
  `patron_declarado` en la entrada de triage.
- `src/components/alerta/DescribirGrietaManual.tsx` — consume `LABEL_PATRON`/`ORDEN_PATRON`.
- `src/components/alerta/ResultadoGrieta.tsx` — banner de discrepancia de patrón.

### Nuevos

- `src/components/alerta/ConfirmarPatron.tsx`
- `scripts/calibrar-vision.ts`
- `calibracion/README.md`, `calibracion/manifiesto.simulado.json`,
  `calibracion/manifiesto.ejemplo.json`
- Este documento.

### Verificación y config

- `scripts/verificar-triage-alerta.ts` — **extendido**, no reemplazado: 37 → **84** asserts.
- `package.json` — `"calibrar:vision"`. Ninguna dependencia nueva.
- `.gitignore` — `calibracion/fotos/`, `calibracion/manifiesto.json`.
- `docs/arquitectura.md` §9.2.

## 10. Verificación (resultados reales)

| Comando | Resultado |
|---|---|
| `npm run verify:alerta` | **43/43** (script de Fase 1 con diff vacío) |
| `npm run verify:triage` | **84/84** (37 previos + 47 nuevos) |
| `npm run calibrar:vision` (simulado) | 17 casos, **0 falsos verdes**, exit 0 |
| `npx tsc --noEmit` | limpio |
| `npm run lint` | sin errores ni warnings nuevos en los archivos tocados |
| `npm run build` | compila (59/59 páginas) |
| `git diff --stat src/lib/alerta/reglas.ts scripts/verificar-reglas-alerta.ts` | **vacío** |
| `/alerta/grietas` sin key | 200; `POST /api/alerta/observar-grieta` → `{"ok":false,"motivo":"sin_key"}` → modo manual |

Barridos nuevos del script de triage:

- **Invariante extendido**: 10.368 combinaciones (elemento declarado × observado × patrón
  observado × patrón declarado × 2 contextos), verificando contra los 4 candidatos de cada una
  → 0 violaciones.
- **Verde por el camino único**: 34.992 combinaciones del pipeline + 1.080 de la observación
  → todo verde exige fuente `ia`, sin discrepancia de elemento **ni de patrón**,
  `muro_divisorio` + `craquelado`, cero banderas, `calidad_foto: "ok"`, confianza ≥ 0.85 y
  `pasante !== "si"`.
- **Fusión**: 648 pares de lecturas → la fusión nunca es más suave que la primera lectura, y
  nunca da verde si las dos lecturas discrepan en el elemento.

## 11. Pendientes (necesitan insumos de la usuaria)

- **`ANTHROPIC_API_KEY` + `ALERTA_VISION_ENABLED=true`**: sin eso, el modo real del arnés no
  corre y el consenso no se puede medir contra el modelo de verdad.
- **Fotos reales** en `calibracion/fotos/` + `calibracion/manifiesto.json`: son las que
  permitirán llenar las matrices de confusión y el error de ancho. Hoy están vacías a
  propósito — **no se inventaron fotos ni mediciones**.
- `ALERTA_VISION_MODEL` sigue con el default de Fase 2 (`claude-haiku-4-5-20251001`), pendiente
  de verificar contra la documentación vigente de Anthropic.
- La descripción del rango en el schema (`ancho_mm_min`/`ancho_mm_max`) no se ha probado contra
  un modelo real: falta ver si respeta el rango o colapsa `min = max`. Es exactamente lo que
  mide el modo real del arnés.
- `ancho_rango` está disponible en el contrato pero **el PDF todavía no lo muestra**:
  `InformeGrietasReport.tsx` y el payload de `informe-grietas-pdf` no se tocaron (fuera del
  alcance aprobado). Es un cambio aditivo pequeño cuando se decida.
- Igual que en Fase 2: T3 (pasante), `aplicarCandidatoDescartado` y ahora también R4 y el
  umbral 0.85 quedan **pendientes de visto bueno de un ingeniero**. El umbral es un juicio de
  producto, no un valor derivado de una norma.

## 12. Fuera de alcance (explícito)

Persistencia de nada, cambios en `reglas.ts`, mostrar el rango de ancho en el PDF, medición de
ancho por visión clásica, rate limiting, cachear lecturas, reintentos automáticos de las
llamadas del consenso, y cualquier cambio en el flujo del acta de Fase 1.
