# Gates: leaf-6.1 — Agente anti-bugs

OWNS: (ninguno exclusivo — repara donde encuentre, tras reclamar)

Scope: Un solo agente recorre TODO lo entregado por los leaves anteriores, busca defectos de corrección, integración y regresión, y los repara.

- [x] G1: Tipos limpios en todo el repo
  CHECK: npx tsc --noEmit && echo TSC-OK
  EXPECT: TSC-OK
  EVIDENCE: npx tsc --noEmit imprime TSC-OK con exit 0 sobre el repo entero, medido tras la última reparación. Se corrió cinco veces durante el trabajo (línea base, tras la tanda 1, tras la tanda 2, tras los oráculos y al cierre) y salió limpio las cinco. Ficheros tocados que compila: src/lib/productos-tecnicos/index.ts, src/lib/obrero.ts, src/lib/pwa-install.ts, src/lib/media/overlay.ts, src/lib/deepseek....
- [x] G2: Lint sin errores en todo el repo
  CHECK: npx tsx scripts/verificar-lint-linea-base.ts
  EXPECT: verificaciones OK
  EVIDENCE: 1/1 verificaciones OK, exit 0, con LINEA_BASE bajada de 13 a 1 en scripts/verificar-lint-linea-base.ts. npx eslint . pasa de 62 problemas 13 errores 49 avisos a 48 problemas 1 error 47 avisos. Reparados 12 de 13: 3 react-hooks/purity por Date.now en el cuerpo de un Server Component en super-admin/pwa-metricas/page.tsx lineas 29 52 63, resueltos con la funcion haceDias fuera del componente; 4 re...
- [x] G3: Los motores de Juntos siguen verdes
  CHECK: npm run verify:alerta
  EXPECT: verificaciones OK
  EVIDENCE: 43/43, 37/37 y 35/35 verificaciones OK, exit 0, identicos a la linea base recibida; corrido tres veces a lo largo del trabajo. Ademas verificar-calidad-foto 54/54 OK. Ningun fichero de src/lib/alerta ni de src/components/juntos se modifico: el unico cambio que roza la linea Juntos es el parametro wordmark de quemarOverlay en src/lib/media/overlay.ts, que es OPCIONAL y por defecto vale SEIRICON...
- [x] G4: Todos los verificadores nuevos pasan
  CHECK: npx tsx scripts/verificar-perfiles.ts && npx tsx scripts/verificar-personal-campo.ts && npx tsx scripts/verificar-inmueble.ts && npx tsx scripts/verificar-intenciones.ts && npx tsx scripts/verificar-espacios.ts && npx tsx scripts/verificar-duracion-calibracion.ts && npx tsx scripts/verificar-calendario.ts && npx tsx scripts/verificar-cronograma.ts && npx tsx scripts/verificar-probabilidad.ts && npx tsx scripts/verificar-documentos.ts && npx tsx scripts/verificar-firmas.ts && npx tsx scripts/verificar-productos-tecnicos.ts && npx tsx scripts/verificar-acta-inicial.ts && npx tsx scripts/verificar-planos.ts && npx tsx scripts/verificar-medicion-duracion.ts && npx tsx scripts/verificar-dias-habiles-unico.ts && npx tsx scripts/verificar-bundle-cliente.ts && echo TODOS-OK
  EXPECT: TODOS-OK
  EVIDENCE: TODOS-OK, exit 0. Conteos finales frente a la linea base recibida: perfiles 62 igual, personal-campo 5 igual, inmueble 145 igual, intenciones 309 igual, espacios 335 igual, duracion-calibracion 87 igual, calendario 97 igual, cronograma 140 igual, probabilidad 92 igual, documentos 185 igual, firmas 156 sube a 161, productos-tecnicos 102 igual, acta-inicial 140 igual, planos 43 igual, medicion-du...
- [x] G5: Informe de defectos encontrados y reparados, con archivo y línea de cada uno
  EVIDENCE: 14 defectos inventariados, 11 reparados, 3 reportados sin tocar. El detalle completo con archivo y linea esta en la seccion INFORME de este mismo fichero, mas abajo.
## Cómo se buscaron los defectos

Cuatro pasadas, tal como pedía el encargo. La segunda y la cuarta usaron **control
positivo sistemático**: un arnés que hace una copia del fichero, le mete una
mutación semántica, corre el verificador, restaura y comprueba que salió con
exit 1. Se aplicó a 17 verificadores. Dos no detectaron su mutación y ahí
salieron los dos oráculos ciegos que se reparan abajo.

## INFORME — defectos encontrados

### Reparados

