# ingest-email-tx — despliegue y secrets

Endpoint HTTP serverless que corre dentro de Supabase. Recibe los movimientos
que extrae el Apps Script y los inserta en `fin_transactions` con idempotencia
por `gmail_message_id`.

## Requisitos (una sola vez)

```powershell
# CLI de Supabase (sin instalación global: npx)
npx supabase login                      # abre el navegador para autorizar
npx supabase link --project-ref <REF>   # REF = id del proyecto (Dashboard > Settings)
```

## Secrets (nunca en git, nunca en el cliente)

```powershell
# Generar el secreto compartido (PowerShell, sin openssl):
#   -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
npx supabase secrets set INGEST_SECRET=<hex de 64 chars>
npx supabase secrets set OWNER_USER_ID=<uuid de Jean en auth.users>
npx supabase secrets set CUENTA_SLUG_MAP='{"banco-chile":"Banco de Chile","cuentarut":"CuentaRUT","tenpo":"Tenpo","mercadopago":"MercadoPago"}'
```

- `OWNER_USER_ID`: Dashboard → Authentication → Users → copiar el UUID.
  Simplificación mono-usuario: todo insert va a nombre de este usuario;
  si algún día hay más usuarios, esto se rediseña.
- `CUENTA_SLUG_MAP`: slug (viene del Apps Script) → nombre EXACTO de la
  cuenta digital en la app (se busca case-insensitive).

## Desplegar

```powershell
npx supabase functions deploy ingest-email-tx --no-verify-jwt
```

`--no-verify-jwt` es necesario: el Apps Script no tiene JWT de Supabase; la
autenticación es nuestro secreto compartido en el header `x-ingest-secret`
(la función responde 401 sin él).

## Probar a mano

```powershell
curl -X POST "https://<REF>.supabase.co/functions/v1/ingest-email-tx" `
  -H "Content-Type: application/json" `
  -H "x-ingest-secret: <INGEST_SECRET>" `
  -d '{"gmail_message_id":"test-001","fecha":"2026-07-18","monto":1000,"tipo":"gasto","cuenta_slug":"banco-chile","comercio":"PRUEBA","raw_asunto":"test"}'
```

- 1ª vez → `{"id":"...","needs_review":true}` (no hay regla para PRUEBA)
- 2ª vez (mismo gmail_message_id) → `{"duplicated":true}` (idempotencia)
- Sin header → `{"error":"no autorizado"}` con 401
- Borrar la fila de prueba desde la app (historial) al terminar.
