"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

const ASUNTOS = [
  "Informacion general",
  "Solicitar demo",
  "Soporte tecnico",
  "Derechos de datos personales",
  "Facturacion y pagos",
  "Otro",
];

export default function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [asunto, setAsunto] = useState(ASUNTOS[0]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);

    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, asunto, mensaje }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultado({ ok: true, msg: "Mensaje enviado correctamente. Te responderemos pronto." });
        setNombre("");
        setEmail("");
        setAsunto(ASUNTOS[0]);
        setMensaje("");
      } else {
        setResultado({ ok: false, msg: data.error ?? "Error al enviar el mensaje." });
      }
    } catch {
      setResultado({ ok: false, msg: "Error de conexion. Intenta de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-slate-700">Nombre completo</label>
          <input
            id="contact-name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Tu nombre"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium text-slate-700">Correo electronico</label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-asunto" className="text-sm font-medium text-slate-700">Asunto</label>
        <select
          id="contact-asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
        >
          {ASUNTOS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-mensaje" className="text-sm font-medium text-slate-700">Mensaje</label>
        <textarea
          id="contact-mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          required
          rows={5}
          placeholder="Describe tu consulta..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
        />
      </div>

      <p className="text-xs text-slate-500 -mt-1">
        Al enviar este formulario aceptas nuestra{" "}
        <a href="/privacidad" className="text-blue-600 hover:text-blue-700">politica de tratamiento de datos</a>.
      </p>

      {resultado && (
        <div className={`px-4 py-3 rounded-xl text-sm ${resultado.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {resultado.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="self-start inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
      >
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {enviando ? "Enviando..." : "Enviar mensaje"}
      </button>
    </form>
  );
}
