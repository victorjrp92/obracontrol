# Activar la pasarela de pagos (Wompi)

Guía operativa: qué llaves hace falta pedir, **dónde se pegan** y cómo comprobar
que un pago de verdad acredita la suscripción. El código ya está escrito — esto
es solo la configuración.

> Regla que atraviesa todo el documento: **Sandbox y Producción son dos mundos
> separados**. Dos juegos de llaves, dos URLs de eventos. Mezclar uno con otro es
> la forma más común de que «el pago se hizo pero no se acreditó».

---

## 1. Lo que ya está construido

| Pieza | Archivo | Qué hace |
|---|---|---|
| Adaptador de Wompi | [src/lib/pagos/wompi.ts](../src/lib/pagos/wompi.ts) | Firma de integridad, URL del checkout, verificación de webhooks, consulta a la API |
| Inicio del cobro | [src/app/api/pagos/checkout/route.ts](../src/app/api/pagos/checkout/route.ts) | Calcula el monto **en el servidor**, registra el cobro `PENDIENTE` y devuelve la URL firmada |
| Webhook | [src/app/api/pagos/wompi/webhook/route.ts](../src/app/api/pagos/wompi/webhook/route.ts) | Único sitio que concede acceso pagado |
| Reglas de acreditación | [src/lib/pagos/conciliacion.ts](../src/lib/pagos/conciliacion.ts) | Idempotencia, validación de monto, extensión de la vigencia |
| Precios y planes | [src/lib/suscripcion.ts](../src/lib/suscripcion.ts) | Fuente única de cuánto cuesta cada plan |
| Pantalla del cliente | [plan/PlanCliente.tsx](../src/app/(dashboard)/dashboard/configuracion/plan/PlanCliente.tsx) | Elegir plan y período, historial de cobros |
| Avisos de vencimiento | [api/cron/avisos-vencimiento](../src/app/api/cron/avisos-vencimiento/route.ts) | Correo a los 7, 3, 1 y 0 días |

Mientras falte cualquiera de las cuatro llaves, `wompiConfigurado()` devuelve
`false`: la pantalla de plan **no muestra el botón de pagar** y la API responde
503. La app no se rompe, simplemente no cobra.

---

## 2. Sacar las llaves

En el panel de comercios de Wompi (`https://comercios.wompi.co`) →
**Mi cuenta** → sección de llaves / *secretos para la integración técnica*.

Hay **cuatro por ambiente**:

| Variable del proyecto | Qué es | Sandbox | Producción |
|---|---|---|---|
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | Llave pública (viaja al navegador) | `pub_test_…` | `pub_prod_…` |
| `WOMPI_PRIVATE_KEY` | Llave privada — consultas a la API | `prv_test_…` | `prv_prod_…` |
| `WOMPI_INTEGRITY_SECRET` | Firma el monto del checkout | `test_integrity_…` | `prod_integrity_…` |
| `WOMPI_EVENTS_SECRET` | Valida la firma de los webhooks | `test_events_…` | `prod_events_…` |

Las tres últimas son **secretas**. Nunca les pongas el prefijo `NEXT_PUBLIC_`:
ese prefijo hornea el valor dentro del JavaScript que descarga cualquiera.

Existe además `WOMPI_AMBIENTE`, que **no** viene de Wompi: la decide quien
configura. Con `produccion` la app habla con `https://production.wompi.co/v1`;
con cualquier otro valor, con el sandbox. Tiene que ir de la mano con el juego de
llaves que hayas puesto.

---

## 3. Dónde se pegan

### 3.1 En tu máquina — `.env.local`

Es el archivo que lee `npm run dev`, y **no se comitea** (`.gitignore` ignora
`.env*`). La plantilla con todas las variables del proyecto es
[.env.example](../.env.example).

Para pagos, en local van las llaves **de sandbox**:

