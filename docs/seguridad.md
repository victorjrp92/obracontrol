# Seguridad — estado y operación

> Última actualización: 2026-08-15 · Rama de origen: `seguridad/hardening`

Este documento es la referencia viva de seguridad del producto. Registra qué
controles existen, cómo se verifican y qué queda pendiente. Si cambias algo de
lo de aquí, actualízalo en el mismo commit.

---

## 1. Verificación

`scripts/pentest.ts` corre las comprobaciones de esta página contra un
despliegue **propio**. Pide páginas, lee cabeceras y manda peticiones inválidas
a propósito. **No crea, modifica ni borra datos.**

Lo que sí consume es presupuesto de los limitadores en memoria: SEC-08 provoca
429 a propósito y SEC-02 manda 24 peticiones con token inventado. Contra
producción, la IP desde la que lo ejecutes —y la de toda tu oficina, si comparten
salida— puede quedar con el cupo de esas rutas gastado durante un minuto. Se
recupera solo; aun así, mejor no correrlo en hora pico.

**El servidor tiene que estar levantado.** En otra terminal:

```bash
npm run dev                                  # o: npm run build && npm start
```

Y entonces:

```bash
npm run seguridad:probar -- --url http://localhost:3000
npm run seguridad:probar -- --url https://<preview>.vercel.app
```

La comprobación de PostgREST (SEC-01) no necesita el servidor —prueba la API de
Supabase directamente— pero sí las credenciales. Ambas son públicas (viajan en
el HTML de la app), así que se pueden pasar por argumento:

```bash
npm run seguridad:probar -- \
  --url https://<preview>.vercel.app \
  --supabase-url https://<proyecto>.supabase.co \
  --supabase-key <la-llave-que-está-en-el-HTML>
```

Devuelve código 1 si algo falla **o si algo queda por revisar**: un «no pude
comprobar» nunca debe leerse como visto bueno.

### Cómo leer los resultados

| Resultado | Significa |
|---|---|
| `OK` | La prueba corrió y pasó. |
| `FALLA` | La prueba corrió y encontró el problema. |
| `REVISAR` | La prueba **no llegó a correr** (sin servidor, sin credenciales) o el entorno la invalida. |

Dos `REVISAR` son normales contra `next dev`: SEC-01 si no pasas las
credenciales de Supabase, y EXP-02 porque en desarrollo los source maps son
obligatorios. Para medir EXP-02 hay que apuntar a producción o a un preview.

---

## 2. Controles activos

| Control | Dónde vive | Qué protege |
|---|---|---|
| RLS en todas las tablas ⚠️ **escrito, SIN aplicar** | `prisma/migrations/20260815140000_rls_todas_las_tablas` | Que la llave pública de Supabase no lea la base por PostgREST |
| Tokens de acceso aleatorios | `src/lib/tokens.ts` | `/o/[token]` y `/c/[token]` — 192 bits, no adivinables |
| Freno de fuerza bruta | `src/lib/rate-limit.ts` | 10 tokens fallidos por IP cada 10 min |
| Lista blanca de redirección | `src/app/api/auth/callback/route.ts` | Phishing por redirección abierta |
| CSP + HSTS | `next.config.ts` | Exfiltración si se cuela un script ajeno |
| Rate limit público | `src/lib/rate-limit.ts` | Abuso de las rutas de Juntos |
| URLs firmadas | `src/lib/storage.ts` | Las fotos de evidencia no son públicas |
| Aislamiento por tenant | `src/lib/tenant.ts` | Que una constructora no vea a otra |
| Dependencias vigiladas | `.github/dependabot.yml`, `.github/workflows/seguridad.yml` | CVE conocidos |

> ⚠️ **La migración de RLS todavía NO está aplicada en ninguna base.** Ningún
> comando del repo la aplicaba: `db:push` ignora `prisma/migrations/` por
> completo y el `build` solo corre `prisma generate`. Se añadió
> `npm run db:migrate-deploy` (`prisma migrate deploy`) para poder hacerlo.
> Pruébala primero contra una rama de base de datos y comprueba las
> notificaciones en vivo. Mientras no se aplique, SEC-01 sigue abierto — el
> riesgo real no es que rompa algo, es quedarse creyendo que ya está puesto.

