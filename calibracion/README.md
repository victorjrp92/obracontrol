# Calibración de la lectura de fotos de Seiricon Alerta

Esta carpeta es el banco de pruebas de **qué tan bien lee las fotos** el modelo de visión de
`/alerta/grietas`. No es parte de la aplicación: nada de acá se despliega ni se muestra a un
usuario. Sirve para responder, con datos, una sola pregunta:

> ¿Alguna vez esta herramienta le dice "no vemos señales de alarma" a una grieta que sí era
> peligrosa?

Eso es un **falso verde**, y es lo único que el arnés trata como error. Todo lo demás (que
confunda una viga con una losa, que se equivoque 1mm en el ancho) es diagnóstico: se reporta,
pero no reprueba la corrida.

```bash
npm run calibrar:vision                # modo automático (simulado si no hay API key)
npm run calibrar:vision -- --simulado  # forzar el modo simulado
npm run calibrar:vision -- --real      # forzar el modo real (necesita key y fotos)
```

El comando **sale con error si hay un solo falso verde**, o si algún caso del manifiesto está
mal escrito.

---

## Modo simulado (funciona hoy, sin API key y sin fotos)

Lee `manifiesto.simulado.json`, donde cada caso trae la observación del modelo **escrita a
mano**: elemento, patrón, ancho, banderas, confianza y calidad de foto. No hay fotos ni
llamadas a internet. Sirve para probar el arnés y el motor de reglas completo mientras no haya
key ni fotos reales.

Es el modo que corre por defecto cuando no están configuradas `ANTHROPIC_API_KEY` y
`ALERTA_VISION_ENABLED=true`.

> Los números de `manifiesto.simulado.json` son **sintéticos**, inventados para ejercitar cada
> regla (incluidos tres casos trampa que intentan arrancar un verde indebido). No son
> mediciones reales de ninguna grieta.

## Modo real (cuando tengas API key y fotos)

### 1. Toma las fotos

Por cada grieta hacen falta **dos fotos**, las mismas dos que pide la app:

| Foto | Qué debe mostrar |
|---|---|
| **cerca** | Un acercamiento de la grieta con una **moneda de $500 pesos colombianos pegada al lado**, en el mismo plano de la pared. La moneda tiene que verse **completa y nítida** (es la única referencia de escala que tiene el modelo para estimar el ancho en milímetros). |
| **lejos** | El elemento **completo**, de piso a techo, para que se pueda identificar si es columna, viga, muro, losa. |

Consejos que cambian el resultado: buena luz (nada de flash rasante), la cámara perpendicular a
la pared (no en ángulo), pulso firme, y la grieta enfocada. Si la foto sale oscura, movida o muy
lejos, el modelo lo va a reportar en `calidad_foto` — y eso, por diseño, tapa el camino al verde.

### 2. Guarda las fotos

Ponlas en `calibracion/fotos/` con un nombre que puedas reconocer. Sugerencia:

```
calibracion/fotos/01-columna-sala-cerca.jpg
calibracion/fotos/01-columna-sala-lejos.jpg
calibracion/fotos/02-muro-cocina-cerca.jpg
calibracion/fotos/02-muro-cocina-lejos.jpg
```

Formatos aceptados: `.jpg`, `.jpeg`, `.png`, `.webp`.

**Las fotos NO se suben al repositorio** (`calibracion/fotos/` está en `.gitignore`): pueden
tener datos de la casa de alguien. Guárdalas donde tú decidas respaldarlas.

### 3. Escribe el manifiesto

Copia `manifiesto.ejemplo.json` a `manifiesto.json` y llénalo. Un caso se ve así:

```json
{
  "id": "01-columna-sala",
  "foto_cerca": "fotos/01-columna-sala-cerca.jpg",
  "foto_lejos": "fotos/01-columna-sala-lejos.jpg",
  "declarado": "columna",
  "pasante": "no_se",
  "esperado": { "elemento": "columna", "patron": "diagonal", "ancho_mm_real": 2.5 }
}
```

| Campo | Obligatorio | Qué significa |
|---|---|---|
| `id` | sí | Nombre corto del caso; sale en el reporte. |
| `foto_cerca` / `foto_lejos` | sí (modo real) | Ruta relativa a `calibracion/`. |
| `esperado.elemento` | sí | La verdad: `columna`, `viga`, `nudo_viga_columna`, `muro_carga`, `muro_divisorio`, `losa_techo`, `piso`, `fachada`, `no_determinado`. |
| `esperado.patron` | sí | La verdad: `diagonal`, `diagonal_x`, `vertical`, `horizontal`, `escalonada`, `craquelado`, `esquina_vano`, `junta_entre_elementos`. |
| `esperado.ancho_mm_real` | no | Solo si **mediste** la grieta con regla o calibrador. Si no la mediste, no pongas nada. |
| `declarado` | no | Lo que una persona habría marcado en el Paso 1. Por defecto, `esperado.elemento`. |
| `pasante` | no | `si`, `no` o `no_se` (¿se ve la misma grieta del otro lado?). Por defecto `no_se`. |
| `patron_declarado` | no | Lo que la persona confirmaría o corregiría en el paso de confirmación. Por defecto, lo que lea el modelo. |

### 4. Corre la calibración

```bash
# En PowerShell:
$env:ANTHROPIC_API_KEY="sk-..."; $env:ALERTA_VISION_ENABLED="true"; npm run calibrar:vision -- --real
```

Cada caso hace **dos** llamadas al modelo (doble lectura por consenso), así que 20 grietas son
40 llamadas. Los casos corren uno por uno, no todos a la vez.

---

## Qué reporta

- **Matriz de confusión de elemento y de patrón** — qué esperabas vs. qué leyó.
- **Error absoluto medio del ancho** — solo sobre los casos con `ancho_mm_real`.
- **Cuántas veces dijo "no determinado"** y cómo se repartió la calidad de las fotos.
- **Distribución de niveles finales** (rojo / amarillo / verde).
- **FALSOS VERDES**, uno por uno. Si hay al menos uno, el comando falla.

Un caso en verde **solo** es legítimo si lo esperado era un craquelado en un muro divisorio: es
el único camino a verde que tiene el motor de reglas (regla 8).

## Cuántas fotos hacen falta

No hay un número mágico, pero para que las matrices digan algo conviene apuntar a **20-30
grietas**, con al menos 3 o 4 de cada elemento que se quiera medir, y a propósito incluir casos
difíciles: fotos oscuras, sin moneda, muros divisorios que parecen de carga, y grietas
inofensivas junto a grietas graves. Los casos fáciles no enseñan nada.
