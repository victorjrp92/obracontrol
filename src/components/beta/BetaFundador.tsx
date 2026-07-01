// import Image from "next/image"; // TODO Victor: descomenta al poner tu foto real
import Reveal from "./Reveal";

// Bloque de confianza / fundador. Va entre BetaOffer y BetaForm para que, justo
// antes de pedir el registro, el prospecto vea que detrás hay una persona real
// y un beta honesto (pocos cupos, acompañamiento por WhatsApp).
export default function BetaFundador() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div
            data-reveal
            className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-10"
          >
            <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Un beta honesto: apenas arrancamos
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-center text-base leading-relaxed text-slate-600 sm:text-lg">
              {/* TODO Victor: tu nombre y foto */}
              Soy [Tu nombre], fundador de Seiricon. Nació de ver a dueños y
              contratistas cruzando la ciudad para revisar una obra que a veces ni
              avanzó. Estamos empezando de cero y por eso abrimos solo 16 cupos:
              quiero acompañar a cada uno personalmente por WhatsApp y construir la
              app con tu feedback real. Hecho en Colombia, para obras colombianas.
            </p>

            {/* Firma: foto real + nombre */}
            <div className="mt-8 flex flex-col items-center gap-3">
              {/*
                TODO Victor: reemplaza el avatar de iniciales por tu foto real.
                Pon la imagen en /public (p. ej. /public/victor.jpg) y descomenta:

                <Image
                  src="/victor.jpg"
                  alt="Foto de [Tu nombre], fundador de Seiricon"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover shadow-sm"
                />
              */}
              <div
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-extrabold text-white shadow-sm"
              >
                {/* TODO Victor: tus iniciales */}
                V
              </div>
              <div className="text-center">
                {/* TODO Victor: tu nombre y cargo */}
                <p className="text-sm font-bold text-slate-900">[Tu nombre]</p>
                <p className="text-xs text-slate-500">Fundador de Seiricon</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
