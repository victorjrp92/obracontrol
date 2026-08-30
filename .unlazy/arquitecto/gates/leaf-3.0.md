# Gates: leaf-3.0 — Arreglar la MEDICIÓN de duración

OWNS: prisma/schema.prisma, prisma/migrations/**, src/lib/duraciones-mercado.ts, src/app/(dashboard)/empezar/actions.ts, scripts/verificar-medicion-duracion.ts
(+ src/app/api/proyectos/wizard/route.ts — la ruta B2B también crea proyectos)

Scope: `registros_duracion` mide hoy latencia de aprobación, no duración. Corregirlo antes de tocar el motor. BLOQUEA todo lo estadístico.

- [ ] G1: El SQL de diagnóstico confirma o refuta que hoy se mide latencia
  EVIDENCE: NO VERIFICADO — el leaf no tiene acceso a la base. El SQL quedó escrito y listo para correr en Supabase (entregado en el reporte). Predicción falsable a confirmar: mediana de dias_reales entre 0.5 y 3 días para TODAS las clases, «placa» incluida. Pendiente de que Victor lo corra.
- [x] G2: Existe `dias_motor` y guarda la salida de estimarDuracion al crear el proyecto
  CHECK: npx tsx scripts/verificar-medicion-duracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 82/82 verificaciones OK (2026-08-30). Bloque 1 del script prueba que predecirDuracionesMotor calcula dias_motor y que construirPreRegistro lo traslada a la fila con dias_estimados (el plan del usuario) aparte. Las tareas sin rendimiento investigado dan dias_motor = null a propósito: ahí el motor devuelve los días del usuario y registrarlo sería medir al usuario otra vez. Cableado en crearObraPe...
- [x] G3: El inicio real sale de min(Evidencia.timestamp_captura), con fecha_inicio como respaldo
  CHECK: npx tsx scripts/verificar-medicion-duracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: 82/82 verificaciones OK (2026-08-30). Bloque 2 del script: evidencia más antigua gana; sin evidencias cae a fecha_inicio; sin ninguna de las dos devuelve null; relojes de dispositivo corruptos (marca posterior al fin, o de hace años) se descartan y caen al respaldo. Bloque 4 muestra el caso real: la misma tarea mide 0.5 días sin evidencias (latencia) y 7.3 días con ellas.
- [x] G4: Existen dias_reales_habiles, cantidad, unidad y cuadrillas; dias_reales se conserva
  CHECK: node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');const b=s.match(/model RegistroDuracion \{([^}]*)\}/)[1];const need=['dias_motor','dias_reales_habiles','cantidad','unidad','cuadrillas','dias_reales'];const miss=need.filter(f=>!b.includes(f));if(miss.length){console.error('faltan: '+miss);process.exit(1)}console.log('columnas-ok')"
  EXPECT: columnas-ok
  EVIDENCE: columnas-ok (2026-08-30). Las columnas ya existían (migración 20260830110000); este leaf NO tocó schema ni migraciones. dias_reales sigue en días CALENDARIO y dias_reales_habiles usa el dias_habiles_semana del proyecto (6 por defecto). Bloque 3 del script verifica el cálculo de hábiles contra casos conocidos (lu→lu con semana de 6 = 6; con 5 = 5; con 7 = 7; dos semanas = 12; vie 8am→lun 8am = 2...
- [x] G5: La captura sigue sin poder romper la aprobación (try/catch intacto)
  CHECK: node -e "const s=require('fs').readFileSync('src/lib/duraciones-mercado.ts','utf8');if(!/try\s*\{/.test(s)||!/catch/.test(s)){console.error('se perdio el try/catch');process.exit(1)}console.log('defensivo-ok')"
  EXPECT: defensivo-ok
  EVIDENCE: defensivo-ok (2026-08-30). Además el bloque 5 del script prueba el comportamiento, no solo la sintaxis: capturarDuracionAprobada no lanza con la tabla ausente, con la escritura caída, con fechas invertidas, con fechas inválidas ni con la tarea inexistente.
## Verificación global (2026-08-30)
- `npx tsc --noEmit` → sin errores
- `npx eslint src/lib/duraciones-mercado.ts "src/app/(dashboard)/empezar/actions.ts" src/app/api/proyectos/wizard/route.ts scripts/verificar-medicion-duracion.ts` → sin hallazgos
- `npx tsx scripts/verificar-medicion-duracion.ts` → `82/82 verificaciones OK`
- `npm run verify:alerta` → 43/43, 37/37, 35/35 (sin daño colateral)

## Defecto conceptual documentado, NO arreglado
`getDuracionMercado` promedia DÍAS sin normalizar por cantidad: pintar 12 m² y
pintar 120 m² entran con el mismo peso. Queda documentado en el bloque LECTURA
de `duraciones-mercado.ts` con la fórmula correcta (rendimiento = cantidad ÷
días hábiles). No se arregla aquí: los registros históricos tienen `cantidad` en
null, así que primero hay que acumular muestra nueva, y el arreglo pertenece a
la fase estadística (que además exige shrinkage).
