import { Metadata } from "next";
import { Target, Eye, Heart, ShieldCheck, Zap, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Sobre Nosotros — Seiricon",
  description: "Conoce la mision, vision y valores de Seiricon.",
};

const valores = [
  {
    icon: ShieldCheck,
    titulo: "Transparencia",
    descripcion: "Cada tarea, foto y aprobacion queda registrada. Sin ambiguedades, sin excusas. La evidencia habla.",
  },
  {
    icon: Zap,
    titulo: "Eficiencia",
    descripcion: "Menos papel, menos llamadas, menos reprocesos. Mas obra terminada a tiempo y con calidad.",
  },
  {
    icon: Users,
    titulo: "Colaboracion",
    descripcion: "Conectamos a administradores, contratistas y obreros en un solo flujo de trabajo claro y ordenado.",
  },
  {
    icon: Heart,
    titulo: "Compromiso con Colombia",
    descripcion: "Construido desde Colombia, para la realidad de nuestras obras. Entendemos el terreno porque lo vivimos.",
  },
];

export default function NosotrosPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">Sobre Seiricon</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Somos una empresa de tecnologia colombiana que transforma la manera en que las constructoras
          gestionan sus proyectos de obra blanca y carpinteria.
        </p>
      </div>

      {/* Mision y Vision */}
      <div className="grid sm:grid-cols-2 gap-6 mb-16">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 sm:p-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Mision</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Empoderar a las constructoras colombianas con herramientas digitales que les permitan controlar
            cada detalle de sus proyectos de acabados, reducir reprocesos, generar evidencia verificable
            y tomar decisiones informadas en tiempo real — llevando orden, trazabilidad y profesionalismo
            a cada obra.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 sm:p-8">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Vision</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Ser la plataforma lider en gestion de acabados de construccion en Latinoamerica para 2030,
            reconocida por elevar los estandares de calidad, transparencia y eficiencia en la industria,
            y por ser el aliado tecnologico indispensable de toda constructora que busque la excelencia
            operativa.
          </p>
        </div>
      </div>

      {/* Valores */}
      <div className="mb-16">
        <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-8">Nuestros Valores</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {valores.map((valor) => (
            <div key={valor.titulo} className="flex gap-4 p-5 rounded-xl bg-white border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <valor.icon className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">{valor.titulo}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{valor.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* El problema */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-10 text-white mb-16">
        <h2 className="text-xl font-bold mb-4">El Problema que Resolvemos</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          En Colombia, la gestion de acabados de construccion todavia depende de cuadernos, hojas de Excel,
          fotos en WhatsApp y la palabra del contratista. Esto genera:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-white/10 rounded-xl px-4 py-3">Falta de evidencia verificable sobre el avance real</div>
          <div className="bg-white/10 rounded-xl px-4 py-3">Reprocesos costosos por aprobaciones informales</div>
          <div className="bg-white/10 rounded-xl px-4 py-3">Retrasos sin justificacion documentada</div>
          <div className="bg-white/10 rounded-xl px-4 py-3">Pago a contratistas sin metricas objetivas</div>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mt-4">
          <strong className="text-white">Seiricon elimina estas fricciones</strong> con un sistema donde cada tarea tiene
          evidencia fotografica con GPS y timestamp, cada aprobacion queda registrada, y cada contratista
          tiene un score de desempeno objetivo y transparente.
        </p>
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-slate-900 mb-3">Quieres llevar orden a tu obra?</h2>
        <p className="text-slate-600 text-sm mb-6">Crea tu cuenta gratis y empieza a controlar tu proyecto hoy.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/registro"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Crear cuenta gratis
          </a>
          <a
            href="/contacto"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-sm"
          >
            Contactanos
          </a>
        </div>
      </div>
    </div>
  );
}
