# Gates: node-3 — Duración y cronograma (integración)

Hijos: leaf-3.0, leaf-3.1, leaf-3.2, leaf-3.3, leaf-3.4, leaf-3.5

- [ ] N1: Los seis hijos re-verificados desde el padre
  EVIDENCE: pending
- [ ] N2: La tabla de cordura pasa entera tras integrar todo
  CHECK: npx tsx scripts/verificar-duracion-calibracion.ts
  EXPECT: verificaciones OK
  EVIDENCE: pending
- [ ] N3: El motor sigue siendo puro y síncrono — sin DB, sin red, sin reloj
  CHECK: node -e "const s=require('fs').readFileSync('src/lib/estimar-duracion.ts','utf8');for(const m of ['prisma','fetch(','Math.random']){if(s.includes(m)){console.error('impureza: '+m);process.exit(1)}}console.log('puro-ok')"
  EXPECT: puro-ok
  EVIDENCE: pending
- [ ] N4: El flywheel captura la variable correcta — verificado con el SQL de diagnóstico
  EVIDENCE: pending
