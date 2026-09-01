import type { TipoCuenta } from "@/generated/prisma";
import { esCuentaPersonal } from "@/lib/plan";

/**
 * Definiciones de la guía interactiva (tour). Son datos puros y serializables
 * para poder calcularlos en el servidor (layout) y pasarlos al cliente.
 *
 * REGLA AL AÑADIR PASOS: `target` tiene que existir EN LA BARRA DE ESE PERFIL.
 * El Sidebar pinta `data-tour={`nav-${item.key}`}` solo para los ítems que ese
 * perfil ve, y `modulosVisibles()` recorta la lista de las cuentas personales.
 * Un paso que apunta a un ítem oculto no falla: cae en tarjeta centrada y
 * resalta nada, que es peor —parece que la guía está rota—. Los perfiles
 * personales SOLO tienen: dashboard, proyectos, tareas, equipo, reportes,
 * configuracion. No tienen `sugerencias` ni `usuarios`.
 *
 * Lo que vive DENTRO de una obra (productos técnicos, actas, equipo) no tiene
 * ítem de menú al que anclarse. Esos pasos van centrados y dicen con palabras
 * dónde encontrarlo.
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

const PASO_INTRO = (nombre: string, duracion = "30 segundos"): TourStep => ({
  title: `¡Hola${nombre ? `, ${nombre}` : ""}! 👋`,
  body: `En ${duracion} te mostramos para qué sirve cada parte. Puedes saltarla cuando quieras y volver a verla con el botón “¿Cómo funciona?” de abajo a la derecha.`,
  placement: "center",
});

const PASO_FIN: TourStep = {
  title: "¡Listo! 🎉",
  body: "Ya tienes el mapa. Si alguna vez te pierdes, el botón “¿Cómo funciona?” de abajo a la derecha te la vuelve a abrir.",
  placement: "center",
};

/**
 * Tour del ARQUITECTO.
 *
 * Tiene el suyo porque su producto es otro. Un propietario controla su obra; un
 * arquitecto además EMITE DOCUMENTOS que respaldan su trabajo, y eso es por lo
 * que paga. El tour de cuentas personales no menciona ni el registro inicial ni
 * el acta firmada, así que a un arquitecto le contaba la mitad de lo que compró.
 */
function tourArquitecto(nombre: string): TourDef {
  return {
    id: "dashboard-arquitecto-v1",
    steps: [
      PASO_INTRO(nombre, "un minuto"),
      {
        target: "nav-nueva-obra",
        title: "1. Empieza por la obra",
        body: "Creas la obra con un asistente que te pregunta qué vas a hacer y en qué espacios. Rellena los datos del inmueble —sobre todo la matrícula inmobiliaria—: sin ella no se puede emitir el acta después.",
        placement: "right",
      },
      {
        target: "nav-proyectos",
        title: "2. Tus obras",
        body: "Aquí están todas. Entra en cualquiera y verás su avance, sus espacios y la pestaña Técnicos, que es donde vive todo lo tuyo.",
        placement: "right",
      },
      {
        title: "3. El registro fotográfico inicial 📸",
        body: "Dentro de la obra → Técnicos → Registro inicial. Antes de tocar nada, fotografías el estado en que recibes el inmueble. Cada foto lleva fecha, hora y ubicación grabadas encima. Solo se toman con la cámara aquí mismo: no hay botón de galería, porque una foto guardada no prueba cuándo se tomó, y esa fecha es todo el valor del registro.",
        placement: "center",
      },
      {
        title: "4. Tu firma y tu matrícula ✍️",
        body: "En esa misma pantalla subes una vez la imagen de tu firma y tu matrícula profesional. Quedan guardadas para todo lo que emitas. Al firmar, la matrícula se congela en el documento: si luego la actualizas, lo ya emitido no cambia.",
        placement: "center",
      },
      {
        title: "5. El acta que te respalda 📄",
        body: "Con las fotos y tu firma, emites el acta de estado inicial. Queda sellada con un folio y una huella digital, y ya nadie puede modificarla —ni tú—. Si algo salió mal, emites una corrección: se crea una versión nueva y la anterior sigue siendo válida. Eso es lo que la hace defendible.",
        placement: "center",
      },
      {
        title: "6. Tu cliente firma el recibido 🤝",
        body: "Le compartes un enlace y él deja constancia de que lo recibió, sin crear cuenta ni descargar nada. Queda registrado con fecha. Es tu respaldo de que entregaste.",
        placement: "center",
      },
      {
        title: "7. Planos y renders 📐",
        body: "También en Técnicos. Subes planos y renders, y cada vez que reemplazas uno se guarda como versión nueva sin borrar la anterior. Tienes 1 GB por obra.",
        placement: "center",
      },
      {
        target: "nav-equipo",
        title: "8. Tu personal de campo",
        body: "Registra a quien trabaja contigo y comparte con cada uno su enlace personal. Con ese enlace ven sus tareas y te reportan desde el celular con fotos, sin necesitar cuenta.",
        placement: "right",
      },
      {
        target: "nav-tareas",
        title: "9. Revisa y aprueba",
        body: "Lo que te reportan llega aquí. Miras las fotos y apruebas o devuelves con un comentario. Así controlas la calidad sin estar en la obra todo el día.",
        placement: "right",
      },
      PASO_FIN,
    ],
  };
}

/** Tour para propietario y contratista B2C. */
function tourPersonal(nombre: string): TourDef {
  return {
    id: "dashboard-personal-v1",
    steps: [
      PASO_INTRO(nombre),
      {
        target: "nav-nueva-obra",
        title: "1. Inicia tu obra",
        body: "Aquí creas una obra nueva con un asistente que te pregunta qué vas a hacer, en qué espacios y con qué tareas. Es tu punto de partida.",
        placement: "right",
      },
      {
        target: "nav-proyectos",
        title: "2. Tus obras",
        body: "Aquí están todas tus obras. Entra a cualquiera para ver su avance, los espacios y el estado de cada tarea con su semáforo.",
        placement: "right",
      },
      {
        target: "nav-equipo",
        title: "3. Tu personal de campo",
        body: "Registra a quien trabaja contigo y comparte con cada uno su enlace personal. Con ese enlace ven sus tareas y te reportan desde el celular con fotos, sin necesitar cuenta.",
        placement: "right",
      },
      {
        target: "nav-tareas",
        title: "4. Revisa y aprueba",
        body: "Cuando te reportan una tarea, aparece aquí. Miras las fotos y la apruebas o la devuelves con un comentario. Así controlas la calidad.",
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
        body: "Todo lo que reportan contratistas y personal de campo llega aquí para que tu equipo lo revise y apruebe.",
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
  if (tipoCuenta === "ARQUITECTO") return tourArquitecto(nombre);
  if (esCuentaPersonal(tipoCuenta)) return tourPersonal(nombre);
  return tourEmpresa(nombre);
}
