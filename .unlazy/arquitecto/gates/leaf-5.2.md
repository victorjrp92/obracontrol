# Gates: leaf-5.2 — Registro fotográfico inicial y acta de estado

OWNS: src/components/productos-tecnicos/**, src/lib/pdf/ActaEstadoInicialReport.tsx, src/app/api/productos-tecnicos/acta/**, scripts/verificar-acta-inicial.ts

Scope: Registro fotográfico inicial con foto tomada SOLO desde la app (fecha, hora y GPS quemados) y acta de estado inicial en PDF con folio verificable.

Entregado: 8 componentes nuevos en `src/components/productos-tecnicos/**`
(CamaraRegistroInicial, SelectorEspacioRegistro, FotoRegistroCard,
EspacioRegistroSection, FotosSinMarcaAviso, RegistroInicialPanel,
PanelActaInicial, ActaEmitidaCard), 7 módulos de lógica pura sin JSX en
`src/components/productos-tecnicos/logica/**` (marca-foto-inicial,
arbol-espacios, acta-estado-inicial, copys-acta-inicial, api-acta-inicial,
vista-registro-inicial, vista-acta-inicial), el PDF
`src/lib/pdf/ActaEstadoInicialReport.tsx`, cuatro rutas bajo
`src/app/api/productos-tecnicos/acta/**` más su almacén de contenido congelado,
la pantalla `.../tecnicos/registro-inicial/{page,client}.tsx`, y
`scripts/verificar-acta-inicial.ts` (140 verificaciones, sin base de datos).

Fuera de OWNS, tocado y por qué:
- `src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/page.tsx` — solo se AÑADIÓ el enlace a la pantalla nueva y su icono. No se reescribió nada de leaf-5.3.
- `src/app/verificar/{page,client}.tsx` — CREADO. Directorio nuevo que no pertenece a ningún leaf. La compuerta G3 exige que el acta verifique «en la página de verificación» y esa página no existía: solo estaba la ruta API. El pie del PDF imprime esa dirección, y un pie que remite a una página inexistente hace concluir a quien lo intenta que el documento es falso.

NO se tocó `prisma/` (ni esquema ni migraciones), ni `src/lib/media/overlay.ts`, ni `src/lib/documentos/**`, ni `src/lib/productos-tecnicos/**`, ni `src/app/api/productos-tecnicos/route.ts`: todo eso se consume tal cual.

- [x] G1: No hay ninguna vía de subir desde la galería en el registro inicial
  CHECK: npx tsx scripts/verificar-acta-inicial.ts
  EXPECT: verificaciones OK
  EVIDENCE: 140/140 verificaciones OK (exit 0). La cámara del registro es getUserMedia + canvas: los píxeles salen de un MediaStream y se dibujan en un lienzo, así que el gesto de escoger un archivo NO EXISTE — no está prohibido, no está construido. Se descartó el patrón de la cámara de Juntos (input type=file con capture) a propósito: capture es una PISTA que un navegador de escritorio ignora, abriendo el...
- [x] G2: Toda foto del registro lleva fecha, hora y ubicación quemadas en la imagen
  CHECK: npx tsx scripts/verificar-acta-inicial.ts
  EXPECT: verificaciones OK
  EVIDENCE: 140/140 verificaciones OK (exit 0). El overlay lo quema quemarOverlay() de src/lib/media/overlay.ts — el MISMO de Juntos, reusado sin tocarlo, con su MAX_DIM 1200 y su CALIDAD_JPEG 0.65 — y además la fila guarda una marca en texto (espacio, instante ISO, latitud, longitud y la constancia de qué se quemó) que construye el SERVIDOR con los datos ya validados, nunca el cliente. La marca es la puer...
- [x] G3: El acta se registra con folio y verifica en la página de verificación
  CHECK: npx tsx scripts/verificar-acta-inicial.ts
  EXPECT: verificaciones OK
  EVIDENCE: 140/140 verificaciones OK (exit 0). La emisión pasa por emitirDocumento() y la corrección por emitirCorreccion(); el script comprueba estáticamente que la ruta del acta NO hace create, update, updateMany, upsert ni delete sobre documentoFirmable, así que no hay forma de reescribir una fila firmada. Bloque 3: el prefijo de ACTA_ESTADO_INICIAL es AE, el folio cumple el patrón canónico, nace en ve...
- [x] G4: El acta lleva los datos del inmueble, incluida la matrícula inmobiliaria
  CHECK: npx tsx scripts/verificar-acta-inicial.ts
  EXPECT: verificaciones OK
  EVIDENCE: 140/140 verificaciones OK (exit 0). El bloque del inmueble sale de lineasInmuebleParaDocumento() —no de una plantilla propia— así que el acta lee igual que los demás documentos del profesional: dirección con su conjunto, unidad, ciudad, Nro. matrícula, tipo de inmueble, dimensiones, altura libre, año de construcción con su norma sísmica, ocupación durante la obra y solicitante. Bloque 4: se com...
- [x] G5: El acta declara su metodología y lo que NO incluye (ni ensayos ni cálculo)
  EVIDENCE: Revisado texto por texto y comprobado en el bloque 5 del script (44 textos del acta más el acta ya construida, más los 23 archivos del entregable). La metodología va en la PRIMERA página, entera y sin plegar, en dos mitades: qué recoge el documento (4 líneas) y qué NO incluye (7 líneas). Las exclusiones dicen literalmente que no incluye ensayos de laboratorio ni pruebas sobre los materiales; ni...
- [x] G6: Control positivo: una foto sin overlay hace fallar al verificador
  CHECK: npx tsx scripts/verificar-acta-inicial.ts --control-positivo
  EXPECT: exit 1, con las comprobaciones del overlay en FAIL
  EVIDENCE: Demostrado en sus dos formas. Forma fuerte: el script acepta la bandera --control-positivo, que sustituye el registro de prueba por el mismo registro con UNA foto sin marca (misma fila, misma imagen, sin fecha ni ubicación: exactamente lo que quedaría si alguien subiera una imagen de galería por la ruta genérica de productos técnicos), sin cambiar ni una línea de las comprobaciones. Resultado m...
## Cómo se hizo imposible la subida desde la galería

Por construcción, en tres capas, y la primera es la que cuenta.

1. **No existe el control.** `CamaraRegistroInicial.tsx` obtiene los píxeles de
   `navigator.mediaDevices.getUserMedia()`, los dibuja en un `canvas` y los pasa
   a `quemarOverlay()`. En todo el recorrido no hay un input de archivo, ni un
   `accept`, ni una zona de arrastrar y soltar, ni `showOpenFilePicker`. No es un
   control deshabilitado que se pueda reactivar desde las herramientas del
   navegador: es un control que no está escrito.

2. **Se descartó el patrón de Juntos a propósito.** `ActaCameraCaptureJuntos`
   usa un input de archivo con `capture="environment"`. En un móvil abre la
   cámara; en un navegador de escritorio —y en un móvil sin cámara disponible—
   `capture` se ignora y se abre el selector de archivos. Para un documento cuya
   única razón de existir es probar una fecha, depender de una pista que el
   navegador puede ignorar no es aceptable.

3. **El servidor no acepta una foto sin fecha propia.** La única ruta del
   registro exige espacio, instante y coordenadas, y rechaza un instante que no
   caiga junto al reloj del servidor. Y aunque una fila llegara sin marca por
   otra vía, no entra al documento: `construirPayloadActa()` se niega a emitir el
   acta entera, y la pantalla la saca aparte para que se descarte.

## Estructura del acta

Un solo PDF que fluye (no un `Page` por sección: eso se llevaba media hoja en
blanco cada vez), con el sello de verificación fijo al pie de TODAS las páginas.

1. **Encabezado** — logo, título, fecha de emisión y folio.
2. **Naturaleza** — declara en un recuadro que es un concepto técnico de registro.
3. **Identificación del inmueble** — `lineasInmuebleParaDocumento()` completo,
   con la matrícula inmobiliaria, más obra, profesional y su matrícula.
4. **Resumen del registro** — espacios, fotografías, primera y última captura.
5. **Metodología y alcance** — qué recoge / **qué NO incluye** (7 exclusiones).
6. **Registro fotográfico por espacio** — cada espacio con su dirección dentro
   del inmueble, en cuadrícula de dos. Cada foto: número, ubicación, instante en
   hora de Colombia, coordenadas y observación. El nombre del espacio nunca
   queda huérfano al pie de una página: viaja pegado a su primera fila de fotos.
7. **Firmas** — imagen de firma del profesional, nombre, matrícula congelada y
   momento de la firma; junto a ella el bloque de **«recibido conforme»** del
   cliente con su aclaración de que significa entrega y no aprobación.

Verificado visualmente: se renderizó el acta y se revisaron sus cuatro páginas.
El bloque 7 del script deja esa comprobación puesta para siempre — imprime el
acta con react-pdf firmada, sin firmar y con una foto faltante, y comprueba que
sale un PDF válido en los tres casos.

## Decisiones que conviene conocer antes de tocar esto

- **Dónde vive lo que el esquema no tiene.** `prisma/` está congelado y
  `productos_tecnicos` no tiene columnas para espacio, instante ni coordenadas:
  la marca de cada foto va serializada en `descripcion`, con su contrato en
  `marca-foto-inicial.ts`. Y `documentos_firmables` no tiene dónde guardar el
  documento: el contenido del acta se congela en Storage
  (`actas-estado-inicial/<obra>/<folio>.json`, con `upsert: false`), que es el
  mismo criterio con el que leaf-4.2 guardó el perfil de firma. El día que haya
  columnas, lo único que cambia son esos dos archivos.
- **Por qué se congela.** Si el PDF se reconstruyera desde la base, corregir la
  dirección del inmueble haría que un acta ya emitida dejara de cotejar contra
  su propia huella. El PDF se imprime siempre desde la copia y coteja antes de
  dibujar.
- **La ubicación es obligatoria para capturar.** Sin coordenadas no se guarda la
  foto. Es una decisión y tiene su coste: en un sótano sin señal el profesional
  no podrá registrar hasta que el navegador le dé una posición. Se prefiere una
  foto menos a una foto que no prueba dónde se tomó.
- **Descartar no es borrar.** Una foto descartada sale de `vigente`, sigue en el
  bucket y sigue pesando en el cupo. Se puede recuperar: descartar por error no
  puede costar una foto del estado previo, que solo existe una vez.
- **Se montaron los dos componentes que leaf-4.2 dejó sin pantalla.**
  `FirmarDocumento` en cada acta sin firmar y `PerfilDeFirma` en la pestaña del
  acta — ahí y no en un ajuste aparte, porque sin matrícula registrada no se
  puede firmar y descubrirlo al pulsar «firmar» mandaría al profesional a buscar
  una pantalla de configuración con el documento a medias.

## Pendientes que este leaf deja anotados

- **El overlay imprime «SEIRICON ALERTA» en la esquina.** Es el wordmark de la
  línea Juntos y en un acta del arquitecto está fuera de sitio. No se corrigió
  porque `src/lib/media/overlay.ts` no está en OWNS, alimenta tres superficies en
  producción, y el contrato de este leaf dice explícitamente reusar esa cámara y
  no escribir otra. Es cosmético y no afecta a ninguna compuerta; corregirlo pide
  parametrizar el wordmark desde un leaf que sí posea ese archivo.
- **`docs/manual-de-usuario.md` no se tocó.** La regla del repo lo exige para lo
  que llega a `main`, y esto no está commiteado. Queda para la integración de
  node-5, junto con el resto de la rama.
- **Tope de 100 fotos por acta.** No es una regla de negocio: el PDF incrusta
  cada imagen como data-URI dentro de una función serverless. Subirlo pide
  paginar el documento o generarlo fuera de la petición, no cambiar el número.
- **La ruta genérica POST /api/productos-tecnicos sigue aceptando el tipo
  REGISTRO_INICIAL.** Es de leaf-5.1 y no está en OWNS. Ninguna pantalla la
  ofrece para ese tipo, y una fila que llegara por ahí no entra al acta y se
  enseña aparte para descartarla; cerrarla del todo es una línea en esa ruta,
  para quien la posea.

## Verificación completa

- `npx tsc --noEmit` → exit 0 (proyecto entero).
- `npx eslint src/components/productos-tecnicos src/app/api/productos-tecnicos "src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos" src/app/verificar src/lib/pdf/ActaEstadoInicialReport.tsx scripts/verificar-acta-inicial.ts` → exit 0, 0 errores. 4 avisos, ninguno introducido en sustancia: `jsx-a11y/alt-text` sobre el `Image` de react-pdf (que no es un `img` y no acepta `alt`; `ActaJuntosReport.tsx` e `InformeGrietasReport.tsx` reciben el mismo aviso desde antes) y `no-img-element` en `RenderCard.tsx`, preexistente de leaf-5.3.
- `npx tsx scripts/verificar-acta-inicial.ts` → `140/140 verificaciones OK`, exit 0.
- `npx tsx scripts/verificar-acta-inicial.ts --control-positivo` → `33/38`, exit 1 (control positivo: debe fallar).
- Re-ejecutados sin tocarlos, para confirmar que no se rompió nada de los leaves vecinos: `verificar-productos-tecnicos` 102/102, `verificar-planos` 43/43, `verificar-firmas` 156/156, `verificar-documentos` 185/185, `verificar-inmueble` 145/145, y `npm run verify:alerta` 43/43 · 37/37 · 35/35. Todos exit 0.
