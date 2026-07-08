-- =============================================================================
-- ZenMoney — Fase A: esquema de finanzas (prefijo fin_) sobre la instancia
-- Supabase compartida con ZenTask.
--
-- Cómo ejecutar: Supabase Dashboard > SQL Editor > pegar TODO este archivo > Run.
-- Es seguro re-ejecutarlo (create if not exists / create or replace / drop policy).
--
-- Principios de diseño (ver contexto_claude_code_fase2_finanzas.md):
--   * El saldo NUNCA se almacena: todas las cifras son vistas calculadas
--     sobre fin_transactions (causa raíz de la corrupción del sistema viejo).
--   * Traspasos entre cuentas propias NO alteran el patrimonio: mueven plata
--     de una cuenta digital a otra (origen y destino en la misma fila).
--   * RLS en todas las tablas: cada usuario solo ve/toca sus filas.
--   * Idempotencia de correos (Fase B): gmail_message_id UNIQUE.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLAS
-- ─────────────────────────────────────────────────────────────────────────────

-- "Cuentas Digitales": dónde está la plata físicamente.
create table if not exists public.fin_money_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,
  tipo        text not null check (tipo in ('banco', 'app', 'efectivo')),
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- "Cuentas" (de propósito): para qué es la plata. Opcionalmente ligadas a una
-- cuenta digital y con monto propuesto definido por el usuario (nunca sugerido).
create table if not exists public.fin_budget_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre                   text not null,
  linked_money_account_id  uuid references public.fin_money_accounts(id) on delete set null,
  monto_propuesto          integer check (monto_propuesto is null or monto_propuesto >= 0),
  activa                   boolean not null default true,
  created_at               timestamptz not null default now()
);

-- Transacciones: la ÚNICA fuente de verdad. Montos enteros en CLP.
create table if not exists public.fin_transactions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha                     date not null default current_date,
  monto                     integer not null check (monto > 0),
  tipo                      text not null check (tipo in ('gasto', 'ingreso', 'traspaso')),
  money_account_id          uuid not null references public.fin_money_accounts(id),
  money_account_destino_id  uuid references public.fin_money_accounts(id),
  budget_account_id         uuid references public.fin_budget_accounts(id) on delete set null,
  comercio                  text,
  nota                      text,
  source                    text not null default 'manual' check (source in ('manual', 'email', 'import')),
  gmail_message_id          text unique,
  needs_review              boolean not null default false,
  created_at                timestamptz not null default now(),

  -- Un traspaso exige cuenta destino; gasto/ingreso no la llevan.
  constraint fin_tx_traspaso_destino check (
    (tipo = 'traspaso' and money_account_destino_id is not null)
    or (tipo <> 'traspaso' and money_account_destino_id is null)
  ),
  -- Origen y destino no pueden ser la misma cuenta.
  constraint fin_tx_destino_distinto check (money_account_destino_id is distinct from money_account_id),
  -- Un traspaso no es gasto: no lleva cuenta de propósito.
  constraint fin_tx_traspaso_sin_proposito check (tipo <> 'traspaso' or budget_account_id is null)
);

-- Aprendizaje incremental de categorización (la alimenta cada corrección
-- del usuario; la consumirá el parser de correos en Fase B).
create table if not exists public.fin_merchant_rules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patron_comercio    text not null,
  budget_account_id  uuid not null references public.fin_budget_accounts(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (user_id, patron_comercio)
);

