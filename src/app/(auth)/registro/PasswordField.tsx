"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, type LucideIcon } from "lucide-react";

const INPUT_CLS =
  "w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400";

/**
 * Campo de contraseña con icono de candado y botón "ojito" (mostrar/ocultar)
 * que alterna el `type` entre password y text (iconos Eye/EyeOff de lucide).
 *
 * Se usa en el registro para la contraseña y su confirmación. El `name` decide
 * qué viaja al backend: el campo principal usa `name="password"`; el de
 * confirmación NO lleva `name` (es solo validación de front y no se envía).
 */
export default function PasswordField({
  id,
  name,
  label,
  placeholder,
  value,
  onChange,
  required,
  autoFocus,
  autoComplete,
  minLength,
  icon: Icon = Lock,
  error,
}: {
  id: string;
  name?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  minLength?: number;
  icon?: LucideIcon;
  /** Mensaje de error a mostrar bajo el campo (p. ej. "no coinciden"). */
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          className={INPUT_CLS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
