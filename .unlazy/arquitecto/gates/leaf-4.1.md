# Gates: leaf-4.1 — Extraer documentos verificables de juntos/

OWNS: src/lib/documentos/**, src/lib/juntos/registro-documento.ts, src/app/api/juntos/verificar/route.ts, scripts/verificar-documentos.ts

Scope: Sacar folio + huella + verificación de `src/lib/juntos/` a un módulo propio. Juntos pasa a consumidor. Sin cambio de comportamiento visible.

Fuera de OWNS, tocado y por qué: `src/lib/juntos/folio.ts` — dejarlo con su copia del
algoritmo habría mantenido dos implementaciones del hash, que es justo el riesgo de deriva
que este leaf existe para eliminar. Queda como capa fina de 4 líneas; su API no cambió y
sus tres llamadores (las rutas de PDF) no se tocaron.

- [x] G1: El módulo compartido existe y no importa nada de juntos/
  CHECK: node -e "const{execSync}=require('child_process');const out=execSync('grep -rn \"lib/juntos\" src/lib/documentos/ || true').toString();if(out.trim()){console.error('acopla con juntos:\n'+out);process.exit(1)}console.log('desacoplado-ok')"
  EXPECT: desacoplado-ok
  EVIDENCE: desacoplado-ok. Además el script comprueba archivo por archivo los 9 del módulo (bloque 7) y que la dependencia va al revés: juntos/registro-documento.ts y juntos/folio.ts sí importan @/lib/documentos.
- [x] G2: Folio y huella siguen dando el MISMO valor que antes para las mismas entradas
  CHECK: npx tsx scripts/verificar-documentos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 155/155 verificaciones OK. El script reimplementa el algoritmo ORIGINAL (anterior al refactor) y compara contra él, y además congela 7 huellas SHA-256 literales calculadas ANTES de mover el código — así ni un cambio simultáneo en las dos partes pasaría. Cubre fecha local (no UTC), padding de mes/día, los 12 hex de la huella corta, y que un solo byte distinto —en el contenido o en el folio— camb...
- [x] G3: Los documentos ya emitidos siguen verificando — no se rompió el histórico
  CHECK: npx tsx scripts/verificar-documentos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 155/155 verificaciones OK. Bloque 5: la consulta recorre dos fuentes (documentos_firmables y la tabla vieja documentos_juntos) y un documento que solo está en la vieja sigue devolviendo existe: true con su tipo y su fecha. Si una tabla no responde y la otra no lo tiene, responde indisponible, nunca «no existe». Bloque 3: la ruta de verificación acepta exactamente los mismos folios que antes (eq...
- [x] G4: El motor de reglas de Juntos sigue intacto
  CHECK: npm run verify:alerta
  EXPECT: verificaciones OK
  EVIDENCE: 43/43, 37/37, 35/35 verificaciones OK.
- [x] G5: Tipos y lint limpios
  CHECK: npx tsc --noEmit && npx eslint src/lib/documentos src/lib/juntos && echo TSLINT-OK
  EXPECT: TSLINT-OK
  EVIDENCE: eslint limpio sobre src/lib/documentos, src/lib/juntos, la ruta de verificación y el script (exit 0). npx tsc --noEmit acotado a estos archivos y a TODOS los consumidores de Juntos (src/app/api/juntos/**, src/components/juntos/**): exit 0. NOTA: el tsc --noEmit del repo entero da errores en src/app/(auth)/actions.ts y src/app/(dashboard)/empezar/actions.ts, archivos de otros leaves que se estab...
## Privacidad (regla innegociable del leaf)
El registro escribe folio, huella, tipo, ciudad, nivel, piezas y los dos ids de tenant.
Nada más: `construirFilaRegistro` enumera los campos uno a uno y NUNCA hace spread del
objeto de entrada. Bloque 6 del script: se le pasa una entrada contaminada con nombre,
cédula, dirección, teléfono, email, fotos y coordenadas, y se comprueba que ninguno deja
rastro en la fila; más un escaneo estático del código (sin comentarios) de los 10 archivos
del módulo y de la capa de Juntos.

## Dependencia de despliegue
Los documentos nuevos se registran en `documentos_firmables`. La migración
`20260830110000_arquitecto_productos_documentos` debe estar desplegada ANTES o junto con
este código: si no, el registro de los documentos nuevos falla en silencio (es best-effort,
el PDF se entrega igual) y esos documentos no se podrían verificar. Los ya emitidos no
corren riesgo — siguen en `documentos_juntos` y la consulta los sigue mirando.
