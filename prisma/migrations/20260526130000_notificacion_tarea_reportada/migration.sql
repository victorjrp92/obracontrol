-- Add TAREA_REPORTADA value to TipoNotificacion enum.
-- Sirve para notificar a admins cuando un contratista u obrero reporta
-- una tarea como terminada (in-app, además del email).
ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_REPORTADA';
