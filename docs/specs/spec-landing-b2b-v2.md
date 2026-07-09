# Spec — Landing B2B v2 "Producto en vivo + ADN técnico" (seiricon.com)

**Fecha:** 2026-07-08 · **Estado:** aprobado (dirección E elegida por Victor sobre mockups A-E).
**Mockup de referencia aprobado:** Propuesta E (combinación D+C) — scratchpad `mockup-e-combinada.html` (artifact publicado). Los mockups A/B/C/D quedan como archivo de exploración.

## Dirección de arte (decidida)
- **Tema CLARO** (Victor rechazó páginas oscuras). Marca: azul #2563EB, navy #0F172A/#1E293B (solo bloques puntuales: ticker, CTA final), naranja #F97316, verde #16A34A (aprobado/sustentado), rojo solo alertas.
- **Base = "Producto en vivo" (D):** el producto actuando dentro de la página, no descrito. Hero con demo animada EN CÓDIGO (obrero reporta → GPS verificado → cursor aprueba → toast → plata pasa a verde), secciones ancladas en capturas/videos REALES, mapa con feed de actividad, grid denso de capacidades, precios (4 planes actuales), testimonio (placeholder hasta tener beta tester real), FAQ, cierre navy.
- **Firma = "ADN técnico" (C):** semáforo 🟢🟡🔴 como marca en navbar; línea mono de membrete (SEIRICON — CONTROL DE OBRA · COLOMBIA 2026); **ticker navy estilo terminal** con eventos; franja de **cifras duras** con divisiones; capturas con tratamiento **"CAPTURA SIN RETOQUE"** (barra mono identificadora + marcos de esquina + cotas flotantes); etiquetas FIG. 01/02/03.
- Tono copy: formal-cálido colombiano, cero jerga técnica. Cifras honestas (no inventar métricas de clientes).

## Sistema de medios (decidido con Victor)
1. **Hero: animación en código** (GSAP/CSS) — nunca video. Portar la demo del mockup E.
2. **Flujos reales: videos MUDOS de pantalla** (5-10 s loop, H.264/WebM ~1-3 MB, `muted autoplay loop playsinline`, `poster` estático, lazy-load bajo el fold): (a) crear proyecto con torres/edificios, (b) gráficas de gastos/reportes, (c) aprobar evidencia, (d) mapa de obras. **Producción: grabaciones Playwright contra seiricon.com en producción con cuenta demo** (NO dev local). Capturas frescas de alta resolución del mismo recorrido reemplazan los JPG comprimidos del mockup.
3. **Fotos: reales de internet** (Unsplash/Pexels u otros bancos LIBRES; verificar licencia). Curar contra el sesgo "gringo": obra gris/estructuras, materiales, herramientas, manos, trabajadores de espaldas/lejos, skylines colombianos. Presentar candidatas a Victor antes de integrar.
4. **IA solo último recurso y SIN ROSTROS** (regla de Victor): objetos, lugares, personas lejanas o de espaldas. Prompt para su ChatGPT; nunca caras ni personas en detalle.
5. **Futuro cercano:** fotos reales de obras de los 16 beta testers (el contrato del beta incluye caso de éxito).

## Presupuesto de rendimiento (móvil primero)
- LCP < 2.5 s en 4G; carga inicial (above the fold) < 1 MB; página total < 4-5 MB con todos los videos lazy.
- `prefers-reduced-motion`: demo del hero en estado final estático, videos sin autoplay (solo poster), reveals visibles.
- Videos: nunca antes del fold sin interacción; `IntersectionObserver` para play/pause fuera de vista.

## Implementación
- **Ruta oculta `/nueva`** en el repo (grupo `(public)`), sin enlaces entrantes, `noindex`. Victor aprueba ahí → se promueve a `/` (la landing actual se conserva en el historial de git).
- Componentes nuevos en `src/components/landing-v2/` (uno por archivo). Reusar GSAP (ya en el proyecto). No romper `Navbar/Footer` actuales del resto del sitio: la v2 trae los suyos.
- Secciones (orden del mockup E): Nav (semáforo) → Hero + demo viva → chips de casos de uso → 3 pasos → Ticker → Cifras → FIG.01 Dashboard (captura sin retoque + cotas) → FIG.02 Obrero (par de capturas) → **Video: crear obra con edificios** → FIG.03 Equipo → **Mapa vivo + feed** → **Video: gastos y reportes** → Grid denso → Precios (Obra $650k / Pro $1.8M rec. / Empresa $3.5M / Corporativo a convenir · 14 días gratis) → Testimonio (placeholder marcado) → FAQ → Cierre navy → Footer.
- Assets en `public/landing/` (videos, posters, fotos con crédito/licencia documentada en un `CREDITS.md`).

