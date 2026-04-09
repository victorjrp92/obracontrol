export type RolUsuario =
  | "ADMIN"
  | "JEFE_OPERACIONES"
  | "COORDINADOR"
  | "ASISTENTE"
  | "AUXILIAR"
  | "CONTRATISTA_INSTALADOR"
  | "CONTRATISTA_LUSTRADOR";

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

const ROL_LABELS: Record<RolUsuario, string> = {
  ADMIN: "Administrador",
  JEFE_OPERACIONES: "Jefe de operaciones",
  COORDINADOR: "Coordinador",
  ASISTENTE: "Asistente",
  AUXILIAR: "Auxiliar de obra",
  CONTRATISTA_INSTALADOR: "Contratista instalador",
  CONTRATISTA_LUSTRADOR: "Contratista lustrador",
};

export function getRolLabel(rol: string): string {
  return ROL_LABELS[rol as RolUsuario] ?? rol;
}

export function getPermissions(rol: string): Permissions {
  switch (rol) {
    case "ADMIN":
    case "JEFE_OPERACIONES":
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
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "reportes", "usuarios", "configuracion"],
      };
    case "COORDINADOR":
    case "ASISTENTE":
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
        sidebarItems: ["dashboard", "proyectos", "tareas", "contratistas", "reportes"],
      };
    case "AUXILIAR":
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canInviteUsers: false,
        canViewAllProjects: true,
        canViewAllTasks: true,
        canViewReports: false,
        canViewConfig: false,
        canViewContractors: false,
        canViewUsers: false,
        sidebarItems: ["dashboard", "proyectos", "tareas"],
      };
    case "CONTRATISTA_INSTALADOR":
    case "CONTRATISTA_LUSTRADOR":
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
