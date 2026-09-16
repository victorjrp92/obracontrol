import type { NivelAcceso } from "@/generated/prisma";

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canInviteUsers: boolean;
  canViewAllProjects: boolean;
  canViewAllTasks: boolean;
  canViewReports: boolean;
  canViewConfig: boolean;
  canViewContractors: boolean;
  canViewUsers: boolean;
  sidebarItems: string[];
}

export function getRolLabel(rolNombre: string): string {
  return rolNombre;
}

export function getPermissions(nivelAcceso: NivelAcceso | string): Permissions {
  switch (nivelAcceso) {
    case "SUPER_ADMIN":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canInviteUsers: true,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: true,
        canViewConfig: true,
        canViewContractors: true,
        canViewUsers: true,
        sidebarItems: [
          "sa-dashboard",
          "sa-constructoras",
          "sa-admins",
          "sa-proyectos",
          "sa-reportes",
          "sa-configuracion",
        ],
      };
    case "ADMIN_GENERAL":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canInviteUsers: true,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: true,
        canViewConfig: true,
        canViewContractors: false,    // ← Solo Super Admin ve la lista global con scoring
        canViewUsers: true,
        // Sin "empresa": la ficha de la constructora (NIT, direccion, datos
        // fiscales) es configuracion de cuenta, no una seccion de trabajo
        // diaria, y ahora vive dentro de /dashboard/perfil. Quitar la clave de
        // aqui NO cambia quien ve esos datos: eso lo sigue decidiendo
        // `canManageUsers` en la pagina y en api/constructora.
        sidebarItems: ["dashboard", "proyectos", "tareas", "sugerencias", "reportes", "usuarios", "configuracion"],
      };
    case "ADMIN_PROYECTO":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canInviteUsers: true,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: true,
        canViewConfig: false,
        canViewContractors: false,    // ← Sólo Super Admin
        canViewUsers: true,
        sidebarItems: ["dashboard", "proyectos", "tareas", "sugerencias", "reportes", "usuarios"],
      };
    case "DIRECTIVO":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canInviteUsers: false,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: true,
        canViewConfig: false,
        canViewContractors: false,    // ← Sólo Super Admin
        canViewUsers: false,
        // "empresa" salio del menu: la ficha se pinta dentro del perfil.
        sidebarItems: ["dashboard", "proyectos", "tareas", "sugerencias", "reportes"],
      };
    // Personal de campo (auxiliares y residentes): REPORTA, no administra. Sin
    // este case caía en `default`, que lo dejaba con un menú de un solo ítem
    // apuntando a /dashboard — una zona a la que no debe entrar.
    //
    // Los once permisos van en false a propósito, `canApprove` el primero, y
    // eso NO le quita el reporte: reportar no se autoriza por estos flags. Lo
    // autoriza `puedeReportarEnProyecto` (src/lib/access.ts) dentro de
    // POST /api/tareas/[id]/reportar, comprobando que la tarea sea de una obra
    // que un administrador le asignó. Subir cualquiera de estos a true no le
    // daría nada de reporte: solo abriría UI de administración que no le toca.
    case "PERSONAL_CAMPO":
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        // Su zona es /campo, no /dashboard: la clave "campo" debe existir en
        // `allNavItems` de Sidebar.tsx o el menú sale vacío en silencio.
        sidebarItems: ["campo"],
      };
    case "CONTRATISTA":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard"],
      };
    case "OBRERO":
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard"],
      };
    default:
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: false,
        canViewAllTasks: false,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard"],
      };
  }
}
