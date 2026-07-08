import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api, BudgetAccount, MoneyAccount, MoneyAccountTipo } from '../services/api';
import { formatCLP } from '../services/format';
import { showAlert } from './AuthScreen';

// Gestión de las dos entidades del modelo:
//   Cuentas Digitales  = dónde está la plata (banco / app / efectivo).
//   Cuentas (propósito) = para qué es la plata; opcionalmente ligadas a una
//   cuenta digital y con monto propuesto definido por el usuario.
// Las cuentas no se borran (los movimientos las referencian): se desactivan.

type Pestana = 'digitales' | 'proposito';

const TIPOS_DIGITAL: { valor: MoneyAccountTipo; label: string }[] = [
  { valor: 'banco', label: 'BANCO' },
  { valor: 'app', label: 'APP' },
  { valor: 'efectivo', label: 'EFECTIVO' },
];

const AccountsScreen = ({ navigation }: any) => {
  const [pestana, setPestana] = useState<Pestana>('digitales');
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Formulario (sirve para crear y para editar)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipoDigital, setTipoDigital] = useState<MoneyAccountTipo>('banco');
  const [montoPropuesto, setMontoPropuesto] = useState('');
  const [linkedId, setLinkedId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [mas, bas] = await Promise.all([api.getMoneyAccounts(), api.getBudgetAccounts()]);
      setMoneyAccounts(mas);
      setBudgetAccounts(bas);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre('');
    setTipoDigital('banco');
    setMontoPropuesto('');
    setLinkedId(null);
  };

  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    limpiarFormulario();
  };

  const editarDigital = (m: MoneyAccount) => {
    setEditandoId(m.id);
    setNombre(m.nombre);
    setTipoDigital(m.tipo);
  };

  const editarProposito = (b: BudgetAccount) => {
    setEditandoId(b.id);
    setNombre(b.nombre);
    setMontoPropuesto(b.monto_propuesto != null ? String(b.monto_propuesto) : '');
    setLinkedId(b.linked_money_account_id);
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      showAlert('Falta el nombre', 'Ponle nombre a la cuenta.');
      return;
    }
    setGuardando(true);
    try {
      if (pestana === 'digitales') {
        if (editandoId) {
          await api.updateMoneyAccount(editandoId, { nombre: nombre.trim(), tipo: tipoDigital });
        } else {
          await api.createMoneyAccount(nombre.trim(), tipoDigital);
        }
      } else {
        const propuesto = montoPropuesto.trim()
          ? parseInt(montoPropuesto.replace(/[.\s$]/g, ''), 10)
          : null;
        if (montoPropuesto.trim() && (propuesto == null || isNaN(propuesto) || propuesto < 0)) {
          showAlert('Monto inválido', 'El monto propuesto debe ser un número positivo.');
          return;
        }
        if (editandoId) {
          await api.updateBudgetAccount(editandoId, {
            nombre: nombre.trim(),
            monto_propuesto: propuesto,
            linked_money_account_id: linkedId,
          });
        } else {
          await api.createBudgetAccount(nombre.trim(), linkedId, propuesto);
        }
      }
      limpiarFormulario();
      await cargar();
    } catch (err: any) {
      showAlert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternarActiva = async (id: string, activa: boolean) => {
    try {
      if (pestana === 'digitales') {
        await api.updateMoneyAccount(id, { activa: !activa });
      } else {
        await api.updateBudgetAccount(id, { activa: !activa });
      }
      await cargar();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  if (cargando) {
    return (
      <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} />
      </SafeAreaView>
    );
  }

  const TabButton = ({ valor, label }: { valor: Pestana; label: string }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: pestana === valor ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
      }}
      onPress={() => cambiarPestana(valor)}
    >
      <Text
        style={{
          color: pestana === valor ? ZM_COLORS.GOLD : ZM_COLORS.DIM_GRAY,
          fontWeight: '900',
          letterSpacing: 1,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={GLOBAL_STYLES.headerTitle}>CUENTAS</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline' }}>volver</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 20 }}>
          <TabButton valor="digitales" label="DIGITALES (DÓNDE)" />
          <TabButton valor="proposito" label="PROPÓSITO (PARA QUÉ)" />
        </View>

        {/* Formulario crear / editar */}
        <Text style={[GLOBAL_STYLES.sectionTitle, { marginTop: 0 }]}>
          {editandoId ? 'EDITAR CUENTA' : 'NUEVA CUENTA'}
        </Text>
        <TextInput
          style={GLOBAL_STYLES.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder={pestana === 'digitales' ? 'NOMBRE (ej: CuentaRUT)' : 'NOMBRE (ej: Transporte)'}
          placeholderTextColor={ZM_COLORS.DIM_GRAY}
        />

        {pestana === 'digitales' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
            {TIPOS_DIGITAL.map((t) => (
              <TouchableOpacity
                key={t.valor}
                onPress={() => setTipoDigital(t.valor)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  marginRight: 8,
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: tipoDigital === t.valor ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
                  backgroundColor: tipoDigital === t.valor ? ZM_COLORS.GOLD : ZM_COLORS.DARK_GRAY,
                }}
              >
                <Text
                  style={{
                    color: tipoDigital === t.valor ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
                    fontWeight: '900',
                    fontSize: 13,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View>
            <TextInput
              style={GLOBAL_STYLES.input}
              value={montoPropuesto}
              onChangeText={setMontoPropuesto}
              placeholder="MONTO PROPUESTO MENSUAL (OPCIONAL)"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
              keyboardType="number-pad"
            />
            <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, marginBottom: 8, fontFamily: 'monospace' }}>
              VIVE EN (OPCIONAL):
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
              {moneyAccounts
                .filter((m) => m.activa)
                .map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setLinkedId(linkedId === m.id ? null : m.id)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      marginRight: 8,
                      marginBottom: 8,
                      borderWidth: 2,
                      borderColor: linkedId === m.id ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
                      backgroundColor: linkedId === m.id ? ZM_COLORS.GOLD : ZM_COLORS.DARK_GRAY,
                    }}
                  >
                    <Text
                      style={{
                        color: linkedId === m.id ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
                        fontWeight: '900',
                        fontSize: 13,
                      }}
                    >
                      {m.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[GLOBAL_STYLES.primaryButton, { flex: 1 }]}
            onPress={guardar}
            disabled={guardando}
          >
            <Text style={GLOBAL_STYLES.primaryButtonText}>
              {guardando ? 'GUARDANDO...' : editandoId ? 'GUARDAR CAMBIOS' : '+ AGREGAR'}
            </Text>
          </TouchableOpacity>
          {editandoId && (
            <TouchableOpacity
              style={[GLOBAL_STYLES.primaryButton, { backgroundColor: ZM_COLORS.DARK_GRAY, borderColor: ZM_COLORS.BORDER }]}
              onPress={limpiarFormulario}
            >
              <Text style={[GLOBAL_STYLES.primaryButtonText, { color: ZM_COLORS.WHITE }]}>CANCELAR</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Listado */}
        <Text style={GLOBAL_STYLES.sectionTitle}>
          {pestana === 'digitales' ? 'TUS CUENTAS DIGITALES' : 'TUS CUENTAS DE PROPÓSITO'}
        </Text>

        {pestana === 'digitales' &&
          moneyAccounts.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[GLOBAL_STYLES.card, { opacity: m.activa ? 1 : 0.4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => editarDigital(m)}
            >
              <View>
                <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 16 }}>{m.nombre}</Text>
                <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace' }}>
                  {m.tipo.toUpperCase()} · {formatCLP(m.saldo)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => alternarActiva(m.id, m.activa)}>
                <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline', fontSize: 12 }}>
                  {m.activa ? 'desactivar' : 'activar'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

        {pestana === 'proposito' &&
          budgetAccounts.map((b) => {
            const vinculada = moneyAccounts.find((m) => m.id === b.linked_money_account_id);
            return (
              <TouchableOpacity
                key={b.id}
                style={[GLOBAL_STYLES.card, { opacity: b.activa ? 1 : 0.4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => editarProposito(b)}
              >
                <View>
                  <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 16 }}>{b.nombre}</Text>
                  <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace' }}>
                    {[
                      vinculada ? `VIVE EN ${vinculada.nombre.toUpperCase()}` : null,
                      b.monto_propuesto != null ? `PROPUESTO ${formatCLP(b.monto_propuesto)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'SIN VÍNCULO NI MONTO'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => alternarActiva(b.id, b.activa)}>
                  <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline', fontSize: 12 }}>
                    {b.activa ? 'desactivar' : 'activar'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountsScreen;
