# Gates: leaf-2.1 — Fusionar intenciones y modificaciones generales

OWNS: src/lib/plantillas-personal.ts, src/app/(dashboard)/empezar/IntentWizard.tsx, scripts/verificar-intenciones.ts

Scope: Fusionar REFORMA + MODIFICACION en una sola intención (quedan dos) y añadir modificaciones generales (techo, pisos) que sin espacio declarado aplican a todo el piso.

- [x] G1: TIPOS_OBRA tiene exactamente dos entradas y ninguna obra existente queda huérfana
  CHECK: npx tsx scripts/verificar-intenciones.ts
  EXPECT: verificaciones OK
  EVIDENCE: 309/309 verificaciones OK (corrido 2026-08-30). Incluye: TIPOS_OBRA.length === 2; TIPOS_OBRA no incluye "MODIFICACION"; incluye REFORMA y OBRA_NUEVA; y para los TRES valores históricos de Proyecto.tipo_obra (REFORMA, MODIFICACION, OBRA_NUEVA) resolverTipoObra devuelve una clave que existe en TIPOS_OBRA (ninguna huérfana), con resolverTipoObra("MODIFICACION") === "REFORMA" verificado explícitame...
- [x] G2: Las modificaciones generales sin espacio se expanden a todos los espacios del piso
  CHECK: npx tsx scripts/verificar-intenciones.ts
  EXPECT: verificaciones OK
  EVIDENCE: mismo run (309/309 OK). Incluye: selección vacía → []; piso sin espacios → []; clave desconocida ignorada; una modificación × N espacios → N tareas (una por cada espacio, sin excepción); dos modificaciones × N espacios → 2N tareas, cada espacio recibe las dos. Catálogo MODIFICACIONES_GENERALES verificado con ≥3 entradas (techo, pisos, pintura), todas con tarea/duración válidas.
- [x] G3: Los proyectos ya creados con MODIFICACION siguen abriendo sin error
  EVIDENCE: no se puede levantar next dev/next build (prohibido por el contrato del repo) ni hay acceso a una base con una obra real MODIFICACION desde este entorno. Se verificó en su lugar, con npx tsx sobre un script ad-hoc, la MISMA cadena de funciones que toca obraParaEditar en empezar/actions.ts:~793 al reabrir una obra, simulando proyecto.tipo_obra = "MODIFICACION" (el valor crudo real que tiene hoy...
- [x] G4: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/plantillas-personal.ts "src/app/(dashboard)/empezar" && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: el comando encadenado tal cual NO llega a imprimir TSLINT-OK, porque npx tsc --noEmit (compila TODO el proyecto) reporta 1 error preexistente y ajeno a este leaf: scripts/verificar-documentos.ts(146,39) (archivo sin trackear de otro leaf en curso, src/lib/documentos/folio.ts — no toca tipo_obra ni ninguno de los archivos OWNS de leaf-2.1). Evidencia desagregada: - npx tsc --noEmit sobre el proy...
