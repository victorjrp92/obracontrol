-- Granular permissions for ADMIN_PROYECTO (admin junior).
-- Default values preserve existing behaviour: previously, simply having an
-- AdminProyectoAccess row gave full operative control. We default the four
-- new flags to FALSE for write-style perms and TRUE only for can_approve_tasks
-- (legacy behaviour) — Admin General can edit these per-admin from the UI.

ALTER TABLE "admin_proyecto_access"
  ADD COLUMN "can_edit_project"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_assign_contractors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_manage_team"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_approve_tasks"      BOOLEAN NOT NULL DEFAULT true;
