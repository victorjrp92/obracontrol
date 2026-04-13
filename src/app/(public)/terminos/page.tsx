import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos y Condiciones — Seiricon",
  description: "Terminos y condiciones de uso de la plataforma Seiricon.",
};

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Terminos y Condiciones de Uso</h1>
      <p className="text-sm text-slate-500 mb-10">Ultima actualizacion: 13 de abril de 2026</p>

      <div className="prose prose-slate prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-slate-600 [&_li]:text-slate-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        <h2>1. Objeto</h2>
        <p>
          Los presentes Terminos y Condiciones regulan el acceso y uso de la plataforma tecnologica SEIRICON
          (en adelante, "la Plataforma"), operada por SEIRICON S.A.S., sociedad constituida bajo las leyes de la
          Republica de Colombia, identificada con NIT [pendiente de registro], con domicilio en la ciudad de Bogota D.C.
        </p>
        <p>
          La Plataforma es un software como servicio (SaaS) disenado para la gestion, seguimiento y control de
          proyectos de obra blanca y carpinteria en el sector de la construccion.
        </p>

        <h2>2. Aceptacion</h2>
        <p>
          Al registrarse, acceder o utilizar la Plataforma, el Usuario declara que ha leido, comprendido y aceptado
          integramente estos Terminos y Condiciones, asi como la Politica de Tratamiento de Datos Personales.
          Si no esta de acuerdo con alguna disposicion, debera abstenerse de usar la Plataforma.
        </p>

        <h2>3. Definiciones</h2>
        <ul>
          <li><strong>Usuario:</strong> Toda persona natural o juridica que accede y utiliza la Plataforma.</li>
          <li><strong>Constructora:</strong> La empresa del sector construccion que contrata los servicios de la Plataforma.</li>
          <li><strong>Administrador:</strong> Usuario con permisos de gestion total dentro de una Constructora.</li>
          <li><strong>Contratista:</strong> Usuario con permisos para reportar avances y gestionar tareas asignadas.</li>
          <li><strong>Obrero:</strong> Persona autorizada mediante token temporal para reportar evidencia fotografica.</li>
          <li><strong>Contenido:</strong> Toda informacion, datos, fotografias, documentos y demas material cargado en la Plataforma.</li>
        </ul>

        <h2>4. Registro y Cuenta</h2>
        <ol>
          <li>Para usar la Plataforma es necesario crear una cuenta proporcionando informacion veraz, completa y actualizada.</li>
          <li>El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
          <li>Cada cuenta es personal e intransferible. El Usuario no debera compartir sus credenciales con terceros.</li>
          <li>SEIRICON se reserva el derecho de suspender o cancelar cuentas que infrinjan estos Terminos.</li>
        </ol>

        <h2>5. Planes y Pagos</h2>
        <ol>
          <li>La Plataforma ofrece diferentes planes de suscripcion con funcionalidades y limites especificos.</li>
          <li>Los precios seran informados en la Plataforma y pueden ser actualizados con previo aviso de treinta (30) dias calendario.</li>
          <li>Los pagos se realizaran de forma anticipada segun la periodicidad del plan contratado.</li>
          <li>En caso de mora, SEIRICON podra suspender el acceso hasta la regularizacion del pago, sin que esto implique perdida de datos durante un periodo de gracia de sesenta (60) dias.</li>
        </ol>

        <h2>6. Uso Aceptable</h2>
        <p>El Usuario se compromete a:</p>
        <ul>
          <li>Utilizar la Plataforma unicamente para fines licitos relacionados con la gestion de proyectos de construccion.</li>
          <li>No intentar acceder a cuentas, datos o funcionalidades no autorizadas.</li>
          <li>No introducir virus, malware o cualquier codigo malicioso.</li>
          <li>No realizar ingenieria inversa, descompilar ni desensamblar la Plataforma.</li>
          <li>No utilizar la Plataforma para almacenar contenido ilegal, difamatorio u ofensivo.</li>
          <li>Cumplir con la legislacion colombiana vigente en todo momento.</li>
        </ul>

        <h2>7. Propiedad Intelectual</h2>
        <ol>
          <li>SEIRICON es titular de todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo software, diseno, marcas, logos y documentacion.</li>
          <li>El Usuario conserva la titularidad sobre el Contenido que cargue en la Plataforma.</li>
          <li>El Usuario otorga a SEIRICON una licencia limitada y no exclusiva para almacenar, procesar y mostrar el Contenido unicamente con el fin de prestar el servicio.</li>
        </ol>

        <h2>8. Disponibilidad del Servicio</h2>
        <ol>
          <li>SEIRICON se esforzara por mantener la Plataforma disponible de manera continua (99.9% de uptime objetivo).</li>
          <li>SEIRICON podra realizar mantenimientos programados, los cuales seran comunicados con antelacion razonable.</li>
          <li>SEIRICON no sera responsable por interrupciones causadas por fuerza mayor, fallas de terceros proveedores de infraestructura, o problemas de conectividad del Usuario.</li>
        </ol>

        <h2>9. Proteccion de Datos Personales</h2>
        <p>
          SEIRICON cumple con la Ley 1581 de 2012, el Decreto 1377 de 2013 y demas normatividad vigente en
          materia de proteccion de datos personales en Colombia. El tratamiento de datos se rige por la
          {" "}<a href="/privacidad" className="text-blue-600 hover:text-blue-700">Politica de Tratamiento de Datos Personales</a>.
        </p>

        <h2>10. Confidencialidad</h2>
        <p>
          SEIRICON tratara como confidencial toda la informacion del Usuario y sus proyectos. No divulgara,
          vendera ni compartira datos con terceros, excepto cuando sea requerido por autoridad competente
          mediante orden judicial o administrativa debidamente fundamentada.
        </p>

        <h2>11. Limitacion de Responsabilidad</h2>
        <ol>
          <li>SEIRICON no sera responsable por danos indirectos, incidentales, especiales o consecuentes derivados del uso de la Plataforma.</li>
          <li>La responsabilidad maxima de SEIRICON estara limitada al valor pagado por el Usuario en los ultimos doce (12) meses.</li>
          <li>SEIRICON no es responsable de las decisiones de construccion tomadas con base en los datos de la Plataforma.</li>
        </ol>

        <h2>12. Terminacion</h2>
        <ol>
          <li>El Usuario podra cancelar su cuenta en cualquier momento desde la configuracion de la Plataforma.</li>
          <li>Tras la cancelacion, SEIRICON conservara los datos por un periodo de sesenta (60) dias, tras los cuales seran eliminados permanentemente.</li>
          <li>SEIRICON podra terminar la relacion en caso de incumplimiento de estos Terminos, previo aviso al Usuario.</li>
        </ol>

        <h2>13. Modificaciones</h2>
        <p>
          SEIRICON se reserva el derecho de modificar estos Terminos. Los cambios seran notificados al Usuario
          por correo electronico y/o mediante aviso en la Plataforma con al menos quince (15) dias de antelacion.
          El uso continuado de la Plataforma tras la notificacion constituye aceptacion de los nuevos Terminos.
        </p>

        <h2>14. Ley Aplicable y Jurisdiccion</h2>
        <p>
          Estos Terminos se rigen por las leyes de la Republica de Colombia. Cualquier controversia sera
          resuelta ante los jueces y tribunales competentes de la ciudad de Bogota D.C., previo agotamiento
          de mecanismos alternativos de solucion de conflictos.
        </p>

        <h2>15. Contacto</h2>
        <p>
          Para consultas sobre estos Terminos, el Usuario puede comunicarse a:
        </p>
        <ul>
          <li>Correo electronico: <a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a></li>
          <li>Formulario de contacto: <a href="/contacto" className="text-blue-600">/contacto</a></li>
        </ul>
      </div>
    </div>
  );
}
