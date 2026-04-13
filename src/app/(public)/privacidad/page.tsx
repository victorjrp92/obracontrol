import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Tratamiento de Datos Personales — Seiricon",
  description: "Politica de tratamiento de datos personales conforme a la Ley 1581 de 2012.",
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Politica de Tratamiento de Datos Personales</h1>
      <p className="text-sm text-slate-500 mb-2">Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013</p>
      <p className="text-sm text-slate-500 mb-10">Ultima actualizacion: 13 de abril de 2026</p>

      <div className="prose prose-slate prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-slate-600 [&_li]:text-slate-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">

        <h2>1. Responsable del Tratamiento</h2>
        <table className="text-sm border-collapse w-full not-prose mb-4">
          <tbody className="divide-y divide-slate-100">
            <tr><td className="py-2 pr-4 font-medium text-slate-700 w-48">Razon social</td><td className="py-2 text-slate-600">SEIRICON S.A.S.</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-slate-700">NIT</td><td className="py-2 text-slate-600">[Pendiente de registro]</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-slate-700">Domicilio</td><td className="py-2 text-slate-600">Bogota D.C., Colombia</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-slate-700">Correo electronico</td><td className="py-2 text-slate-600"><a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a></td></tr>
            <tr><td className="py-2 pr-4 font-medium text-slate-700">Sitio web</td><td className="py-2 text-slate-600">www.seiricon.com</td></tr>
          </tbody>
        </table>

        <h2>2. Marco Legal</h2>
        <p>
          La presente Politica se fundamenta en la Constitucion Politica de Colombia (Art. 15), la Ley Estatutaria
          1581 de 2012, el Decreto Reglamentario 1377 de 2013, el Decreto Unico 1074 de 2015 (Titulo 26) y
          demas normas concordantes en materia de proteccion de datos personales.
        </p>

        <h2>3. Ambito de Aplicacion</h2>
        <p>
          Esta Politica aplica a todos los datos personales recopilados, almacenados, usados, circulados,
          suprimidos y tratados por SEIRICON en el marco de su objeto social, incluyendo datos de:
        </p>
        <ul>
          <li>Usuarios registrados en la plataforma (administradores, directivos, contratistas)</li>
          <li>Obreros que acceden mediante token temporal</li>
          <li>Prospectos y personas que solicitan informacion</li>
          <li>Proveedores y aliados comerciales</li>
        </ul>

        <h2>4. Definiciones</h2>
        <p>Conforme al articulo 3 de la Ley 1581 de 2012:</p>
        <ul>
          <li><strong>Dato personal:</strong> Cualquier informacion vinculada o que pueda asociarse a una persona natural determinada o determinable.</li>
          <li><strong>Dato sensible:</strong> Dato que afecta la intimidad del Titular o cuyo uso indebido puede generar discriminacion (origen racial, orientacion politica, datos biometricos, de salud, vida sexual, entre otros).</li>
          <li><strong>Titular:</strong> Persona natural cuyos datos personales son objeto de tratamiento.</li>
          <li><strong>Tratamiento:</strong> Cualquier operacion sobre datos personales (recoleccion, almacenamiento, uso, circulacion, supresion).</li>
          <li><strong>Responsable del Tratamiento:</strong> SEIRICON S.A.S., quien decide sobre la base de datos y/o el tratamiento.</li>
          <li><strong>Encargado del Tratamiento:</strong> Persona que realiza el tratamiento por cuenta del Responsable (proveedores de infraestructura).</li>
          <li><strong>Autorizacion:</strong> Consentimiento previo, expreso e informado del Titular.</li>
        </ul>

        <h2>5. Principios Rectores</h2>
        <p>SEIRICON aplica los siguientes principios en el tratamiento de datos personales:</p>
        <ul>
          <li><strong>Legalidad:</strong> Tratamiento sujeto a la ley colombiana vigente.</li>
          <li><strong>Finalidad:</strong> Los datos se tratan con una finalidad legitima informada al Titular.</li>
          <li><strong>Libertad:</strong> Solo se tratan datos con autorizacion previa del Titular o por mandato legal.</li>
          <li><strong>Veracidad:</strong> La informacion debe ser veraz, completa y actualizada.</li>
          <li><strong>Transparencia:</strong> El Titular puede conocer en cualquier momento la existencia del tratamiento.</li>
          <li><strong>Acceso y circulacion restringida:</strong> Los datos solo se tratan por personas autorizadas.</li>
          <li><strong>Seguridad:</strong> Se aplican medidas tecnicas y administrativas para proteger los datos.</li>
          <li><strong>Confidencialidad:</strong> Las personas que intervienen en el tratamiento estan obligadas a garantizar la reserva.</li>
        </ul>

        <h2>6. Datos que Recopilamos</h2>

        <h3>6.1 Datos de identificacion y contacto</h3>
        <ul>
          <li>Nombre completo</li>
          <li>Correo electronico</li>
          <li>Numero de telefono (opcional)</li>
          <li>Nombre de la constructora</li>
          <li>NIT de la constructora</li>
        </ul>

        <h3>6.2 Datos de la actividad en la plataforma</h3>
        <ul>
          <li>Proyectos creados y su estructura</li>
          <li>Tareas asignadas, estados y tiempos</li>
          <li>Evidencia fotografica y de video con metadatos (GPS, fecha/hora)</li>
          <li>Aprobaciones y rechazos</li>
          <li>Metricas de desempeno de contratistas</li>
          <li>Historial de cambios (audit log)</li>
        </ul>

        <h3>6.3 Datos tecnicos</h3>
        <ul>
          <li>Direccion IP</li>
          <li>Tipo de navegador y dispositivo</li>
          <li>Datos de cookies y tecnologias similares (ver <a href="/cookies" className="text-blue-600">Politica de Cookies</a>)</li>
        </ul>

        <h3>6.4 Datos sensibles</h3>
        <p>
          SEIRICON <strong>no recopila datos sensibles</strong> de manera deliberada. En caso de que un Titular
          incluya datos sensibles en campos de texto libre o fotografias, dicha informacion sera tratada con
          las medidas de seguridad reforzadas que exige la ley.
        </p>

        <h2>7. Finalidades del Tratamiento</h2>
        <p>Los datos personales seran tratados para las siguientes finalidades:</p>

        <h3>7.1 Finalidades necesarias para la prestacion del servicio</h3>
        <ul>
          <li>Crear y gestionar la cuenta del Usuario</li>
          <li>Prestar los servicios contratados de la plataforma</li>
          <li>Procesar pagos y facturacion</li>
          <li>Verificar la identidad del Usuario (autenticacion)</li>
          <li>Generar reportes y metricas de proyecto</li>
          <li>Brindar soporte tecnico</li>
          <li>Cumplir obligaciones legales y requerimientos de autoridades</li>
        </ul>

        <h3>7.2 Finalidades adicionales (requieren autorizacion)</h3>
        <ul>
          <li>Enviar comunicaciones comerciales y de mercadeo</li>
          <li>Realizar encuestas de satisfaccion</li>
          <li>Generar estadisticas agregadas sobre el sector construccion</li>
          <li>Informar sobre nuevas funcionalidades y actualizaciones</li>
        </ul>

        <h2>8. Autorizacion</h2>
        <p>
          SEIRICON obtiene la autorizacion del Titular para el tratamiento de sus datos personales de manera
          previa, expresa e informada, a traves del formulario de registro en la plataforma, donde el Titular
          acepta expresamente esta Politica marcando la casilla correspondiente.
        </p>
        <p>
          No se requiere autorizacion cuando el tratamiento sea ordenado por ley o autoridad competente,
          se trate de datos de naturaleza publica, o sea necesario para atender una emergencia medica o sanitaria.
        </p>

        <h2>9. Derechos del Titular</h2>
        <p>Conforme al articulo 8 de la Ley 1581 de 2012, el Titular tiene derecho a:</p>
        <ol>
          <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales.</li>
          <li><strong>Solicitar prueba</strong> de la autorizacion otorgada.</li>
          <li><strong>Ser informado</strong> sobre el uso dado a sus datos.</li>
          <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
          <li><strong>Revocar la autorizacion</strong> y/o solicitar la supresion de sus datos cuando no se respeten los principios legales.</li>
          <li><strong>Acceder gratuitamente</strong> a los datos tratados.</li>
        </ol>

        <h2>10. Procedimiento para Ejercer Derechos</h2>
        <p>
          El Titular o su representante podra ejercer sus derechos enviando una solicitud a
          {" "}<a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a> o a traves del
          {" "}<a href="/contacto" className="text-blue-600">formulario de contacto</a>, indicando:
        </p>
        <ol>
          <li>Nombre completo y documento de identidad del Titular</li>
          <li>Descripcion de los hechos que dan lugar a la solicitud</li>
          <li>Direccion de correspondencia y correo electronico</li>
          <li>Documentos que soporten la solicitud (si aplica)</li>
        </ol>
        <p>
          <strong>Plazos de respuesta:</strong> Consultas seran atendidas en un termino maximo de diez (10) dias
          habiles. Reclamos seran atendidos en un termino maximo de quince (15) dias habiles, prorrogable
          por ocho (8) dias habiles adicionales conforme a la ley.
        </p>

        <h2>11. Medidas de Seguridad</h2>
        <p>SEIRICON implementa las siguientes medidas para proteger los datos personales:</p>
        <ul>
          <li>Cifrado en transito (TLS/SSL) y en reposo (AES-256) para toda la informacion</li>
          <li>Autenticacion segura con hash de contrasenas (bcrypt)</li>
          <li>Control de acceso basado en roles (RBAC) con cuatro niveles de permisos</li>
          <li>Registro de auditoria (audit log) de operaciones sensibles</li>
          <li>Infraestructura alojada en servidores con certificacion SOC 2 Tipo II</li>
          <li>Backups automaticos diarios con retencion de treinta (30) dias</li>
          <li>Acceso restringido a datos de produccion solo a personal autorizado</li>
        </ul>

        <h2>12. Transferencia y Transmision de Datos</h2>
        <p>
          SEIRICON podra transmitir datos personales a los siguientes Encargados del Tratamiento, quienes
          operan bajo contratos que garantizan niveles adecuados de proteccion:
        </p>
        <ul>
          <li><strong>Supabase Inc.</strong> (Estados Unidos) — Almacenamiento de base de datos y autenticacion. Opera bajo certificacion SOC 2 y cumple con estandares internacionales de seguridad.</li>
          <li><strong>Vercel Inc.</strong> (Estados Unidos) — Alojamiento de la aplicacion web.</li>
        </ul>
        <p>
          Las transferencias internacionales de datos se realizan conforme al articulo 26 de la Ley 1581 de 2012,
          garantizando niveles adecuados de proteccion en el pais receptor.
        </p>

        <h2>13. Retencion de Datos</h2>
        <ul>
          <li><strong>Cuenta activa:</strong> Los datos se conservan mientras la cuenta este activa y el servicio vigente.</li>
          <li><strong>Cuenta cancelada:</strong> Los datos se conservan por sesenta (60) dias adicionales y luego se eliminan permanentemente.</li>
          <li><strong>Obligaciones legales:</strong> Ciertos datos podran conservarse por periodos mayores cuando asi lo exija la ley (obligaciones tributarias, contables o judiciales).</li>
        </ul>

        <h2>14. Menores de Edad</h2>
        <p>
          La plataforma no esta dirigida a menores de edad. SEIRICON no recopila deliberadamente datos de
          menores de dieciocho (18) anos. Si se identifica que se han recopilado datos de un menor, estos
          seran eliminados inmediatamente.
        </p>

        <h2>15. Modificaciones</h2>
        <p>
          SEIRICON podra modificar esta Politica en cualquier momento. Las modificaciones seran comunicadas al
          Titular por correo electronico y/o mediante aviso en la plataforma con al menos quince (15) dias
          de antelacion. La version vigente estara siempre disponible en esta pagina.
        </p>

        <h2>16. Autoridad de Vigilancia</h2>
        <p>
          La Superintendencia de Industria y Comercio (SIC) es la autoridad encargada de vigilar el cumplimiento
          de la legislacion en materia de proteccion de datos personales en Colombia.
        </p>
        <ul>
          <li>Sitio web: <span className="text-slate-700">www.sic.gov.co</span></li>
          <li>Linea gratuita: 01 8000 910 165</li>
        </ul>

        <h2>17. Contacto</h2>
        <p>Para ejercer sus derechos o resolver dudas sobre esta Politica:</p>
        <ul>
          <li>Correo: <a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a></li>
          <li>Formulario: <a href="/contacto" className="text-blue-600">www.seiricon.com/contacto</a></li>
        </ul>
      </div>
    </div>
  );
}
