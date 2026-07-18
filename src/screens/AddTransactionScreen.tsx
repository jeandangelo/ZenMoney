import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api, BudgetAccount, MoneyAccount, Transaction, TransactionTipo } from '../services/api';
import { showAlert } from './AuthScreen';

// Objetivo de diseño: registrar un gasto en menos de 10 segundos.
// Camino mínimo: escribir monto (teclado numérico ya abierto) → tocar cuenta
// de propósito → GUARDAR. Cuenta digital y fecha vienen preseleccionadas
// (última usada / hoy). Comercio, nota y fecha viven colapsados en "+ detalle".

const LAST_MONEY_KEY = 'zm_last_money_account';
const LAST_BUDGET_KEY = 'zm_last_budget_account';

const TIPOS: { valor: TransactionTipo; label: string; color: string }[] = [
  { valor: 'gasto', label: 'GASTO', color: ZM_COLORS.EXPENSE },
  { valor: 'ingreso', label: 'INGRESO', color: ZM_COLORS.INCOME },
  { valor: 'traspaso', label: 'TRASPASO', color: ZM_COLORS.TRANSFER },
];

interface ChipProps {
  label: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
}

const Chip = ({ label, selected, color = ZM_COLORS.GOLD, onPress }: ChipProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: selected ? color : ZM_COLORS.BORDER,
      backgroundColor: selected ? color : ZM_COLORS.DARK_GRAY,
    }}
  >
    <Text
      style={{
        color: selected ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
        fontWeight: '900',
        fontSize: 13,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const AddTransactionScreen = ({ navigation, route }: any) => {
  // Si llega una transacción por parámetro, la pantalla funciona en modo edición.
  const editando: Transaction | undefined = route.params?.transaction;

  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [monto, setMonto] = useState(editando ? String(editando.monto) : '');
  const [tipo, setTipo] = useState<TransactionTipo>(editando?.tipo ?? 'gasto');
  const [moneyId, setMoneyId] = useState<string | null>(editando?.money_account_id ?? null);
  const [destinoId, setDestinoId] = useState<string | null>(editando?.money_account_destino_id ?? null);
  const [budgetId, setBudgetId] = useState<string | null>(editando?.budget_account_id ?? null);
  const [comercio, setComercio] = useState(editando?.comercio ?? '');
  const [nota, setNota] = useState(editando?.nota ?? '');
  const [fecha, setFecha] = useState(editando?.fecha ?? format(new Date(), 'yyyy-MM-dd'));
  const [verDetalle, setVerDetalle] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [mas, bas] = await Promise.all([api.getMoneyAccounts(), api.getBudgetAccounts()]);
        const activasM = mas.filter((m) => m.activa);
        const activasB = bas.filter((b) => b.activa);
        setMoneyAccounts(activasM);
        setBudgetAccounts(activasB);

        // Preselección para el camino de 10 segundos: última cuenta usada.
        if (!editando) {
          const [lastMoney, lastBudget] = await Promise.all([
            AsyncStorage.getItem(LAST_MONEY_KEY),
            AsyncStorage.getItem(LAST_BUDGET_KEY),
          ]);
          const money = activasM.find((m) => m.id === lastMoney) ?? activasM[0];
          if (money) setMoneyId(money.id);
          const budget = activasB.find((b) => b.id === lastBudget);
          if (budget) setBudgetId(budget.id);
        }
      } catch (err: any) {
        showAlert('Error', err.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [editando]);

  const hoy = format(new Date(), 'yyyy-MM-dd');
  const ayer = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const colorTipo = useMemo(() => TIPOS.find((t) => t.valor === tipo)!.color, [tipo]);

  const guardar = useCallback(async () => {
    const montoNum = parseInt(monto.replace(/[.\s$]/g, ''), 10);
    if (!montoNum || montoNum <= 0) {
      showAlert('Falta el monto', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!moneyId) {
      showAlert('Falta la cuenta', 'Elige la cuenta digital.');
      return;
    }
    if (tipo === 'traspaso' && (!destinoId || destinoId === moneyId)) {
      showAlert('Traspaso incompleto', 'Elige una cuenta destino distinta del origen.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return;
    }

    setGuardando(true);
    try {
      const tx = {
        fecha,
        monto: montoNum,
        tipo,
        money_account_id: moneyId,
        money_account_destino_id: tipo === 'traspaso' ? destinoId : null,
        budget_account_id: tipo === 'traspaso' ? null : budgetId,
        comercio: comercio.trim() || null,
        nota: nota.trim() || null,
      };
      if (editando) {
        await api.updateTransaction(editando.id, tx);
        // Corregir = enseñar: si el movimiento vino por correo y quedó con
        // sobre asignado, se resuelve la revisión y se aprende la regla
        // comercio→sobre para que el próximo llegue ya categorizado.
        // (Solo hacia adelante: los movimientos pasados no se tocan.)
        if (editando.source === 'email' && tx.budget_account_id) {
          await api.resolveReview(editando.id, tx.budget_account_id, tx.comercio);
        }
      } else {
        await api.createTransaction(tx);
        await AsyncStorage.setItem(LAST_MONEY_KEY, moneyId);
        if (budgetId) await AsyncStorage.setItem(LAST_BUDGET_KEY, budgetId);
      }
      navigation.goBack();
    } catch (err: any) {
      showAlert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  }, [monto, moneyId, destinoId, budgetId, tipo, fecha, comercio, nota, editando, navigation]);

  const eliminar = useCallback(async () => {
    if (!editando) return;
    const confirmado =
      Platform.OS === 'web'
        ? window.confirm('¿Eliminar este movimiento? No se puede deshacer.')
        : true; // en nativo el botón ya exige un toque deliberado en zona propia
    if (!confirmado) return;
    try {
      await api.deleteTransaction(editando.id);
      navigation.goBack();
    } catch (err: any) {
      showAlert('Error al eliminar', err.message);
    }
  }, [editando, navigation]);

  if (cargando) {
    return (
      <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} />
      </SafeAreaView>
    );
  }

  if (moneyAccounts.length === 0) {
    return (
      <SafeAreaView style={GLOBAL_STYLES.container}>
        <Text style={GLOBAL_STYLES.headerTitle}>{editando ? 'EDITAR' : 'REGISTRAR'}</Text>
        <Text style={{ color: ZM_COLORS.DIM_GRAY, marginTop: 20, fontSize: 16 }}>
          Primero crea al menos una cuenta digital en CUENTAS.
        </Text>
        <TouchableOpacity
          style={[GLOBAL_STYLES.primaryButton, { marginTop: 20 }]}
          onPress={() => navigation.replace('Accounts')}
        >
          <Text style={GLOBAL_STYLES.primaryButtonText}>IR A CUENTAS</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={GLOBAL_STYLES.headerTitle}>{editando ? 'EDITAR' : 'REGISTRAR'}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 16, textDecorationLine: 'underline' }}>
              cancelar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tipo */}
        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          {TIPOS.map((t) => (
            <Chip
              key={t.valor}
              label={t.label}
              color={t.color}
              selected={tipo === t.valor}
              onPress={() => setTipo(t.valor)}
            />
          ))}
        </View>

        {/* Monto: el protagonista */}
        <TextInput
          style={[
            GLOBAL_STYLES.input,
            { fontSize: 36, textAlign: 'center', borderColor: colorTipo, marginTop: 8 },
          ]}
          value={monto}
          onChangeText={setMonto}
          placeholder="$ 0"
          placeholderTextColor={ZM_COLORS.DIM_GRAY}
          keyboardType="number-pad"
          autoFocus={!editando}
        />

        {/* Cuenta digital (origen) */}
        <Text style={GLOBAL_STYLES.sectionTitle}>
          {tipo === 'traspaso' ? 'DESDE (CUENTA DIGITAL)' : 'CUENTA DIGITAL'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {moneyAccounts.map((m) => (
            <Chip
              key={m.id}
              label={m.nombre}
              selected={moneyId === m.id}
              onPress={() => setMoneyId(m.id)}
            />
          ))}
        </View>

        {/* Destino solo para traspasos */}
        {tipo === 'traspaso' && (
          <>
            <Text style={GLOBAL_STYLES.sectionTitle}>HACIA (CUENTA DESTINO)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {moneyAccounts
                .filter((m) => m.id !== moneyId)
                .map((m) => (
                  <Chip
                    key={m.id}
                    label={m.nombre}
                    color={ZM_COLORS.TRANSFER}
                    selected={destinoId === m.id}
                    onPress={() => setDestinoId(m.id)}
                  />
                ))}
            </View>
          </>
        )}

        {/* Cuenta de propósito, solo gasto/ingreso (opcional) */}
        {tipo !== 'traspaso' && budgetAccounts.length > 0 && (
          <>
            <Text style={GLOBAL_STYLES.sectionTitle}>CUENTA DE PROPÓSITO (OPCIONAL)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {budgetAccounts.map((b) => (
                <Chip
                  key={b.id}
                  label={b.nombre}
                  selected={budgetId === b.id}
                  onPress={() => setBudgetId(budgetId === b.id ? null : b.id)}
                />
              ))}
            </View>
          </>
        )}

        {/* Fecha rápida */}
        <Text style={GLOBAL_STYLES.sectionTitle}>FECHA</Text>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="HOY" selected={fecha === hoy} onPress={() => setFecha(hoy)} />
          <Chip label="AYER" selected={fecha === ayer} onPress={() => setFecha(ayer)} />
          {fecha !== hoy && fecha !== ayer && <Chip label={fecha} selected onPress={() => {}} />}
        </View>

        {/* Detalle opcional colapsado: no estorba el camino de 10 segundos */}
        <TouchableOpacity onPress={() => setVerDetalle(!verDetalle)}>
          <Text
            style={{
              color: ZM_COLORS.DIM_GRAY,
              textDecorationLine: 'underline',
              marginTop: 16,
              marginBottom: 12,
            }}
          >
            {verDetalle ? '− ocultar detalle' : '+ detalle (comercio, nota, otra fecha)'}
          </Text>
        </TouchableOpacity>
        {verDetalle && (
          <View>
            <TextInput
              style={GLOBAL_STYLES.input}
              value={comercio}
              onChangeText={setComercio}
              placeholder="COMERCIO (ej: LIDER)"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
              autoCapitalize="characters"
            />
            <TextInput
              style={GLOBAL_STYLES.input}
              value={nota}
              onChangeText={setNota}
              placeholder="NOTA"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
            />
            <TextInput
              style={GLOBAL_STYLES.input}
              value={fecha}
              onChangeText={setFecha}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
              autoCapitalize="none"
            />
          </View>
        )}

        <TouchableOpacity
          style={[GLOBAL_STYLES.primaryButton, { backgroundColor: colorTipo, marginTop: 8 }]}
          onPress={guardar}
          disabled={guardando}
        >
          <Text style={GLOBAL_STYLES.primaryButtonText}>
            {guardando ? 'GUARDANDO...' : 'GUARDAR'}
          </Text>
        </TouchableOpacity>

        {editando && (
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 24 }} onPress={eliminar}>
            <Text style={{ color: ZM_COLORS.EXPENSE, textDecorationLine: 'underline', fontSize: 14 }}>
              ELIMINAR MOVIMIENTO
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddTransactionScreen;
