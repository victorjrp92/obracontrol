// ─────────────────────────────────────────────────────────────────────────
// AVANCE POR FASE de un proyecto, y su reparto por edificio.
//
// La pantalla del proyecto enseñaba las fases como una lista de nombres
// separados por comas. Con diez fases y cuatro mil tareas repartidas entre
// ellas, lo único que se sabía era que existían: ni cuál está en curso, ni
// cuál está trabada, ni dónde hay trabajo esperando que alguien lo apruebe.
//
// ══ POR QUÉ EL REPARTO POR EDIFICIO NO ES UN ADORNO ════════════════════════
//
// El porcentaje de una fase es un promedio sobre torres que van en frentes
// distintos, y ese promedio no describe a ninguna. En una obra real de tres
// torres, «Enchapes y pisos» al 49% resultó ser torre 1 al 100%, torre 2 al
// 46% y torre 3 sin empezar. El promedio sirve para ORDENAR la lista; la
// verdad está en el reparto. Por eso se calculan los dos.
//
// Puro y sin Prisma: recibe el árbol ya cargado por la página. La pantalla ya
// trae todas las tareas con su fase y su estado, así que esto no cuesta un
// viaje más a la base.
// ─────────────────────────────────────────────────────────────────────────

/** Lo mínimo que se necesita de una tarea. Deliberadamente laxo: la página
 *  pasa el objeto de Prisma entero y aquí solo importan dos campos. */
export interface TareaConFase {
  estado: string;
  fase?: { id: string; nombre: string; orden: number } | null;
  fase_id?: string;
}

/** El árbol tal como lo devuelve `getProyectoDetalle`. */
export interface EdificioConTareas {
  nombre: string;
  pisos: { unidades: { espacios: { tareas: TareaConFase[] }[] }[] }[];
}

export interface RepartoEdificio {
  nombre: string;
  total: number;
  aprobadas: number;
  reportadas: number;
}

export interface AvanceFase {
  id: string;
  nombre: string;
  orden: number;
  total: number;
  aprobadas: number;
  /** REPORTADA: trabajo hecho y esperando revisión. NO incluye las aprobadas. */
  reportadas: number;
  /** NO_APROBADA: devuelta con motivo. */
  devueltas: number;
  pendientes: number;
  porcentajeAprobado: number;
  /** ¿Todas sus tareas están aprobadas? */
  completa: boolean;
  reparto: RepartoEdificio[];
}

export interface ResumenFases {
  fases: AvanceFase[];
  /**
   * Índice de la fase donde HAY MÁS TRABAJO SIN APROBAR, o -1 si no hay
   * ninguna esperando revisión.
   *
   * No es «la primera sin terminar»: ese criterio señalaba una fase al 91%,
   * porque con varias torres en frentes distintos siempre queda una fase vieja
   * a la que le falta el pedazo de la torre atrasada. Lo que ubica al que lee
   * es dónde se está acumulando trabajo hecho y sin revisar — ahí hay
   * cuadrilla, y ahí alguien tiene que ir hoy.
   */
  frente: number;
  totalReportadas: number;
  totalDevueltas: number;
}

const pct = (x: number, t: number) => (t > 0 ? Math.round((x / t) * 100) : 0);

export function avancePorFase(
  fases: { id: string; nombre: string; orden: number }[],
  edificios: EdificioConTareas[],
): ResumenFases {
  const porId = new Map<string, AvanceFase>();
  for (const f of fases) {
    porId.set(f.id, {
      id: f.id, nombre: f.nombre, orden: f.orden,
      total: 0, aprobadas: 0, reportadas: 0, devueltas: 0, pendientes: 0,
      porcentajeAprobado: 0, completa: false, reparto: [],
    });
  }

  for (const ed of edificios) {
    // Un acumulador por fase para ESTE edificio; se vuelca al final para no
    // dejar filas de reparto en cero cuando el edificio no toca la fase.
    const aqui = new Map<string, RepartoEdificio>();

    for (const piso of ed.pisos) {
      for (const unidad of piso.unidades) {
        for (const espacio of unidad.espacios) {
          for (const t of espacio.tareas) {
            const fid = t.fase?.id ?? t.fase_id;
            if (!fid) continue;
            const fase = porId.get(fid);
            if (!fase) continue; // tarea de una fase que ya no existe

            fase.total++;
            if (t.estado === "APROBADA") fase.aprobadas++;
            else if (t.estado === "REPORTADA") fase.reportadas++;
            else if (t.estado === "NO_APROBADA") fase.devueltas++;
            else fase.pendientes++;

            const r = aqui.get(fid) ?? { nombre: ed.nombre, total: 0, aprobadas: 0, reportadas: 0 };
            r.total++;
            if (t.estado === "APROBADA") r.aprobadas++;
            else if (t.estado === "REPORTADA") r.reportadas++;
            aqui.set(fid, r);
          }
        }
      }
    }

    for (const [fid, r] of aqui) porId.get(fid)?.reparto.push(r);
  }

  const lista = [...porId.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  for (const f of lista) {
    f.porcentajeAprobado = pct(f.aprobadas, f.total);
    f.completa = f.total > 0 && f.aprobadas === f.total;
  }

  // El frente: más tareas esperando revisión. Empate → la fase más temprana,
  // que es la que bloquea a las de arriba.
  let frente = -1;
  for (const [i, f] of lista.entries()) {
    if (f.reportadas > 0 && (frente === -1 || f.reportadas > lista[frente].reportadas)) frente = i;
  }

  return {
    fases: lista,
    frente,
    totalReportadas: lista.reduce((a, f) => a + f.reportadas, 0),
    totalDevueltas: lista.reduce((a, f) => a + f.devueltas, 0),
  };
}
