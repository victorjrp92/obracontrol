# Spec: Seiricon for All

Fecha: 2026-06-04
Estado: aprobado para arranque Sprint 1
Owner: Victor + Karen

## 1. Contexto y visión

Versión B2C de Seiricon enfocada en personas naturales que necesitan controlar una obra (o varias pequeñas) sin estar en sitio. Casos de uso ancla:

- Madre en Cali con finca en Chocó
- Persona en Alemania remodelando casa en Brasil
- Flipper que compra-remodela-vende
- Arquitecto independiente con 2-5 obras pequeñas

**Insight principal:** son usuarios sin experiencia constructora pero con plata en riesgo. La complejidad del schema de Seiricon se mantiene en BD pero **se oculta totalmente en la UI**.

**Reutilización del schema main:** mismo `Constructora → Proyecto → Edificio → Piso → Unidad → Espacio → Tarea`. Niveles intermedios se auto-crean. Para el super admin (Victor + Karen) todo se ve igual y se acumula scoring de obreros cross-producto **internamente, nunca expuesto al usuario**.

## 2. Sistema de naming — A→C→B

**A — Landing self-identification** (cards visuales):
- 🏠 Construyo mi casa o finca
- 🔨 Estoy remodelando un espacio
- 🌎 Mi obra está lejos de donde vivo
- 💼 Compro, remodelo y vendo
- 📐 Manejo varios proyectos pequeños

