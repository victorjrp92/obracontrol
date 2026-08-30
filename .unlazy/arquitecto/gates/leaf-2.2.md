# Gates: leaf-2.2 — Espacios por tipo de propiedad y uso por piso

OWNS: src/lib/plantillas-personal.ts, src/app/(dashboard)/empezar/**, scripts/verificar-espacios.ts

Scope: En LOCAL mostrar «Espacios» con opciones de comercio en vez de «Habitaciones», y permitir nombrar el uso de cada piso (piso 1 farmacia, piso 2 peluquería).

- [x] G1: LOCAL devuelve un catálogo de espacios distinto al de CASA/APARTAMENTO y sin «Habitaciones»
  CHECK: npx tsx scripts/verificar-espacios.ts
  EXPECT: verificaciones OK
  EVIDENCE: 335/335 verificaciones OK — ESPACIOS_LOCAL (9 espacios: zona_atencion, bodega, bano_clientes, bano_personal, cocina_local, vitrina, oficina, caja, otro) es un array propio distinto de ESPACIOS_PERSONAL (12 espacios residenciales, intactos), sin ninguna key/label que contenga "habitac", con espaciosParaTipo("LOCAL") enrutando al catálogo de comercio y CASA/APARTAMENTO/EDIFICIO al residencial de...
- [x] G2: Cada piso admite un uso nombrable y se persiste
  CHECK: npx tsx scripts/verificar-espacios.ts
  EXPECT: verificaciones OK
  EVIDENCE: 335/335 verificaciones OK — PisoInput.usoNombre (opcional) viaja del wizard (PisoW.usoNombre, input visible solo si esLocal, setUsoPiso) al payload y se persiste en Unidad.nombre_personalizado (columna String? ya existente, sin migración) en crearObraPersonal, en el piso nuevo de editarObraPersonal y en sincronizarUnidad para pisos existentes; cargarObraParaEditar lo lee de vuelta. Verificado c...
- [x] G3: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/plantillas-personal.ts "src/app/(dashboard)/empezar" && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: TSLINT-OK — tsc --noEmit sin errores, eslint sin warnings/errores sobre plantillas-personal.ts y empezar/**. Control de no regresión: npx tsx scripts/verificar-intenciones.ts → 309/309 OK y npx tsx scripts/verificar-duracion-calibracion.ts → 87/87 OK (este último mostró 5 FAIL preexistentes de calibración de OTRO leaf al inicio de la sesión; se aisló revirtiendo temporalmente el único cambio de...