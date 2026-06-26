"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  FileText,
  User,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Check,
  Home,
  Compass,
  ChevronRight,
} from "lucide-react";
import { registro, loginConGoogle } from "../actions";

const INPUT_CLS =
  "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400";

type Perfil = "PROPIETARIO" | "CONTRATISTA" | "CONSTRUCTORA";

const PERFILES: {
  key: Perfil;
  icon: typeof Home;
  titulo: string;
  desc: string;
  acento: string;
}[] = [
  {
    key: "PROPIETARIO",
    icon: Home,
    titulo: "Gestiono mi propia obra",
    desc: "Remodelo o construyo mi vivienda y superviso a los obreros que contrato.",
    acento: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    key: "CONTRATISTA",
    icon: Compass,
    titulo: "Soy contratista",
    desc: "Eres arquitecto o tienes un negocio de pintura, instalación eléctrica, cocinas, carpintería… y envías a tu personal a ejecutar trabajos donde tus clientes.",
    acento: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    key: "CONSTRUCTORA",
    icon: Building2,
    titulo: "Soy una empresa constructora",
    desc: "Gestiono varios proyectos con equipo, contratistas y obreros.",
    acento: "text-slate-700 bg-slate-100 border-slate-200",
  },
];

export default function RegistroWizard({ error }: { error?: string }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [step, setStep] = useState(1);

  // Step empresa (solo CONSTRUCTORA)
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [empresaNit, setEmpresaNit] = useState("");
  const [empresaDireccion, setEmpresaDireccion] = useState("");
  const [empresaCiudad, setEmpresaCiudad] = useState("");
  const [empresaTelefono, setEmpresaTelefono] = useState("");
  const [empresaSitioWeb, setEmpresaSitioWeb] = useState("");

  // Personal (contratista B2C): nombre del negocio
  const [estudioNombre, setEstudioNombre] = useState("");

  // Cuenta (todos)
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);

  const esPersonal = perfil === "PROPIETARIO" || perfil === "CONTRATISTA";
  const canProceed1 = empresaNombre.trim().length >= 1;

  function elegirPerfil(p: Perfil) {
    setPerfil(p);
    setStep(1);
  }

  function handleNextEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (canProceed1) setStep(2);
  }

  async function handleSubmit(formData: FormData) {
    formData.set("tipo_cuenta", perfil ?? "CONSTRUCTORA");
    if (perfil === "CONSTRUCTORA") {
      formData.set("company", empresaNombre);
      formData.set("empresa_nit", empresaNit);
      formData.set("empresa_direccion", empresaDireccion);
      formData.set("empresa_ciudad", empresaCiudad);
      formData.set("empresa_telefono", empresaTelefono);
      formData.set("empresa_sitio_web", empresaSitioWeb);
    } else if (perfil === "CONTRATISTA") {
      formData.set("estudio_nombre", estudioNombre);
    }
    await registro(formData);
  }

  // ── Paso 0: selección de perfil ───────────────────────────────────────────
  if (!perfil) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">¿Cómo usarás Seiricon?</h2>
          <p className="text-sm text-slate-500">Selecciona el perfil que mejor te describe; adaptamos la plataforma a tu caso.</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {PERFILES.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => elegirPerfil(p.key)}
                className="group flex items-center gap-4 text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${p.acento}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">{p.titulo}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Inicia sesión
          </Link>
        </p>
      </>
    );
  }

  // ── Flujo PERSONAL (contratista B2C / propietario): un solo paso ───────────
  if (esPersonal) {
    return (
      <>
        <BackToPicker onClick={() => setPerfil(null)} />

        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">
            {perfil === "CONTRATISTA" ? "Crea tu cuenta de contratista" : "Crea tu cuenta"}
          </h2>
          <p className="text-sm text-slate-500">
            {perfil === "CONTRATISTA"
              ? "En unos minutos tendrás tu cuenta lista. El resto lo configuramos juntos."
              : "Solo lo esencial. Tu primera obra la creamos en cuanto ingreses."}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Field id="name" name="name" label="Tu nombre" required icon={User} placeholder="Juan Pérez" value={nombre} onChange={setNombre} autoFocus />

          {perfil === "CONTRATISTA" && (
            <Field
              id="estudio_nombre"
              label="Nombre del negocio"
              icon={Building2}
              placeholder="Pinturas Pérez (opcional)"
              value={estudioNombre}
              onChange={setEstudioNombre}
            />
          )}

          <Field id="email" name="email" type="email" label="Correo electrónico" required icon={Mail} placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" />
          <Field id="password" name="password" type="password" label="Contraseña" required icon={Lock} placeholder="Mínimo 6 caracteres" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />

          <ConsentCheckbox consent={consent} setConsent={setConsent} />

          <button
            type="submit"
            className="mt-1 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
          >
            Crear cuenta y empezar
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </>
    );
  }

  // ── Flujo EMPRESA (CONSTRUCTORA): 2 pasos como antes ───────────────────────
  const steps = [
    { num: 1, label: "Tu empresa" },
    { num: 2, label: "Tu cuenta" },
  ];

  return (
    <>
      <BackToPicker onClick={() => { setPerfil(null); setStep(1); }} />

      {/* Stepper indicator */}
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.num
                    ? "bg-blue-600 text-white"
                    : step > s.num
                      ? "bg-green-500 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? "text-slate-800" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleNextEmpresa} className="flex flex-col gap-4">
          <Field id="empresa_nombre" label="Nombre de la empresa" required icon={Building2} placeholder="Constructora ABC" value={empresaNombre} onChange={setEmpresaNombre} autoFocus />
          <Field id="empresa_nit" label="NIT" icon={FileText} placeholder="900.123.456-7" value={empresaNit} onChange={setEmpresaNit} />
          <Field id="empresa_direccion" label="Dirección" icon={MapPin} placeholder="Calle 100 #15-20" value={empresaDireccion} onChange={setEmpresaDireccion} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="empresa_ciudad" label="Ciudad" icon={MapPin} placeholder="Bogotá" value={empresaCiudad} onChange={setEmpresaCiudad} />
            <Field id="empresa_telefono" type="tel" label="Teléfono" icon={Phone} placeholder="301 234 5678" value={empresaTelefono} onChange={setEmpresaTelefono} />
          </div>
          <Field id="empresa_sitio_web" type="url" label="Sitio web" icon={Globe} placeholder="https://constructora-abc.co" value={empresaSitioWeb} onChange={setEmpresaSitioWeb} />

          <button
            type="submit"
            disabled={!canProceed1}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
          >
            Siguiente
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {step === 2 && (
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Field id="name" name="name" label="Nombre completo" required icon={User} placeholder="Juan Pérez" value={nombre} onChange={setNombre} autoComplete="name" autoFocus />
          <Field id="email" name="email" type="email" label="Correo electrónico" required icon={Mail} placeholder="tu@constructora.co" value={email} onChange={setEmail} autoComplete="email" />
          <Field id="password" name="password" type="password" label="Contraseña" required icon={Lock} placeholder="Mínimo 6 caracteres" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />

          <ConsentCheckbox consent={consent} setConsent={setConsent} />

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-5 rounded-xl transition-colors text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Crear cuenta
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* "Continuar con Google" SOLO en el flujo de empresa: el callback de
              OAuth provisiona como CONSTRUCTORA por defecto. Ofrecerlo en los
              perfiles personales (Propietario/Contratista B2C) crearía el tipo de
              cuenta equivocado y perdería el perfil personal. */}
          <GoogleDivider />
          <GoogleButton />
        </form>
      )}
    </>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function BackToPicker({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Cambiar perfil
    </button>
  );
}

function Field({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  autoFocus,
  autoComplete,
  minLength,
}: {
  id: string;
  name?: string;
  label: string;
  icon: typeof User;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id={id}
          name={name ?? id}
          type={type}
          placeholder={placeholder}
          className={INPUT_CLS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          minLength={minLength}
        />
      </div>
    </div>
  );
}

function GoogleDivider() {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs text-slate-400">o continúa con</span>
      </div>
    </div>
  );
}

function GoogleButton() {
  return (
    <form action={loginConGoogle}>
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-colors text-sm cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continuar con Google
      </button>
    </form>
  );
}

function ConsentCheckbox({ consent, setConsent }: { consent: boolean; setConsent: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 -mt-1 cursor-pointer">
      <input
        type="checkbox"
        name="consent"
        required
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
      />
      <span className="text-xs text-slate-500">
        Autorizo el tratamiento de mis datos personales conforme a la{" "}
        <Link href="/privacidad" className="text-blue-600 hover:text-blue-700">
          Política de Tratamiento de Datos
        </Link>{" "}
        y acepto los{" "}
        <Link href="/terminos" className="text-blue-600 hover:text-blue-700">
          Términos y Condiciones
        </Link>
        .
      </span>
    </label>
  );
}
