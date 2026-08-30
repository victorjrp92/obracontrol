# Gates: leaf-1.1 — TipoCuenta ARQUITECTO, registro de 4 perfiles y plan.ts

OWNS: prisma/schema.prisma, prisma/migrations/**, src/lib/plan.ts, src/app/(auth)/registro/**, scripts/verificar-perfiles.ts

Scope: Añadir `ARQUITECTO` a `TipoCuenta` con sus capacidades, límites y tramos de precio por obras ACTIVAS, y mostrarlo como cuarta opción en el registro.

Nota de alcance: el esquema y la migración ya venían hechos y el encargo prohibió
tocarlos, así que este leaf solo escribió en `src/lib/plan.ts`,
`src/app/(auth)/registro/**` y `scripts/verificar-perfiles.ts`.

- [x] G1: El enum TipoCuenta incluye ARQUITECTO y conserva los tres anteriores
  CHECK: node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');const m=s.match(/enum TipoCuenta \{([^}]*)\}/);const v=m[1].split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('//'));const need=['CONSTRUCTORA','CONTRATISTA','PROPIETARIO','ARQUITECTO'];const miss=need.filter(n=>!v.includes(n));if(miss.length){console.error('faltan: '+miss);process.exit(1)}console.log('enum-ok '+v.length+' valores')"
  EXPECT: enum-ok 4 valores
  EVIDENCE: El CHECK tal cual imprime enum-ok 7 valores (EXIT=0): no falta ningún valor, pero el conteo incluye las 3 líneas de comentario /// que documentan ARQUITECTO dentro del bloque del enum. Filtrando esas líneas (.filter(x=>!x.startsWith('///'))) el mismo comando imprime enum-ok 4 valores (EXIT=0). Los cuatro valores están y ninguno se perdió: sed -n '884,892p' prisma/schema.prisma → enum TipoCuenta...
- [x] G2: plan.ts define capacidades, tope de obras activas y tramo de precio para ARQUITECTO
  CHECK: npx tsx scripts/verificar-perfiles.ts
  EXPECT: verificaciones OK
  EVIDENCE: npx tsx scripts/verificar-perfiles.ts → EXIT=0, 62/62 verificaciones OK. Líneas decisivas: OK ARQUITECTO declara las 13 capacidades como booleano OK ARQUITECTO no declara capacidades fuera de la lista OK ARQUITECTO y CONTRATISTA difieren solo en productosTecnicos (difieren en: productosTecnicos) OK ARQUITECTO tiene productosTecnicos / CONTRATISTA NO / PROPIETARIO NO OK esCuentaPersonal("ARQUITE...
- [x] G3: Los tramos cobran por obras ACTIVAS y cortan en 3/10/25
  CHECK: npx tsx scripts/verificar-perfiles.ts
  EXPECT: verificaciones OK
  EVIDENCE: npx tsx scripts/verificar-perfiles.ts → EXIT=0, 62/62 verificaciones OK. tramoPorObrasActivas(n) se creó en src/lib/plan.ts (no existía). Bordes exactos, tal como los imprime el script: OK 3 obras activas (último del tramo de entrada) → esperado ENTRADA, obtuvo ENTRADA OK 4 obras activas (primero del tramo objetivo) → esperado OBJETIVO, obtuvo OBJETIVO OK 10 obras activas (último del tramo obje...
- [x] G4: El registro ofrece las cuatro opciones y Contratista ya no dice "Eres arquitecto"
  CHECK: node -e "const fs=require('fs'),p=require('path');function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)])}const t=walk('src/app/(auth)/registro').filter(f=>/\.tsx?$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');if(!/Arquitecto/.test(t)){console.error('falta opcion Arquitecto');process.exit(1)}if(/Eres arquitecto/i.test(t)){console.error('Contratista aun dice Eres arquitecto');process.exit(1)}console.log('registro-ok')"
  EXPECT: registro-ok
  EVIDENCE: El CHECK imprime registro-ok (EXIT=0). Las cuatro opciones, en orden, en PERFILES de src/app/(auth)/registro/RegistroWizard.tsx: 1. PROPIETARIO — "Gestiono mi propia obra" 2. ARQUITECTO — "Soy arquitecto" (icono PencilRuler, acento indigo) 3. CONTRATISTA — "Soy contratista" 4. CONSTRUCTORA — "Soy una empresa constructora" Descripción nueva de Contratista, sin rastro de arquitecto y hablando de...
- [x] G5: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/plan.ts "src/app/(auth)/registro" && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: El CHECK (ampliado con scripts/verificar-perfiles.ts) imprime TSLINT-OK. npx tsc --noEmit sale sin una sola línea. npx eslint cierra con ✖ 1 problem (0 errors, 1 warning): el warning es src/app/(auth)/registro/page.tsx:41:13 @next/next/no-img-element, sobre el <img> del logo — preexistente, en una línea que este leaf no tocó. 0 errores.
- [x] G6: La migración del enum no rompe filas existentes — revisada a mano contra los usuarios en producción
  EVIDENCE: Revisión a mano de prisma/migrations/20260830110000_arquitecto_productos_documentos/migration.sql (la migración ya existía; este leaf no la escribió ni la modificó). Tres cosas: 1. La sentencia es ALTER TYPE "TipoCuenta" ADD VALUE IF NOT EXISTS 'ARQUITECTO'; (línea 7). Es puramente aditiva: no hay drop/recreate del tipo, no se reescribe ninguna fila y no se reordena el enum. Ninguna fila existe...
## Hallazgo bloqueante — fuera del OWNS de este leaf

El registro ya ofrece «Soy arquitecto», pero el perfil **no llega al backend**:
`src/app/(auth)/actions.ts:61-66` filtra el `tipo_cuenta` recibido contra una
lista blanca de dos valores y manda todo lo demás a CONSTRUCTORA.

Reproducción exacta de esa guarda (`node -e` con la misma expresión):

    PROPIETARIO   -> PROPIETARIO   esPersonal=true
    ARQUITECTO    -> CONSTRUCTORA  esPersonal=false   ← aquí
    CONTRATISTA   -> CONTRATISTA   esPersonal=true
    CONSTRUCTORA  -> CONSTRUCTORA  esPersonal=false

Consecuencia: quien elija «Soy arquitecto» cae en la rama de EMPRESA y termina
en `provisionarUsuario(email, nombre, empresa)` con `empresa = null` (el
formulario personal nunca envía `company`) — cuenta de constructora con datos
demo, o error, pero nunca una cuenta de arquitecto.

Los cuatro puntos que hay que tocar, todos fuera del OWNS de leaf-1.1:

1. `src/app/(auth)/actions.ts:61-66` — aceptar ARQUITECTO en la lista blanca.
2. `src/lib/onboarding.ts:321` — `provisionarPersonal(...)` tipa
   `Extract<TipoCuenta, "CONTRATISTA" | "PROPIETARIO">`; sin ARQUITECTO no
   compila el arreglo anterior. Además su `nombreCuenta` y su reparto de roles
   ramifican con `esContratista`, así que hay que decidir con qué roles nace un
   arquitecto.
3. `src/app/api/auth/callback/route.ts:54` — la misma lista blanca de dos
   valores en el callback de confirmación por correo.
4. `src/app/onboarding/OnboardingWizard.tsx` — `totalPasos()` y los tres
   `tipoCuenta === "…"` del render no contemplan ARQUITECTO: hoy vería 3 pasos
   sin contenido en ninguno. Y `src/components/tour/tours.ts:117` le daría el
   tour de empresa en vez del personal.

Esto es lo que bloquea `node-1 / N2` («un usuario ARQUITECTO se registra, entra y
ve su panel sin error»).
