/**
 * Cómo se lee el estado de una obra en la pantalla de campo.
 *
 * `ACTIVO` NO está en el mapa a propósito: es el caso normal y una etiqueta
 * que sale siempre no informa de nada. Los otros tres sí cambian lo que el
 * residente tiene que hacer al llegar mañana, así que se pintan.
 *
 * Vive aparte porque lo usan la lista de obras y el detalle: dos copias del
 * mismo mapa es la forma de que un día digan cosas distintas.
 */
export const ESTADO_OBRA_LABEL: Record<string, string> = {
  PREPROYECTO: "En cotización",
  PAUSADO: "Pausada",
  COMPLETADO: "Completada",
};
