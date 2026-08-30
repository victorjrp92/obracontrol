# Gates: node-1 — Fundaciones (integración)

Hijos: leaf-1.1, leaf-1.2, leaf-1.3

- [ ] N1: Los tres hijos re-verificados desde el padre
  EVIDENCE: pending
- [ ] N2: Un usuario ARQUITECTO se registra, entra y ve su panel sin error
  EVIDENCE: pending
- [ ] N3: Los tres perfiles anteriores siguen funcionando igual que antes
  EVIDENCE: pending
- [ ] N4: Tipos y lint limpios tras integrar
  CHECK: npx tsc --noEmit && npx tsx scripts/verificar-lint-linea-base.ts
  EXPECT: verificaciones OK
  EVIDENCE: pending
