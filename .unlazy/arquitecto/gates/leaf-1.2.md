# Gates: leaf-1.2 — «Obrero» → «Personal de Campo» y campos nuevos

OWNS: src/components/dashboard/**, src/app/(dashboard)/dashboard/equipo/**, src/app/(dashboard)/dashboard/obreros/**, prisma/migrations/**, scripts/verificar-personal-campo.ts

> Nota: el encargo recibido en esta pasada listaba el OWNS como
> `src/components/dashboard/**, src/app/(dashboard)/dashboard/equipo/**,
> src/app/(dashboard)/dashboard/obreros/**, src/components/personal/**,
> src/app/o/**, scripts/verificar-personal-campo.ts` — sin
> `prisma/migrations/**` (con instrucción explícita de NO tocar
> `prisma/schema.prisma` ni `prisma/migrations/`), y SÍ con
> `src/components/personal/**` y `src/app/o/**`. Se siguió esa versión.
> `prisma/migrations/**` no se tocó en ningún caso (no hizo falta: los
> campos ya existían — ver G3).

Scope: Renombrar «Obrero» a «Personal de Campo» y «Personas externas» a «Personal del proyecto» SOLO en interfaz, en todos los perfiles incluido B2B, y añadir contacto de emergencia y dirección a ambos.

- [x] G1: Ningún texto visible dice «Obrero» / «obrero» / «Personas externas»
  CHECK: npx tsx scripts/verificar-personal-campo.ts
  EXPECT: verificaciones OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=5/5 verificaciones OK | Renombrado de interfaz de leaf-1.2 verificado sin errores. $ npx tsx scripts/verificar-personal-campo.ts Seiricon — verificación de «Personal de Campo» / «Personal del proyecto» (leaf-1.2) Archivos .tsx bajo OWNS: 39 G1 — ningún texto visi...
- [x] G2: El modelo de datos NO cambió — sigue existiendo `model Obrero` y la tabla `obreros`
  CHECK: node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');if(!/model Obrero \{/.test(s)){console.error('se renombro el modelo');process.exit(1)}if(!/@@map\(\"obreros\"\)/.test(s)){console.error('se renombro la tabla');process.exit(1)}console.log('modelo-intacto')"
  EXPECT: modelo-intacto
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=modelo-intacto $ node -e "...(check de arriba)..." modelo-intacto prisma/schema.prisma no se editó en ningún momento de esta pasada.
- [x] G3: Contacto de emergencia y dirección existen en Obrero y en PersonaExternaProyecto
  CHECK: node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');const b=n=>s.match(new RegExp('model '+n+' \\\\{([^}]*)\\\\}'))[1];for(const m of ['Obrero','PersonaExternaProyecto']){const t=b(m);for(const f of ['contacto_emergencia','direccion']){if(!t.includes(f)){console.error(m+' sin '+f);process.exit(1)}}}console.log('campos-ok')"
  EXPECT: campos-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=campos-ok $ node -e "...(check de arriba)..." campos-ok Ambos campos ya existían en el esquema antes de esta pasada (confirmado leyendo prisma/schema.prisma líneas 646-867: Obrero.direccion, Obrero.contacto_emergencia, PersonaExternaProyecto.direccion, PersonaExt...
- [x] G4: Las rutas públicas /o/[token] siguen funcionando sin cambios de contrato
  CHECK: npx tsc --noEmit && npx eslint "src/app/o" && echo RUTAS-OK
  EXPECT: RUTAS-OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=✖ 2 problems (0 errors, 2 warnings) | RUTAS-OK $ npx tsc --noEmit (sin salida — 0 errores) $ npx eslint "src/app/o" src/app/o/[token]/layout.tsx 26:15 warning Using <img> could result in slower LCP... @next/next/no-img-element src/app/o/[token]/tarea/[id]/page.ts...
- [x] G5: Control positivo del verificador: introducir «Obrero» en un fixture lo hace fallar
  EVIDENCE: Control positivo — el detector SÍ debe marcar un fixture con «Obrero» OK el detector marca el fixture de control (contiene «Obrero» en texto visible) Fixture usado (en el propio script, FIXTURE_CON_VIOLACION): un componente con <h3 title="Detalle">Agrega un Obrero para continuar.</h3>. El detector lo marca correctamente. Se agregó además una segunda prueba, FIXTURE_LIMPIO (línea real tomada de...
## Fuera de alcance (fuera de OWNS, no tocado en esta pasada)

Auditoría completa hecha durante la implementación. Estos archivos siguen
mostrando «Obrero»/«obreros» o «Personas externas» como texto visible y
necesitan un leaf/PR aparte porque no están en el OWNS de leaf-1.2:

- **«Personas externas» → «Personal del proyecto» (B2B), completo:**
  `src/app/(dashboard)/dashboard/proyectos/[id]/equipo/client.tsx` (título de
  sección, empty state, texto de ayuda de "Gestionar equipo"),
  `.../proyectos/[id]/equipo/page.tsx` (subtítulo del Topbar: "N externos"),
  `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep3.tsx` (texto de
  ayuda). Ninguno de estos vive bajo `dashboard/equipo/**` (esa ruta es
  el "Mi equipo" B2C) — viven bajo `proyectos/[id]/equipo/**`, una ruta
  distinta no incluida en este OWNS.
- **«Obrero» en super-admin:** `src/app/(super-admin)/super-admin/obreros/{page,client}.tsx`
  (Topbar "Obreros", columna "Obrero", empty state) y
  `src/app/(super-admin)/super-admin/proyectos/[id]/equipo-client.tsx`
  (sección "Obreros activos (N)", empty state "Sin obreros activos").
- **«Obrero» en el contratista B2C/B2B:** `src/app/(contratista)/contratista/obreros/page.tsx`
  — Topbar `title="Mis obreros" subtitle="Gestiona el acceso de tus
  obreros"`. (El componente que renderiza debajo, `ObreroManager`, SÍ está
  arreglado — ver arriba — así que el formulario/ficha de esa página ya
  dicen «Personal de campo»; solo el título de la página quedó pendiente.)
- **Gap de datos (no de texto):** `src/app/api/obreros/route.ts` (GET de
  lista) no selecciona `direccion`/`contacto_emergencia`/
  `contacto_emergencia_telefono`/`fecha_nacimiento`/`tipo_sangre` — ver
  detalle en G3 arriba.
