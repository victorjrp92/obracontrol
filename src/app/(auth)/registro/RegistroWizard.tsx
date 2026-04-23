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
} from "lucide-react";
import { registro } from "../actions";

const INPUT_CLS =
  "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400";

export default function RegistroWizard({ error }: { error?: string }) {
  const [step, setStep] = useState(1);

  // Step 1 — empresa
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [empresaNit, setEmpresaNit] = useState("");
  const [empresaDireccion, setEmpresaDireccion] = useState("");
  const [empresaCiudad, setEmpresaCiudad] = useState("");
  const [empresaTelefono, setEmpresaTelefono] = useState("");
  const [empresaSitioWeb, setEmpresaSitioWeb] = useState("");

  // Step 2 — usuario
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);

  const canProceed1 = empresaNombre.trim().length >= 1;

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (canProceed1) setStep(2);
  }

  function handleBack() {
    setStep(1);
  }

  async function handleSubmit(formData: FormData) {
    // Inject step 1 data that lives in client state
    formData.set("company", empresaNombre);
    formData.set("empresa_nit", empresaNit);
    formData.set("empresa_direccion", empresaDireccion);
    formData.set("empresa_ciudad", empresaCiudad);
    formData.set("empresa_telefono", empresaTelefono);
    formData.set("empresa_sitio_web", empresaSitioWeb);
    await registro(formData);
  }

  const steps = [
    { num: 1, label: "Tu empresa" },
    { num: 2, label: "Tu cuenta" },
  ];

  return (
    <>
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
              <span
                className={`text-sm font-medium ${
                  step >= s.num ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-slate-300" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* ── Step 1: Empresa ────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="empresa_nombre" className="text-sm font-medium text-slate-700">
              Nombre de la empresa <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="empresa_nombre"
                type="text"
                placeholder="Constructora ABC"
                className={INPUT_CLS}
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="empresa_nit" className="text-sm font-medium text-slate-700">
              NIT
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="empresa_nit"
                type="text"
                placeholder="900.123.456-7"
                className={INPUT_CLS}
                value={empresaNit}
                onChange={(e) => setEmpresaNit(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="empresa_direccion" className="text-sm font-medium text-slate-700">
              Direccion
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="empresa_direccion"
                type="text"
                placeholder="Calle 100 #15-20"
                className={INPUT_CLS}
                value={empresaDireccion}
                onChange={(e) => setEmpresaDireccion(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="empresa_ciudad" className="text-sm font-medium text-slate-700">
                Ciudad
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="empresa_ciudad"
                  type="text"
                  placeholder="Bogota"
                  className={INPUT_CLS}
                  value={empresaCiudad}
                  onChange={(e) => setEmpresaCiudad(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="empresa_telefono" className="text-sm font-medium text-slate-700">
                Telefono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="empresa_telefono"
                  type="tel"
                  placeholder="301 234 5678"
                  className={INPUT_CLS}
                  value={empresaTelefono}
                  onChange={(e) => setEmpresaTelefono(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="empresa_sitio_web" className="text-sm font-medium text-slate-700">
              Sitio web
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="empresa_sitio_web"
                type="url"
                placeholder="https://constructora-abc.co"
                className={INPUT_CLS}
                value={empresaSitioWeb}
                onChange={(e) => setEmpresaSitioWeb(e.target.value)}
              />
            </div>
          </div>

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

      {/* ── Step 2: Cuenta ─────────────────────────────────────────────── */}
      {step === 2 && (
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Juan Perez"
                className={INPUT_CLS}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Correo electronico <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@constructora.co"
                className={INPUT_CLS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contrasena <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimo 6 caracteres"
                minLength={6}
                className={INPUT_CLS}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

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
                Politica de Tratamiento de Datos
              </Link>{" "}
              y acepto los{" "}
              <Link href="/terminos" className="text-blue-600 hover:text-blue-700">
                Terminos y Condiciones
              </Link>
              .
            </span>
          </label>

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-5 rounded-xl transition-colors text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Atras
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Crear cuenta
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </>
  );
}
