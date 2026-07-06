# Spec — Landing de waitlist `seiricon.com/beta`

**Fecha:** 2026-07-01 · **Estado:** aprobado para ejecución.
**Objetivo:** página de marketing que vende el beta B2C y capta/califica candidatos vía un formulario **Tally embebido**. Los primeros 16 (8 propietarios + 8 contratistas) entran gratis; el resto queda en lista de espera.

## Arquitectura
- Página pública Next.js en **`/beta`** (nueva ruta; reusa marca/estilo del landing actual: `Navbar`, `Footer`, colores azul #2563EB / navy / naranja #F97316). Mobile-first (el tráfico viene de redes → celular). NO redirige usuarios logueados (es para prospectos).
- **Sin backend / sin base de datos:** los datos los maneja Tally. La página **embebe el formulario Tally** (iframe) en un bloque claramente marcado con un **placeholder de URL** (`TALLY_EMBED_URL`) que Victor reemplaza con su formulario real. Alternativa: botón CTA que abre el Tally (popup). Preferir embed inline al final + botones "Quiero mi cupo" que hacen scroll al formulario.
- Escasez: elemento visual "Solo 16 cupos · 8 por perfil" (estático o número editable por constante; NO contador dinámico —no hay backend—). Honesto: no inventar un contador falso decreciente.

## Contenido / secciones (copy base — el agente de marketing lo pule)
1. **Hero:** Titular del pilar central → *"Controla tu obra sin ir todos los días."* Subtítulo: *"Ve el avance con foto, ubicación y hora — y sabe en qué va tu plata — desde tu celular. Deja de cruzar la ciudad para revisar si de verdad avanzó."* Insignia: *"Beta gratis · solo 16 cupos."* Botón: **"Quiero mi cupo"**.
2. **¿Para quién es?** Dos tarjetas:
   - **Propietario** — *"Remodelas o construyes lo tuyo y quieres control del avance, del presupuesto y de los pagos, sin vivir en la obra."*
   - **Contratista** — *"Tienes un negocio de un oficio (pintura, carpintería, eléctricos, cocinas…) y mandas tu gente a obras de clientes; quieres verte pro y controlar a distancia."*
3. **Los 3 pilares de valor** (con íconos lucide):
   - **Control a distancia con evidencia confiable** — cada tarea se cierra con **foto + GPS + hora**. No es "me dijeron que ya está": la prueba muestra que estuvieron ahí y cuándo. Controlas sin ir todos los días.
   - **Control de tu plata** — presupuesto, anticipos con factura y la alarma de "plata entregada vs. sustentada". Sabes en qué se va cada peso.
   - **Todo desde el celular, sin fricción** — tu gente sube la evidencia **sin instalar nada** (por un link). Tú apruebas desde donde estés.
4. **Cómo funciona (3 pasos):** 1) Armas tu obra en minutos (con ayuda de IA). 2) Tu gente sube fotos del avance con ubicación. 3) Tú apruebas y ves todo desde donde estés.
5. **La oferta del beta:** **3 meses gratis** + **precio de fundador congelado de por vida**. **Solo 16 cupos (8 + 8).** A cambio: tu feedback honesto para pulir la app. Encuadre de escasez real y estatus de "Fundador Seiricon".
6. **Formulario (Tally embebido)** — bloque `#inscribirme` con el iframe/placeholder. Encabezado: *"Cuéntanos de tu obra y te reservamos tu cupo — toma 1 minuto."*
7. **FAQ corta:** ¿Cuánto cuesta? *Gratis en el beta.* · ¿Instalar algo? *No; funciona en el navegador y se puede instalar como app.* · ¿Mis datos están seguros? *Sí.* · ¿Cuándo empiezo? *Te contactamos por WhatsApp para activarte.*
8. **Cierre + Footer.**

## El formulario Tally (contenido que Victor monta en Tally; va embebido en /beta)
Portada: *"Cuéntanos de tu obra y te reservamos tu cupo — toma 1 minuto."* (encuadre "adaptamos la app a ti", nunca "¿calificas?").
Comunes: **Nombre** · **WhatsApp** · **Ciudad/Departamento** · **¿Cómo usarás Seiricon?** → Propietario / Contratista (ramifica).
NO pedir correo ni contraseña (los pone la persona al registrarse en la app, ya invitada).

**Rama Propietario:**
1. ¿En qué momento va tu obra? → Ya estoy en obra · Arranca esta semana · Arranca este mes · En 1-2 meses · Solo mirando ideas
2. ¿Qué vas a hacer? → Remodelar cocina/baño · Remodelación general · Construir/ampliar · Solo arreglos menores
3. ¿Ya tienes con quién trabajar? → Ya contraté · Estoy cotizando · Todavía no
4. **La obra queda cerca de tu casa o lejos?** Referencia = tu casa → elige el **tiempo**: Menos de 30 min · 30-40 min · ~1 hora · Más de una hora · En otra ciudad/municipio
5. ¿En qué zona/barrio queda? (texto)

**Rama Contratista:**
1. ¿Cuál es tu oficio? → Pintura · Carpintería · Electricidad · Plomería · Cocinas/closets · Acabados · Arquitecto · Otro
2. ¿Cuándo arranca tu próxima obra? → Estoy en obra ahora · En los próximos días · En 2-3 semanas · En más de un mes
3. ¿Cuántas obras/clientes tienes ahora mismo? → 0 · 1 · 2-3 · 4+
4. ¿Cuántos trabajadores envías? → Solo yo · 1-3 · 4+
5. **¿Dónde quedan tus obras?** Referencia = tu casa/oficina → **tiempo** (Menos de 30 min · 30-40 min · ~50 min-1 hora · Más de una hora) **+** opción **"En otra ciudad / en varios municipios"** (ej. Cali + Jamundí + Palmira + Pance). Permitir indicar varios municipios (texto).
6. ¿En qué zona(s)/municipio(s) trabajas? (texto)

**Puntaje para elegir 8+8:** timing (ya/pronto +3, este mes/2-3 sem +1, más de un mes/mirando = descarta) · actividad real (propietario ya contrató/cotizando +2; contratista 1+ obras +2, 4+ +3) · **distancia = valor** (otra ciudad/varios municipios +2; misma ciudad 30 min+ +1; cerca 0, no descarta) · equipo contratista (1-3/4+ +1/+2). Descartes: "solo arreglos menores", "solo mirando", timing de un mes o más. Ordenar por puntaje → top 8 por perfil → confirmar en llamada 1-a-1.

## Pipeline de ejecución (definido por Victor)
1. **Agente build (frontend + UX/UI):** construye `/beta`.
2. **Agente experto en marketing digital:** revisa la página y propone mejoras (copy, jerarquía, conversión, CTA, escasez, prueba social).
3. **Agente build:** implementa las mejoras del marketing.
4. **Cierre:** agente de **revisión/corrección de bugs** + agente de **seguridad**.
Verificación `tsc`/`eslint` limpia en cada paso. Al fijar en main, actualizar el manual si aplica.

## Criterios de aceptación
- `/beta` carga rápido, se ve pro y de marca, mobile-first; el Tally va embebido con placeholder claro para que Victor pegue su URL; los CTA llevan al formulario; copy centrado en el pilar "control a distancia + evidencia confiable" + "control de la plata". tsc/eslint limpios; sin fugas de seguridad (página pública, iframe de tally.so).
