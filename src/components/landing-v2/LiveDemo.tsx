"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Check, MapPin, Receipt, TriangleAlert } from "lucide-react";

/**
 * Demo viva del hero, EN CÓDIGO (nunca video). v2.1: cuatro secuencias rotando
 * en loop — ① aprobar evidencia · ② se registra un gasto · ③ llega un reporte ·
 * ④ se crea un proyecto — con transición de fade entre ellas, dots indicadores
 * y pausa al hacer hover. El panel derecho lleva la doble barra reportado
 * (azul) vs. aprobado (verde), como la app. Con prefers-reduced-motion se
 * pinta el estado final estático de la secuencia ①.
 */

/** Las 48 unidades del mini-armado de la secuencia ④ (8 pisos × 6 unidades). */
const UNIDADES = Array.from({ length: 48 });

export default function LiveDemo() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const el = root.current;
      if (!el || !contextSafe) return;
      const get = (sel: string) => el.querySelector(sel) as HTMLElement;

      const frame = get('[data-d="frame"]');
      const esc = get('[data-d="esc"]');
      const th = get('[data-d="th"]');
      const metaPin = get('[data-d="metaPin"]');
      const metaTxt = get('[data-d="metaTxt"]');
      const pill = get('[data-d="pill"]');
      const btn = get('[data-d="btn"]');
      const cur = get('[data-d="cursor"]');
      const toast = get('[data-d="toast"]');
      const toastTxt = get('[data-d="toastTxt"]');
      const st = get('[data-d="status"]');
      const stTxt = get('[data-d="statusTxt"]');
      const alarma = get('[data-d="alarma"]');
      const alarmaTxt = get('[data-d="alarmaTxt"]');
      const kA = get('[data-d="kA"]');
      const kR = get('[data-d="kR"]');
      const kB = get('[data-d="kB"]');
      const kS = get('[data-d="kS"]');
      const fila = get('[data-d="fila"]');
      const filaGasto = get('[data-d="filaGasto"]');
      const monto = get('[data-d="monto"]');
      const filaReporte = get('[data-d="filaReporte"]');
      const crea = get('[data-d="crea"]');
      const creaNom = get('[data-d="creaNom"]');
      const creaMeta = get('[data-d="creaMeta"]');
      const unidades = Array.from(el.querySelectorAll<HTMLElement>(".crea-grid .und"));
      const dots = Array.from(el.querySelectorAll<HTMLElement>(".ddot"));

      const setDot = (i: number) => dots.forEach((d, j) => d.classList.toggle("on", j === i));
      const plata = { v: 268 };

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        // Estado final estático de la secuencia ① (sin rotación de secuencias)
        th.classList.add("on");
        metaPin.classList.remove("oculta");
        metaTxt.textContent = "GPS verificado · hoy 10:42 a. m.";
        pill.textContent = "Aprobada";
        pill.classList.add("ok");
        st.classList.add("ok");
        stTxt.textContent = "Aprobada — historial guardado";
        alarma.classList.add("ok");
        alarmaTxt.textContent = "Anticipo sustentado — quedan $29M por revisar";
        kA.textContent = "64%";
        kB.style.width = "64%";
        kS.textContent = "$281M";
        return;
      }

      /** Estado base = arranque de la secuencia ① (también corre en cada loop). */
      const reset = () => {
        setDot(0);
        th.classList.remove("on");
        metaPin.classList.add("oculta");
        metaTxt.textContent = "esperando reporte…";
        pill.textContent = "Pendiente";
        pill.classList.remove("ok", "rep");
        btn.classList.remove("lista");
        toast.classList.remove("on");
        st.classList.remove("ok");
        stTxt.textContent = "Obrero reportando…";
        alarma.classList.remove("ok");
        alarmaTxt.textContent = "$42M sin sustentar — 3 anticipos";
        kA.textContent = "63%";
        kR.style.width = "71%";
        kB.style.width = "63%";
        kS.textContent = "$268M";
        plata.v = 268;
        fila.classList.remove("foco");
        filaGasto.classList.remove("res");
        monto.textContent = "";
        filaReporte.classList.remove("res");
        crea.classList.remove("on");
        gsap.set([filaGasto, filaReporte], { clearProps: "opacity,transform" });
        cur.style.left = "76%";
        cur.style.top = "82%";
      };

      reset();

      /** Fade del contenido del frame entre secuencias + preparación de la que sigue. */
      const transicion = (dot: number, prep: () => void) => {
        const t = gsap.timeline();
        t.to(esc, { opacity: 0, duration: 0.28, ease: "power1.in" });
        t.add(() => {
          setDot(dot);
          toast.classList.remove("on");
          prep();
        });
        t.to(esc, { opacity: 1, duration: 0.32, ease: "power1.out" });
        return t;
      };

      /** ① Aprobar evidencia: foto + GPS → cursor aprueba → toast → plata al día. */
      const seq1 = () => {
        const t = gsap.timeline();
        t.add(() => {
          th.classList.add("on");
          metaPin.classList.remove("oculta");
          metaTxt.textContent = "GPS verificado · hoy 10:42 a. m.";
          stTxt.textContent = "Foto recibida — GPS verificado";
          fila.classList.add("foco");
        }, 1.1);
        t.add(() => {
          pill.textContent = "Reportada";
          pill.classList.add("rep");
        }, 1.5);
        t.add(() => {
          const r = btn.getBoundingClientRect();
          const d = frame.getBoundingClientRect();
          cur.style.left = ((r.left + r.width / 2 - d.left) / d.width) * 100 + "%";
          cur.style.top = ((r.top + r.height / 2 - d.top) / d.height) * 100 + "%";
        }, 2.3);
        t.add(() => {
          btn.classList.add("click");
          gsap.delayedCall(0.6, () => btn.classList.remove("click"));
        }, 3.4);
        t.add(() => {
          pill.textContent = "Aprobada";
          pill.classList.remove("rep");
          pill.classList.add("ok");
          // El botón desaparece: una tarea aprobada ya no se puede aprobar.
          btn.classList.add("lista");
          toastTxt.textContent = "Evidencia aprobada — Estuco alcoba 2";
          toast.classList.add("on");
          st.classList.add("ok");
          stTxt.textContent = "Aprobada — historial guardado";
          kA.textContent = "64%";
        }, 3.7);
        t.to(kB, { width: "64%", duration: 0.6, ease: "power2.out" }, 3.7);
        // Primero cambia el color (verde) y un instante después el texto:
        // evita el fotograma "check verde sobre alarma roja" a mitad de transición.
        t.add(() => {
          alarma.classList.add("ok");
        }, 4.6);
        t.add(() => {
          kS.textContent = "$281M";
          alarmaTxt.textContent = "Anticipo sustentado — quedan $29M por revisar";
        }, 4.85);
        t.add(() => {
          toast.classList.remove("on");
          fila.classList.remove("foco");
        }, 6.3);
        t.to({}, { duration: 0.7 }); // respiro
        return t;
      };

      /** ② Se registra un gasto: fila nueva, monto tipeándose, la plata se actualiza. */
      const prep2 = () => {
        st.classList.remove("ok");
        stTxt.textContent = "Registrando gasto…";
        filaGasto.classList.add("res");
      };
      const seq2 = () => {
        const t = gsap.timeline();
        t.fromTo(
          filaGasto,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false },
          0.4
        );
        "$4.2M".split("").forEach((c, i) => {
          t.add(() => {
            monto.textContent += c;
          }, 1.0 + i * 0.13);
        });
        t.add(() => {
          toastTxt.textContent = "Gasto registrado — $4.2M · Ferretería El Punto";
          toast.classList.add("on");
        }, 2.1);
        t.to(
          plata,
          {
            v: 272.2,
            duration: 0.9,
            ease: "power1.out",
            onUpdate: () => {
              kS.textContent = `$${plata.v.toFixed(1).replace(/\.0$/, "")}M`;
            },
          },
          2.5
        );
        t.add(() => {
          st.classList.add("ok");
          stTxt.textContent = "Plata al día — factura adjunta";
        }, 3.0);
        t.add(() => toast.classList.remove("on"), 4.9);
        t.to({}, { duration: 0.7 });
        return t;
      };

      /** ③ Llega un reporte: fila nueva reportada y la barra azul sube. */
      const prep3 = () => {
        st.classList.remove("ok");
        stTxt.textContent = "Reporte entrando…";
        filaReporte.classList.add("res");
      };
      const seq3 = () => {
        const t = gsap.timeline();
        t.fromTo(
          filaReporte,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false },
          0.6
        );
        t.to(kR, { width: "73%", duration: 0.6, ease: "power2.out" }, 1.5);
        t.add(() => {
          toastTxt.textContent = "Nuevo avance por revisar — Apto 108";
          toast.classList.add("on");
        }, 1.7);
        t.add(() => toast.classList.remove("on"), 4.4);
        t.to({}, { duration: 0.7 });
        return t;
      };

      /** ④ Se crea un proyecto: nombre tipeado + torres/pisos armándose. */
      const prep4 = () => {
        st.classList.remove("ok");
        stTxt.textContent = "Creando proyecto…";
        crea.classList.add("on");
        creaNom.textContent = "";
        creaMeta.classList.remove("on");
        gsap.set(unidades, { opacity: 0, scale: 0.4 });
      };
      const seq4 = () => {
        const t = gsap.timeline();
        "Torre 2".split("").forEach((c, i) => {
          t.add(() => {
            creaNom.textContent += c;
          }, 0.4 + i * 0.11);
        });
        t.to(
          unidades,
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            ease: "back.out(2)",
            stagger: { each: 0.02, from: "end" },
          },
          1.5
        );
        t.add(() => creaMeta.classList.add("on"), 2.9);
        t.add(() => {
          toastTxt.textContent = "Proyecto creado — Torre 2 · 8 pisos · 48 unidades";
          toast.classList.add("on");
        }, 3.3);
        t.add(() => {
          st.classList.add("ok");
          stTxt.textContent = "Listo para asignar tareas";
        }, 3.8);
        t.add(() => toast.classList.remove("on"), 5.6);
        t.to({}, { duration: 0.6 });
        return t;
      };

      const tl = gsap.timeline({ repeat: -1, onRepeat: reset });
      tl.fromTo(esc, { opacity: 0 }, { opacity: 1, duration: 0.32, ease: "power1.out" });
      tl.add(seq1());
      tl.add(transicion(1, prep2));
      tl.add(seq2());
      tl.add(transicion(2, prep3));
      tl.add(seq3());
      tl.add(transicion(3, prep4));
      tl.add(seq4());
      tl.to(esc, { opacity: 0, duration: 0.28, ease: "power1.in" });

      // Pausa en hover + pausa fuera de viewport (ahorra CPU y batería)
      let hover = false;
      let visible = true;
      const onEnter = contextSafe(() => {
        hover = true;
        tl.pause();
      });
      const onLeave = contextSafe(() => {
        hover = false;
        if (visible) tl.play();
      });
      frame.addEventListener("mouseenter", onEnter);
      frame.addEventListener("mouseleave", onLeave);
      const io = new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
          if (!visible) tl.pause();
          else if (!hover) tl.play();
        },
        { threshold: 0.2 }
      );
      io.observe(frame);

      return () => {
        frame.removeEventListener("mouseenter", onEnter);
        frame.removeEventListener("mouseleave", onLeave);
        io.disconnect();
      };
    },
    { scope: root }
  );

  return (
    <div className="demo" ref={root}>
      <div className="demo-frame" data-d="frame">
        <div className="demo-top">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="demo-url">app.seiricon.com — Torre 1</span>
          <span className="status" data-d="status">
            <span className="led"></span>
            <span data-d="statusTxt">Obrero reportando…</span>
          </span>
        </div>
        <div className="demo-body" data-d="esc">
          <div className="panel-izq">
            <div className="ph4">Tareas de hoy · Torre 1</div>

            {/* fila de gasto — solo secuencia ② */}
            <div className="trow extra" data-d="filaGasto">
              <span className="th th-ic" aria-hidden="true">
                <Receipt size={16} strokeWidth={2.2} />
              </span>
              <div>
                <b>Ferretería El Punto</b>
                <small>factura adjunta · hoy 11:02 a. m.</small>
              </div>
              <span className="monto" data-d="monto"></span>
            </div>

            {/* fila de reporte entrante — solo secuencia ③ */}
            <div className="trow extra" data-d="filaReporte">
              <span className="th th-f2c fijo" aria-hidden="true">
                <Image src="/landing/fotos/f2-manos-panete.jpg" alt="" width={120} height={180} />
              </span>
              <div>
                <b>Pañete muro sur — Apto 108</b>
                <small>
                  <MapPin className="ico-meta" aria-hidden="true" />
                  GPS verificado · hoy 11:05 a. m.
                </small>
              </div>
              <span className="estado-pill rep">Reportada</span>
            </div>

            {/* fila protagonista — secuencia ① */}
            <div className="trow" data-d="fila">
              <span className="th th-f2" data-d="th" aria-hidden="true">
                <Image src="/landing/fotos/f2-manos-panete.jpg" alt="" width={80} height={120} />
              </span>
              <div>
                <b>Estuco alcoba 2 — Apto 302</b>
                <small>
                  <MapPin className="ico-meta oculta" data-d="metaPin" aria-hidden="true" />
                  <span data-d="metaTxt">esperando reporte…</span>
                </small>
              </div>
              <span className="estado-pill" data-d="pill">
                Pendiente
              </span>
              <span className="btn-aprobar" data-d="btn" aria-hidden="true">
                Aprobar
                <span className="anillo"></span>
              </span>
            </div>

            <div className="trow">
              <span className="th th-shot fijo" aria-hidden="true">
                <Image
                  src="/landing/capturas/shot-tarea-evidencia.png"
                  alt=""
                  width={365}
                  height={228}
                />
              </span>
              <div>
                <b>Enchape baño ppal — Apto 504</b>
                <small>
                  <MapPin className="ico-meta" aria-hidden="true" />
                  GPS · hoy 9:12 a. m.
                </small>
              </div>
              <span className="estado-pill ok">Aprobada</span>
            </div>
            <div className="trow">
              <span className="th th-f2b fijo" aria-hidden="true">
                <Image src="/landing/fotos/f2-manos-panete.jpg" alt="" width={60} height={90} />
              </span>
              <div>
                <b>Pintura fachada norte — T2</b>
                <small>
                  <MapPin className="ico-meta" aria-hidden="true" />
                  GPS · hoy 8:03 a. m.
                </small>
              </div>
              <span className="estado-pill ok">Aprobada</span>
            </div>

            {/* overlay secuencia ④ — se crea un proyecto */}
            <div className="crea" data-d="crea" aria-hidden="true">
              <div className="ph4">Nuevo proyecto</div>
              <div className="crea-nombre">
                <span data-d="creaNom"></span>
                <i className="caret"></i>
              </div>
              <div className="crea-grid" data-d="creaGrid">
                {UNIDADES.map((_, i) => (
                  <span key={i} className="und"></span>
                ))}
              </div>
              <small className="crea-meta" data-d="creaMeta">
                8 pisos · 48 unidades
              </small>
            </div>
          </div>

          <div className="panel-der">
            <div className="ph4">La obra, ahora</div>
            <div className="krow">
              <span>Avance aprobado</span>
              <b data-d="kA">63%</b>
            </div>
            {/* doble barra como la app: azul = reportado, verde = aprobado */}
            <div className="kbar dual">
              <i className="rep" data-d="kR" style={{ width: "71%" }}></i>
              <i className="apr" data-d="kB" style={{ width: "63%" }}></i>
            </div>
            <div className="kley" aria-hidden="true">
              <span>
                <i className="lg rep"></i>Reportado
              </span>
              <span>
                <i className="lg apr"></i>Aprobado
              </span>
            </div>
            <div className="krow">
              <span>Entregado a contratistas</span>
              <b>$310M</b>
            </div>
            <div className="krow">
              <span>Sustentado con factura</span>
              <b style={{ color: "var(--verde)" }} data-d="kS">
                $268M
              </b>
            </div>
            <div className="alarma-d" data-d="alarma">
              <TriangleAlert className="al-ic warn" size={15} aria-hidden="true" />
              <Check className="al-ic okk" size={15} strokeWidth={3} aria-hidden="true" />
              <span data-d="alarmaTxt">$42M sin sustentar — 3 anticipos</span>
            </div>
          </div>
        </div>
        <div className="toast" data-d="toast">
          <Check size={13} strokeWidth={3} aria-hidden="true" />
          <span data-d="toastTxt">Evidencia aprobada — Estuco alcoba 2</span>
        </div>
        <div className="cursor" data-d="cursor" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M2 1 L2 14 L6 11 L8.5 16.5 L11 15.3 L8.6 10 L13.5 9.6 Z"
              fill="#0F172A"
              stroke="#fff"
              strokeWidth="1.3"
            />
          </svg>
        </div>
      </div>
      {/* indicador sutil de secuencia */}
      <div className="demo-dots" aria-hidden="true">
        <span className="ddot on"></span>
        <span className="ddot"></span>
        <span className="ddot"></span>
        <span className="ddot"></span>
      </div>
    </div>
  );
}
