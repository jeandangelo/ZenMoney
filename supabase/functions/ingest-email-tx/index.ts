// =============================================================================
// Edge Function: ingest-email-tx
// Recibe el payload del Apps Script (extractor tonto) y hace TODO el trabajo:
// valida el secreto, resuelve la cuenta digital, categoriza con
// fin_merchant_rules e inserta en fin_transactions de forma idempotente.
//
// Seguridad:
//   * Header x-ingest-secret debe calzar con el secret INGEST_SECRET → si no, 401.
//   * Usa la service_role key (solo existe en el entorno de la función).
//   * Mono-usuario: todo se inserta a nombre de OWNER_USER_ID. Simplificación
//     válida SOLO mientras el sistema tenga un usuario (Jean).
//
// Secrets requeridos (supabase secrets set — ver README):
//   INGEST_SECRET, OWNER_USER_ID, CUENTA_SLUG_MAP
//   (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo.)
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Payload {
  gmail_message_id: string;
  fecha: string; // YYYY-MM-DD
  monto: number; // entero CLP > 0
  tipo: 'gasto' | 'ingreso';
  cuenta_slug: string;
  comercio: string | null;
  raw_asunto: string | null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // 1. Secreto compartido: sin él no se conversa.
  const secreto = req.headers.get('x-ingest-secret');
  if (!secreto || secreto !== Deno.env.get('INGEST_SECRET')) {
    return json(401, { error: 'no autorizado' });
  }

  // 2. Validar forma del payload (el script es tonto; aquí se desconfía).
  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return json(400, { error: 'body no es JSON' });
  }
  if (!p.gmail_message_id) return json(400, { error: 'falta gmail_message_id' });
  if (!Number.isInteger(p.monto) || p.monto <= 0) {
    return json(400, { error: 'monto debe ser entero > 0' });
  }
  if (p.tipo !== 'gasto' && p.tipo !== 'ingreso') {
    return json(400, { error: 'tipo debe ser gasto o ingreso' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha) || isNaN(Date.parse(p.fecha))) {
    return json(400, { error: 'fecha invalida (YYYY-MM-DD)' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const owner = Deno.env.get('OWNER_USER_ID')!;

  // 3. Resolver cuenta_slug → cuenta digital (mapa de configuración, no lógica).
  //    CUENTA_SLUG_MAP es JSON: {"banco-chile": "Banco de Chile", ...}
  let mapa: Record<string, string>;
  try {
    mapa = JSON.parse(Deno.env.get('CUENTA_SLUG_MAP') ?? '{}');
  } catch {
    return json(500, { error: 'CUENTA_SLUG_MAP no es JSON valido' });
  }
  const nombreCuenta = mapa[p.cuenta_slug];
  if (!nombreCuenta) {
    return json(422, { error: `cuenta_slug desconocido: ${p.cuenta_slug}` });
  }
  const { data: cuenta, error: errCuenta } = await supabase
    .from('fin_money_accounts')
    .select('id')
    .eq('user_id', owner)
    .ilike('nombre', nombreCuenta)
    .maybeSingle();
  if (errCuenta) return json(500, { error: errCuenta.message });
  if (!cuenta) {
    return json(422, { error: `cuenta digital no encontrada: ${nombreCuenta}` });
  }

  // 4. Categorizar con las reglas aprendidas del usuario. Si ninguna calza,
  //    el movimiento entra sin sobre y marcado "por revisar" — la app nunca
  //    adivina.
  let budget_account_id: string | null = null;
  let needs_review = true;
  if (p.comercio) {
    const comercio = p.comercio.toUpperCase();
    const { data: reglas, error: errReglas } = await supabase
      .from('fin_merchant_rules')
      .select('patron_comercio, budget_account_id')
      .eq('user_id', owner);
    if (errReglas) return json(500, { error: errReglas.message });
    const regla = (reglas ?? []).find((r) =>
      comercio.includes(r.patron_comercio.toUpperCase())
    );
    if (regla) {
      budget_account_id = regla.budget_account_id;
      needs_review = false;
    }
  }

  // 5. Insertar. El UNIQUE de gmail_message_id hace la idempotencia: el
  //    duplicado se responde 200 (éxito, ya estaba) para que el script
  //    etiquete el correo como procesado y no reintente para siempre.
  const { data: fila, error: errInsert } = await supabase
    .from('fin_transactions')
    .insert({
      user_id: owner,
      fecha: p.fecha,
      monto: p.monto,
      tipo: p.tipo,
      money_account_id: cuenta.id,
      budget_account_id,
      comercio: p.comercio,
      nota: p.raw_asunto ? `asunto: ${p.raw_asunto}` : null,
      source: 'email',
      gmail_message_id: p.gmail_message_id,
      needs_review,
    })
    .select('id')
    .single();

  if (errInsert) {
    if (errInsert.code === '23505') return json(200, { duplicated: true });
    return json(500, { error: errInsert.message });
  }
  return json(200, { id: fila.id, needs_review });
});