```dotenv
NEXT_PUBLIC_WOMPI_PUBLIC_KEY="pub_test_..."
WOMPI_PRIVATE_KEY="prv_test_..."
WOMPI_INTEGRITY_SECRET="test_integrity_..."
WOMPI_EVENTS_SECRET="test_events_..."
WOMPI_AMBIENTE="pruebas"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

Tras tocar `.env.local` hay que **reiniciar `npm run dev`**: las variables se
leen al arrancar.

### 3.2 En producción — Vercel

**Este es el único sitio donde deben vivir las llaves de producción.** No bajan
a ninguna máquina, no viajan por chat, correo ni WhatsApp: se pegan una vez,
directamente del panel de Wompi al panel de Vercel.

Project → **Settings → Environment Variables**, y por cada una:

1. *Key*: el nombre exacto de la tabla de arriba.
2. *Value*: pégalo copiándolo del panel de Wompi, sin pasar por ningún archivo
   intermedio.
3. Marca **Production**. Marca *Preview* solo si aceptas que un despliegue de
   prueba cobre dinero real — normalmente no se marca.
4. Si Vercel ofrece marcarla como **Sensitive**, hazlo: deja de poder leerse
   desde la interfaz después de guardarla.
5. *Save*.

Dos cosas que muerden:

- Las `NEXT_PUBLIC_*` se hornean **en el build**. Cambiarlas no tiene efecto
  hasta un **redeploy**. Las demás se leen en cada ejecución.
- Cada *Preview* de Vercel tiene su propio dominio. Si pruebas ahí, apunta
  `NEXT_PUBLIC_SITE_URL` a esa URL o el cliente volverá del pago a producción.

### 3.3 En GitHub Actions

Solo dos secretos, en Settings → *Secrets and variables* → **Actions**:

- `CRON_SECRET` — lo usa [avisos.yml](../.github/workflows/avisos.yml) para
  disparar los correos de vencimiento. Debe ser **el mismo valor** que la
  variable `CRON_SECRET` de Vercel, o la ruta responde 401.
- `DIRECT_URL` — lo usa [despliegue.yml](../.github/workflows/despliegue.yml)
  para comprobar que la base va al día con las migraciones.

Genera el secreto con `openssl rand -hex 32`.

---

## 4. Registrar la URL de eventos (webhook)

Sin esto **nada se acredita**: el cliente paga, Wompi cobra, y Seiricon nunca se
entera. Es el paso que más se olvida.

En el panel de Wompi, en la misma sección de la integración técnica, configura la
**URL de eventos** — una por ambiente:

```
Sandbox:     https://<tu-preview-o-túnel>/api/pagos/wompi/webhook
Producción:  https://seiricon.com/api/pagos/wompi/webhook
```

Wompi tiene que poder llegar por internet, así que **`localhost` no sirve**. Para
probar el webhook desde tu máquina, abre un túnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
# usa la URL pública que imprime como URL de eventos del sandbox
```

Alternativa más simple: probar contra un *Preview* de Vercel, que ya tiene
dominio público.

---

## 5. Probar en sandbox antes de tocar dinero real

1. Entra con un usuario que pueda administrar la cuenta (el mismo nivel que
   invita usuarios) → **Configuración › Plan**.
2. Elige plan y período. Si no ves el botón de pagar, falta alguna de las cuatro
   llaves.
3. En el checkout de Wompi paga con tarjeta de prueba:
   - `4242 4242 4242 4242` → transacción **APROBADA**
   - `4111 1111 1111 1111` → transacción **DECLINADA**
   - Fecha de vencimiento futura y CVC de 3 dígitos cualesquiera.
4. Al volver deberías caer en `/dashboard/configuracion/plan?pago=SRC-…`.

**Qué comprobar después** — esto es lo que de verdad valida la integración:

- En `pagos_suscripcion`, la fila de esa `referencia` pasó de `PENDIENTE` a
  `APROBADO` y tiene `wompi_transaccion_id` y `metodo`.
- En `constructoras`, el `plan_suscripcion` es el comprado,
  `estado_suscripcion = ACTIVA` y `suscripcion_vence_el` se corrió.