**D1 · Prisma en el bundle del navegador — `src/lib/productos-tecnicos/index.ts:35` y `:45`.**
El barril reexportaba `puertosPrisma` (de `puertos-prisma.ts:1`) y las cuatro
consultas (de `consultas.ts:2`), y los dos importan `@/lib/prisma`, que
**instancia** `PrismaClient` en el propio módulo (`src/lib/prisma.ts:19`). Un
barril con un módulo con efectos secundarios dentro no se puede podar, así que
cuatro módulos de cliente que solo querían una constante se llevaban Prisma y
`pg` al navegador: `SubidaProductoDialog.tsx:6` (`formatearBytes`),
`logica/vista-cupo.ts:1` (`formatearBytes`), `logica/vista-formatos.ts:2`
(`FIRMAS`, `FORMATOS_POR_TIPO`) y `logica/vista-planos.ts:1`
(`cadenaDeVersiones`). Es exactamente el defecto contra el que ya avisaba la
cabecera del propio fichero para `contexto.ts` y `almacenamiento.ts`.
**Reparado:** los dos reexports salen del barril; las dos únicas páginas que los
usaban pasan a import directo
(`dashboard/proyectos/[id]/tecnicos/page.tsx:7`, `.../registro-inicial/page.tsx:9`),
que es lo que ya hacían todas las rutas de `src/app/api/productos-tecnicos/**`.

**D2 · Enum de Prisma importado como valor — `src/lib/obrero.ts:1`.**
`import { EspecialidadObrero } from "@/generated/prisma"` en forma de VALOR. Los
enums son constantes reales en el cliente generado. Hoy `tsc` lo borra porque
solo se usa en posiciones de tipo, pero está a un uso de distancia de arrastrar
el cliente entero a `ObreroManager.tsx` y a `dashboard/obreros/client.tsx`, que
son `"use client"`. **Reparado:** `import type`.

**D3 · `diasHabilesSemana` no llegaba al motor — `src/components/personal/LineaTiempoObra.tsx:180` y `src/components/personal/ContraPronostico.tsx:59`.**
Costura entre leaves. leaf-3.3 dejó anotado que la jornada del proyecto no
llegaba al motor; leaf-3.5 añadió la prop y
`dashboard/proyectos/[id]/page.tsx:474` pasa el valor real
(`proyecto.dias_habiles_semana`) — pero los dos componentes se lo daban solo a
`pronosticoFechas` y a `addWorkingDays`, **nunca a `estimarDuracion`**. El motor
usa ese número en ρ, el factor que traduce las esperas de secado de días
calendario a días de obra (`estimar-duracion.ts:416`). Resultado: en cualquier
proyecto con jornada distinta de 6, la DURACIÓN se calculaba con semana de 6 y
las FECHAS con la real. Dos números que no cuadran entre sí en la misma tarjeta.
**Reparado:** la opción entra en las dos llamadas y en los dos arrays de
dependencias del `useMemo` (que era el segundo medio-defecto: sin eso el
resultado quedaba congelado al cambiar la jornada).

**D4 · La ficha de personal de campo no mostraba dirección ni contacto de emergencia — `src/app/api/obreros/route.ts:36-58`.**
El `select` de `GET /api/obreros` no traía `direccion`,
`contacto_emergencia`, `contacto_emergencia_telefono`, `fecha_nacimiento` ni
`tipo_sangre`, pero `ObreroManager.tsx:358-367` los pinta en la tarjeta. Llegaban
siempre `undefined`, así que los campos que el POST sí guarda
(`route.ts:182-187`) eran invisibles hasta abrir «Editar», que pide la ficha
completa a `GET /api/obreros/[id]`. **Reparado:** los cinco campos entran en el
`select`; `ObreroManager.tsx` prellena también fecha de nacimiento y tipo de
sangre y su comentario deja de mentir.

**D5 · El uso del piso no se veía en el progreso — `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx:518-580`.**
En una obra personal hay una `Unidad` por piso y su `nombre` es «Piso 2» — el
mismo dato que ya se pinta a la izquierda de la fila. El uso que el usuario
nombró en el wizard («Farmacia», «Peluquería») vive en
`Unidad.nombre_personalizado` (`empezar/actions.ts:721`), y la rejilla de
progreso no lo leía: un LOCAL de dos pisos mostraba «Piso 1 · Piso 2» y el uso
solo existía dentro del wizard. **Reparado:** helper `etiquetaUnidad()` que
prefiere `nombre_personalizado`, usado en la rejilla, en las zonas comunes, en el
`title` y en el panel de detalle.

