import type { TipoCuenta } from "@/generated/prisma";

/**
 * Definiciones de la guía interactiva (tour). Son datos puros y serializables
 * para poder calcularlos en el servidor (layout) y pasarlos al cliente.
 */

export interface TourStep {
  /** Clave `data-tour` del elemento a resaltar. Si falta → tarjeta centrada. */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export interface TourDef {
  id: string;
  steps: TourStep[];
}

const PASO_INTRO = (nombre: string): TourStep => ({
  title: `¡Hola${nombre ? `, ${nombre}` : ""}! 👋`,
  body: "Te muestro en 30 segundos para qué sirve cada parte. Puedes saltarla cuando quieras y volver a verla con el botón “¿Cómo funciona?”.",
  placement: "center",
});

const PASO_FIN: TourStep = {
  title: "¡Eso es todo! 🎉",
  body: "Ya conoces el mapa. Si te pierdes, abre esta guía otra vez con el botón “¿Cómo funciona?” abajo a la derecha.",
  placement: "center",
};

/** Tour del mapa del sistema para cuentas personales (arquitecto / propietario). */
function tourPersonal(nombre: string): TourDef {
  return {
    id: "dashboard-personal-v1",
    steps: [
      PASO_INTRO(nombre),
      {
        target: "nav-nueva-obra",
        title: "1. Empieza tu obra",
        body: "Aquí creas una obra nueva con un asistente que te pregunta qué vas a hacer, en qué espacios y qué tareas. Es tu punto de partida.",
        placement: "right",
      },
      {
        target: "nav-proyectos",
        title: "2. Tus obras",
        body: "Aquí viven todas tus obras. Entra a una para ver su avance, los espacios y el estado de cada tarea con su semáforo.",
        placement: "right",
      },
      {
        target: "nav-equipo",
        title: "3. Tu equipo",
        body: "Agrega a tus obreros con sus datos y cópiales su enlace personal. Con ese enlace ellos ven las tareas y te reportan desde el celular con fotos.",
        placement: "right",
      },
      {
        target: "nav-tareas",
        title: "4. Revisa y aprueba",
        body: "Cuando tu equipo reporta una tarea, aparece aquí. Tú revisas las fotos y la apruebas o la devuelves. Así controlas la calidad.",
        placement: "right",
      },
      {
        target: "nav-reportes",
        title: "5. Reportes",
        body: "Descarga informes y PDF del avance de tu obra para compartir o archivar.",
        placement: "right",
      },
      PASO_FIN,
    ],
  };
}

/** Tour del mapa del sistema para empresas (constructora). */
function tourEmpresa(nombre: string): TourDef {
  return {
    id: "dashboard-empresa-v1",
    steps: [
      PASO_INTRO(nombre),
      {
        target: "nav-proyectos",
        title: "Proyectos",
        body: "El corazón del sistema. Crea y administra tus proyectos: torres, unidades, fases, tareas y asignación de contratistas.",
        placement: "right",
      },
      {
        target: "nav-tareas",
        title: "Tareas",
        body: "Todo lo que reportan contratistas y obreros llega aquí para que tu equipo lo revise y apruebe.",
        placement: "right",
      },
      {
        target: "nav-sugerencias",
        title: "Sugerencias",
        body: "Los contratistas proponen tareas adicionales. Aquí las apruebas o rechazas antes de que entren al proyecto.",
        placement: "right",
      },
      {
        target: "nav-usuarios",
        title: "Usuarios",
        body: "Invita a tu equipo (administradores, directivos, contratistas) y define qué puede hacer cada uno.",
        placement: "right",
      },
      {
        target: "nav-reportes",
        title: "Reportes",
        body: "Métricas, avance y exportables de todos tus proyectos.",
        placement: "right",
      },
      PASO_FIN,
    ],
  };
}

/** Devuelve el tour del dashboard adecuado al tipo de cuenta. */
export function getDashboardTour(tipoCuenta: TipoCuenta, nombre: string): TourDef {
  if (tipoCuenta === "ARQUITECTO" || tipoCuenta === "PROPIETARIO") return tourPersonal(nombre);
  return tourEmpresa(nombre);
}