- En el historial de la pantalla de plan el cobro aparece como **Pagado**.

Si el cobro se queda en `PENDIENTE`, el problema casi siempre está en el paso 4:
o la URL de eventos no está registrada, o apunta a otro ambiente, o
`WOMPI_EVENTS_SECRET` es el del ambiente contrario y la firma no valida.

---

## 5b. Probar el cobro REAL con montos mínimos

El sandbox no reproduce ni los tiempos de PSE ni la dispersión a tu cuenta, así
que antes de anunciar el cobro hay que hacer al menos un pago de verdad. Lo
único que sobra de esa prueba es el monto: para eso están los **precios de
prueba**.

```dotenv
PRECIOS_PRUEBA="true"
PRECIOS_PRUEBA_CORREOS="tu-correo@seiricon.com"
```

Con eso, y solo para las cuentas de esa lista:

| Plan | Precio de prueba | 6 meses | 12 meses |
|---|---|---|---|
| Obra | $1.000 | $5.000 | $5.000 |
| Proyecto | $2.000 | $5.000 | $5.000 |
| Empresa | $3.000 | $5.000 | $5.000 |

Ningún cobro de prueba pasa de **$5.000**: el tope se aplica después de
multiplicar por los meses, que es donde un descuido se volvería un cobro de
cinco cifras.

**El cobro es real.** El dinero sale de verdad de la cuenta, entra de verdad a
tu comercio y se dispersa de verdad. Lo simbólico es la cifra, no la
transacción — que es justo lo que hace que la prueba sirva.

### Cómo saber qué precios están activos

| Dónde | Qué te dice |
|---|---|
| **Panel de Super Admin** (`/super-admin`) | La respuesta completa: si la pasarela está configurada, en qué ambiente, si los precios de prueba están encendidos y **para quién**. Es el único sitio que lo dice aunque a tu cuenta no le afecte |
| **Configuración › Plan** | Aviso ámbar y los montos que se van a cobrar — pero solo si TU cuenta está en la lista |
| **Historial de pagos** | Lo que se cobró de verdad en cada transacción |
| **Vercel → Environment Variables** | La fuente de la verdad |

El panel de Super Admin existe precisamente porque la pantalla de plan no basta:
si acotas por correo, quien no esté en la lista no ve ningún aviso y el modo
puede quedarse encendido sin que nadie lo note.

### Las dos reglas

1. **Acota siempre con `PRECIOS_PRUEBA_CORREOS`.** Mientras la lista tenga a
   alguien, el resto de tus clientes sigue viendo y pagando el precio real. Con
   la lista vacía aplica a todo el mundo: cualquiera podría comprar el plan
   Empresa por mil pesos.
2. **Apágalo al terminar** (`PRECIOS_PRUEBA=false` y redeploy). Mientras esté
   encendido, la pantalla de plan muestra un aviso ámbar de «Precios de prueba
   activos» — está puesto ahí a propósito, para que no se quede olvidado en
   silencio.

Los precios reales de [suscripcion.ts](../src/lib/suscripcion.ts) **no se
modifican**: el modo prueba los sustituye al vuelo. Por eso `npm run
verify:pagos` sigue afirmando que el plan Empresa cuesta $3.500.000, y por eso
volver atrás es cambiar una variable, no revertir un commit.

---

## 6. Pasar a producción

Lista de verificación, en orden:

- [ ] El comercio está **aprobado** por Wompi (documentos y cuenta de dispersión
      al día). Sin eso las llaves `prod` no cobran.
- [ ] Las cuatro llaves `pub_prod_ / prv_prod_ / prod_integrity_ / prod_events_`
      cargadas en Vercel, entorno *Production*.
- [ ] `WOMPI_AMBIENTE=produccion`.
- [ ] `NEXT_PUBLIC_SITE_URL=https://seiricon.com`.
- [ ] URL de eventos **de producción** registrada en el panel de Wompi.
- [ ] `RESEND_API_KEY` puesta: los avisos de vencimiento son el mecanismo de
      renovación de este producto, sin correo no hay renovación.