-- Índices para las consultas del dashboard e historial.
create index if not exists fin_tx_user_fecha_idx     on public.fin_transactions (user_id, fecha desc, created_at desc);
create index if not exists fin_tx_money_idx          on public.fin_transactions (money_account_id);
create index if not exists fin_tx_money_destino_idx  on public.fin_transactions (money_account_destino_id);
create index if not exists fin_tx_budget_idx         on public.fin_transactions (budget_account_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS: cada usuario solo accede a sus propias filas
--    ((select auth.uid()) en vez de auth.uid() directo: se evalúa una sola vez
--    por consulta, recomendación oficial de Supabase para rendimiento).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.fin_money_accounts  enable row level security;
alter table public.fin_budget_accounts enable row level security;
alter table public.fin_transactions    enable row level security;
alter table public.fin_merchant_rules  enable row level security;

drop policy if exists "fin_money_accounts_own"  on public.fin_money_accounts;
create policy "fin_money_accounts_own" on public.fin_money_accounts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "fin_budget_accounts_own" on public.fin_budget_accounts;
create policy "fin_budget_accounts_own" on public.fin_budget_accounts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "fin_transactions_own" on public.fin_transactions;
create policy "fin_transactions_own" on public.fin_transactions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "fin_merchant_rules_own" on public.fin_merchant_rules;
create policy "fin_merchant_rules_own" on public.fin_merchant_rules
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VISTAS (security_invoker: la vista respeta el RLS del usuario que consulta)
-- ─────────────────────────────────────────────────────────────────────────────

-- Saldo por cuenta digital, calculado desde cero en cada consulta.
create or replace view public.fin_v_money_saldos
  with (security_invoker = true) as
select
  ma.id,
  ma.user_id,
  ma.nombre,
  ma.tipo,
  ma.activa,
  coalesce((
    select sum(
      case
        when t.tipo = 'ingreso'  and t.money_account_id = ma.id         then  t.monto
        when t.tipo = 'gasto'    and t.money_account_id = ma.id         then -t.monto
        when t.tipo = 'traspaso' and t.money_account_id = ma.id         then -t.monto  -- sale plata
        when t.tipo = 'traspaso' and t.money_account_destino_id = ma.id then  t.monto  -- entra plata
        else 0
      end)
    from public.fin_transactions t
    where t.money_account_id = ma.id or t.money_account_destino_id = ma.id
  ), 0)::bigint as saldo
from public.fin_money_accounts ma;

-- Patrimonio total: suma de las cuentas digitales activas.
-- Por construcción, un traspaso resta en el origen y suma en el destino: neto 0.
create or replace view public.fin_v_patrimonio
  with (security_invoker = true) as
select user_id, sum(saldo)::bigint as total
from public.fin_v_money_saldos
where activa
group by user_id;

-- Estado del mes corriente por cuenta de propósito (gastado vs propuesto).
create or replace view public.fin_v_budget_mes
  with (security_invoker = true) as
select
  ba.id,
  ba.user_id,
  ba.nombre,
  ba.linked_money_account_id,
  ba.monto_propuesto,
  ba.activa,
  coalesce((
    select sum(t.monto)
    from public.fin_transactions t
    where t.budget_account_id = ba.id
      and t.tipo = 'gasto'
      and t.fecha >= date_trunc('month', current_date)::date
      and t.fecha <  (date_trunc('month', current_date) + interval '1 month')::date
  ), 0)::bigint as gastado_mes
from public.fin_budget_accounts ba;

-- Historial mensual por cuenta de propósito (evolución mes a mes).
create or replace view public.fin_v_budget_historial
  with (security_invoker = true) as
select
  t.user_id,
  t.budget_account_id,
  ba.nombre,
  to_char(date_trunc('month', t.fecha), 'YYYY-MM') as mes,
  coalesce(sum(t.monto) filter (where t.tipo = 'gasto'), 0)::bigint    as gastado,
  coalesce(sum(t.monto) filter (where t.tipo = 'ingreso'), 0)::bigint  as ingresado
from public.fin_transactions t
join public.fin_budget_accounts ba on ba.id = t.budget_account_id
group by t.user_id, t.budget_account_id, ba.nombre, date_trunc('month', t.fecha);

-- =============================================================================
-- VERIFICACIÓN DE RLS (checklist "listo" de Fase A):
-- 1. Con tu usuario logueado en la app, crea cuentas y transacciones.
-- 2. En el SQL Editor (rol postgres, salta RLS) verás todas las filas; para
--    probar el aislamiento crea un SEGUNDO usuario en Authentication > Users,
--    loguéate con él en la app y confirma que ve todo vacío.
-- 3. Traspaso Chile→FAN: registra uno y confirma que fin_v_patrimonio.total
--    no cambia (solo se mueve saldo entre cuentas en fin_v_money_saldos).
-- =============================================================================
