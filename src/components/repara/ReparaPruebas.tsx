import { Camera, Link2, Receipt } from "lucide-react";
// Reveal compartido con /beta a propósito (ver D8 del spec, mismo comentario que
// en ReparaMiedo.tsx).
import Reveal from "@/components/beta/Reveal";

// Los tres mecanismos que YA existen en el producto: evidencia con overlay
// (foto + fecha/hora/GPS), anticipos vs. gastos sustentados con factura, y el
// link público de transparencia. Nada aquí es una promesa a futuro.
const pruebas = [
  {
    icon: Camera,
    color: "bg-blue-600",
    titulo: "Nada se da por hecho sin foto",
    texto:
      "Cada trabajo se cierra con una foto que trae quemados la fecha, la hora y la ubicación. No es «ya quedó, señora»: es la prueba de que estuvo ahí, ese día, en su casa.",
  },
  {
    icon: Receipt,
    color: "bg-orange-500",
    titulo: "No pagas sin factura",
    texto:
      "La plata que entregas queda registrada como anticipo, y cada gasto tiene que sustentarse con la foto de la factura. Si entregaste dos millones y solo hay setecientos mil sustentados, la app te lo muestra en rojo. Sin discusiones ni cuentas de servilleta.",
  },
  {
    icon: Link2,
    color: "bg-violet-600",
    titulo: "Un link para verlo todo desde donde estés",
    texto:
      "Le pasas un link a quien tiene que ver el avance: tu mamá, tu hermano, tu arrendatario. Entra sin cuenta y sin contraseña, ve las fotos y el porcentaje real. Y el día que ya no quieras que lo vea, lo apagas.",
  },
];

export default function ReparaPruebas() {
  return (
    <section className="bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mb-10 text-center sm:mb-14">
          <h2 data-reveal className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Tres pruebas que cambian quién tiene el control
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 sm:grid-cols-3" stagger={0.12}>
          {pruebas.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.titulo}
                data-reveal
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${p.color} shadow-sm`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900">{p.titulo}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{p.texto}</p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
