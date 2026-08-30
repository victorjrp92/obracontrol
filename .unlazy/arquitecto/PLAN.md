# PLAN — Perfil Arquitecto, TPS y documentos firmables

Spec: `docs/specs/spec-arquitecto-2026-08.md`
Scope: `arquitecto`

## Contrato compartido (todo leaf lo recibe)

- Repo: `"/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol"` — la carpeta padre TERMINA EN ESPACIO, cita rutas entre comillas dobles.
- **PROHIBIDO** `next dev` y `next build` (congelan la máquina). Verificación: `npx tsc --noEmit`, `npx eslint <ruta>`, y scripts `npx tsx scripts/verificar-*.ts`.
- Prisma se importa de `@/generated/prisma`. Tras tocar `schema.prisma`: `npx prisma generate`.
- Rutas API nuevas: `requireUser()` de `src/lib/tenant.ts` + `assert*InTenant()`. No copiar el patrón viejo inline.
- Tabla nueva = `ENABLE ROW LEVEL SECURITY` en su migración, sin excepción.
- Un componente por archivo. Dominio en español, infraestructura en inglés.
- Sin emojis. El verde no es color de marca (solo estado funcional).
- Cada leaf entrega su ledger con evidencia real, no «pending».
- Cuatro pasadas por leaf: implementar completo → releer como experto y subir el nivel → cazar defectos → pulir. Repetir hasta que una pasada no encuentre nada.

## Estados

| Leaf | Estado | Needs | Modelo | OWNS (resumen) |
|---|---|---|---|---|
| leaf-1.1 | VERIFIED | — | opus | `prisma/schema.prisma`, `src/lib/plan.ts`, `src/app/(auth)/registro/**` |
| leaf-1.2 | VERIFIED | — | sonnet | `src/components/dashboard/**` (obrero→Personal de Campo), `src/app/(dashboard)/dashboard/equipo/**` |
| leaf-1.3 | VERIFIED | — | opus | `src/lib/inmueble/**`, `src/components/inmueble/**` |
| leaf-2.1 | VERIFIED | leaf-1.1 | sonnet | `src/lib/plantillas-personal.ts`, `src/app/(dashboard)/empezar/IntentWizard.tsx` |
| leaf-2.2 | VERIFIED | leaf-2.1 | sonnet | `src/lib/plantillas-personal.ts`, `src/app/(dashboard)/empezar/**` |
| leaf-3.0 | VERIFIED | — | opus | `src/lib/duraciones-mercado.ts`, `prisma/schema.prisma` (RegistroDuracion) |
| leaf-3.1 | VERIFIED | — | opus | `src/lib/rendimientos.ts`, `src/lib/precios-semilla.ts`, `src/lib/estimar-duracion.ts` |
| leaf-3.2 | VERIFIED | leaf-3.1 | opus | `src/lib/rendimientos.ts`, `src/lib/estimar-duracion.ts` |
| leaf-3.3 | VERIFIED | leaf-3.2 | opus | `src/lib/calendario-colombia.ts`, `src/lib/scoring.ts` |
| leaf-3.4 | VERIFIED | leaf-3.3 | opus | `src/lib/cronograma/**`, `src/components/personal/LineaTiempoObra.tsx` |
| leaf-3.5 | VERIFIED | leaf-3.4 | opus | `src/lib/cronograma/**`, `src/components/personal/ContraPronostico.tsx` |
| leaf-4.1 | VERIFIED | — | opus | `src/lib/documentos/**`, `src/lib/juntos/registro-documento.ts` |
| leaf-4.2 | VERIFIED | leaf-4.1 | opus | `src/lib/documentos/**`, `src/app/api/documentos/**` |
| leaf-5.1 | VERIFIED | leaf-1.1 | opus | `prisma/migrations/**`, `src/lib/productos-tecnicos/**` |
| leaf-5.2 | VERIFIED | leaf-5.1, leaf-4.2 | opus | `src/components/productos-tecnicos/**`, `src/lib/pdf/ActaEstadoInicialReport.tsx` |
| leaf-5.3 | VERIFIED | leaf-5.1 | sonnet | `src/components/productos-tecnicos/**`, `src/app/api/productos-tecnicos/**` |
| leaf-6.1 | IN-FLIGHT | todos | opus | ninguno exclusivo — repara donde encuentre |
| leaf-6.2 | WAITING | leaf-6.1 | opus | ninguno exclusivo — solo reporta y corrige seguridad |

## Orden de despacho

**Ola 1 (paralelo):** leaf-1.1 · leaf-1.2 · leaf-1.3 · leaf-4.1 · **leaf-3.0** · **leaf-3.1**
**Ola 2:** leaf-2.1 · leaf-4.2 · leaf-5.1 · leaf-3.2
**Ola 3:** leaf-2.2 · leaf-5.3 · leaf-3.3
**Ola 4:** leaf-5.2 · leaf-3.4
**Ola 5:** leaf-3.5
**Ola 6:** leaf-6.1 → leaf-6.2

`leaf-3.0` y `leaf-3.1` suben a la Ola 1: el análisis de algoritmia ya está
entregado (`docs/specs/algoritmo-duracion.md`) y son las dos de mayor retorno de
todo el plan — el motor está hoy **fuera de banda en los tres casos patrón**.

**El shrinkage bayesiano queda FUERA de este alcance.** Requiere ~50 obras
terminadas con la medición ya arreglada. Fase 8 del documento de algoritmia.

## Log

- 2026-08-30 plan creado
- 2026-08-30 agente de algoritmia entregó `docs/specs/algoritmo-duracion.md`
- 2026-08-30 rama 3 reestructurada: 3 leaves → 6, con leaf-3.0 (medición) como bloqueante