- [ ] `CRON_SECRET` idéntico en Vercel y en GitHub Secrets.
- [ ] **Redeploy** después de cargar las variables.
- [ ] `npm run verify:pasarela` en verde. Comprueba desde fuera —igual que lo
      haría Wompi— que el sitio responde, que la base va al día, que el webhook
      es alcanzable **sin sesión** y que el checkout no entrega una URL de pago a
      un anónimo. No manda dinero ni crea cobros.

      ```bash
      npm run verify:pasarela
      npm run verify:pasarela -- --sitio https://mi-preview.vercel.app
      ```

      Lo que ese script **no** puede ver: si las cuatro llaves están cargadas (no
      hay endpoint que lo diga, ni debe haberlo — se comprueba entrando a
      Configuración › Plan y viendo si aparece el botón de pagar) y si la URL de
      eventos está registrada, que vive del lado de Wompi.
- [ ] Prueba real de punta a punta: una compra con dinero de verdad,
      verificando que la vigencia se extiende. Con `PRECIOS_PRUEBA` cuesta
      $1.000 en vez de $650.000 (ver §5b).
- [ ] **`PRECIOS_PRUEBA=false` y redeploy** en cuanto termines esa prueba.
      Es el paso que más fácil se olvida y el más caro: mientras siga
      encendido sin lista de correos, cualquiera compra el plan Empresa por
      mil pesos.
- [ ] Que los precios de [suscripcion.ts](../src/lib/suscripcion.ts) sean los
      mismos que muestra la landing. Es el mismo número en dos sitios y no puede
      divergir.

---

## 7. Cómo se acredita un pago (y por qué no se puede hacer trampa)

La suscripción **solo** la extiende el webhook, nunca el checkout. Tres candados,
en este orden:

1. **Firma.** El checksum SHA-256 del evento se valida contra
   `WOMPI_EVENTS_SECRET`. Sin esto la ruta sería un endpoint público donde
   cualquiera declararía aprobado un pago que nunca ocurrió.
2. **Confirmación contra la API.** Aunque la firma pase, el estado se vuelve a
   consultar a Wompi con la llave privada: la fuente de verdad es Wompi, no el
   cuerpo que llegó por la red.
3. **Idempotencia y monto.** El pago se acredita solo si estaba `PENDIENTE` y si
   lo cobrado coincide con lo registrado. Un reintento de Wompi no extiende la
   vigencia dos veces, y un monto manipulado se marca `ERROR` sin acreditar nada.

El monto lo calcula siempre el servidor a partir del plan; el navegador nunca
manda un precio.

---

## 8. Lo que NO es automático

- **La renovación.** PSE —como paga una empresa en Colombia— no admite cobro
  recurrente: cada pago lo autoriza la persona en su banco. Por eso el modelo es
  *avisar y que renueve*, y por eso los correos de vencimiento no son un adorno.
- **La conciliación de pagos huérfanos, en automático.** El barrido existe y es
  [scripts/conciliar-pagos.ts](../scripts/conciliar-pagos.ts): busca los cobros
  que llevan demasiado tiempo en `PENDIENTE`, le pregunta a Wompi cómo
  terminaron y los resuelve llamando a la misma `aplicarResultado()` que usa el
  webhook.

  ```bash
  npm run pagos:conciliar                      # informe, no toca nada
  npm run pagos:conciliar -- --ejecutar        # resuelve lo que encuentre
  npm run pagos:conciliar -- --minutos 60      # margen antes de darlo por huérfano
  ```

  Lo que **no** existe es una tarea programada que lo corra sola: hoy alguien
  tiene que acordarse. Y como el script lee `.env.local`, para conciliar
  producción necesita las credenciales de producción en la sesión — otra razón
  para montarlo como ruta de cron protegida con `CRON_SECRET`, igual que los
  avisos, en vez de correrlo a mano desde una máquina.

  Conviene hacerlo antes de tener volumen: «pagó y el producto le dice que no»
  es la peor forma de fallar de todas las que tiene un cobro.

