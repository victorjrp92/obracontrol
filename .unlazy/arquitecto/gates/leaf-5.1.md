# Gates: leaf-5.1 — Modelo, almacenamiento y cupos

OWNS: prisma/schema.prisma, prisma/migrations/**, src/lib/productos-tecnicos/**, src/lib/storage.ts, scripts/verificar-productos-tecnicos.ts

Scope: Modelo de Productos Técnicos atado a obra (y opcionalmente a piso o unidad), con cupo de 1 GB por obra activa y aislamiento por tenant.

Entregado: capa de dominio `src/lib/productos-tecnicos/**` (13 archivos), tres rutas
en `src/app/api/productos-tecnicos/**` y la suite `scripts/verificar-productos-tecnicos.ts`
(102 verificaciones, sin base de datos, con puertos inyectados).

NO se tocaron `prisma/schema.prisma`, `prisma/migrations/**` ni `src/lib/storage.ts`:
el modelo `ProductoTecnico` y su migración con RLS ya existían, y `storage.ts` se
lee y se usa (`getSignedEvidenciaUrl` en la ruta de descarga) pero no se modifica.

- [x] G1: La tabla nueva nace con RLS activo
  CHECK: node -e "const fs=require('fs'),p='prisma/migrations';const d=fs.readdirSync(p).filter(x=>/producto/i.test(x));if(!d.length){console.error('sin migracion');process.exit(1)}const s=d.map(x=>fs.readFileSync(p+'/'+x+'/migration.sql','utf8')).join('\n');if(!/ENABLE ROW LEVEL SECURITY/i.test(s)){console.error('sin RLS');process.exit(1)}console.log('rls-ok')"
  EXPECT: rls-ok
  EVIDENCE: rls-ok (exit 0). La migración 20260830110000_arquitecto_productos_documentos crea productos_tecnicos y cierra con ALTER TABLE "productos_tecnicos" ENABLE ROW LEVEL SECURITY;. No se modificó ninguna migración.
- [x] G2: El cupo de 1 GB por obra se aplica y rechaza la subida que lo exceda
  CHECK: npx tsx scripts/verificar-productos-tecnicos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 102/102 verificaciones OK (exit 0). Sección 1 del script: - CUPO_BYTES_POR_OBRA === 1024³. - Borde exacto: lo que ocupa justo lo que queda se acepta; un byte más → 413 CUPO_EXCEDIDO. - El mensaje dice cuánto queda: «Esta obra llegó a su cupo de 1 GB. Quedan 24 MB libres y el archivo pesa 40 MB.» - EL CÁLCULO INCLUYE LAS REEMPLAZADAS: obra con una versión reemplazada de 600 MB y una vigente de 4...
- [x] G3: Un archivo puede atarse a obra, a piso o a unidad, y siempre pertenece a una obra
  CHECK: npx tsx scripts/verificar-productos-tecnicos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 102/102 verificaciones OK (exit 0). Sección 2 del script: - Los tres niveles (OBRA / PISO / UNIDAD) se aceptan y prepararSubida conserva siempre proyectoId en el plan. - Sin obra, o con la obra en blanco → 400 UBICACION_INVALIDA. - Piso y unidad a la vez → 400 (ambiguo: la unidad ya cuelga de un piso). - Un piso de otra obra → 404 UBICACION_AJENA (el puerto ubicacionPertenece comprueba la caden...
- [x] G4: Solo ARQUITECTO y CONSTRUCTORA acceden al módulo
  CHECK: npx tsx scripts/verificar-productos-tecnicos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 102/102 verificaciones OK (exit 0). Sección 3 del script: - perfilPuedeProductosTecnicos delega en puede(tipo, "productosTecnicos") de src/lib/plan.ts — no hay una segunda comprobación escrita en paralelo. - ARQUITECTO y CONSTRUCTORA suben; CONTRATISTA y PROPIETARIO reciben 403 PERFIL_SIN_ACCESO, tanto en assertPerfilConAcceso como en prepararSubida. - El 403 corta ANTES de consultar: con puert...
- [x] G5: Las rutas API empiezan por requireUser() y validan pertenencia al tenant
  CHECK: node -e "const fs=require('fs'),p=require('path');function walk(d){if(!fs.existsSync(d))return[];return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)])}const rs=walk('src/app/api/productos-tecnicos').filter(f=>f.endsWith('route.ts'));if(!rs.length){console.error('sin rutas');process.exit(1)}const bad=rs.filter(f=>!/requireUser\(/.test(fs.readFileSync(f,'utf8')));if(bad.length){console.error('sin requireUser: '+bad.join(', '));process.exit(1)}console.log('tenant-ok '+rs.length+' rutas')"
  EXPECT: tenant-ok
  EVIDENCE: tenant-ok 3 rutas (exit 0). Las tres rutas (route.ts, [id]/vigente/route.ts, [id]/descarga/route.ts) abren con requireUser() de src/lib/tenant.ts y siguen con contextoProductosTecnicos() + assertObraAccesible(), que encadena assertProyectoInTenant() (404 si la obra es de otra constructora) y canAccessProject() sobre getAccessibleProjectIds() (403 si es del tenant pero no de este usuario). Los t...
## Verificación adicional (no exigida por las compuertas)

- `npx tsc --noEmit` → 0 errores en `productos-tecnicos`.
  (El proyecto tiene 1 error preexistente ajeno a este leaf, en
  `scripts/verificar-documentos.ts:146`, causado por la ampliación de
  `PrefijoFolio` a `"AE" | "CT"` en `src/lib/documentos/folio.ts` — otro leaf.)
- `npx eslint src/lib/productos-tecnicos src/app/api/productos-tecnicos scripts/verificar-productos-tecnicos.ts`
  → exit 0, sin avisos.
- `npx tsx scripts/verificar-productos-tecnicos.ts` → `102/102 verificaciones OK`, exit 0.
