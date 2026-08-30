# Gates: leaf-3.1 — Los tres bugs baratos

OWNS: src/lib/rendimientos.ts, src/lib/precios-semilla.ts, src/lib/estimar-duracion.ts, src/lib/normalizar-tarea.ts, src/lib/fases-obra.ts, scripts/verificar-duracion-calibracion.ts
(`src/app/(dashboard)/empezar/actions.ts` NO se tocó: es de leaf-3.0, que corre en paralelo.)

Scope: Ampliar el matcher, quitar el piso de 0.5 d por tarea, mover «Otros» al inicio y cambiar el default de días laborables a 6. Es la fase de mejor retorno.

- [x] G1: Las tareas que genera sugerirTareas() encuentran rendimiento y fase
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 59/59 verificaciones OK (exit 0). Enumeradas las 12 espacios × 3 tipos de obra de sugerirTareas() → 40 nombres distintos: 40/40 con rendimiento y 40/40 con fase (antes 7 con NULL: "Acabado de piso", "Estuco zona de lavado", "Gabinete espejo baño principal", "Mueble zona de lavado", "Resanar y alisar paredes", "Retiro de acabados existentes", "Vestier habitación principal"). Los 8 nombres del di...
- [x] G2: La fase «Otros» pesa menos del 5% del trabajo en los tres casos patrón
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: Baño 40.0% → 0.0% · Apto 39.2% → 0.0% · Casa 37.3% → 0.0%. Tareas sin rendimiento en los tres casos: 2/6, 10/38, 18/62 → 0/6, 0/38, 0/62. Cobertura del motor: 100% en los tres.
- [x] G3: No queda piso de 0.5 día por tarea dentro del cálculo de escenarios
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: tres comprobaciones. (a) escaneo de la fuente: estimar-duracion.ts no contiene ningún Math.max(0.5, …) — se quitaron los 4 (líneas 164-166 de los escenarios, 180 y 188 del fallback) y aMediosDias se reemplazó por redondear (2 decimales, sin piso). (b) conductual: una tarea de 1 aparato ÷ 5/día se reporta como **0.2 d**, no 0.5. (c) aditividad: 4 tareas iguales cuestan **1.34 d = 4 × 0.34 d**, n...
- [x] G4: «Otros» se agenda ANTES de las fases de acabado, no en posición 10 de 12
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: ordenFases = [FASE_OTROS, ...FASES_OBRA]. Con una tarea que ningún matcher clasifica ("Trámite de permisos ante la copropiedad") el orden devuelto es Otros → Repello/Estuco → Pintura → Pisos/Enchapes → Aparatos y grifería → Detalles y aseo: índice 0, antes de las 5 fases de acabado, y las fases curadas conservan su orden constructivo entre sí.
- [x] G5: El default de dias_habiles_semana es 6
  CHECK: node -e "const s=require('fs').readFileSync('src/app/(dashboard)/empezar/actions.ts','utf8');if(/dias_habiles_semana:\s*5\b/.test(s)){console.error('sigue en 5');process.exit(1)}if(!/dias_habiles_semana:\s*6\b/.test(s)){console.error('no se encontro el 6');process.exit(1)}console.log('semana-ok')"
  EXPECT: semana-ok
  EVIDENCE: semana-ok. Ya venía en 6 desde leaf-3.0 (actions.ts:427, y prisma/schema.prisma con @default(6) + migración 20260830100000_dias_habiles_seis). Este leaf NO tocó ese archivo: es de otro leaf en paralelo. Compuerta verificada, no ejecutada aquí.
- [x] G6: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/rendimientos.ts src/lib/estimar-duracion.ts && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: TSLINT-OK (tsc exit 0 sobre todo el repo; eslint exit 0 sobre los 5 módulos tocados + el script de verificación).
## Tabla ANTES / DESPUÉS (medida, no estimada)

ANTES = los 5 módulos revertidos con `git checkout --`, mismos casos, misma corrida.

| Caso | Banda de cordura | Antes | Después | Δ | «Otros» antes → hoy | sin rendimiento antes → hoy |
|---|---|---|---|---|---|---|
| Baño 5 m² | 7–15 d | 11 d | **6 d** | −45% | 40.0% → 0.0% | 2/6 → 0/6 |
| Apto 60 m² (6 esp) | 60–70 d | 87 d | **60 d** | −31% | 39.2% → 0.0% | 10/38 → 0/38 |
| Casa 120 m² (10 esp) | 100–120 d | 154 d | **111 d** | −28% | 37.3% → 0.0% | 18/62 → 0/62 |

Umbrales de Fase 1 (≤15 / ≤75 / ≤130): cumplidos con margen.
Apto y casa entran además en banda; el **baño queda por debajo** (6 d vs 7–15):
es exactamente el overhead fijo `O_0` que le toca añadir a leaf-3.2.

## Defectos encontrados y arreglados de paso

- `buscarPrecioSemilla` ganaba SIEMPRE sobre los `match` de rendimientos, así
  que «Demolición de muro» se estimaba con el rendimiento de LEVANTAR el muro
  (contiene "muro", 4 letras, vs "demolicion", 10). Ahora gana el término más
  largo venga de donde venga, con el mismo criterio en `faseDeTarea`.
  Nuevo helper `buscarPrecioSemillaConLargo`.
- «Gabinete espejo baño principal» necesitaba rendimiento pero NO el precio de
  un mueble de baño (mediana 800k): el alias vive en `RENDIMIENTOS.mueble_bano.match`,
  no en la semilla de precios.

## Defecto conocido que NO se arregló (queda para otro leaf)

- Con el criterio de «término más largo», «Demolición de enchape de piso»
  cae en `enchape_piso` (12) y no en `demolicion` (10). Un verbo de demolición
  al inicio del nombre debería tener prioridad sobre el sustantivo demolido;
  eso es una regla nueva de matching, no un alias.
