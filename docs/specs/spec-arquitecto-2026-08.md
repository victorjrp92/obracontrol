# Spec — Perfil Arquitecto, cambios TPS y documentos firmables

Estado: **aprobado para implementar** · 30 de agosto de 2026
Ledger de verificación: `.unlazy/arquitecto/`

---

## 1. Qué se construye y por qué

Seiricon B2C tiene hoy tres perfiles. Se añade un cuarto, **Arquitecto**, porque
produce entregables que puede facturar —informes, actas, planos— y por eso tiene
otra disposición a pagar. No se separa por consumo de disco: un proyecto de
arquitecto pesa ~262 MB y cuesta medio centavo de dólar al mes. **Se separa por
valor entregado.**

De paso se corrigen ocho cosas del wizard B2C que aplican a todos los perfiles, y
se saca de Juntos la maquinaria de documentos verificables para que sirva también
al arquitecto.

### Los cuatro perfiles

| Perfil | `TipoCuenta` | Qué cambia |
|---|---|---|
| Gestiono mi propia obra | `PROPIETARIO` | solo TPS |
| **Arquitecto** | **`ARQUITECTO`** ← nuevo | TPS + Productos Técnicos + documentos firmables |
| Soy contratista | `CONTRATISTA` | TPS · quitar «Eres arquitecto o…» de su descripción |
| Empresa constructora | `CONSTRUCTORA` | Productos Técnicos (B2B también) |

---

## 2. Alcance

### A. Registro

- **A1** — Cuarta opción «Arquitecto» en `/registro`.
- **A2** — La descripción de Contratista deja de decir «Eres arquitecto o…».

### B. TPS — los tres perfiles B2C

- **B1** — Fusionar `REFORMA` + `MODIFICACION` en una sola categoría. Quedan dos
  intenciones: trabajar sobre lo existente / hacer algo nuevo.
- **B2** — Espacios según tipo de propiedad. En `LOCAL` se dice «Espacios», no
  «Habitaciones», con opciones de comercio.
- **B3** — Uso por piso nombrable: piso 1 farmacia, piso 2 peluquería.
- **B4** — Modificaciones generales (techo, pisos). Sin espacio declarado, aplican
  a todo el piso.
- **B5** — «Personas externas» → **«Personal del proyecto»**. Son parte del
  proyecto pero no responden por él.
- **B6** — «Obrero» → **«Personal de Campo»**, en **todos** los perfiles, B2B
  incluido. Solo interfaz: el modelo `Obrero`, la tabla `obreros` y las rutas
  `/o/[token]` no se tocan. Se añaden **contacto de emergencia** y **dirección**,
  mismos campos para el personal del proyecto.
- **B7** — Rediseño del algoritmo de duración (sección 4).
- **B8** — Bloque de datos del inmueble: matrícula inmobiliaria, dirección,
  conjunto + unidad, ciudad, tipo, área, pisos, **año de construcción**,
  solicitante. El año importa: dice bajo qué norma sísmica se construyó
  (pre-1984 sin código · CCCSR-84 · NSR-98 · NSR-10).

### C. Arquitecto

- **C1** — `TipoCuenta = ARQUITECTO` con capacidades y límites propios en `plan.ts`.
- **C2** — **Módulo Productos Técnicos** (Arquitecto **y** Constructora):
  registro fotográfico inicial · planos versionados · renders.
- **C3** — **Acta de estado inicial** en PDF con folio verificable.
- **C4** — Precios por **obras activas** (`estado: ACTIVO`), no totales.

### D. Documentos firmables — infraestructura compartida

- **D1** — Sacar folio + huella + verificación de `src/lib/juntos/` a un módulo
  propio. Juntos pasa a ser consumidor, no dueño.
- **D2** — Firma del profesional: imagen en su perfil + sesión autenticada como
  identidad, con fecha y hora.
- **D3** — «Recibido conforme» del cliente por enlace sin cuenta, patrón `/c/[token]`.
- **D4** — Documento inmutable. Corregir emite versión nueva con folio nuevo; la
  anterior queda marcada como reemplazada.
- **D5** — Todo texto dice **concepto técnico**. Nunca dictamen pericial.

---

## 3. Precios

Cobro por **obras activas**, porque un maestro de pintura con veinte trabajitos al
año pero tres activos a la vez debe pagar por tres. El código ya filtra por
`estado: ACTIVO` en `limiteObrasActivas`.

| Tramo | Obras activas | Para quién |
|---|---|---|
| Entrada | 1–3 | arquitecto empezando |
| **Objetivo** | **4–10** | ← aquí debe caer la mayoría |
| Estudio | 11–25 | con equipo |
| A convenir | +25 | |

El tramo del medio es el que se quiere vender (*center-stage effect*); los otros
dos existen para hacerlo ver razonable. El de entrada se corta en 3 a propósito:
si cubriera hasta 5, nadie subiría nunca de tramo.

