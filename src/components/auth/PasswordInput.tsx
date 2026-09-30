"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

/**
 * Campo de contraseña con botón «ojito» para mostrar u ocultar lo escrito.
 *
 * Existe aparte del `PasswordField` del registro por una diferencia que importa:
 * aquel es CONTROLADO (value + onChange) porque el wizard necesita el valor en
 * React para validar que las dos contraseñas coincidan. El login, en cambio, es
 * un Server Component cuyo formulario se envía con una Server Action: si el
 * input fuera controlado haría falta subir estado a un componente cliente y
 * envolver todo el formulario. Este es NO controlado — el navegador conserva el
 * valor y la Server Action lo lee del FormData por su `name`, igual que antes.
 *
 * Lo único que vive en el cliente es si se ve o no el texto.
 */
export default function PasswordInput({
  id = "password",
  name = "password",
  autoComplete = "current-password",
  placeholder = "••••••••",
  required = true,
  minLength,
}: {
  id?: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        // pr-11 (no pr-4): deja sitio al botón para que no tape los últimos
        // caracteres cuando la contraseña está visible.
        className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-500 rounded cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
