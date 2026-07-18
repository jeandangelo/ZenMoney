# Apps Script — ingesta de correos bancarios

Extractor **tonto**: lee correos del banco, extrae monto/tipo/comercio con
regex deterministas y hace POST a la Edge Function `ingest-email-tx`. Cero
lógica de negocio aquí — eso vive en Supabase.

## Configurar clasp (versionar el script en este repo)

```powershell
npm i -g @google/clasp
clasp login                              # cuenta de Gmail de Jean
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

⚠ **PENDIENTES de correos reales.** Cada parser retorna `null` hasta que se
escriban sus regex sobre 1-2 correos reales por banco aportados por Jean
(con datos sensibles tachados). No se inventan formatos de memoria.
