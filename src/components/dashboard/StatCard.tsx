import { LucideIcon } from "lucide-react";

/**
 * Tarjeta de cifra del dashboard — sistema Vivo/Aizome.
 *
 * PLANA, con línea fina. No lleva la sombra dura de 4px y no es un descuido:
 * la sombra se reserva para lo que se pulsa (botón, pastilla accionable). Esto
 * es superficie de datos —una cifra, no un control—, y en pantalla hay cuatro
 * a la vez, encima de paneles que también son superficie. Cuatro sombras duras
 * en fila hacen vibrar la zona más importante de la pantalla.
 *
 * Tampoco lleva ya `hover:shadow-sm`: una sombra difuminada al pasar por
 * encima prometía una interacción que no existe (la tarjeta no es un enlace) y
 * era, además, el gesto del lenguaje viejo que este cambio retira.
 *
 * La usan también /directivo, /super-admin y reportes/evidencias: los props
 * (icono + clases de color) no cambian, así que esas pantallas heredan el
 * aspecto nuevo sin tocarlas.
 */

interface StatCardProps {
  icon: LucideIcon;
  /** Clase Tailwind de color del icono, p. ej. "text-blue-600". */
  iconColor: string;
  /** Clase Tailwind de fondo del sello, p. ej. "bg-blue-50". */
  iconBg: string;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  sub?: string;
}

export default function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  trend,
  trendUp,
  sub,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-tarjeta border-[1.5px] border-linea p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Cejilla del sistema (.eyebrow de la landing): versalita índigo-neutra
              que marca «esto es la etiqueta, no el dato». Separa el rótulo del
              subtítulo sin necesidad de dos grises casi iguales. */}
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gris leading-tight mb-2">
            {label}
          </p>
          {/* La cifra es el héroe: tinta sobre blanco (18.7:1) y tabular-nums
              para que al refrescarse no bailen las columnas de dígitos. */}
          <div className="text-[28px] leading-none font-extrabold tracking-[-0.03em] text-tinta tabular-nums">
            {value}
          </div>
          {sub && (
            <p className="text-xs font-medium text-gris mt-1.5 leading-snug">{sub}</p>
          )}
        </div>
        {/* Sello del icono: relleno pastel que trae quien la usa + hilo de tinta
            al 10 %. El hilo es lo que lo vuelve un objeto dibujado (Aizome) en
            vez de una mancha de color, y funciona sobre cualquier pastel. */}
        <div
          className={`w-10 h-10 rounded-[11px] border-[1.5px] border-tinta/10 ${iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.25} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {/* Verde y rojo intactos: aquí ya significan mejora y caída. */}
          <span
            className={`text-xs font-bold tabular-nums ${trendUp ? "text-green-600" : "text-red-500"}`}
          >
            {trend}
          </span>
        </div>
      )}
    </div>
  );
}