**D6 · «SEIRICON ALERTA» quemado en el acta del arquitecto — `src/lib/media/overlay.ts:110`.**
El wordmark estaba escrito a pelo y `CamaraRegistroInicial.tsx:173` reusa esa
cámara, así que el registro fotográfico inicial salía con la marca de la línea de
alertas. **Reparado:** quinto parámetro `wordmark` con `WORDMARK_DEFECTO =
"SEIRICON ALERTA"`, así que las dos superficies de Juntos no cambian ni un píxel,
y la cámara del arquitecto pasa `"SEIRICON"`.

**D7 · Copy muerto de una intención retirada — `src/lib/deepseek.ts:82`.**
`LABEL_OBRA.MODIFICACION` decía «modificación / ampliación», el nombre de una
intención que se fusionó dentro de REFORMA. **Reparado apartándose del enunciado
a propósito:** la clave NO se borra, se apunta al mismo texto que REFORMA. Borrarla
haría que un `tipo_obra = "MODIFICACION"` de la base cayera en el `||` de
`deepseek.ts:124` y el modelo recibiera «obra de construcción». Es la misma
política de legado que ya aplica `resolverTipoObra`
(`plantillas-personal.ts:57`) y que `verificar-intenciones.ts:76` verifica.

**D8 · 12 de los 13 errores de eslint.** Detalle en G2.

**D9 · ORÁCULO CIEGO — `scripts/verificar-dias-habiles-unico.ts`.**
Tres agujeros, los tres medidos con un control positivo que NO hizo fallar al
guardia: (a) su `RE_DEF` solo reconocía `function nombre(`, así que
`const esHabil = (d) => d.getDay() !== 0` era invisible; (b) daba por buena
cualquier definición en un fichero que importara `@/lib/calendario-colombia`,
aunque el import fuera decorativo — un `esHabil` ciego junto a un `rho(6)` sin
usar pasaba; (c) solo recorría `src/`, así que la tercera copia real llevaba
semanas fuera de radar. Marcaba 3/3 OK con 2 definiciones vivas y una copia ciega
suelta. **Reparado:** regla conductual en vez de conteo — si el cuerpo de una
función de la familia mira `getDay`/`getUTCDay`, tiene que consultar el
calendario canónico en ese mismo cuerpo. Detector ampliado a las cuatro formas
sintácticas, recorrido ampliado a `scripts/`, y cuatro controles positivos más
dos negativos dentro del propio script. Pasa de 3 a 7 verificaciones.

**D10 · Tercera copia de «día hábil», ciega a los festivos — `scripts/seed-demo-camara.ts:107`.**
La que destapó D9. Descontaba domingos pero no los 18 festivos colombianos. Su
comentario justificaba la réplica con «no importamos de `src/` porque ese módulo
arrastra el cliente Prisma»; dejó de ser cierto cuando leaf-3.3 escribió
`calendario-colombia.ts`, que no tiene ninguna dependencia. **Reparado:** delega
en `esHabil` canónico, normalizando a medianoche UTC porque el canónico mira
`getUTCDay()` y el script camina en hora local.

**D11 · ORÁCULO CIEGO — `scripts/verificar-firmas.ts:792` y `:799`.**
Las dos listas que sostienen la compuerta de inmutabilidad,
`CAMPOS_INMUTABLES` y `CAMPOS_ESCRIBIBLES_UNA_VEZ`, se importaban del módulo
auditado y su CONTENIDO no se comprobaba en ninguna parte. La compuerta se podía
desarmar sin tocar una línea de lógica: renombrando `"folio"` dentro de
`src/lib/documentos/inmutabilidad.ts:36` el script seguía en verde — medido. La
lista de la verdad vivía en el examinado, no en el oráculo. **Reparado:** las dos
listas se fijan literalmente en el script, se comprueba que son disjuntas, y se
añade un control positivo con un `data:` que reescribe el folio. Ahora las dos
mutaciones lo hacen fallar. Pasa de 156 a 161 verificaciones.

**D12 · Estado derivado sin declarar — `src/app/onboarding/OnboardingWizard.tsx:104` y `:111`.**
Dos avisos `exhaustive-deps` nuevos que introdujo el soporte de ARQUITECTO:
`esPerfilContratista` se usa dentro de dos `useMemo` y no está en sus
dependencias. Hoy no puede desincronizarse porque se deriva de `tipoCuenta` en el
propio render y `tipoCuenta` sí está listado, pero eso es una casualidad del
código actual. **Reparado:** listado.

### Nuevo guardia

