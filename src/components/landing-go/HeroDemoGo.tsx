"use client";

import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Calendar,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  LayoutGrid,
  Lightbulb,
  MapPin,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import CursorGo from "./CursorGo";
import { moverCursor, useLoopGo } from "./useLoopGo";

/** Ítems reales del menú lateral de la app (mismos de sidebarItems). */
const MENU: { Icono: LucideIcon; txt: string; activo?: boolean }[] = [
  { Icono: LayoutGrid, txt: "Dashboard" },
  { Icono: Building2, txt: "Empresa" },
  { Icono: FolderOpen, txt: "Proyectos", activo: true },
  { Icono: ClipboardList, txt: "Tareas" },
  { Icono: Lightbulb, txt: "Sugerencias" },
  { Icono: ChartNoAxesColumn, txt: "Reportes" },
  { Icono: Users, txt: "Usuarios" },
  { Icono: Settings, txt: "Configuración" },
];

/**
 * Las 3 obras de la pantalla "Proyectos" de la app, con sus cifras reales.
 * Torres del Río es la protagonista de la demo: 512 tareas, 294 aprobadas.
 * Una aprobación mueve el avance UN punto (57 % → 58 %); esos números no se
 * exageran nunca.
 */
const PROYECTOS: {
  codigo: string;
  nombre: string;
  tipo: string;
  torres: string;
  unidades: string;
  fecha: string;
  tareas: string;
  pct: number;
  estado: string;
  tono: "ok" | "mal";
  foco?: boolean;
}[] = [
  {
    codigo: "CP-2026-003",
    nombre: "Casa Pance",
    tipo: "Casas",
    torres: "1 torre",
    unidades: "2 unidades",
    fecha: "ago de 2026",
    tareas: "12 tareas · 10 aprobadas",
    pct: 83,
    estado: "A tiempo",
    tono: "ok",
  },
  {
    codigo: "ER-2026-002",
    nombre: "Conjunto El Roble",
    tipo: "Apartamentos",
    torres: "1 torre",
    unidades: "8 unidades",
    fecha: "dic de 2026",
    tareas: "32 tareas · 15 aprobadas",
    pct: 47,
    estado: "Retraso",
    tono: "mal",
  },
  {
    codigo: "TR-2026-001",
    nombre: "Torres del Río",
    tipo: "Apartamentos",
    torres: "2 torres",
    unidades: "64 unidades",
    fecha: "ene de 2027",
    tareas: "512 tareas · 294 aprobadas",
    pct: 57,
    estado: "Crítico",
    tono: "mal",
    foco: true,
  },
];

/**
 * Demo animada del hero: la pantalla "Proyectos" de la app recreada en
 * HTML/CSS (nada de captura PNG, para que nunca se descuadre) con su historia
 * en loop de ~11 s — llega la notificación de un avance de Torres del Río, se
 * enfoca la tarjeta, el cursor fantasma aprueba, y el avance sube de 57 % a
 * 58 % con el contador y el subtexto (294 → 295 aprobadas) al día. Los 4 chips
 * flotantes entran coreografiados con la escena, no al azar.
 *
 * Tiempos del ciclo (s): 0,8 notificación · 1,6 chip GPS · 2,4 foco + botón
 * Aprobar (+ chip semáforo) · 3,2 viaja el cursor · 4,2 clic → pastilla
 * "Aprobada" · 4,5 chip Aprobada · 4,6 barra y contador 57 → 58 (0,9 s) ·
 * 6,5 chip Factura adjunta · 8,5 todo se desvanece · 10,4 + 0,6 de respiro =
 * 11,0 s por vuelta.
 *
 * Patrón useLoopGo (timeline GSAP repeat:-1, resets en t=0, pausa por
 * IntersectionObserver). Con prefers-reduced-motion se pinta el estado final
 * estático: 58 %, "Aprobada", chips y notificación visibles, sin cursor.
 */
