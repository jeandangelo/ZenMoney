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

// Fila de la vista fin_v_budget_mes ("Cuentas" de propósito + gastado del mes)
export interface BudgetAccount {
  id: string;
  nombre: string;
  linked_money_account_id: string | null;
  monto_propuesto: number | null;
  activa: boolean;
  gastado_mes: number;
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

  // ── Cuentas de propósito ───────────────────────────────────────────────────
  getBudgetAccounts: async (): Promise<BudgetAccount[]> => {
    const { data, error } = await supabase
      .from('fin_v_budget_mes')
      .select('id, nombre, linked_money_account_id, monto_propuesto, activa, gastado_mes')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },

  createBudgetAccount: async (
    nombre: string,
    linked_money_account_id: string | null,
    monto_propuesto: number | null
  ) => {
    const { error } = await supabase
      .from('fin_budget_accounts')
      .insert({ nombre, linked_money_account_id, monto_propuesto });
    if (error) throw error;
  },

  updateBudgetAccount: async (
    id: string,
    cambios: Partial<
      Pick<BudgetAccount, 'nombre' | 'linked_money_account_id' | 'monto_propuesto' | 'activa'>
    >
  ) => {
    const { error } = await supabase.from('fin_budget_accounts').update(cambios).eq('id', id);
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
