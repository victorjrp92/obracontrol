-- Índices de performance identificados en docs/auditoria-bd.md
-- Todos son `IF NOT EXISTS` para idempotencia.

-- Tareas filtradas por contratista (query muy frecuente)
CREATE INDEX IF NOT EXISTS "tareas_asignado_a_idx" ON "tareas"("asignado_a");

-- Filtros por estado en dashboards
CREATE INDEX IF NOT EXISTS "tareas_estado_idx" ON "tareas"("estado");

-- Composite para "mis tareas pendientes" del contratista
CREATE INDEX IF NOT EXISTS "tareas_asignado_estado_idx" ON "tareas"("asignado_a", "estado");

-- Evidencias por tarea (render de detalle)
CREATE INDEX IF NOT EXISTS "evidencias_tarea_id_idx" ON "evidencias"("tarea_id");

-- Aprobaciones por tarea (historial)
CREATE INDEX IF NOT EXISTS "aprobaciones_tarea_id_idx" ON "aprobaciones"("tarea_id");
