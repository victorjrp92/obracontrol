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
        canViewContractors: true,
        canViewUsers: true,
        sidebarItems: ["dashboard", "empresa", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios", "configuracion"],
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
        canViewContractors: true,
        canViewUsers: true,
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "sugerencias", "reportes", "usuarios"],
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
        canViewContractors: true,
        canViewUsers: false,
        sidebarItems: ["dashboard", "empresa", "proyectos", "tareas", "contratistas", "sugerencias", "reportes"],
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
        sidebarItems: ["dashboard", "tareas"],
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