export default function HeroDemoGo() {
  const root = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as HTMLElement;
      const marco = q(".shot-marco");
      const cards = q(".hd-cards");
      const noti = q(".hd-noti");
      const chipGps = q(".cf-gps");
      const chipApr = q(".cf-apr");
      const chipSem = q(".cf-sem");
      const chipFac = q(".cf-fac");
      const card = q(".es-foco");
      const btn = q(".hd-btn");
      const btnTxt = q('[data-h="btntxt"]');
      const pulso = q(".hd-pulso");
      const barra = q(".es-foco .hd-bar i");
      const num = q('[data-h="num"]');
      const sub = q('[data-h="sub"]');
      const mas = q(".hd-mas");
      const cur = q(".mcur");
      const chips = [chipGps, chipApr, chipSem, chipFac];

      // t=0 de cada vuelta: pantalla limpia en 57 %, sin chips ni notificación
      tl.set(cards, { opacity: 0 }, 0);
      tl.set(noti, { opacity: 0, xPercent: 22, y: -14 }, 0);
      tl.set(chips, { opacity: 0, scale: 0.9, y: 8 }, 0);
      tl.set(btn, { opacity: 0, scale: 0.9 }, 0);
      tl.set(pulso, { opacity: 0, scale: 0.3 }, 0);
      tl.set(mas, { opacity: 0, y: 4 }, 0);
      tl.set(barra, { width: "57%" }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        card.classList.remove("foco");
        btn.classList.remove("ok");
        num.classList.remove("realce");
        sub.classList.remove("realce");
        btnTxt.textContent = "Aprobar";
        num.textContent = "57";
        sub.textContent = "512 tareas · 294 aprobadas";
        cur.style.left = "58%";
        cur.style.top = "92%";
      }, 0);
      tl.to(cards, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.15);

      // 0,8 — la notificación del avance entra desde arriba-derecha
      tl.to(noti, { opacity: 1, xPercent: 0, y: 0, duration: 0.55, ease: "power3.out" }, 0.8);

      // 1,6 — chip "GPS verificado"
      tl.to(chipGps, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }, 1.6);

      // 2,4 — Torres del Río se enfoca y asoma el botón "Aprobar" (+ semáforo)
      tl.call(() => card.classList.add("foco"), [], 2.4);
      tl.to(btn, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, 2.55);
      tl.to(chipSem, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }, 2.7);

      // 3,2 — el cursor fantasma viaja hasta el botón (el trayecto lo hace la
      // transición CSS de .mcur)
      tl.to(cur, { opacity: 1, duration: 0.25 }, 3.2);
      tl.add(() => moverCursor(cur, btn, marco), 3.3);

      // 4,2 — clic: pulso y el botón se vuelve pastilla "Aprobada"
      tl.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 }, 4.2);
      tl.fromTo(
        pulso,
        { opacity: 0.5, scale: 0.35 },
        { opacity: 0, scale: 1.7, duration: 0.55, ease: "power2.out" },
        4.2
      );
      tl.call(
        () => {
          btn.classList.add("ok");
          btnTxt.textContent = "Aprobada";
        },
        [],
        4.35
      );
      tl.to(cur, { opacity: 0, duration: 0.3 }, 4.6);

      // 4,5 — chip "Aprobada"
      tl.to(chipApr, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }, 4.5);

      // 4,6 — el avance sube UN punto: barra 57 → 58 % y el número contando.
      // El realce del número es deliberadamente discreto (clase .realce: leve
      // escala + índigo un instante) más un "+1%" diminuto que sube y se va.
      const p = { n: 57 };
      tl.to(barra, { width: "58%", duration: 0.9, ease: "power2.inOut" }, 4.6);
      tl.to(
        p,
        {
          n: 58,
          duration: 0.9,
          ease: "power2.inOut",
          onUpdate: () => {
            num.textContent = String(Math.round(p.n));
          },
        },
        4.6
      );
      tl.call(() => num.classList.add("realce"), [], 4.7);
      tl.fromTo(
        mas,
        { opacity: 0, y: 4 },
        { opacity: 1, y: -9, duration: 0.5, ease: "power2.out" },
        4.8
      );
      tl.call(
        () => {
          sub.classList.add("realce");
          sub.textContent = "512 tareas · 295 aprobadas";
        },
        [],
        5.1
      );
      tl.call(() => num.classList.remove("realce"), [], 5.5);
      tl.to(mas, { opacity: 0, y: -17, duration: 0.6, ease: "power1.in" }, 5.5);
      tl.call(() => sub.classList.remove("realce"), [], 5.9);

      // 6,5 — chip "Factura adjunta"
      tl.to(chipFac, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }, 6.5);

      // Balanceo leve de cada chip mientras está visible (en GSAP, no en CSS:
      // una animación CSS de transform pisaría lo que anima el timeline).
      const balanceo = (
        chip: HTMLElement,
        desde: number,
        duracion: number,
        repeticiones: number
      ) =>
        tl.to(
          chip,
          {
            y: -8,
            duration: duracion,
            repeat: repeticiones,
            yoyo: true,
            ease: "sine.inOut",
          },
          desde
        );
      balanceo(chipGps, 2.0, 1.8, 3);
      balanceo(chipSem, 3.1, 1.5, 3);
      balanceo(chipApr, 4.9, 1.4, 2);
      balanceo(chipFac, 6.9, 1.15, 1);

      // 8,5 — todo se desvanece suavemente; el reset completo va en t=0
      tl.to([noti, ...chips], { opacity: 0, duration: 0.7, ease: "power2.in" }, 8.5);
      tl.to(cards, { opacity: 0, duration: 0.7, ease: "power2.in" }, 8.9);
      tl.to({}, { duration: 10.4 }, 0); // duración total del ciclo
    },
    (el) => {
      el.classList.add("fin");
      const num = el.querySelector('[data-h="num"]') as HTMLElement;
      const sub = el.querySelector('[data-h="sub"]') as HTMLElement;
      const btnTxt = el.querySelector('[data-h="btntxt"]') as HTMLElement;
      num.textContent = "58";
      sub.textContent = "512 tareas · 295 aprobadas";
      btnTxt.textContent = "Aprobada";
      el.querySelector(".hd-btn")?.classList.add("ok");
      el.querySelector(".es-foco")?.classList.add("foco");
    },
    0.6
  );

  return (
    <div className="escenario" ref={root}>
      <span className="chip-flot cf-gps">
        <MapPin className="ic" strokeWidth={2.4} aria-hidden="true" />
        <span>
          GPS verificado
          <small>Cali — La Buitrera</small>
        </span>
      </span>
      <span className="chip-flot cf-apr">Aprobada</span>
      <span className="chip-flot cf-sem">
        <span className="cf-leds">
          <i className="led-v"></i>
          <i className="led-a"></i>
          <i className="led-r"></i>
        </span>
        <span>
          Semáforo
          <small>sabes qué mirar</small>
        </span>
      </span>
      <span className="chip-flot cf-fac">
        <Check className="ic" strokeWidth={3} aria-hidden="true" />
        Factura adjunta
      </span>

      <div className="shot-marco" role="img" aria-label="Tus obras en Seiricon Go">
        <div className="hd-app">
          <aside className="hd-side">
            <span className="hd-logo">
              <Image src="/seiricon-icon.png" alt="" width={20} height={20} />
              <span>
                SEIRICON
                <small>construyendo en orden</small>
              </span>
            </span>
            <span className="hd-menu">
              {MENU.map(({ Icono, txt, activo }) => (
                <span className={`hd-item${activo ? " act" : ""}`} key={txt}>
                  <Icono className="ic" strokeWidth={2} aria-hidden="true" />
                  {txt}
                </span>
              ))}
            </span>
          </aside>

          <div className="hd-main">
            <div className="hd-top">
              <span className="hd-titulo">
                Proyectos
                <small>Gestión de proyectos activos</small>
              </span>
              <span className="hd-buscar">
                <Search className="ic" strokeWidth={2.2} aria-hidden="true" />
                Buscar proyecto, tarea…
              </span>
              <Bell className="ic hd-campana" strokeWidth={2} aria-hidden="true" />
            </div>

            <div className="hd-cuerpo">
              <div className="hd-cab">
                <span>3 proyectos activos</span>
                <span className="hd-nuevo">
                  <Plus className="ic" strokeWidth={2.6} aria-hidden="true" />
                  Nuevo proyecto
                </span>
              </div>

              <div className="hd-cards">
                {PROYECTOS.map((p) => (
                  <div className={`hd-card${p.foco ? " es-foco" : ""}`} key={p.codigo}>
                    <div className="hd-card-top">
                      <span className="hd-codigo">{p.codigo}</span>
                      <span className={`hd-estado e-${p.tono}`}>
                        <i></i>
                        {p.estado}
                      </span>
                    </div>
                    <b className="hd-nombre">{p.nombre}</b>
                    <span className="hd-tipo">{p.tipo}</span>
                    <div className="hd-meta">
                      <span>
                        <Building2 className="ic" strokeWidth={2} aria-hidden="true" />
                        {p.torres}
                      </span>
                      <span>{p.unidades}</span>
                      <span>
                        <Calendar className="ic" strokeWidth={2} aria-hidden="true" />
                        {p.fecha}
                      </span>
                    </div>
                    <span className="hd-tareas" data-h={p.foco ? "sub" : undefined}>
                      {p.tareas}
                    </span>
                    <div className="hd-prog">
                      <span>Progreso aprobado</span>
                      <span className="hd-pct">
                        <b data-h={p.foco ? "num" : undefined}>{p.pct}</b>%
                        {p.foco ? <span className="hd-mas">+1%</span> : null}
                      </span>
                    </div>
                    <div className={`hd-bar b-${p.pct}`}>
                      <i></i>
                    </div>
                    <div className="hd-pie">
                      <span className="hd-ver">
                        Ver detalle
                        <ChevronRight className="ic" strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      {p.foco ? (
                        <span className="hd-btn">
                          <Check className="ic hd-ic-ok" strokeWidth={3} aria-hidden="true" />
                          <span data-h="btntxt">Aprobar</span>
                          <span className="hd-pulso"></span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hd-noti">
          <span className="hd-noti-foto">
            <Image src="/landing/fotos/f2-manos-panete.jpg" alt="" fill sizes="64px" />
          </span>
          <span className="hd-noti-txt">
            <b>Nuevo avance — Torres del Río · Piso 6</b>
            <small>Reportó: don Álvaro · hace un momento</small>
          </span>
        </div>

        <CursorGo />
      </div>
    </div>
  );
}
