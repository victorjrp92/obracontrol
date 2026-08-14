/**
 * Líneas de emergencia y puntos de atención — línea «Juntos» (post-sismo).
 *
 * REGLA: aquí solo entran números confirmados en FUENTE OFICIAL (.gov.co) o
 * nacionales estables. Cada entrada lleva su fuente y fecha de verificación.
 * Los números que solo circulan en prensa NO se publican: en una pantalla de
 * emergencia, un número equivocado es peor que uno menos.
 *
 * El 123 va SIEMPRE primero y en grande: es el Número Único Nacional de
 * Emergencias (Función Pública) y funciona en todo el país.
 */

export interface LineaEmergencia {
  nombre: string;
  numero: string; // tal como se marca
  detalle?: string;
  fuente: string;
  verificado: string; // AAAA-MM-DD
}

export interface CiudadJuntos {
  slug: "cali" | "pereira" | "manizales" | "quibdo";
  nombre: string;
  lineas: LineaEmergencia[];
  /** Punto de atención presencial para el registro de damnificados (RUD). */
  puntoAtencion?: { lugar: string; detalle?: string; fuente: string; verificado: string };
}

/** Nacionales — estables, funcionan en todo el país. */
export const LINEAS_NACIONALES: LineaEmergencia[] = [
  {
    nombre: "Emergencias (todo el país)",
    numero: "123",
    detalle: "Policía, ambulancias, bomberos y Defensa Civil",
    fuente:
      "funcionpublica.gov.co — Línea Única de Emergencias Nacional 123",
    verificado: "2026-08-14",
  },
  {
    nombre: "Bomberos",
    numero: "119",
    fuente: "Línea nacional estable",
    verificado: "2026-08-14",
  },
  {
    nombre: "Cruz Roja",
    numero: "132",
    fuente: "Línea nacional estable",
    verificado: "2026-08-14",
  },
  {
    nombre: "Defensa Civil",
    numero: "144",
    fuente: "Línea nacional estable",
    verificado: "2026-08-14",
  },
];

export const CIUDADES_JUNTOS: CiudadJuntos[] = [
  {
    slug: "cali",
    nombre: "Cali",
    lineas: [
      {
        nombre: "Secretaría de Gestión del Riesgo de Emergencias y Desastres",
        numero: "+57 602 653 3801",
        fuente: "cali.gov.co/directorio (página oficial de la Secretaría)",
        verificado: "2026-08-14",
      },
      {
        nombre: "Línea de la Alcaldía de Cali",
        numero: "195",
        detalle: "Nacional gratuita: 01 8000 222 195",
        fuente: "cali.gov.co",
        verificado: "2026-08-14",
      },
    ],
    puntoAtencion: {
      lugar: "Sede de la Beneficencia del Valle y Gobernación del Valle",
      detalle: "Registro de damnificados · también opera el PMU regional",
      fuente: "Guías oficiales de atención post-sismo (UNGRD/alcaldías), prensa nacional 2026-08-13",
      verificado: "2026-08-14",
    },
  },
  {
    slug: "pereira",
    nombre: "Pereira",
    lineas: [
      {
        nombre: "Alcaldía de Pereira — conmutador (DIGER)",
        numero: "+57 606 324 8000",
        detalle: "La Dirección de Gestión del Riesgo (DIGER) atiende por el conmutador",
        fuente: "pereira.gov.co (página oficial de DIGER)",
        verificado: "2026-08-14",
      },
    ],
    puntoAtencion: {
      lugar: "Sede del Cuerpo Oficial de Bomberos de Pereira",
      detalle: "Registro de damnificados",
      fuente: "Guías oficiales de atención post-sismo, prensa nacional 2026-08-13",
      verificado: "2026-08-14",
    },
  },
  {
    slug: "manizales",
    nombre: "Manizales",
    lineas: [
      {
        nombre: "Alcaldía de Manizales — Unidad de Gestión del Riesgo (UGR)",
        numero: "+57 606 892 8000",
        detalle: "Gratuita nacional: 01 8000 968 988",
        fuente: "manizales.gov.co/unidad-de-gestion-del-riesgo",
        verificado: "2026-08-14",
      },
    ],
    puntoAtencion: {
      lugar: "Comando de Bomberos Fundadores",
      detalle: "Registro de damnificados",
      fuente: "Guías oficiales de atención post-sismo, prensa nacional 2026-08-13",
      verificado: "2026-08-14",
    },
  },
  {
    slug: "quibdo",
    nombre: "Quibdó",
    lineas: [
      // Sin línea municipal confirmada en fuente oficial al 2026-08-14.
      // Las nacionales (123/119/132/144) cubren; NO publicar números de prensa.
    ],
    puntoAtencion: {
      lugar: "Comando de Policía de Quibdó",
      detalle: "Registro de damnificados · también opera el PMU regional",
      fuente: "Guías oficiales de atención post-sismo, prensa nacional 2026-08-13",
      verificado: "2026-08-14",
    },
  },
];