**Almacenamiento: 1 GB por obra activa.** Un proyecto real de arquitecto pesa
~262 MB, así que son cuatro veces de margen. El tope existe para frenar abuso, no
porque el disco sea caro.

---

## 4. Algoritmo de duración

`estimar-duracion.ts` **ya divide cantidad ÷ rendimiento**, ordena fases,
paraleliza por cuadrillas, aplica ×1,4 con cuadrilla única, +20% de imprevistos y
buffers de fragüe. No se reescribe. Se cierran tres huecos:

1. **La cantidad se deduce, no se pregunta.** `cantidadPorUnidad` la deriva del
   área del espacio, así que «tumbar 1 muro» y «tumbar 5» dan igual.
2. **El flywheel gira sin correa.** `registros_duracion` lleva meses guardando
   días estimados contra reales; `getDuracionMercado` calcula la mediana y **nadie
   la consume** — el propio archivo dice «SIN conectar a la UI todavía».
3. **Nadie mide el error.** Estimado y real están en la misma fila y jamás se ha
   calculado la diferencia.

**El análisis está entregado: `docs/specs/algoritmo-duracion.md`.** Y encontró
algo peor de lo que suponíamos:

- El motor **rompe hoy su propia tabla de calibración**: apto de 60 m² da 91 días
  contra 60–70 (+30%), casa de 120 m² da 166 contra 100–120 (+51%). **El error
  crece con el tamaño de la obra.**
- **`dias_reales` no mide duración: mide latencia de aprobación.** `fecha_inicio`
  se escribe cuando el obrero reporta la tarea *terminada* y `fecha_fin_real`
  cuando el supervisor aprueba. El intervalo es el tiempo que tarda alguien en
  mirar dos fotos. Conectar el flywheel hoy colapsaría todo a 0.5–2 días.
- **`dias_estimados` mide el plan del usuario, no la predicción del motor**:
  `repartirGlobal()` lo sobrescribe con el reparto del plazo que puso el usuario.
- **El 30–41% del trabajo cae en la fase «Otros»** porque el matcher falla con los
  nombres que la propia app genera — y «Otros» se agenda en posición 10 de 12, así
  que **la demolición se programa después de instalar la grifería**.

Por eso la rama 3 pasa de tres leaves a seis, con `leaf-3.0` (arreglar la
medición) como bloqueante de todo lo estadístico. El shrinkage bayesiano queda
fuera de este alcance: necesita ~50 obras terminadas con la medición corregida.

---

## 5. Reglas que no se negocian

- **Nunca** `next dev` ni `next build` en local: congelaron la máquina con 16 GB.
  Verificación = `npx tsc --noEmit` + `npx eslint` + los `scripts/verificar-*.ts`.
- La ruta del repo **termina en espacio**. Comillas dobles siempre.
- Cliente Prisma en `@/generated/prisma`, nunca `@prisma/client`.
- Toda ruta API nueva empieza por `requireUser()` y valida con `assert*InTenant()`.
- Toda tabla nueva nace con **RLS activo**.
- Toda foto de registro se toma **desde la app**, jamás desde la galería: una foto
  subida no prueba fecha y el registro pierde su razón de existir.
- Sin emojis de WhatsApp. El verde no es color de marca.
- Cada cambio que llegue a `main` se refleja en `docs/manual-de-usuario.md`.

---

## 6. Árbol de ejecución

Detalle, estados y dependencias en `.unlazy/arquitecto/PLAN.md`.

```
node-1  Fundaciones ─────────── leaf-1.1  TipoCuenta ARQUITECTO + registro + plan.ts
                                leaf-1.2  Personal de Campo (renombrado + campos)
                                leaf-1.3  Datos del inmueble

node-2  Wizard B2C (TPS) ────── leaf-2.1  Fusionar intenciones + modif. generales
                                leaf-2.2  Espacios por propiedad + uso por piso

node-3  Duración ────────────── leaf-3.0  Arreglar la MEDICIÓN (bloqueante)
                                leaf-3.1  Matcher + piso de 0.5d + orden de fases
                                leaf-3.2  Recalibrar factores y cuadrillas
                                leaf-3.3  Calendario colombiano + esperas como lags
                                leaf-3.4  CPM/DAG por espacio
                                leaf-3.5  Distribución de probabilidad

node-4  Documentos firmables ── leaf-4.1  Extraer de juntos/ a módulo propio
                                leaf-4.2  Firmas + inmutabilidad

node-5  Productos técnicos ──── leaf-5.1  Modelo + storage + cupos
                                leaf-5.2  Registro inicial + acta
                                leaf-5.3  Planos versionados + renders

node-6  Verificación final ──── leaf-6.1  Agente anti-bugs (encuentra y repara)
                                leaf-6.2  Agente de seguridad
```
