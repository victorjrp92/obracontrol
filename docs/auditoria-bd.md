# Auditoría de la base de datos (2026-04-30)

## 1. Estado de las relaciones

Todas las FK con `onDelete` explícito:

| Padre → Hijo | Comportamiento |
|---|---|
| `Constructora →` Proyecto, Usuario, Rol, Obrero | Cascade |
| `Proyecto →` Edificio, AdminProyectoAccess | Cascade |
| `Edificio → Piso → Unidad → Espacio → Tarea` | Cascade en cada nivel |
| `Tarea →` Evidencia, Aprobacion, Retraso, ExtensionTiempo, ChecklistRespuesta, ConsumoMaterial | Cascade |
| `Proyecto → contratista_default (Usuario)` | **SetNull** |

## 2. Índices aplicados (alta prioridad)

```sql
CREATE INDEX tareas_asignado_a_idx ON tareas(asignado_a);
CREATE INDEX tareas_estado_idx ON tareas(estado);
CREATE INDEX tareas_asignado_estado_idx ON tareas(asignado_a, estado);
CREATE INDEX evidencias_tarea_id_idx ON evidencias(tarea_id);
CREATE INDEX aprobaciones_tarea_id_idx ON aprobaciones(tarea_id);
```

Plus únicos pre-existentes: `usuarios.email`, `obreros.token`, `obreros(constructora_id, cedula)`, `roles(constructora_id, nombre)`, `proyectos(constructora_id, numero_registro)`.

## 3. Pendientes para el siguiente sprint

```sql
-- Filtrado de tareas en riesgo (dashboard)
CREATE INDEX tareas_fecha_inicio_idx ON tareas(fecha_inicio) WHERE fecha_inicio IS NOT NULL;
-- Notificaciones no leídas
CREATE INDEX notificaciones_usuario_leida_idx ON notificaciones(usuario_id, leida) WHERE leida = false;
-- Audit log por proyecto
CREATE INDEX audit_logs_proyecto_idx ON audit_logs(proyecto_id, created_at DESC);
```

## 4. Normalización (3NF)

- ✅ Sin redundancia (Tarea no tiene proyecto_id directo — se llega vía joins)
- ✅ Multi-tenant scoping consistente (todas las raíces tienen constructora_id)
- ⏳ A futuro: cuando todos los obreros legacy tengan datos completos, hacer NOT NULL `obreros.cedula/eps/arl/especialidad`

## 5. Performance: queries N+1 a vigilar

- `getDashboardStats` → 7 queries paralelas (OK)
- `getProyectosConProgreso` → include 5-niveles (raro, sólo en home)
- `recalcularScoreContratista` → carga TODAS las tareas del contratista (refactor a query analítica si pasa de 1000/contratista)

## 6. Checklist pre-producción

- [x] FK con onDelete explícito
- [x] Índices unique en lookups críticos
- [x] Constraint multi-tenant en todas las entidades
- [x] Índices de alta prioridad aplicados
- [ ] Backups validados (Supabase Pro: daily; validar restore mensual)
- [ ] Connection pooling correcto (pgbouncer transaction mode)
- [ ] Row-Level-Security (defensa en profundidad, próxima iteración)
