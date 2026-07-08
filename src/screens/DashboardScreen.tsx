import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api, BudgetAccount, MoneyAccount } from '../services/api';
import { formatCLP } from '../services/format';
import { supabase } from '../services/supabase';
import { showAlert } from './AuthScreen';

// Dashboard: responde "¿cuánto tengo y en qué lo gasté?" de un vistazo.
// Todas las cifras vienen de vistas SQL calculadas sobre transacciones;
// aquí nunca se acumula ni persiste un saldo.

const DashboardScreen = ({ navigation }: any) => {
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [mas, bas] = await Promise.all([api.getMoneyAccounts(), api.getBudgetAccounts()]);
      setMoneyAccounts(mas.filter((m) => m.activa));
      setBudgetAccounts(bas.filter((b) => b.activa));
    } catch (err: any) {
      showAlert('Error cargando datos', err.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Recargar cada vez que la pantalla vuelve a estar en foco
  // (después de registrar un movimiento o editar cuentas).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const total = moneyAccounts.reduce((suma, m) => suma + m.saldo, 0);

  if (cargando) {
    return (
      <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar();
            }}
            tintColor={ZM_COLORS.GOLD}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Encabezado */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={GLOBAL_STYLES.headerTitle}>ZENMONEY</Text>
              <TouchableOpacity onPress={() => supabase.auth.signOut()}>
                <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline' }}>salir</Text>
              </TouchableOpacity>
            </View>

            {/* Patrimonio total */}
            <View style={[GLOBAL_STYLES.card, { marginTop: 20, borderColor: ZM_COLORS.GOLD, padding: 20 }]}>
              <Text style={{ color: ZM_COLORS.DIM_GRAY, fontFamily: 'monospace', letterSpacing: 2, fontSize: 12 }}>
                PATRIMONIO TOTAL
              </Text>
              <Text style={{ color: ZM_COLORS.GOLD, fontSize: 40, fontWeight: '900', marginTop: 4 }}>
                {formatCLP(total)}
              </Text>
            </View>

            {/* Acciones */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[GLOBAL_STYLES.primaryButton, { flex: 1.2 }]}
                onPress={() => navigation.navigate('AddTransaction')}
              >
                <Text style={GLOBAL_STYLES.primaryButtonText}>+ REGISTRAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[GLOBAL_STYLES.primaryButton, { flex: 1, backgroundColor: ZM_COLORS.DARK_GRAY, borderColor: ZM_COLORS.BORDER }]}
                onPress={() => navigation.navigate('History')}
              >
                <Text style={[GLOBAL_STYLES.primaryButtonText, { color: ZM_COLORS.WHITE }]}>MOVIM.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[GLOBAL_STYLES.primaryButton, { flex: 1, backgroundColor: ZM_COLORS.DARK_GRAY, borderColor: ZM_COLORS.BORDER }]}
                onPress={() => navigation.navigate('Accounts')}
              >
                <Text style={[GLOBAL_STYLES.primaryButtonText, { color: ZM_COLORS.WHITE }]}>CUENTAS</Text>
              </TouchableOpacity>
            </View>

            {/* Cuentas digitales */}
            <Text style={GLOBAL_STYLES.sectionTitle}>CUENTAS DIGITALES</Text>
            {moneyAccounts.length === 0 && (
              <Text style={{ color: ZM_COLORS.DIM_GRAY }}>
                Sin cuentas todavía. Crea la primera en CUENTAS.
              </Text>
            )}
            {moneyAccounts.map((m) => (
              <View
                key={m.id}
                style={[GLOBAL_STYLES.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              >
                <View>
                  <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 16 }}>{m.nombre}</Text>
                  <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace' }}>
                    {m.tipo.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={{
                    color: m.saldo < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.WHITE,
                    fontWeight: '900',
                    fontSize: 18,
                  }}
                >
                  {formatCLP(m.saldo)}
                </Text>
              </View>
            ))}

            {/* Cuentas de propósito */}
            <Text style={GLOBAL_STYLES.sectionTitle}>CUENTAS DE PROPÓSITO · ESTE MES</Text>
            {budgetAccounts.length === 0 && (
              <Text style={{ color: ZM_COLORS.DIM_GRAY }}>
                Sin cuentas de propósito. Crea Transporte, Comida, etc. en CUENTAS.
              </Text>
            )}
            {budgetAccounts.map((b) => {
              const proporcion =
                b.monto_propuesto && b.monto_propuesto > 0
                  ? Math.min(b.gastado_mes / b.monto_propuesto, 1)
                  : null;
              const excedido = b.monto_propuesto != null && b.gastado_mes > b.monto_propuesto;
              return (
                <View key={b.id} style={GLOBAL_STYLES.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 16 }}>{b.nombre}</Text>
                    <Text style={{ color: excedido ? ZM_COLORS.EXPENSE : ZM_COLORS.WHITE, fontWeight: '900' }}>
                      {formatCLP(b.gastado_mes)}
                      {b.monto_propuesto != null && (
                        <Text style={{ color: ZM_COLORS.DIM_GRAY, fontWeight: 'normal' }}>
                          {' '}/ {formatCLP(b.monto_propuesto)}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {proporcion != null && (
                    <View style={{ height: 6, backgroundColor: ZM_COLORS.BORDER, marginTop: 10 }}>
                      <View
                        style={{
                          height: 6,
                          width: `${proporcion * 100}%`,
                          backgroundColor: excedido ? ZM_COLORS.EXPENSE : ZM_COLORS.GOLD,
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;
