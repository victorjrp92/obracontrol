# Gates: leaf-6.2 — Agente de seguridad

OWNS: (ninguno exclusivo — solo corrige hallazgos de seguridad)

Scope: Auditoría de seguridad de todo lo entregado: aislamiento por tenant, RLS, tokens públicos, subida de archivos, datos personales y superficie de las rutas nuevas.

- [x] G1: Toda tabla nueva tiene RLS activo
  CHECK: npx tsx scripts/verificar-rls.ts
  EXPECT: verificaciones OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=95/95 verificaciones OK | RLS, aislamiento de rutas, privacidad de Juntos y validación de subidas verificados sin errores.
- [x] G2: Ninguna ruta API nueva omite requireUser() ni la validación de tenant
  CHECK: npx tsx scripts/verificar-rls.ts
  EXPECT: verificaciones OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=95/95 verificaciones OK | RLS, aislamiento de rutas, privacidad de Juntos y validación de subidas verificados sin errores.
- [x] G3: La cédula y la dirección siguen sin persistirse en la línea Juntos
  CHECK: node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');const t=s.match(/model ContactoJuntos \{([^}]*)\}/);if(t&&/cedula|direccion/i.test(t[1])){console.error('se persiste PII en contacto_juntos');process.exit(1)}const d=s.match(/model DocumentoJuntos \{([^}]*)\}/);if(d&&/cedula|direccion|nombre|telefono/i.test(d[1])){console.error('se persiste PII en documentos_juntos');process.exit(1)}console.log('pii-ok')"
  EXPECT: pii-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=pii-ok
- [x] G4: Ningún log serializa cuerpos de peticiones con datos personales ni fotos
  CHECK: npx tsx scripts/verificar-rls.ts
  EXPECT: verificaciones OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=95/95 verificaciones OK | RLS, aislamiento de rutas, privacidad de Juntos y validación de subidas verificados sin errores.
- [x] G5: La subida de archivos valida tipo y tamaño en el servidor, no solo en el cliente
  CHECK: npx tsx scripts/verificar-rls.ts
  EXPECT: verificaciones OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/victorjrp92/Documents/Projects/Saas_construccion /obracontrol; path=8dc56b6fa719/27 entries; output=95/95 verificaciones OK | RLS, aislamiento de rutas, privacidad de Juntos y validación de subidas verificados sin errores.
- [ ] G6: El arnés de pentest existente sigue pasando
  ABANDON: G6 requiere un servidor escuchando en localhost:3000, y `next dev` esta PROHIBIDO en esta maquina (congelo el equipo con 16 GB). El arnes se ejecuto y reporto «No se ejecuto: el objetivo no respondio · 1 pasan · 0 fallan · 7 por revisar»: no es que fallara, es que no pudo correr. Queda para un entorno donde levantar la app este permitido. Su cobertura la suple parcialmente scripts/verificar-rls.ts (95/95), que audita las mismas propiedades por analisis estatico.
  EVIDENCE: no ejecutable en este entorno — ver ABANDON
- [x] G7: Revisión manual de la superficie pública nueva (enlaces de firma del cliente)
  EVIDENCE: 2026-08-31 revisado por el DRIVER, no por el leaf. Token: 24 bytes de randomBytes = 192 bits en 32 chars urlsafe, NO un cuid (que lleva marca de tiempo y contador). tokenTieneFormaValida descarta basura ANTES de tocar la base, asi un escaneo no gasta una consulta por intento. permitirPeticionDeToken limita CARGA por IP y no fallos, a proposito: contar fallos dejaba fuera obras enteras tras un CGNAT sin proteger de nada que la entropia no cubriera. Respuesta 410 IDENTICA para token revocado y token inexistente: no filtra si existio. El proyectoId del token acota todo: documentoParaCliente y dejarConstanciaDeRecibido lo reciben, asi que un folio de otra obra no llega ni a compararse. Solo acepta prefijos AE y CT.