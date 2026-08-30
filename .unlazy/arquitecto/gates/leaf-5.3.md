# Gates: leaf-5.3 — Planos versionados y renders

OWNS: src/components/productos-tecnicos/**, src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/**, scripts/verificar-planos.ts

Scope: Planos con versionado inequívoco y renders, atados a obra/piso/unidad. La versión vigente nunca puede confundirse con una anterior. Visible solo para ARQUITECTO y CONSTRUCTORA.

Entregado: 11 componentes en `src/components/productos-tecnicos/**` (BadgeVigente,
CupoBarra, EtiquetaUbicacion, EstadoVacio, VersionPlanoRow, PlanoCard, ListaPlanos,
RenderCard, ListaRenders, SelectorUbicacion, SubidaProductoDialog), 7 módulos de
lógica pura sin JSX en `src/components/productos-tecnicos/logica/**`
(vista-planos, vista-cupo, vista-formatos, formato-fecha, ubicaciones,
api-productos-tecnicos, mapear-producto), la pantalla
`src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/{page,client}.tsx`, y
`scripts/verificar-planos.ts` (43 verificaciones). Se editó además
`src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx` para añadir el link
"Planos y renders" condicionado por `puede(tipo, "productosTecnicos")`. NO se
tocó `src/lib/productos-tecnicos/**` ni `src/app/api/productos-tecnicos/**`
(dominio y rutas de leaf-5.1, se usan tal cual: `listarProductos`,
`cadenaDeVersiones`, `estadoCupo`, `formatearBytes`, `FORMATOS_POR_TIPO`,
POST /api/productos-tecnicos, PATCH .../vigente, GET .../descarga).

- [x] G1: Solo una versión por plano puede estar vigente a la vez
  CHECK: npx tsx scripts/verificar-planos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 43/43 verificaciones OK (exit 0). La invariante en sí (una sola vigente, garantizada por el dominio) ya la prueba scripts/verificar-productos-tecnicos.ts (102/102) y no se repite aquí. Lo que prueba verificar-planos.ts, sección 1, es la VISTA sobre esa invariante: ordenarParaVista pone la vigente primera SIEMPRE, incluido el caso borde de volver atrás (la v1 vigente con número más bajo se pinta...
- [x] G2: Cada versión guarda fecha y quién la subió
  CHECK: npx tsx scripts/verificar-planos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 43/43 verificaciones OK (exit 0). Sección 2: aProductoParaVista (el único punto donde ProductoApi se convierte en lo que pinta la pantalla) conserva fecha y subidoPorId sin pérdida, resuelve subidoPorNombre contra el mapa de usuarios, y cuando el nombre no se resuelve (usuario borrado) cae a "Alguien que ya no está en el equipo" en vez de dejar la fila en blanco. También se prueba que la ubicac...
- [x] G3: Subir una versión nueva no borra la anterior
  CHECK: npx tsx scripts/verificar-planos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 43/43 verificaciones OK (exit 0). La garantía de que nada borra una versión anterior es del dominio y ya la prueba scripts/verificar-productos-tecnicos.ts (grep sobre index.ts y sobre subida.ts/versionado.ts/consultas.ts/puertos-prisma.ts, sin ningún productoTecnico.delete). verificar-planos.ts, sección 5, añade la comprobación equivalente sobre la CAPA NUEVA: ningún archivo bajo src/components...
- [x] G4: Se rechaza cualquier tipo de archivo fuera de la lista permitida
  CHECK: npx tsx scripts/verificar-planos.ts
  EXPECT: verificaciones OK
  EVIDENCE: 43/43 verificaciones OK (exit 0). El rechazo real (magic number, por servidor) es del dominio y ya lo prueba scripts/verificar-productos-tecnicos.ts sección 4 (102/102). verificar-planos.ts sección 4 prueba que el FORMULARIO no ofrece de entrada algo que el servidor va a rechazar: extensionesAceptadas/acceptDeTipo/etiquetaFormatos salen de FORMATOS_POR_TIPO y FIRMAS del propio dominio (no de un...
- [x] G5: En el celular se distingue de un vistazo cuál es la versión vigente
  EVIDENCE: no verificado con captura en dispositivo — el contrato de este leaf prohíbe next dev/next build, así que no hay app corriendo para fotografiar. Lo que sí se hizo fue una revisión de diseño de las clases Tailwind renderizadas en VersionPlanoRow.tsx y BadgeVigente.tsx: la vigente se pinta con opacidad plena, fondo bg-green-50/60 + borde green-100, y un badge SÓLIDO (bg-green-600, texto blanco, ic...
## Verificación adicional (no exigida por las compuertas)

- `npx tsc --noEmit` → 0 errores en todo el proyecto (incluye
  `src/components/productos-tecnicos/**`, la pantalla `tecnicos/**` y
  `scripts/verificar-planos.ts`).
- `npx eslint src/components/productos-tecnicos "src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos" "src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx" scripts/verificar-planos.ts`
  → exit 0, 0 errores. 3 avisos, ninguno introducido por este leaf en sustancia:
  `RenderCard.tsx` recibe el aviso estándar `@next/next/no-img-element` (se usa
  `<img>` a propósito porque la fuente es una URL firmada temporal, no un asset
  de `/public` — mismo patrón sin excepción que ya usa `Sidebar.tsx` en el resto
  del repo); los otros dos avisos (`CheckCircle2`, `SemaforoLevel` sin usar) son
  preexistentes en `proyectos/[id]/page.tsx`, de antes de esta edición.
- `npx tsx scripts/verificar-planos.ts` → `43/43 verificaciones OK`, exit 0.
- `npx tsx scripts/verificar-productos-tecnicos.ts` (re-ejecutado, no tocado por
  este leaf) → `102/102 verificaciones OK`, exit 0 — confirma que reusar el
  dominio desde la capa de presentación no le cambió el comportamiento.
