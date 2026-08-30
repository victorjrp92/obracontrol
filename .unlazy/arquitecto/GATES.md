# Gates: raíz — Perfil Arquitecto, TPS y documentos firmables

Spec: `docs/specs/spec-arquitecto-2026-08.md`
Motor de duración: `docs/specs/algoritmo-duracion.md`

- [ ] R1: Las cinco ramas verificadas (node-1 … node-5)
  EVIDENCE: pending

- [ ] R2: Tipos limpios en todo el repo
  CHECK: npx tsc --noEmit && echo TSC-OK
  EXPECT: TSC-OK
  EVIDENCE: pending

- [ ] R3: Lint sin errores
  CHECK: npx tsx scripts/verificar-lint-linea-base.ts
  EXPECT: verificaciones OK
  EVIDENCE: pending

- [ ] R4: Los motores de Juntos intactos
  CHECK: npm run verify:alerta
  EXPECT: verificaciones OK
  EVIDENCE: pending

- [ ] R5: El agente anti-bugs cerró su ledger sin defectos abiertos
  EVIDENCE: pending

- [ ] R6: El agente de seguridad cerró su ledger sin hallazgos abiertos
  EVIDENCE: pending

- [ ] R7: `docs/manual-de-usuario.md` refleja los cuatro perfiles y el módulo nuevo
  CHECK: node -e "const s=require('fs').readFileSync('docs/manual-de-usuario.md','utf8');const need=['Arquitecto','Productos'];const miss=need.filter(n=>!s.includes(n));if(miss.length){console.error('el manual no menciona: '+miss);process.exit(1)}console.log('manual-ok')"
  EXPECT: manual-ok
  EVIDENCE: pending

- [ ] R8: Ninguna migración quedó sin aplicar en Supabase — revisado por Victor
  EVIDENCE: pending

- [ ] R9: Nunca se corrió `next dev` ni `next build` durante la implementación
  EVIDENCE: pending
