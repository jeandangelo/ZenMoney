# Apps Script — ingesta de correos bancarios

Extractor **tonto**: lee correos del banco, extrae monto/tipo/comercio con
regex deterministas y hace POST a la Edge Function `ingest-email-tx`. Cero
lógica de negocio aquí — eso vive en Supabase.

## Cuenta de Gmail (decisión jul-2026)

El script vive en **jeandangelon@gmail.com** (ahí llegan los correos de
BancoEstado y la mayoría de las cuentas). Lo que llegue a otras casillas
(p. ej. MercadoPago → jeandangelous.90@) Jean lo redirige con un filtro de
reenvío de Gmail o cambiando el correo en el servicio. Una sola instalación,
un solo trigger.

## Configurar clasp (versionar el script en este repo)

```powershell
npm i -g @google/clasp
clasp login                              # jeandangelon@gmail.com
clasp create --type standalone --title "ZenMoney Ingesta" --rootDir apps-script
# clasp create genera apps-script/.clasp.json con el scriptId → GITIGNOREADO
clasp push                               # sube src/ + appsscript.json
clasp pull                               # baja cambios hechos en el editor web
```

`.clasp.json` contiene el `scriptId` privado y está en `.gitignore` — copiar
`.clasp.json.example` y completar si se clona el repo en otra máquina.

## Configuración en el editor de Apps Script (script.google.com)

1. **Propiedades del script** (⚙ Configuración del proyecto → Propiedades):
   - `INGEST_URL` = `https://<REF>.supabase.co/functions/v1/ingest-email-tx`
   - `INGEST_SECRET` = el mismo secreto configurado en `supabase secrets`
2. **Trigger**: Activadores → Añadir → función `procesarCorreos`,
   basado en tiempo, cada 10 o 15 minutos.
3. Primera ejecución manual de `procesarCorreos` para otorgar permisos
   (Gmail + peticiones externas).

## Etiquetas Gmail (las crea el script solo)

- `zenmoney-procesado`: insertado o duplicado ignorado — no se vuelve a tocar.
- `zenmoney-error`: parser no reconoció el formato o la función rechazó el
  payload. Revisar a mano; al quitar la etiqueta, el script lo reintenta.

## Estado de los parsers

Escritos y probados sobre correos reales (jul-2026):

- ✅ BancoEstado · compra con débito (gasto, comercio del voucher)
- ✅ BancoEstado · TEF enviada (gasto, destinatario como comercio)
- ✅ MercadoPago · transferencia enviada (gasto; si es a cuenta propia,
  entra POR REVISAR y Jean decide — refinamiento futuro)
- ⏳ BancoEstado · recepción de dinero (ingreso) — falta correo de ejemplo
- ⏳ MercadoPago · pagos/compras — falta correo de ejemplo
- ⏳ Tenpo y Banco de Chile — faltan correos de ejemplo

Regla: nunca inventar formatos de memoria; todo regex nace de un correo real.
