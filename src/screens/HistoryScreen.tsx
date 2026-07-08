import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api, Transaction } from '../services/api';
import { formatCLP } from '../services/format';
import { showAlert } from './AuthScreen';

// Historial de movimientos. Tocar uno lo abre en modo edición
// (corregir cuenta, comercio, monto o eliminarlo).

const COLOR_TIPO = {
  gasto: ZM_COLORS.EXPENSE,
  ingreso: ZM_COLORS.INCOME,
  traspaso: ZM_COLORS.TRANSFER,
} as const;

const SIGNO = { gasto: '-', ingreso: '+', traspaso: '⇄' } as const;

const HistoryScreen = ({ navigation }: any) => {
  const [transacciones, setTransacciones] = useState<Transaction[]>([]);
  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const cargar = async () => {
        try {
          setTransacciones(await api.getTransactions());
        } catch (err: any) {
          showAlert('Error', err.message);
        } finally {
          setCargando(false);
        }
      };
      cargar();
    }, [])
  );

  const renderItem = ({ item }: { item: Transaction }) => {
    const titulo =
      item.comercio ??
      (item.tipo === 'traspaso'
        ? `${item.money_account?.nombre ?? '?'} → ${item.money_account_destino?.nombre ?? '?'}`
        : item.nota ?? item.tipo.toUpperCase());

    const detalle = [
      item.fecha,
      item.tipo !== 'traspaso' ? item.money_account?.nombre : null,
      item.budget_account?.nombre,
      item.needs_review ? '⚠ REVISAR' : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <TouchableOpacity
        style={[GLOBAL_STYLES.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => navigation.navigate('AddTransaction', { transaction: item })}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 15 }} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
            {detalle}
          </Text>
        </View>
        <Text style={{ color: COLOR_TIPO[item.tipo], fontWeight: '900', fontSize: 16 }}>
          {SIGNO[item.tipo]} {formatCLP(item.monto)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={GLOBAL_STYLES.headerTitle}>MOVIMIENTOS</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline' }}>volver</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={transacciones}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ color: ZM_COLORS.DIM_GRAY, textAlign: 'center', marginTop: 40 }}>
              Sin movimientos todavía.
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default HistoryScreen;