**C — App se configura sola** (sin etiqueta visible) según las respuestas del onboarding (# proyectos esperados, tipo elegido).

**B — Identidad aspiracional en dashboard**:
- **"Dueño de obra"** (single project, persona natural típica)
- **"Gestor de proyectos"** (multi-project, arquitectos y flippers)

El usuario ve su identidad reflejada en su perfil ("Hola, dueño de obra. Estos son tus avances de hoy.") pero **nunca tuvo que elegir una etiqueta funcional**.

**Internamente en BD** (`Constructora.tipo`):
```
enum TipoConstructora {
  CONSTRUCTORA       // Seiricon main (existing default)
  DUENO_OBRA         // 1 proyecto, persona natural
  GESTOR_OBRA        // multi-proyecto B2C (arquitectos, flippers)
}
```

## 3. Pricing y validación

**Estrategia:** waitlist + A/B test antes de precio fijo.

**Hipótesis inicial:** $39.000 COP/mes (primer mes gratis, tarjeta obligatoria al signup).

**Razón de $39k:**
- Por debajo de Netflix Premium ($49k) — techo psicológico mensual
- Por encima de Spotify ($16k) — establece valor de "más serio"
- Costo unitario ~$8k → margen ~80%
- 0.5% de obra promedio ($50M) → loss aversion fuerte

**Plan de validación (mes 1-2):**
1. Landing live con waitlist (email capture)
2. Primeros 100-200 inscritos: 3 grupos A/B (`$29k` / `$39k` / `$49k`)
3. Métrica: % activación y % retención mes 2
4. Precio definitivo mes 3

**Largo plazo:** suscripción cubre acquisition + costo. Revenue real viene de:
- Escrow (fase 3): 1-2% sobre pagos a maestros = $500k-$1M por obra
- Marketplace de obreros calificados (fase 4) — usa el scoring interno
- Comisión por compra de materiales con partners (fase 5)

## 4. Landing seiricon.com/forall

### Hero
> **Tu obra. Bajo tu control. Aunque estés lejos.**
> Recibe fotos, videos y avances reales de tu obra todos los días. Aprueba lo que está bien, rechaza lo que no, controla el dinero. Desde tu celular.
>
> [Empezar gratis →]
> *Primer mes gratis. Cancela cuando quieras.*

### Estructura
1. Hero
2. Cards "¿Cuál es tu caso?" (los 5 emojis de naming)
3. Testimonios reales (3 cards con caras y nombres — empieza con la mamá de Victor, el amigo en Alemania, y un flipper si conseguimos)
4. "Los problemas que resolvemos" — 4 bullets en negativo (loss aversion)
5. Cómo funciona — 3 pasos con screenshots de la app
6. Calculadora de costos de remodelación (lead magnet — captura email)
7. Pricing transparente
8. FAQ
9. CTA final
10. Footer

### Visual direction
- **Paleta:** azules de Seiricon + acentos cálidos (terracota `#C2410C`, arena `#F5F5DC`). Sensación de "casa", no "constructora".
- **Fotos:** reales de obras latinoamericanas, NO stock con personas felices en MacBooks.
- **Tipografía:** Plus Jakarta Sans (heredada de Seiricon main) en weight medium para headers, regular en body. Tono cálido.
- **Mobile-first agresivo.** 70% del tráfico va a ser celular.

### SEO
- Keywords objetivo: "controlar obra a distancia", "supervisar remodelación", "app para constructor", "presupuesto construcción casa"
- Páginas separadas por tipo de proyecto: `/forall/remodelar-cocina`, `/forall/construir-casa`, etc. Cada una con su calculadora y testimonial.

## 5. Tipos de proyecto y fases

6 tipos preloaded. Fases en lenguaje **simple pero estándar** (educamos sin condescender). Cada fase tiene tooltip "¿qué es esto?" en primer uso.

| Tipo BD | Nombre user-facing | Fases |
|---|---|---|
| `CASA_NUEVA` | Construyo casa nueva | Cimentación · Estructura · Mampostería · Cubierta · Instalaciones · Acabados · Carpintería · Pintura · Detalles finales |
| `REMODEL_COCINA` | Remodelo mi cocina | Desmonte · Plomería y eléctrico · Enchapes · Mesón · Carpintería · Pintura · Electrodomésticos |
| `REMODEL_BANO` | Remodelo mi baño | Desmonte · Plomería · Enchapes · Sanitarios · Pintura |
| `FINCA` | Construyo o remodelo finca | (casa nueva) + Cerramiento + Pozo séptico + Accesos |
| `FLIPPING` | Compro y remodelo para vender | Diagnóstico · Demolición selectiva · Reparaciones · Cocina · Baños · Pintura general · Pulida final |
| `AMPLIACION` | Ampliación / cuarto adicional | Cimentación · Estructura · Mampostería · Cubierta · Acabados |
| `CUSTOM` | Otro / personalizado | Usuario define |

Cada fase tiene tareas sugeridas auto-pobladas (reusa la tabla `TareaAprendida` de Seiricon main). Usuario puede agregar/quitar.

## 6. Materiales precargados

Por fase, materiales más comunes con unidad y precio referencia COP. Precios se mantendrán como referencia (no live pricing — sería un proyecto aparte).

**Catálogo inicial** (~30 materiales):

| Fase | Materiales |
|---|---|
| Cimentación | Cemento gris (saco 50kg, ref $40k), Arena (m³, ref $70k), Gravilla (m³, ref $80k), Varilla #3/#4 (kg, ref $5-7k) |
| Mampostería | Ladrillo común (unidad, ref $800), Ladrillo prensado (unidad, ref $1.5k), Bloque (unidad, ref $1.8k), Cemento blanco (saco, ref $50k) |
| Cubierta | Teja de barro (m², ref $35k), Teja eternit (unidad), Madera estructural (varilla 3m) |
| Enchapes | Pegacor (saco 25kg, ref $25k), Cerámica piso (m², ref desde $25k), Porcelanato (m², ref desde $50k), Boquilla (kg, ref $8k) |
| Plomería | Tubería PVC 1/2" (varilla 6m, ref $18k), Codos PVC, Tees PVC, Pegamento PVC |
| Eléctrico | Cable #12 (m, ref $1.2k), Cable #14 (m), Toma doble (unidad, ref $8k), Interruptor (unidad, ref $5k) |
| Pintura | Vinilo blanco galón (ref $45k), Vinilo color (ref $55k), Esmalte sintético (galón, ref $60k), Estuco (saco, ref $35k) |
| Carpintería | Tablex/MDF (lámina, ref $80k), Bisagras (unidad), Manijas |

Usuario puede agregar custom. **Schema nuevo:**

```prisma
model MaterialCatalogo {
  id              String   @id @default(cuid())
  nombre          String
  unidad          String   // "saco 50kg", "m²", "varilla 6m", etc.
  precio_referencia Int?   // COP, opcional
  fase_sugerida   String?  // "cimentacion", "pintura", etc.
  es_predefinido  Boolean  @default(false)  // true = del catálogo Seiricon, false = custom usuario
  constructora_id String?  // null si predefinido global
  
  constructora    Constructora? @relation(fields: [constructora_id], references: [id], onDelete: Cascade)
  
  @@index([fase_sugerida])
  @@map("material_catalogo")
}

model InventarioObra {
  id              String   @id @default(cuid())
  proyecto_id     String
  material_id     String
  cantidad        Float    // unidades del material
  precio_unitario Int      // COP por unidad
  fecha_compra    DateTime @default(now())
  comprobante_url String?  // foto factura opcional
  
  proyecto        Proyecto         @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  material        MaterialCatalogo @relation(fields: [material_id], references: [id])
  consumos        ConsumoMaterial[]
  
  @@index([proyecto_id])
  @@map("inventario_obra")
}

model ConsumoMaterial {
  id            String   @id @default(cuid())
  inventario_id String
  tarea_id      String
  cantidad      Float
  reportado_por String   // usuario_id del maestro
  created_at    DateTime @default(now())
  
  inventario    InventarioObra @relation(fields: [inventario_id], references: [id], onDelete: Cascade)
  tarea         Tarea          @relation(fields: [tarea_id], references: [id])
  reportador    Usuario        @relation(fields: [reportado_por], references: [id])
  
  @@map("consumo_material_obra")
}
```

NOTA: ya existe un modelo `ConsumoMaterial` en el schema actual. Renombrar el existente o el nuevo. Recomendación: usar `ConsumoMaterialObra` para el nuevo y dejar el existente intacto (es para Seiricon main).

## 7. Onboarding (3 pantallas)

**Pantalla 1 — "Tu obra"**
- Cards "¿Qué vas a hacer?" (los 6 tipos)
- "¿Dónde queda?" — ciudad + departamento (autocomplete)
- "¿Cuándo crees que termina?" — mes/año

**Pantalla 2 — "Tu maestro"**
- Nombre + WhatsApp (+ código país)
- Botón "Después" para saltarse este paso

**Pantalla 3 — "Tu plata"**
- "¿Cuánto piensas invertir en total?" — input simple con separadores de miles
- Subtexto: *"Esto solo lo ves tú. Sirve para que te alertemos si el gasto se sale del rango."*

**Final:** dashboard listo con fases sugeridas. Toast de bienvenida con quick tour de 4 pasos.

## 8. Flow del maestro (data collection, sin signup)

1. Dueño en onboarding ingresa nombre + WhatsApp.
2. Sistema manda SMS + email (si dieron) con link único: `/o/[token-único-32-chars]`.
3. Maestro hace tap, ve **mini formulario obligatorio** la primera vez:
   - Nombre completo (obligatorio)
   - Cédula colombiana o documento de identidad (recomendado, no obligatorio — copy: *"Para que el dueño te identifique bien"*)
   - Confirma teléfono recibido
   - Email (opcional)
   - Foto selfie (opcional — copy: *"Para que el dueño sepa que sí eres tú"*)
4. NO crea contraseña. El link es su acceso permanente.
5. Si el mismo teléfono aparece en otra obra futura, **internamente** se asocia al mismo registro de `Obrero`/`Contratista`. Acumulación de scoring transparente para el usuario.

**Schema:** reusa `Obrero` existente, agregar `documento_identidad` opcional + `selfie_url`.

UX maestro: pantalla minimalista — solo tareas asignadas con botón gigante "Reportar avance". Misma flow que el obrero token-based actual de Seiricon main.

## 9. Notificaciones

| Canal | Cuándo | Implementación |
|---|---|---|
| **Push PWA** | Cada evento (tarea reportada, aprobada, rechazada, presupuesto al X%) | Reusa la infra de `NotificacionesContext` que ya existe |
| **Email** | Resumen semanal lunes 7am | Cron job (Vercel cron o Supabase Edge function) → `sendEmail()` con template HTML |
| **SMS** | Solo críticos: rechazo de evidencia, alerta presupuesto crítico | Twilio (cuenta nueva). Limitar para no quemar plata. |
| **Botón "Compartir avance"** | A demanda del usuario | Genera imagen + link de la app. El usuario decide compartir vía WhatsApp/Telegram/etc. desde su sistema operativo. |

**No WhatsApp Business API en MVP.** Setup complejo, aprobación Meta lenta. Fase 3.

## 10. Pagos integrados

### Suscripción Seiricon for All → usuario

- **Provider:** Wompi (más fácil en Colombia que Stripe)
- **Métodos:** Tarjeta crédito/débito + PSE + Nequi
- **Modelo:** $39k COP/mes, auto-cobro mensual, primer mes gratis pero **tarjeta obligatoria al signup** (reduce fricción de churn al mes 2)
- **Webhooks:** Wompi notifica → tabla `Suscripcion`

```prisma
model Suscripcion {
  id              String              @id @default(cuid())
  constructora_id String              @unique
  estado          EstadoSuscripcion   @default(TRIAL)
  precio_mensual  Int                 // COP, para A/B testing futuro
  wompi_subscription_id String?
  trial_termina   DateTime
  proximo_cobro   DateTime?
  ultimo_cobro    DateTime?
  metodo_pago     String?             // "tarjeta", "pse", "nequi"
  cancelada_at    DateTime?
  motivo_cancelacion String?
  
  constructora    Constructora        @relation(fields: [constructora_id], references: [id], onDelete: Cascade)
  
  @@map("suscripciones")
}

enum EstadoSuscripcion {
  TRIAL              // gratis primer mes
  ACTIVA             // pagando
  PAUSADA            // problema con pago, periodo gracia 7 días
  CANCELADA          // canceló
}
```

### Pagos a maestros (manual MVP, escrow fase 3)

**Fase 1 (MVP):** registro manual con foto de comprobante opcional.

```prisma
model PagoMaestro {
  id          String   @id @default(cuid())
  proyecto_id String
  obrero_id   String
  monto       Int      // COP
  motivo      String?  // texto libre o tarea_id asociada
  tarea_id    String?  // opcional, si fue por tarea específica
  comprobante_url String?
  metodo      String?  // "efectivo", "nequi", "transferencia", "daviplata"
  registrado_por String
  fecha_pago  DateTime @default(now())
  
  proyecto    Proyecto @relation(fields: [proyecto_id], references: [id], onDelete: Cascade)
  obrero      Usuario  @relation("PagosRecibidos", fields: [obrero_id], references: [id])
  tarea       Tarea?   @relation(fields: [tarea_id], references: [id])
  registrador Usuario  @relation("PagosRegistrados", fields: [registrado_por], references: [id])
  
  @@index([proyecto_id])
  @@index([obrero_id])
  @@map("pagos_maestro")
}
```

**Fase 2 (sprint 4+):** integración Nequi/Daviplata APIs para pago directo.

**Fase 3 (largo plazo):** escrow real — usuario carga plata, app paga automáticamente al aprobar tarea.

## 11. Redirects desde Seiricon main

Triggers que mandan a `/forall`:

1. **Signup form en seiricon.com:** pregunta upfront "¿Eres empresa constructora o tienes una obra personal?" → segundo va directo a /forall
2. **Email no empresarial** (@gmail, @hotmail, @outlook, @yahoo): banner sutil "¿Te queda mejor Seiricon for All?"
3. **NIT vs Cédula:** si registran con CC en lugar de NIT → suggested /forall
4. **Dentro de app main, 30 días con 1 proyecto < 200 tareas:** banner sugiriendo migración
5. **Landing principal seiricon.com:** card en hero "¿Tienes tu propia obra?"
6. **Quiz "¿Cuál es para mí?"** en la home — 3 preguntas → resultado

**Migración técnica:** si un usuario de Seiricon main quiere mover su data a /forall (cambio de tipo), un endpoint admin transforma `Constructora.tipo: CONSTRUCTORA → DUENO_OBRA` con flag de "migrado".

## 12. Arquitectura técnica

### Rutas

```
/forall                        # landing
/forall/empezar                # signup wizard
/forall/precios                # pricing page (deep link)
/forall/calculadora/cocina     # SEO + lead magnet
/forall/calculadora/casa
/forall/calculadora/bano
/forall/remodelar-cocina       # SEO landing por tipo
/forall/construir-casa
/forall/construir-finca
/forall/flipping
/forall/arquitecto

/dashboard                     # UI condicional según Constructora.tipo
```

### Decisión clave: misma app, UI condicional

NO crear un `/app-forall` separado. Mismo `/dashboard` con componentes condicionales:

```tsx
{tipo === "DUENO_OBRA" && <DashboardDueno />}
{tipo === "GESTOR_OBRA" && <DashboardGestor />}
{tipo === "CONSTRUCTORA" && <DashboardEmpresarial />}  // existing
```

Reusamos: auth, notificaciones, evidencias, reportar tareas, aprobar/rechazar, Topbar, sidebar (con items condicionales).

### Componentes nuevos clave

- `app/forall/page.tsx` — landing
- `app/forall/empezar/page.tsx` — signup wizard 3 pantallas
- `app/forall/calculadora/[tipo]/page.tsx` — calculadora por tipo
- `components/forall/HeroSection.tsx`
- `components/forall/UseCaseCards.tsx`
- `components/forall/Testimonios.tsx`
- `components/forall/Calculadora.tsx`
- `components/dashboard/DashboardDueno.tsx`
- `components/dashboard/DashboardGestor.tsx`
- `components/dashboard/CardPlata.tsx` — presupuesto vs gastado
- `components/dashboard/CompartirAvance.tsx`
- `components/dashboard/InventarioMateriales.tsx`
- `components/onboarding/PantallaObra.tsx`
- `components/onboarding/PantallaMaestro.tsx`
- `components/onboarding/PantallaPlata.tsx`
- `lib/wompi.ts` — wrapper Wompi API
- `lib/calculadora.ts` — estimadores por tipo

### Migración de schema

Migración `20260605000000_seiricon_for_all`:

```sql
-- 1. Tipo de constructora
CREATE TYPE "TipoConstructora" AS ENUM ('CONSTRUCTORA', 'DUENO_OBRA', 'GESTOR_OBRA');
ALTER TABLE "constructoras" ADD COLUMN "tipo" "TipoConstructora" NOT NULL DEFAULT 'CONSTRUCTORA';

-- 2. Presupuesto por proyecto
ALTER TABLE "proyectos" ADD COLUMN "presupuesto_total" INTEGER;
ALTER TABLE "proyectos" ADD COLUMN "tipo_obra" TEXT;  -- "CASA_NUEVA" | "REMODEL_COCINA" | etc.

-- 3. Material catalog (predefinido + custom por constructora)
CREATE TABLE "material_catalogo" (...);
CREATE TABLE "inventario_obra" (...);
CREATE TABLE "consumo_material_obra" (...);

-- 4. Suscripciones
CREATE TYPE "EstadoSuscripcion" AS ENUM ('TRIAL','ACTIVA','PAUSADA','CANCELADA');
CREATE TABLE "suscripciones" (...);

-- 5. Pagos a maestros
CREATE TABLE "pagos_maestro" (...);

-- 6. Obrero — campos extra
ALTER TABLE "usuarios" ADD COLUMN "documento_identidad" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "selfie_url" TEXT;
```

### Seed del catálogo de materiales

Script `prisma/seed-materiales.ts` que crea ~30 materiales predefinidos (`es_predefinido: true`, `constructora_id: null`) al deploy inicial.

## 13. Sprint roadmap

### Sprint 1 — Foundation (3 semanas)
**Objetivo:** Landing live + onboarding funcional + subscripción cobrando

- Migración schema (tipo, presupuesto, materiales, suscripción)
- Seed materiales predefinidos
- Landing /forall (hero, cards, testimonios placeholder, FAQ, pricing)
- Onboarding wizard 3 pantallas
- Integración Wompi (signup con tarjeta, primer mes gratis, webhook activación)
- DashboardDueno básico (sin inventario aún)
- Worker registration flow
- Redirect desde signup de Seiricon main

**Salida:** podemos cobrar a usuarios reales y entregar valor mínimo

### Sprint 2 — Operations (2 semanas)
**Objetivo:** Lo que hace diferente al producto

- Inventario de materiales: agregar compra, asociar consumo a tarea
- CardPlata: presupuesto vs gastado vs comprometido
- Resumen semanal email (cron Vercel)
- Botón compartir avance (genera imagen)
- Calculadoras por tipo de obra (`/forall/calculadora/cocina` etc.) — lead magnet
- Páginas SEO por tipo

**Salida:** producto diferenciado, lead gen activo

### Sprint 3 — Multi-proyecto / Gestor (2 semanas)
**Objetivo:** Arquitectos y flippers

- DashboardGestor con vista multi-proyecto
- Upgrade flow (Dueño → Gestor cuando agregan 2do proyecto)
- Inventario centralizado cross-proyecto
- Tabla obreros frecuentes
- Banner de migración dentro de Seiricon main para empresas con 1 proyecto pequeño

**Salida:** ampliación del target

### Sprint 4 — Monetización avanzada (2 semanas)
**Objetivo:** Empezar a construir el revenue real

- Tracking pagos a maestros (registro manual + comprobante)
- Integración Nequi para pago directo
- Quiz "¿cuál es para mí?" en landing seiricon.com
- Calculadoras evolucionadas con email gating

### Backlog / Fase futura
- Escrow real con plata depositada
- WhatsApp Business API (resumen + notificaciones)
- Marketplace obreros calificados (cross-producto)
- Comisiones por partnership Homecenter/Easy
- Dashboard de cross-producto analytics para super admin (números agregados de cuántos DUENO_OBRA hay activos, conversión, etc.)

## 14. Branding / voz

### Voz del producto
- **Tú** siempre (no usted, no formal)
- Frases cortas (máximo 12 palabras)
- Cero jerga técnica sin tooltip
- Tono de amigo que sabe del tema, no de software empresarial

### Ejemplos de copy
| ❌ Evitar | ✅ Usar |
|---|---|
| "Configure los parámetros de su obra" | "Cuéntanos qué vas a hacer" |
| "Asignar contratista a la tarea" | "¿Quién hace este trabajo?" |
| "Reportar avance" | "Ya quedó listo" (botón maestro) |
| "Aprobación pendiente" | "Esperando tu visto bueno" |

### Color y estilo
- Mantener azul Seiricon (`#2563EB`) como primario para consistencia con main
- Añadir cálidos: `#C2410C` (terracota CTA) y `#FEF3C7` (arena fondos)
- Bordes más redondeados (`rounded-2xl` por default en cards)
- Más whitespace que Seiricon main
- Iconos Lucide + ilustraciones humanas donde aplique

## 15. Métricas que vamos a trackear

Para validar y mejorar:

- **Activación**: signup → completar onboarding → primera tarea creada (3 pasos del funnel)
- **Engagement**: % usuarios que abren la app cada día en mes 1
- **Retención**: % activos en día 7, 14, 30 (D7, D14, D30)
- **Conversión paga**: % que sobrevive el trial y paga mes 2
- **NPS**: encuesta sencilla a los 30 días
- **Costo por adquisición** (CAC): inversión marketing / nuevos signups
- **Lifetime value** (LTV): meses promedio activos × precio

Reusamos `PwaEvento` que ya existe y agregamos `app_evento` genérico para activación.

## 16. Preguntas abiertas para resolver durante implementación

- ¿Necesitamos i18n desde MVP o solo español? **Decisión: solo español MVP, i18n fase 3.**
- ¿Soporte cliente — solo email, o chat?  **Decisión: solo email en MVP, chat en fase 2.**
- Términos y condiciones — necesitan revisión legal antes de lanzar
- GDPR / Habeas Data (Colombia) — política de privacidad obligatoria
- Capacidad inicial de servidor — Vercel + Supabase escalan, pero monitorear costo

## 17. Owners y responsabilidades

- **Producto y dirección**: Victor
- **Diseño y validación visual**: Karen + Victor
- **Implementación técnica**: Claude (asistido)
- **Legal/Habeas Data/T&C**: outsourced o ChatGPT + revisión humana
- **Soporte**: email a contacto@seiricon.com (forwardea a Victor + Karen)

---

## Decisión final

**Aprobado para arranque Sprint 1.** Inicio: 2026-06-05.
