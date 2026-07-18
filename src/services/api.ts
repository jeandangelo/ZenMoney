import { supabase } from './supabase';

// --- TIPOS (espejo de supabase/fin_schema.sql) ---

export type MoneyAccountTipo = 'banco' | 'app' | 'efectivo';
export type TransactionTipo = 'gasto' | 'ingreso' | 'traspaso';

// Fila de la vista fin_v_money_saldos ("Cuentas Digitales" + saldo calculado)
export interface MoneyAccount {
  id: string;
  nombre: string;
  tipo: MoneyAccountTipo;
  activa: boolean;
  saldo: number;
}

// Fila de fin_budget_accounts (el sobre como entidad, sin cifras calculadas)
export interface BudgetAccount {
  id: string;
  nombre: string;
  monto_propuesto: number | null;
  activa: boolean;
}

// Fila de la vista fin_v_sobres: el sobre con todas sus cifras calculadas.
// saldo_sobre = asignado_total - gastado_total; puede ser negativo (se muestra
// en rojo pero nunca se bloquea nada).
export interface Sobre {
  id: string;
  nombre: string;
  monto_propuesto: number | null;
  activa: boolean;
  asignado_total: number;
  asignado_mes: number;
  gastado_total: number;
  gastado_mes: number;
  saldo_sobre: number;
}

// Fila de fin_budget_assignments. monto > 0 asigna; monto < 0 devuelve al
// disponible. Corregir un error = borrar la fila (los saldos se recalculan).
export interface Assignment {
  id: string;
  fecha: string; // YYYY-MM-DD
  monto: number;
  budget_account_id: string;
  nota: string | null;
  // Nombre embebido para listados (join de Supabase)
  budget_account?: { nombre: string } | null;
}

export interface NewAssignment {
  budget_account_id: string;
  monto: number;
  fecha: string;
  nota: string | null;
}

export interface Transaction {
  id: string;
  fecha: string; // YYYY-MM-DD
  monto: number;
  tipo: TransactionTipo;
  money_account_id: string;
  money_account_destino_id: string | null;
  budget_account_id: string | null;
  comercio: string | null;
  nota: string | null;
  source: 'manual' | 'email' | 'import';
  needs_review: boolean;
  // Nombres embebidos para el historial (join de Supabase)
  money_account?: { nombre: string } | null;
  money_account_destino?: { nombre: string } | null;
  budget_account?: { nombre: string } | null;
}

export interface NewTransaction {
  fecha: string;
  monto: number;
  tipo: TransactionTipo;
  money_account_id: string;
  money_account_destino_id: string | null;
  budget_account_id: string | null;
  comercio: string | null;
  nota: string | null;
}

// Embebido de nombres: hay dos FKs a fin_money_accounts, así que se nombra
// la constraint explícitamente para desambiguar.
const TX_SELECT = `*,
  money_account:fin_money_accounts!fin_transactions_money_account_id_fkey(nombre),
  money_account_destino:fin_money_accounts!fin_transactions_money_account_destino_id_fkey(nombre),
  budget_account:fin_budget_accounts!fin_transactions_budget_account_id_fkey(nombre)`;

// --- API ---
// user_id no se envía nunca: la columna tiene default auth.uid() y el RLS
// garantiza que cada usuario solo toca sus filas.

export const api = {
  // ── Cuentas digitales ──────────────────────────────────────────────────────
  getMoneyAccounts: async (): Promise<MoneyAccount[]> => {
    const { data, error } = await supabase
      .from('fin_v_money_saldos')
      .select('id, nombre, tipo, activa, saldo')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },

  createMoneyAccount: async (nombre: string, tipo: MoneyAccountTipo) => {
    const { error } = await supabase.from('fin_money_accounts').insert({ nombre, tipo });
    if (error) throw error;
  },

  updateMoneyAccount: async (
    id: string,
    cambios: Partial<Pick<MoneyAccount, 'nombre' | 'tipo' | 'activa'>>
  ) => {
    const { error } = await supabase.from('fin_money_accounts').update(cambios).eq('id', id);
    if (error) throw error;
  },

  // ── Cuentas de propósito (sobres como entidad) ─────────────────────────────
  getBudgetAccounts: async (): Promise<BudgetAccount[]> => {
    const { data, error } = await supabase
      .from('fin_budget_accounts')
      .select('id, nombre, monto_propuesto, activa')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },

  createBudgetAccount: async (nombre: string, monto_propuesto: number | null) => {
    const { error } = await supabase
      .from('fin_budget_accounts')
      .insert({ nombre, monto_propuesto });
    if (error) throw error;
  },

  updateBudgetAccount: async (
    id: string,
    cambios: Partial<Pick<BudgetAccount, 'nombre' | 'monto_propuesto' | 'activa'>>
  ) => {
    const { error } = await supabase.from('fin_budget_accounts').update(cambios).eq('id', id);
    if (error) throw error;
  },

  // ── Sobres y asignaciones ──────────────────────────────────────────────────
  // El saldo de cada sobre y el disponible vienen SIEMPRE de vistas SQL;
  // aquí nunca se calcula ni se persiste un saldo (invariante #1).
  getSobres: async (): Promise<Sobre[]> => {
    const { data, error } = await supabase
      .from('fin_v_sobres')
      .select(
        'id, nombre, monto_propuesto, activa, asignado_total, asignado_mes, gastado_total, gastado_mes, saldo_sobre'
      )
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },

  // Un solo número por usuario; si aún no hay filas (usuario sin cuentas), 0.
  getDisponible: async (): Promise<number> => {
    const { data, error } = await supabase
      .from('fin_v_disponible')
      .select('disponible')
      .maybeSingle();
    if (error) throw error;
    return data?.disponible ?? 0;
  },

  createAssignment: async (asignacion: NewAssignment) => {
    if (asignacion.monto === 0) throw new Error('El monto de una asignación no puede ser 0.');
    const { error } = await supabase.from('fin_budget_assignments').insert(asignacion);
    if (error) throw error;
  },

  getAssignments: async (limit = 50): Promise<Assignment[]> => {
    const { data, error } = await supabase
      .from('fin_budget_assignments')
      .select('*, budget_account:fin_budget_accounts(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as Assignment[]) ?? [];
  },

  // Corregir una asignación errada = borrarla; las vistas recalculan solas.
  deleteAssignment: async (id: string) => {
    const { error } = await supabase.from('fin_budget_assignments').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Transacciones ──────────────────────────────────────────────────────────
  getTransactions: async (limit = 200): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('fin_transactions')
      .select(TX_SELECT)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as Transaction[]) ?? [];
  },

  createTransaction: async (tx: NewTransaction) => {
    const { error } = await supabase.from('fin_transactions').insert(tx);
    if (error) throw error;
  },

  updateTransaction: async (id: string, cambios: Partial<NewTransaction>) => {
    const { error } = await supabase.from('fin_transactions').update(cambios).eq('id', id);
    if (error) throw error;
  },

  deleteTransaction: async (id: string) => {
    const { error } = await supabase.from('fin_transactions').delete().eq('id', id);
    if (error) throw error;
  },
};
