# Gates: leaf-4.2 — Firmas e inmutabilidad

OWNS: src/lib/documentos/**, src/app/api/documentos/**, src/components/documentos/**, src/app/c/**, scripts/verificar-firmas.ts

Scope: Firma del profesional (imagen + sesión autenticada como identidad, fecha y hora), «recibido conforme» del cliente por enlace sin cuenta, y documento inmutable tras firmar.

Fuera de OWNS, tocado y por qué: `src/app/c/[token]/page.tsx` está DENTRO de OWNS (`src/app/c/**`) y solo se le añadió la lista de documentos firmados de la obra, bajo un `try/catch` que devuelve `[]` — el avance de la obra no puede desaparecer porque el registro de documentos tenga un mal minuto. Nada más fuera de OWNS.

NO se tocó `prisma/schema.prisma` ni `prisma/migrations/**`: el modelo `DocumentoFirmable` ya traía `firmado_por_id`, `firmado_el`, `matricula`, `recibido_por`, `recibido_el`, `version` y `reemplaza_a`.

- [x] G1: Un documento firmado NO se puede modificar; corregir emite versión nueva con folio nuevo
  CHECK: npx tsx scripts/verificar-firmas.ts
  EXPECT: verificaciones OK
  EVIDENCE: 156/156 verificaciones OK. Bloque 1 (26 comprobaciones) y bloque 8 (18). El comportamiento: firmar estampa quién/cuándo/matrícula y no toca folio ni huella; asegurarModificable y asegurarBorrador lanzan DOCUMENTO_INMUTABLE sobre un firmado; firmar dos veces lanza YA_FIRMADO y NO cambia ni un campo de la fila; dos firmas simultáneas (Promise.allSettled) dejan exactamente una; corregir emite foli...
- [x] G2: La versión anterior queda marcada como reemplazada y sigue verificando
  CHECK: npx tsx scripts/verificar-firmas.ts
  EXPECT: verificaciones OK
  EVIDENCE: 156/156 verificaciones OK. Bloque 2 (11 comprobaciones). La v1 firmada y reemplazada sigue devolviendo existe: true y su huella SIGUE COTEJANDO (huellaCoincide: true) contra la huella corta impresa en su pie; la verificación añade vigencia: { version: 1, reemplazado: true } para que quien tenga el papel viejo se entere de que hay una posterior. Tras dos correcciones encadenadas la v1 conserva s...
- [x] G3: La huella cambia si cambia un solo byte del contenido
  CHECK: npx tsx scripts/verificar-firmas.ts
  EXPECT: verificaciones OK
  EVIDENCE: 156/156 verificaciones OK. Bloque 3 (10 comprobaciones): un byte al final del contenido, un byte EN MEDIO de un contenido largo, y un dígito del folio (que también entra en el hash) dan huellas distintas; la huella CORTA impresa en el pie también cambia. Una corrección con el MISMO contenido tiene otra huella, porque tiene otro folio. Y por el lado de la consulta: con la huella impresa responde...
- [x] G4: El enlace del cliente no expone datos de otros documentos ni de otro tenant
  CHECK: npx tsx scripts/verificar-firmas.ts
  EXPECT: verificaciones OK
  EVIDENCE: 156/156 verificaciones OK. Bloque 6 (17 comprobaciones), con dos obras en dos constructoras distintas. documentoParaCliente y dejarConstanciaDeRecibido pasan obligatoriamente por asegurarEnAlcance(), que exige doc.proyecto_id === proyectoId y cuyo proyectoId sale del TOKEN, nunca de la URL ni del cuerpo. Un folio de otra obra, uno de otro tenant, uno sin obra y uno inexistente fallan los cuatro...
- [x] G5: El token del cliente es aleatorio, no adivinable, y tiene freno de fuerza bruta
  CHECK: npx tsx scripts/verificar-firmas.ts
  EXPECT: verificaciones OK
  EVIDENCE: 156/156 verificaciones OK. Bloque 7 (20 comprobaciones). Se reutiliza EL MISMO mecanismo endurecido de /c/[token], no uno nuevo: 5000 tokens de generarTokenAcceso() salen todos de 32 caracteres urlsafe (24 bytes = 192 bits), sin repetirse, ninguno con forma de cuid —que lleva marca de tiempo y contador y no es un secreto— y ninguna de las 32 posiciones resulta fija ni casi fija (menos de 8 valo...
- [x] G6: El botón dice «recibido conforme» — constancia de entrega, NUNCA aprobación del contenido
  EVIDENCE: Revisado texto por texto, no por inercia. COPY_RECIBIDO.boton = «Dejar constancia de recibido conforme». La aclaración va ENCIMA del campo y del botón, no debajo ni tras un enlace de «más información», y dice literalmente: «"Recibido conforme" quiere decir que el documento te llegó completo y legible en esta fecha. NO es una aprobación de su contenido: puedes dejar la constancia hoy y no estar...
- [x] G7: Ningún texto del módulo dice «dictamen pericial»; todo dice «concepto técnico»
  CHECK: node -e "const{execSync}=require('child_process');const out=execSync('grep -rni \"dictamen pericial\\|peritaje\" src/lib/documentos src/components/documentos src/app/api/documentos 2>/dev/null || true').toString();if(out.trim()){console.error('prohibido:\n'+out);process.exit(1)}console.log('concepto-tecnico-ok')"
  EXPECT: concepto-tecnico-ok
  EVIDENCE: concepto-tecnico-ok. Revisado de verdad, y con una red más ancha que la del grep: el bloque 9 del script barre CUATRO directorios (src/lib/documentos, src/components/documentos, src/app/api/documentos y src/app/c) más el propio script —37 archivos— contra TERMINOS_PROHIBIDOS, que además del que busca la compuerta incluye «prueba pericial» y las dos formas del sustantivo. En positivo: ETIQUETA_T...
## Cómo quedó la firma

**Quién.** La sesión autenticada ES la identidad. `POST /api/documentos/[id]/firmar` no lee el
cuerpo de la petición —se comprueba estáticamente que no hay `req.json()`—: el id que se
estampa sale de `requireUser()`. Un campo donde el propio firmante escribiera su nombre no
probaría nada.

**Cuándo.** El reloj del servidor, no uno que venga en la petición. Las fechas se muestran en
`America/Bogota` (`fechas.ts`): a las 21:00 en Colombia son las 02:00 UTC del día siguiente, y
un acta firmada el domingo por la noche no puede salir fechada el lunes.

**Qué no cambió.** La huella SHA-256 del contenido + folio, que ya existía, más la
inmutabilidad estructural descrita en G1 — sin ella la huella no probaría nada.

**Matrícula congelada.** Se copia del perfil a la fila al firmar. Comprobado: se firma con una,
se actualiza el perfil, y el documento emitido sigue con la vieja mientras los siguientes
llevan la nueva.

**Perfil de firma (imagen + matrícula).** Vive en el bucket PRIVADO bajo `firmas/<usuarioId>/`,
porque el esquema estaba congelado para este leaf y `usuarios` no tiene columnas para esto. La
ruta ES la clave, así que no hace falta ninguna columna para encontrarlo; el perfil se lee en
un solo momento (al firmar) y nunca se consulta ni se agrega. Una firma escaneada es un dato
sensible de verdad —quien la tenga puede pegarla en cualquier papel—, así que no entra en un
bucket público ni se sirve por URL permanente, solo firmada y temporal. El día que se le añadan
columnas a `usuarios`, lo único que cambia es `almacen-firma.ts`.

## Lo que este leaf NO promete
Firma electrónica SIMPLE (Ley 527 de 1999, Decreto 2364 de 2012). No es firma digital
certificada —esa exige entidad de certificación acreditada— y el texto de pantalla lo dice con
esas palabras. La identidad de quien recibe es más débil que la del profesional (entra por
enlace, sin cuenta) y por eso lo suyo es constancia de ENTREGA y no una segunda firma con el
mismo peso.

## Punto de integración pendiente para leaf-5.2
Los componentes `FirmarDocumento` y `PerfilDeFirma` están escritos y comprobados pero todavía
no los monta ninguna pantalla: `src/app/(dashboard)/**` no está en el OWNS de este leaf. La
pantalla del acta de estado inicial (leaf-5.2) debe montarlos y llamar a `emitirDocumento()` /
`emitirCorreccion()` en vez de reescribir la fila. `asegurarBorrador()` es la puerta para
cualquier consumidor que guarde el contenido por su cuenta y quiera tocarlo.

## Verificación completa
- `npx tsc --noEmit` → exit 0
- `npx eslint src/lib/documentos src/components/documentos src/app/api/documentos src/app/c scripts/verificar-firmas.ts` → exit 0
- `npx tsx scripts/verificar-firmas.ts` → `156/156 verificaciones OK`
- `npx tsx scripts/verificar-documentos.ts` → `185/185 verificaciones OK` (leaf-4.1 intacto)
- `npm run verify:alerta` → `43/43`, `37/37`, `35/35 verificaciones OK`
- compuerta de lenguaje → `concepto-tecnico-ok`