---

## 9. Problemas comunes

| Síntoma | Causa casi segura |
|---|---|
| No aparece el botón de pagar | Falta alguna de las cuatro llaves, o se cargaron sin redeploy |
| `/api/pagos/checkout` → 503 | Lo mismo: `wompiConfigurado()` es `false` |
| `/api/pagos/checkout` → 403 | El usuario no tiene nivel para administrar la cuenta |
| Wompi rechaza el checkout | `WOMPI_INTEGRITY_SECRET` es de otro ambiente que la llave pública |
| El pago se queda en «En proceso» | URL de eventos sin registrar, mal apuntada, o `WOMPI_EVENTS_SECRET` cruzado |
| Log `webhook wompi: firma inválida` | El secreto de eventos no corresponde al comercio o ambiente que envió |
| Log `el monto cobrado no coincide` | Se cambió el precio en `suscripcion.ts` entre iniciar el cobro y pagarlo |
| El cliente vuelve a una página sin noticias del pago | `NEXT_PUBLIC_SITE_URL` apunta a otro entorno |
| `verify:pasarela` dice que el webhook no es alcanzable | La *Deployment Protection* de Vercel está activa sobre producción: Wompi no tiene sesión y nunca podrá acreditar |

---

## 10. Custodia y rotación de las llaves

Tres de las cuatro llaves son secretos de dinero, y cada una falla distinto si se
filtra:

| Llave | Qué puede hacer quien la tenga |
|---|---|
| `WOMPI_EVENTS_SECRET` | Falsificar un webhook con firma válida y **regalarse suscripciones**: es la que concede acceso |
| `WOMPI_PRIVATE_KEY` | Consultar y operar sobre tu comercio contra la API de Wompi |
| `WOMPI_INTEGRITY_SECRET` | Firmar checkouts con el monto que quiera |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | Nada: es pública por diseño, viaja en cada checkout |

Reglas de custodia:

- Del panel de Wompi al panel de Vercel, **directo**. Nunca por chat, correo,
  WhatsApp, ticket, captura de pantalla ni un archivo compartido.
- Nunca en el repositorio. `.gitignore` ignora `.env*`, pero la regla real es no
  escribirlas en ningún archivo versionable.
- Las de producción no viven en máquinas de desarrollo. En local, sandbox.
- Si una llave aparece en un comando, queda en el historial de la terminal.

### Cuándo rotar

En cuanto una llave haya pasado por un canal que no controlas — y eso incluye un
chat, aunque después se borre. **Borrar el mensaje no revoca la llave; solo
rotarla lo hace.** Ante la duda, se rota: cuesta diez minutos.

### Cómo rotar, en orden

1. En `comercios.wompi.co` → Mi cuenta, genera el juego nuevo. Si no hay
   autoservicio para alguno de los secretos, pídelo a soporte de Wompi.
2. Actualiza las cuatro variables en Vercel (*Production*).
3. **Redeploy.** Hasta que no lo hagas, la llave pública vieja sigue horneada en
   el build.
4. Comprueba que la URL de eventos sigue registrada. La URL no cambia al rotar,
   pero el secreto con el que se firman los eventos sí.
5. Corre la conciliación: un webhook que viajaba firmado con el secreto viejo
   falla la validación de firma y ese cobro se queda `PENDIENTE`.

   ```bash
   npm run pagos:conciliar                 # informe
   npm run pagos:conciliar -- --ejecutar   # resolver
   ```

6. Haz un cobro real de prueba y verifica que se acredita.

### Si sospechas que una llave se usó

Revisa en el panel de Wompi las transacciones del período, y en la base los
`pagos_suscripcion` con estado `APROBADO` sin una `referencia` que tú hayas
generado, o `constructoras` con la vigencia extendida sin pago detrás. El
esquema de referencias (`SRC-…` con 8 bytes aleatorios) hace que una acreditación
inventada sea fácil de distinguir.
