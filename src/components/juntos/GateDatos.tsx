"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { normalizarCedula, normalizarWhatsapp } from "@/lib/juntos/acta-juntos";

/**
 * Rol de quien declara. Se separan «vivo ahí» de «lo tengo arrendado» (el que
 * arrienda suele estar lejos — el perfil de la diáspora) y el administrador de
 * copropiedad de la inmobiliaria: son negocios distintos. El administrador de
 * conjunto es el lead más valioso (Ley 675: las zonas comunes tienen seguro
 * obligatorio, y un edificio son muchas actas).
 */
export type AudienciaJuntos =
  | "propietario_habita"
  | "propietario_arrienda"
  | "administrador_ph"
  | "inmobiliaria"
  | "contratista";

export interface DatosGate {
  nombre: string;
  cedula: string;
  whatsapp: string;
  direccion: string;
  ciudad: string;
  audiencia: AudienciaJuntos;
  aceptaContacto: boolean;
  /** Honeypot — viaja al API de contacto tal cual. */
  sitioWeb: string;
}

interface GateDatosProps {
  enviando: boolean;
  error: string | null;
  onEnviar: (datos: DatosGate) => void;
  /** Qué documento se está por generar: cambia títulos y textos, no la lógica. */
  variante?: "acta" | "informe";
}

const TEXTOS = {
  acta: {
    titulo: "Ponle tu nombre al acta",
    documento: "el acta",
    boton: "Descargar mi acta",
    generando: "Generando tu acta...",
    pistaWhatsapp: "Te enviamos el acta también por ahí, por si pierdes el archivo.",
    obligatoria: "Obligatoria para generar el acta.",
  },
  informe: {
    titulo: "Ponle tu nombre al informe",
    documento: "el informe",
    boton: "Descargar mi informe",
    generando: "Generando tu informe...",
    pistaWhatsapp: "Te enviamos el informe también por ahí, por si pierdes el archivo.",
    obligatoria: "Obligatoria para generar el informe.",
  },
} as const;

const OPCIONES_ROL: { valor: AudienciaJuntos; label: string }[] = [
  { valor: "propietario_habita", label: "Mi casa o apartamento — vivo ahí" },
  { valor: "propietario_arrienda", label: "Mi casa o apartamento — lo tengo arrendado" },
  { valor: "administrador_ph", label: "El conjunto o edificio del que soy administrador" },
  { valor: "inmobiliaria", label: "Inmuebles de otros dueños (soy inmobiliaria)" },
  { valor: "contratista", label: "La obra de un cliente" },
];

/**
 * Gate de datos — el momento de conversión (spec-go-juntos.md): campos con
 * microcopy que los justifica, DOS casillas separadas y NINGUNA premarcada
 * (Ley 1581 obligatoria con link a /privacidad; contacto para reparación
 * OPCIONAL, no condiciona la descarga), pregunta de rol para el negocio,
 * honeypot, y el botón «Descargar mi acta» con «Gratis. Sin crear cuenta.».
 * La cédula y la dirección SOLO viajan al request del PDF: no se persisten.
 */