**`scripts/verificar-bundle-cliente.ts`** — 8 verificaciones. Recorre el grafo de
imports desde los 156 ficheros `"use client"`, siguiendo solo imports de VALOR
(`import type` y `import { type A, type B }` se descartan; `export … from`
CUENTA, que es por donde entraron las dos fugas) y parando en las fronteras
`"use server"`, y falla si alcanza `@/lib/prisma`, `@/generated/prisma`,
`@prisma/client`, `@prisma/adapter-pg`, `pg`, `next/headers`, `server-only` o
`fs`. Existe porque este defecto ya se coló dos veces, `tsc` no lo ve, `eslint`
tampoco y `next build` está prohibido en esta máquina. Comprobado que caza D1 y
D2 exactos: reponiendo el reexport del barril sale exit 1, y devolviendo
`src/lib/obrero.ts:1` a forma de valor también.

### Encontrados y NO reparados, con el porqué

**N1 · El wizard B2B no escribe `depende_de`.** Pendiente de leaf-3.4.
No son un sitio sino SEIS: `src/app/api/proyectos/[id]/wizard/route.ts:728`,
`:889` y `:1026` insertan con `createMany` —cuyo comentario en `:726` dice
literalmente «evita timeout P2028 cuando son cientos de tareas»— y
`src/app/api/proyectos/wizard/route.ts:662`, `:693` y `:781` insertan fila a
fila. Encadenar exige pre-generar ids para las tres primeras, o volver a insertar
una a una y reintroducir el timeout que ese comentario documenta. **Y no tiene
efecto observable hoy:** ninguna superficie B2B lee `depende_de` y el motor de
duración solo corre para cuentas personales
(`dashboard/proyectos/[id]/page.tsx:465`, condición `personal &&`). Arreglar la
mitad barata (las tres de fila a fila) sería peor que no tocarlo: las obras
creadas tendrían cadena y las editadas la perderían, porque la ruta de edición
borra y recrea. Es un cambio de alcance en dos rutas transaccionales grandes, sin
banco de pruebas y sin base de datos a mano para medir el timeout.

**N2 · `edificio_id` y `unidades` sin validar contra el proyecto — `src/app/api/sugerencias/route.ts:134-140`.**
El POST comprueba que quien llama tiene al menos una tarea en `proyecto_id`
(`:120-131`), pero luego persiste `edificio_id` y `unidades` crudos del cuerpo
sobre `TareaSugerida`, sin comprobar que ese edificio pertenezca a ese proyecto ni
a ese tenant. Es preexistente —no lo introdujo ningún leaf de esta tanda— y es
materia de aislamiento por tenant, o sea de leaf-6.2. Se reporta, no se toca.

**N3 · Los defectos del §4 del spec que siguen vivos y son decisión de producto.**
Comprobados uno a uno: §4.4 `cuadrillas` sigue fijado en 1 en los dos call sites
(`ContraPronostico.tsx:59`, `LineaTiempoObra.tsx:181`) — inerte hasta que el
wizard pregunte «¿cuántas personas van a trabajar?», que es la fase 7. §4.8
segunda mitad: `Proyecto.dependencias_habilitadas` existe en
`prisma/schema.prisma:109` y **no lo lee absolutamente nadie** — columna muerta.
§4.9: `score_velocidad` se calcula y se guarda (`src/lib/obrero.ts:108`) y el
estimador lo ignora. §4.10: `FACTOR_PARED = 2.4`
(`src/lib/estimar-presupuesto.ts:117`) sigue siendo constante y gobierna el 47%
del trabajo. §1: `verificar-medicion-duracion` está verde, pero la compuerta G1
de leaf-3.0 sigue en NO VERIFICADO — el SQL de diagnóstico necesita la base y
nadie lo ha corrido. Ninguno es un bug de código; los cuatro son alcance.

**N4 · El error de lint que queda — `src/components/tour/TourProvider.tsx:58`.**
`recompute()` mide el `DOMRect` del objetivo del tour y lo guarda con `setRect`.
Es estado DERIVADO del layout, así que el arreglo no es envolver la llamada:
probado con `useLayoutEffect` y la regla da exactamente el mismo error. Arreglarlo
de verdad es rehacer el posicionamiento del foco con un ref callback o un store
externo, y en este repo no se puede levantar `next dev` para comprobar que el
foco sigue cayendo donde debe. Riesgo visual sin forma de medirlo. `LINEA_BASE`
queda en 1 con el motivo escrito en la cabecera del script.

**N5 · Aserto deliberadamente débil, no roto — `scripts/verificar-triage-alerta.ts:316`.**
`ADVERTENCIA_VERDE existe y no está vacía` pasa con cualquier cadena, incluida
una rota — comprobado con el arnés. No es un oráculo ciego: hace exactamente lo
que su descripción dice, y fijar el contenido de un copy sería duplicarlo. Se
anota para que nadie lo lea como una garantía de que el texto es el correcto.