### Reglas que no se negocian

1. **`select` explícito, nunca `include`**, en cualquier consulta que toque
   `Usuario`, `Obrero`, `Cliente` o `Contratista`. Lo que traes de la base
   termina en el payload RSC del HTML, se pinte o no.
2. **Toda ruta nueva empieza con `requireUser()`** de `src/lib/tenant.ts` y
   valida pertenencia con los helpers `assert*InTenant()`. El patrón de
   referencia está en `src/app/api/evidencias/direct-upload/route.ts`.
3. **Ningún `catch` serializa el cuerpo de la petición a los logs** en rutas que
   reciben datos personales o fotos.
4. **Ningún token de acceso usa `cuid()`.** Siempre `generarTokenAcceso()`.
5. **Si el prefijo es `NEXT_PUBLIC_`, es público.** No hay excepciones ni
   ofuscación que valga.

---

## 3. Qué es visible desde «Inspeccionar»

Todo lo que llega al navegador es público. La pregunta no es cómo esconderlo,
sino qué es aceptable que se vea.

| Visible | ¿Problema? |
|---|---|
| Llave anon de Supabase | No, **siempre que RLS esté activo**. Es su único seguro. |
| Token de Mapbox | Solo si no es `pk.` con restricción de dominio. Verificar en el panel. |
| Motor de reglas de grietas | No. Corre en el navegador a propósito: es lo que permite que el wizard funcione con la base caída, y que las reglas sean auditables. |
| ID de Clarity | No. Es público en cualquier sitio que use Clarity. |
| Rutas de la API | No, si cada una valida. Asume que son conocidas. |
| Payload RSC | Sí, si traes campos de más. Ver regla 1. |
| Variables sin `NEXT_PUBLIC_` | No se ven. Se quedan en el servidor. |

---

## 4. Pendiente

| # | Tarea | Por qué |
|---|---|---|
| 1 | Nonce en la CSP en vez de `'unsafe-inline'` | Hoy la CSP no frena un script inline inyectado. El nonce se genera en `src/proxy.ts`. |
| 2 | Contador de rate limit compartido (Redis o tabla con TTL) | El actual es por instancia: bajo carga Vercel escala y el techo global se multiplica justo durante un ataque. |
| 3 | Migrar las rutas viejas al patrón `requireUser` + `assert*InTenant` | El aislamiento entre constructoras depende hoy de 78 `where` escritos a mano. Priorizar las de datos personales y dinero. |
| 4 | Auditar los 14 `include` de `src/lib/data.ts` | Ver regla 1. |
| 5 | Segundo factor obligatorio en Supabase y Vercel | No se ve desde el repo. Requiere revisar la consola. |
| 6 | Probar la restauración de un respaldo | Un respaldo que nunca se restauró no es un respaldo. |

---

## 5. Rotación de los tokens de obrero

Los tokens creados antes del 15-ago-2026 se generaban con `cuid()` y son
adivinables. Rotarlos **invalida los enlaces actuales**: hay que reenviarlos.

```bash
# 1. Simulacro: dice a quién afectaría, sin escribir nada.
npm run seguridad:rotar-tokens

# 2. Rotar de verdad. Imprime los enlaces nuevos agrupados por constructora.
npm run seguridad:rotar-tokens -- --aplicar
```

Coordina el paso 2 con quien atiende a las constructoras: entre que se rota y
que llega el enlace nuevo, el obrero no puede reportar.

---

## 6. Alcance de la auditoría

La revisión del 15-ago-2026 fue de **código**. No cubrió, y siguen pendientes de
una revisión aparte:

- Configuración de las consolas de Supabase, Vercel y el DNS.
- Quién tiene acceso a producción y con qué segundo factor.
- Si los respaldos se han probado restaurándolos alguna vez.
- Pruebas de carga y de denegación de servicio.
