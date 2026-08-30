# Gates: leaf-3.2 — Recalibrar factores y escalado de cuadrillas

OWNS: src/lib/rendimientos.ts, src/lib/estimar-duracion.ts, scripts/verificar-duracion-calibracion.ts

Scope: Unificar ×1.4 y ×1.2 en un solo `f`, añadir overhead fijo O_0, y arreglar el escalado de cuadrillas con c^0.85 y tope por congestión.

Calibración fijada: **O_0 = 2.5 cd · f = 1.65** (`OVERHEAD_FIJO_CD`, `FACTOR_PRODUCTIVIDAD_REAL`).
Ecuación de cierre implementada: **D = f · (O_0 + D_trabajo) + Λ** — las esperas
de secado quedan FUERA de `f`; el porqué, medido, está al final de este fichero
y en el paso 6 de `estimar-duracion.ts`.

- [x] G1: Los tres casos de la tabla de cordura caen DENTRO de banda
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-duracion-calibracion.ts 5. Los tres casos patrón caen DENTRO de banda (no bajo un techo) OK Baño 5 m²: 10 d dentro de [7, 15] d OK Apto 60 m² (6 espacios): 63 d dentro de [60, 70] d OK Casa 120 m² (10 espacios): 113 d dentro de [100, 120] d OK Cocina 9 m²: 19 d dentro de [10, 20] d OK Baño 5 m²: Σfases + esperas + overhead (10.19) = total (10) OK Apto 60 m² (6 espaci...
- [x] G2: Duplicar cuadrillas acelera menos del doble (sub-lineal, sin discontinuidad en c=1)
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 6. Cuadrillas: sub-lineal, continuo en c = 1 y con f vivo apto 60 m² con 1/2/3/4/6/8 cuadrillas: 63 / 39 / 31 / 26 / 22 / 20 d OK duplicar cuadrillas acelera ×1.62 — menos del doble OK y no más de lo que promete c^0.85 (×1.62 ≤ ×1.80) OK el motor no tiene ningún caso especial para cuadrillas === 1 (no hay dónde saltar) OK rendimientos decrecientes: 1→2 (×1.62) rinde más que 2→4 (×1.50) OK más c...
- [x] G3: El tope por congestión impide más de una cuadrilla en un espacio de 5 m²
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 7. Tope de congestión: en 5 m² no cabe una segunda cuadrilla baño 5 m² con 1/2/3/4/6/8 cuadrillas: 10 / 10 / 10 / 10 / 10 / 10 d OK el baño de 5 m² dura lo mismo con 1 que con 8 cuadrillas (10 d = 10 d) salón 100 m² con 1/2/3/4/6/8 cuadrillas: 87 / 52 / 39 / 32 / 25 / 22 d OK en 100 m² sí caben más cuadrillas y aceleran (87 → 52 d con 2) OK …pero tampoco al doble (el tope no es el único freno:...
- [x] G4: El motor sigue siendo puro — mismas entradas, mismas salidas, sin DB ni red
  CHECK: node -e "const s=require('fs').readFileSync('src/lib/estimar-duracion.ts','utf8');for(const m of ['prisma','fetch(','Date.now','Math.random']){if(s.includes(m)){console.error('impureza: '+m);process.exit(1)}}console.log('puro-ok')"
  EXPECT: puro-ok
  EVIDENCE: $ node -e "const s=require('fs').readFileSync('src/lib/estimar-duracion.ts','utf8');for(const m of ['prisma','fetch(','Date.now','Math.random']){if(s.includes(m)){console.error('impureza: '+m);process.exit(1)}}console.log('puro-ok')" puro-ok La suite lo extiende a rendimientos.ts y a new Date(: 9. El motor sigue siendo puro y determinista OK src/lib/estimar-duracion.ts sin prisma / fetch( / Mat...
- [x] G5: El barrido (O_0, f) se rehace en cada corrida y los valores fijados son los que gana
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 8. Barrido (O_0, f) — la calibración se rehace aquí, no se hereda 47/273 combinaciones meten los tres casos patrón en banda (22 también la cocina). Mejor del barrido: O_0=2.5 f=1.65 → 10 / 63 / 113 d (margen 0.60; con cocina 0.20). Fijado en rendimientos.ts: O_0=2.5 f=1.65 → 10 / 63 / 113 d (margen 0.60) OK la calibración no es frágil: 47 combinaciones válidas (≥ 20) OK el punto fijado no está...
- [x] G6: Verificación estática y de estilo
  CHECK: npx tsc --noEmit && npx eslint src/lib/rendimientos.ts src/lib/estimar-duracion.ts scripts/verificar-duracion-calibracion.ts && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: $ npx tsc --noEmit; echo "tsc_exit=$?" tsc_exit=0 $ npx eslint src/lib/rendimientos.ts src/lib/estimar-duracion.ts scripts/verificar-duracion-calibracion.ts (sin salida; exit 0) Nota de la corrida: durante el trabajo tsc reportó un error en scripts/verificar-documentos.ts (leaf de «juntos/folio», PrefijoFolio vs "JT" | "DP"), ajeno a este leaf y a los módulos de duración; en la verificación fin...
- [x] G7: Sin regresión en el resto del motor de duración
  CHECK: npx tsx scripts/verificar-medicion-duracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: $ npx tsx scripts/verificar-medicion-duracion.ts 82/82 verificaciones OK Medición de duración verificada sin errores.
## Desviación consciente del enunciado (y por qué)

El enunciado pide `D_obra = f · (O_0 + D_makespan)`. Implementado al pie de la
letra —con las esperas de secado DENTRO del makespan— **sacaba de banda la
cocina de 9 m²**, el cuarto caso de cordura publicado en la cabecera del propio
motor. Medido, con el mismo barrido de 273 puntos:

| Modelo | Baño | Cocina | Apto | Casa | Barrido |
|---|---|---|---|---|---|
| `f` multiplica las esperas | 12 ✓ | **22 ✗** (banda 10–20) | 64 ✓ | 113 ✓ | los 4 en banda solo con O_0 ≤ 2; óptimo en O_0 = 0 |
| `f` fuera de las esperas | 10 ✓ | 19 ✓ | 63 ✓ | 113 ✓ | óptimo en O_0 = 2.5, f = 1.65 |

Meter `f` dentro de las esperas empujaba `O_0` a ~0, o sea borraba el entregable
central de esta fase. El spec da la razón textual (§5: las esperas «consumen
calendario, no cuadrilla»): un factor de PRODUCTIVIDAD no puede estirar un
fragüe — el mortero no fragua un 65% más lento porque la cuadrilla rinda un 65%
menos. Es además el trato que ya tenían en el motor previo (crudas). La forma
del spec supone un `D_ms` de scheduler que SOLAPA las esperas con el resto del
trabajo; este motor todavía las suma en serie a cada fase (defecto §4.1, lo
arregla la Fase 3), así que multiplicarlas por `f` componía dos errores.

## Para el siguiente leaf

1. **`overheadDias` no se pinta.** El motor lo devuelve en `ResultadoDuracion` y
   el total lo incluye, pero `LineaTiempoObra.tsx` solo dibuja fases: hoy las
   barras suman 4.13 d menos que la cifra total. Falta una banda de apertura
   («Movilización y compras») en el front — fuera del OWNS de este leaf.
2. **Piso efectivo de la obra:** con O_0 = 2.5 cd y f = 1.65, ninguna obra con
   al menos una tarea baja de ~5 días. Es intencional (no existe la obra de un
   día), pero conviene saberlo antes de prometer «arreglos exprés».
3. **`cuadrillas` sigue muerto en producción** (spec §4.4): los dos call sites
   lo fijan en 1. Todo el escalado nuevo está verificado pero inerte hasta que
   el wizard pregunte «¿cuántas personas van a trabajar?» (Nivel B).
4. **La cocina es el caso que más aprieta por arriba** (poco trabajo, 4 manos de
   secado). Cuando la Fase 3 convierta las esperas en lags solapables, la cocina
   soltará holgura y el barrido probablemente admita un `O_0` mayor: hay que
   RE-CORRER el barrido, que para eso vive dentro de la suite.
