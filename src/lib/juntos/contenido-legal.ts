/**
 * Contenido legal de la pantalla post-descarga — línea «Juntos».
 *
 * REGLA: cada tarjeta INFORMA lo que dice la ley (información pública, con el
 * artículo citado). NUNCA asesora el caso concreto ("demanda", "tu caso lo
 * ganas") ni promete resultados. El texto de `ley` es fiel a la norma
 * verificada en fuente oficial en la fecha indicada.
 *
 * Formato: gancho corto que invita al clic (Victor: "la idea es que le den
 * click") + cuerpo digerible en bullets + cita legal al pie.
 */

export interface TarjetaLegal {
  id: string;
  /** Frase de enganche — se ve con la tarjeta cerrada. */
  gancho: string;
  /** Refuerzo bajo el gancho, una línea. */
  subgancho: string;
  /** Cifra o dato ancla que acompaña al gancho (grande, tabular). */
  ancla: string;
  /** Bullets del contenido expandido — cortos, accionables. */
  puntos: string[];
  /** Cita legal al pie, letra pequeña. */
  cita: string;
  verificado: string; // AAAA-MM-DD
}

export const TARJETAS_SEGURO: TarjetaLegal[] = [
  {
    id: "aviso-3-dias",
    gancho: "Tienes 3 días para avisarle a tu aseguradora.",
    subgancho: "No para tener todo listo — solo para avisar.",
    ancla: "3 días",
    puntos: [
      "Avisa HOY, aunque no tengas fotos ni papeles todavía. El aviso y la prueba son dos momentos distintos.",
      "Sirve una llamada, un correo o la app de tu aseguradora. Guarda constancia de la fecha del aviso.",
      "Este plazo se puede ampliar por acuerdo con la aseguradora, pero nunca reducir.",
    ],
    cita: "Código de Comercio, art. 1075: el asegurado debe dar noticia del siniestro dentro de los tres días siguientes a la fecha en que lo haya conocido.",
    verificado: "2026-08-14",
  },
  {
    id: "carga-de-la-prueba",
    gancho: "Si te dicen que no cubre, ellos tienen que probarlo. No tú.",
    subgancho: "Tú pruebas el daño. La exclusión la prueban ellos.",
    ancla: "Art. 1077",
    puntos: [
      "A ti te corresponde demostrar que el daño ocurrió y cuánto vale — exactamente lo que hace tu acta: fotos con fecha, ubicación y tu inventario de pérdidas.",
      "Si la aseguradora alega que tu caso está excluido de la póliza, la carga de demostrarlo es de ella.",
      "Entrega tu reclamo por escrito y guarda copia de todo lo que envíes.",
    ],
    cita: "Código de Comercio, art. 1077: corresponde al asegurado demostrar la ocurrencia del siniestro y la cuantía de la pérdida; al asegurador, los hechos o circunstancias excluyentes de su responsabilidad.",
    verificado: "2026-08-14",
  },
  {
    id: "un-mes-para-pagar",
    gancho: "Un mes para pagarte. Después, te deben intereses.",
    subgancho: "El plazo corre desde que acreditas tu derecho — tu acta es parte de esa prueba.",
    ancla: "1 mes",
    puntos: [
      "La aseguradora está obligada a pagar dentro del mes siguiente a que acredites tu derecho, incluso extrajudicialmente (sin ir a juicio).",
      "Si se pasa del mes, debe pagarte intereses de mora: la tasa bancaria corriente aumentada en la mitad.",
      "Si objetan tu reclamo y no estás de acuerdo, puedes acudir al Defensor del Consumidor Financiero de tu aseguradora (gratuito) o a la Superintendencia Financiera.",
    ],
    cita: "Código de Comercio, art. 1080: pago dentro del mes siguiente a la acreditación del derecho (art. 1077); vencido el plazo, interés moratorio igual al bancario corriente aumentado en la mitad.",
    verificado: "2026-08-14",
  },
];

export const TARJETA_CONJUNTOS: TarjetaLegal = {
  id: "conjuntos-ley-675",
  gancho: "¿Vives en conjunto o edificio? Las zonas comunes están aseguradas contra terremoto. Por ley.",
  subgancho: "Fachadas, escaleras, muros estructurales, techos, parqueaderos comunes.",
  ancla: "Ley 675",
  puntos: [
    "La ley obliga a toda copropiedad a tener póliza contra incendio y terremoto sobre los bienes comunes asegurables. No es opcional.",
    "Pídele al administrador: la póliza vigente, el número de contacto de la aseguradora y que reporte el siniestro de las zonas comunes.",
    "La indemnización se destina prioritariamente a reconstruir.",
    "Lo de adentro de tu apartamento corre por tu cuenta, salvo que la copropiedad haya asegurado también los bienes privados (revisa la póliza).",
  ],
  cita: "Ley 675 de 2001, art. 15: «será obligatoria la constitución de pólizas de seguros que cubran contra los riesgos de incendio y terremoto los bienes comunes… susceptibles de ser asegurados».",
  verificado: "2026-08-14",
};

export const TARJETA_AYUDAS: TarjetaLegal = {
  id: "ayudas-rud",
  gancho: "Sin estar en el censo, no hay ayuda del Estado.",
  subgancho: "El registro es la puerta a subsidios de arriendo y kits de ayuda — y va atrasado: no te quedes por fuera.",
  ancla: "RUD",
  puntos: [
    "Inscríbete en el Registro Único de Damnificados (RUD) en el punto de atención de tu ciudad (abajo te decimos cuál es).",
    "Lleva: tu cédula, FOTOS de los daños (tu acta te sirve exactamente para esto) y, si los conservas, documentos de la vivienda (escritura, contrato de arriendo o un recibo de servicios).",
    "Pide la evaluación técnica de tu vivienda a Bomberos o Cruz Roja — la hacen ellos, y es requisito para el subsidio de arriendo si tu casa quedó inhabitable.",
    "Descarga aquí tu derecho de petición ya diligenciado con tus datos: la autoridad tiene 15 días hábiles para responderte.",
  ],
  cita: "Proceso oficial de registro post-sismo (UNGRD y alcaldías, agosto 2026). El derecho de petición es el art. 23 de la Constitución.",
  verificado: "2026-08-14",
};

export const TARJETA_ANTIESTAFA: TarjetaLegal = {
  id: "antiestafa",
  gancho: "Nadie puede cobrarte por esto. Nadie.",
  subgancho: "Ni por inscribirte en el censo, ni por 'agilizar' un subsidio, ni por este documento.",
  ancla: "$0",
  puntos: [
    "El registro de damnificados y las ayudas del Estado son GRATIS y no necesitan intermediarios.",
    "Después de un desastre aparecen personas cobrando por 'gestionar' ayudas. Es estafa.",
    "No entregues datos bancarios ni dinero a nadie que te prometa un cupo o un subsidio.",
    "Haz todo por los canales oficiales: alcaldía, puntos de atención y líneas que te mostramos aquí.",
    "Este documento de Seiricon también es gratuito, hoy y siempre.",
  ],
  cita: "Advertencia oficial de las autoridades durante la emergencia (agosto 2026).",
  verificado: "2026-08-14",
};

/** Aviso legal del acta y de los resultados — compartido por pantallas y PDF. */
export const AVISO_DOCUMENTO =
  "Este documento registra los daños declarados por quien lo genera, con fotografías fechadas y geolocalizadas. No es un peritaje, ni un dictamen técnico, ni una evaluación de habitabilidad: esas las realiza un ingeniero estructural o los organismos oficiales (Bomberos, Cruz Roja).";
