# Gates: leaf-1.3 — Bloque de datos del inmueble

OWNS: src/lib/inmueble/**, src/components/inmueble/**, prisma/schema.prisma, prisma/migrations/**, scripts/verificar-inmueble.ts

Scope: Bloque reutilizable de datos del inmueble (matrícula inmobiliaria, dirección, conjunto+unidad, ciudad, tipo, área, pisos, año de construcción, solicitante), consumible desde Juntos, el acta de estado inicial y el proyecto.

NOTA: `prisma/schema.prisma` y `prisma/migrations/**` NO se tocaron. Los once
campos del bloque ya existían en el modelo `Proyecto` (ocho añadidos para el
perfil Arquitecto + `ciudad`, `tipo_propiedad` y `metraje_total`, que se
reutilizan). El verificador los comprueba leyendo el schema, no asumiéndolos.

- [x] G1: El modelo tiene los nueve campos y matrícula inmobiliaria es opcional
  CHECK: npx tsx scripts/verificar-inmueble.ts
  EXPECT: verificaciones OK
  EVIDENCE: 2026-08-30 — 145/145 verificaciones OK, exit 0. La sección 1 del script lee prisma/schema.prisma y verifica uno por uno los ONCE campos del bloque B8 en model Proyecto (matricula_inmobiliaria, direccion_inmueble, conjunto_edificio, unidad_inmueble, ciudad, tipo_propiedad, metraje_total, anio_construccion, altura_libre_m, habitada_durante_obra, solicitante), más matricula_inmobiliaria String? y...
- [x] G2: El año de construcción se traduce a norma sísmica (pre-1984 / CCCSR-84 / NSR-98 / NSR-10)
  CHECK: npx tsx scripts/verificar-inmueble.ts
  EXPECT: verificaciones OK
  EVIDENCE: 2026-08-30 — sección 3 del script, 24 asserts. Los cuatro tramos con sus BORDES exactos: 1983→sin_codigo / 1984→cccsr_84, 1997→cccsr_84 / 1998→nsr_98, 2009→nsr_98 / 2010→nsr_10. Sin año no hay tramo por defecto: null, undefined, 1499, año futuro fuera de rango, 1998.5 y NaN devuelven null. normaSismicaPorAnio y fraseNormaSismica en src/lib/inmueble/norma-sismica.ts.
- [x] G3: La validación rechaza matrícula con formato imposible y área negativa
  CHECK: npx tsx scripts/verificar-inmueble.ts
  EXPECT: verificaciones OK
  EVIDENCE: 2026-08-30 — sección 2: la matrícula da la MISMA forma canónica escrita con guion, sin guion, con espacios, con punto y con guion tipográfico (370-7596 / 3707596 / 370 7596 / 370.7596 / 370–7596), y se rechazan 13 formas imposibles (vacía, solo el círculo, dos guiones, letras en el número, 30 caracteres…). Sección 4: área negativa (-1, -45.5), cero, 0,5 y 100001 se rechazan; el borde 100000 se...
- [x] G4: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/inmueble src/components/inmueble && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: 2026-08-30 — npx tsc --noEmit exit 0 (repo completo); npx eslint src/lib/inmueble src/components/inmueble scripts/verificar-inmueble.ts sin salida, exit 0.
- [x] G5: Ningún texto del módulo emite un juicio sobre el inmueble
  CHECK: npx tsx scripts/verificar-inmueble.ts
  EXPECT: verificaciones OK
  EVIDENCE: 2026-08-30 — sección 7, misma mecánica que la regla de /\bsegur/i en src/lib/alerta/copys.ts: se barren 147 cadenas (microcopy de los once campos, etiquetas de documento, las cuatro normas, las líneas impresas y los ~30 mensajes de error que producen las entradas inválidas) contra /\bsegur|peligr|riesg|habitab/i y no matchea ninguna. Con control positivo (el patrón caza «es peligroso», «hay rie...
## Entregable

- `src/lib/inmueble/tipos.ts` — `DatosInmueble` (once campos, nombres = columnas
  de `Proyecto`), `FormularioInmueble`, `CampoInmueble`, `NormaSismica`.
- `src/lib/inmueble/matricula.ts` — `normalizarMatricula`, `validarMatricula`,
  `formatearMatricula`. Permisiva a propósito (decisión documentada en el
  encabezado): valida la FORMA, no la existencia del predio.
- `src/lib/inmueble/norma-sismica.ts` — los cuatro tramos y sus frases neutras.
- `src/lib/inmueble/validacion.ts` — validador por campo + de formulario (todos
  los errores a la vez) + de JSON crudo para rutas API.
- `src/lib/inmueble/copys.ts` — microcopy que justifica cada campo.
- `src/lib/inmueble/documento.ts` — el bloque tal como se imprime en el acta.
- `src/lib/inmueble/index.ts` — API pública.
- `src/components/inmueble/BloqueDatosInmueble.tsx` (+ `CampoFormularioInmueble.tsx`,
  `PistaNormaSismica.tsx`) — bloque controlado, móvil primero.
- `scripts/verificar-inmueble.ts` — 145 verificaciones.
