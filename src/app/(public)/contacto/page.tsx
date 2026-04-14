import { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contacto — Seiricon",
  description: "Contacta al equipo de Seiricon.",
};

export default function ContactoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Contacto</h1>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          Tienes preguntas sobre la plataforma, necesitas una demo personalizada o quieres ejercer
          tus derechos como titular de datos? Estamos para ayudarte.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5 mb-12">
        <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">Correo electronico</div>
          <a href="mailto:info@seiricon.com" className="text-sm text-blue-600 hover:text-blue-700">info@seiricon.com</a>
        </div>
        <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Phone className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">Telefono</div>
          <a href="tel:+573151760351" className="text-sm text-slate-600">+57 315 176 0351</a>
        </div>
        <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">Ubicacion</div>
          <span className="text-sm text-slate-600">Cali, Colombia</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Enviar un mensaje</h2>
        <p className="text-sm text-slate-500 mb-6">Completa el formulario y te responderemos en menos de 24 horas.</p>
        <ContactForm />
      </div>

      {/* Derechos de datos */}
      <div className="mt-8 bg-slate-50 border border-slate-100 rounded-xl p-5 text-sm text-slate-600">
        <strong className="text-slate-800">Derechos como titular de datos:</strong> Si deseas consultar,
        actualizar, rectificar o suprimir tus datos personales conforme a la Ley 1581 de 2012, puedes usar
        este formulario seleccionando "Derechos de datos personales" como asunto, o escribir directamente a{" "}
        <a href="mailto:info@seiricon.com" className="text-blue-600">info@seiricon.com</a>.
        Responderemos en los plazos establecidos por la ley.
      </div>
    </div>
  );
}