## Pipeline
1. **Assets primero:** cuenta demo en producción con datos realistas → grabaciones + capturas Playwright → compresión (ffmpeg) → curaduría de fotos (agente) → aprobación de fotos por Victor.
2. **Build:** agente frontend/UX porta el mockup E a Next/GSAP con los assets.
3. **Revisión de diseño:** agente con ojos frescos revisa contra el mockup aprobado + screenshots reales de `/nueva` (Playwright).
4. **Gate:** agente de bugs (corrige) + agente de seguridad (página pública: sin fugas, assets sin metadatos sensibles, performance) → tsc/eslint limpios.
5. Victor aprueba `/nueva` → swap a `/` → manual/log al día.

## Datos demo (para cámara)
Obra "Torres del Río" (o similar): 2 torres × 8 pisos, ~90 unidades, tareas en todos los estados (aprobadas con evidencia+GPS, reportadas, en riesgo), gastos con facturas, 2 anticipos (1 sin sustentar para la alarma), 2-3 obras más con ubicación en el mapa (Cali/Bogotá) para el mapa multi-obra. Nada de nombres reales de clientes.

---

# v2.1 — Iteración post-revisión de Victor (2026-07-09, aprobada)

## 1. Hero / demo viva
- **Titular rotatorio** (patrón del landing actual): "Tu **{obra | equipo | proyecto | calidad | progreso | contratista}** bajo control" — "Tu" y "bajo control" FIJOS, el sustantivo rota (fade/slide). Corregir de paso el bug: la 1ª línea del h1 queda oculta tras el navbar.
- **Demo con 3-4 secuencias rotando** (no un solo loop): ① aprobar evidencia (actual) → ② se registra un gasto y la plata/las barras se actualizan → ③ llega un reporte y un pin/tarea cambia → ④ se crea una obra y aparece la estructura. Transición limpia entre secuencias.
- **Doble barra reportado vs. aprobado** en el panel "La obra, ahora" (como la app: barra doble azul=reportado / verde=aprobado) en lugar de barra simple.
- **Cero emojis Unicode/WhatsApp** (📍 fuera): íconos propios (lucide), y sin duplicados por fila.
- **El thumbnail gris se llena** con miniatura real (foto de evidencia del demo, ya en `public/landing/`).

## 2. Copy (agente Copywriter/UX writer)
- Alternar "obra" y "proyecto" en toda la página (hoy "obra" sobreusada).
- **Sección Excel**: PROHIBIDO "importa el Excel que ya tienes" (falso: el flujo es descargar plantilla → llenarla → subirla) y PROHIBIDO "llena nuestra plantilla" (Victor: suena muy mal). El copywriter debe encontrar una promesa honesta y atractiva sin explicar el mecanismo completo (ej. conceptos tipo "tu presupuesto se convierte en obra", a refinar por el agente).
- Tono: formal-cálido colombiano, cero jerga, cero promesas falsas (nada de offline, nada de scoring).

## 3. Sección FIG.03 (contratistas/historial) → REEMPLAZADA por "Roles y permisos"
- La info de historial/calificación de contratistas y obreros es PRIVADA (Decisiones Seiricon 2026-07-09). Nueva sección: "Tu equipo, cada quien con lo suyo" — roles (gerente ve todo, admin junior sus proyectos con permisos configurables, contratista reporta, obrero por enlace) con captura real.
- Candidatos archivados para el futuro: "cada retraso con nombre y causa", "el historial que te respalda", "tu información blindada".

## 4. Mapa multi-obra → mapa animado (sin foto de ambiente)
Secuencia en código estilo el mapa real de la app (referencia: screenshot super admin con Mapbox): pines con semáforo → la cámara viaja de una obra a otra → clic en un pin → panel de detalle (% avance, reportadas vs. aprobadas). Loop.

## 5. Video de gastos (v2) → REGRABAR
Nueva secuencia: registrar un gasto EN CÁMARA (abrir "Registrar un gasto", monto, descripción, guardar) → luego la lista de gastos (la toma actual). Playwright + cuenta demo, cursor falso, clics reales, comando encadenado.

## 6. Grid denso → micro-demos animadas por tarjeta (en código, loop, reduced-motion friendly)
1. Semáforo: color → texto de significado (a tiempo / iniciando / retrasado / crítico) → siguiente → todos juntos + cierre → reinicio.
2. Mapa multi-obra: mini-mapa país → zoom a Cali con varias obras → clic en una → detalle.
3. Importar Excel: botón Importar → clic → selector de archivos estilo macOS eligiendo la plantilla.
4. Notificaciones: dos notificaciones de obra (como en la app) apareciendo.
5. Evidencia GPS: clic en coordenadas → mini-mapa del punto de la foto.
6. Plata sustentada: número contando hacia arriba.

## 7. Proceso
- Agente **Copywriter/UX-writer** para todo el texto. Skill **last30days** para tendencias (donde falte referencia). Agente **experto UX** de revisión. Skills de apoyo si hacen falta.
- **Fotos de personas: permitidas si son REALES** (bancos libres, cero IA) — presentar candidatas a Victor antes de integrar.
- Pipeline: tendencias → regrabar v2-gastos → copywriter → build → revisión UX → mostrar `/nueva` (la home NO se toca hasta aprobación).