export default function GateDatos({ enviando, error, onEnviar, variante = "acta" }: GateDatosProps) {
  const txt = TEXTOS[variante];
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [audiencia, setAudiencia] = useState<AudienciaJuntos | null>(null);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [aceptaContacto, setAceptaContacto] = useState(false);
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // El maestro es estado DERIVADO, no una tercera variable: así desmarcar una
  // casilla suelta lo apaga solo, sin lógica de sincronización que se desfase.
  const aceptaTodo = aceptaDatos && aceptaContacto;
  function marcarTodo(valor: boolean) {
    setAceptaDatos(valor);
    setAceptaContacto(valor);
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;

    if (nombre.trim().length < 3) return setErrorLocal("Escribe tu nombre como aparece en tu cédula.");
    if (!/^\d{5,15}$/.test(normalizarCedula(cedula))) return setErrorLocal("Revisa el número de cédula (solo números).");
    if (!/^\+?\d{7,15}$/.test(normalizarWhatsapp(whatsapp))) return setErrorLocal("Revisa el número de WhatsApp.");
    if (direccion.trim().length < 5) return setErrorLocal("Escribe la dirección del inmueble.");
    if (ciudad.trim().length < 2) return setErrorLocal("Escribe la ciudad.");
    if (!audiencia) return setErrorLocal("Cuéntanos qué es este inmueble para ti.");
    if (!aceptaDatos) return setErrorLocal("Necesitamos tu autorización de datos para generar el documento.");

    setErrorLocal(null);
    onEnviar({
      nombre: nombre.trim(),
      cedula: normalizarCedula(cedula),
      whatsapp: normalizarWhatsapp(whatsapp),
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      audiencia,
      aceptaContacto,
      sitioWeb,
    });
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div>
        <h2>{txt.titulo}</h2>
        <p className="desc">Estos datos van impresos en el documento — por eso los pedimos.</p>
      </div>

      <div className="campo">
        <label htmlFor="jt-nombre">Nombre y apellido</label>
        <p className="pista">Como aparece en tu cédula.</p>
        <input
          id="jt-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          placeholder="Ej: María Fernanda López"
        />
      </div>

      <div className="campo">
        <label htmlFor="jt-cedula">Cédula</label>
        <p className="pista">
          <b>No la guardamos en nuestros servidores.</b> Se imprime en tu documento porque tu aseguradora la
          va a pedir, y se descarta.
        </p>
        <input
          id="jt-cedula"
          type="text"
          inputMode="numeric"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Solo números"
        />
      </div>

      <div className="campo">
        <label htmlFor="jt-whatsapp">WhatsApp</label>
        <p className="pista">{txt.pistaWhatsapp}</p>
        <input
          id="jt-whatsapp"
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          autoComplete="tel"
          placeholder="Ej: 300 123 4567"
        />
      </div>

      <div className="campo">
        <label htmlFor="jt-direccion">Dirección del inmueble</label>
        <p className="pista">Va en el documento como ubicación del daño.</p>
        <input
          id="jt-direccion"
          type="text"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          autoComplete="street-address"
          placeholder="Ej: Calle 5 #23-10, Barrio San Fernando"
        />
      </div>

      <div className="campo">
        <label htmlFor="jt-ciudad">Ciudad</label>
        <input
          id="jt-ciudad"
          type="text"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          autoComplete="address-level2"
          placeholder="Ej: Cali"
        />
      </div>

      <div className="campo">
        <label>¿Este inmueble es…?</label>
        <div className="opciones" style={{ gridTemplateColumns: "1fr" }}>
          {OPCIONES_ROL.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setAudiencia(op.valor)}
              aria-pressed={audiencia === op.valor}
              className={`opcion opcion-linea ${audiencia === op.valor ? "sel" : ""}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Honeypot: campo señuelo oculto a humanos, visible a bots simples. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="jt-sitio-web">No llenar este campo</label>
        <input
          id="jt-sitio-web"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={sitioWeb}
          onChange={(e) => setSitioWeb(e.target.value)}
        />
      </div>

      {/* Las tres casillas van juntas y con menos aire entre ellas: se leen
          como un solo bloque de permisos, no como tres pasos sueltos. */}
      <div className="checks">
        {/* Atajo de una marca, ARRIBA: abajo sería un atajo que se descubre
            tarde. Las dos casillas siguen visibles y se pueden desmarcar por
            separado — la Ley 1581 exige finalidad específica, y un «acepto
            todo» que esconda los fines no la cumple. */}
        <label className={`check check-todo ${aceptaTodo ? "marcada" : ""}`}>
          <input
            type="checkbox"
            checked={aceptaTodo}
            onChange={(e) => marcarTodo(e.target.checked)}
          />
          <span>Acepto todo</span>
        </label>

        <label className={`check ${aceptaDatos ? "marcada" : ""}`}>
          <input type="checkbox" checked={aceptaDatos} onChange={(e) => setAceptaDatos(e.target.checked)} />
          <span>
            Autorizo el tratamiento de mis datos (Ley 1581 de 2012,{" "}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer">
              política de privacidad
            </a>
            ) para generar este documento y enviármelo por los canales que yo pida. Entiendo que este
            documento no es una evaluación estructural ni un dictamen técnico.
            <small>{txt.obligatoria}</small>
          </span>
        </label>

        {/* Consentimiento comercial: explícito y sin premarcar (Ley 1581 exige
            finalidad específica), pero visualmente ligero — es un ofrecimiento,
            no un requisito, y no debe pesar lo mismo que la obligatoria. */}
        <label className={`check check-suave ${aceptaContacto ? "marcada" : ""}`}>
          <input type="checkbox" checked={aceptaContacto} onChange={(e) => setAceptaContacto(e.target.checked)} />
          <span>
            Acepto que me escriban más adelante, por si necesito una mano con la reparación.
            <small>Opcional. Tu documento se descarga igual.</small>
          </span>
        </label>
      </div>

      {(errorLocal || error) && <p className="error-inline">{errorLocal ?? error}</p>}

      <div className="cta-abajo">
        <button type="submit" disabled={enviando} className="btn btn-azul">
          {enviando ? (
            <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} />
          ) : (
            <Download className="ic" aria-hidden="true" />
          )}
          {enviando ? txt.generando : txt.boton}
        </button>
        <p className="micro" style={{ textAlign: "center", marginTop: 0 }}>Gratis. Sin crear cuenta.</p>
      </div>
    </form>
  );
}
