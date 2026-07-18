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
// Los ingresados por correo llevan ✉; los pendientes de revisión se
// destacan y tienen su propio filtro (el dashboard llega aquí filtrado).

const COLOR_TIPO = {
  gasto: ZM_COLORS.EXPENSE,
  ingreso: ZM_COLORS.INCOME,
  traspaso: ZM_COLORS.TRANSFER,
} as const;

const SIGNO = { gasto: '-', ingreso: '+', traspaso: '⇄' } as const;

type Filtro = 'todos' | 'revisar';

const HistoryScreen = ({ navigation, route }: any) => {
  const [transacciones, setTransacciones] = useState<Transaction[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>(route.params?.filtro === 'revisar' ? 'revisar' : 'todos');

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
      item.source === 'email' ? '✉' : null, // vino solo, por correo del banco
      item.fecha,
      item.tipo !== 'traspaso' ? item.money_account?.nombre : null,
      item.budget_account?.nombre,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <TouchableOpacity
        style={[
          GLOBAL_STYLES.card,
          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
          // Pendiente de revisión: borde destacado; se resuelve tocándolo
          // y asignándole cuenta de propósito (la app aprende la regla).
          item.needs_review && { borderColor: ZM_COLORS.EXPENSE },
        ]}
        onPress={() => navigation.navigate('AddTransaction', { transaction: item })}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 15 }} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
            {detalle}
          </Text>
          {item.needs_review && (
            <Text style={{ color: ZM_COLORS.EXPENSE, fontSize: 11, fontFamily: 'monospace', marginTop: 2, letterSpacing: 1 }}>
              POR REVISAR — toca para asignar sobre
            </Text>
          )}
        </View>
        <Text style={{ color: COLOR_TIPO[item.tipo], fontWeight: '900', fontSize: 16 }}>
          {SIGNO[item.tipo]} {formatCLP(item.monto)}
        </Text>
      </TouchableOpacity>
    );
  };

  const visibles = filtro === 'revisar' ? transacciones.filter((t) => t.needs_review) : transacciones;
  const pendientes = transacciones.filter((t) => t.needs_review).length;

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={GLOBAL_STYLES.headerTitle}>MOVIMIENTOS</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline' }}>volver</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro rápido: TODOS / POR REVISAR */}
      <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
        {(
          [
            { valor: 'todos', label: 'TODOS' },
            { valor: 'revisar', label: `POR REVISAR${pendientes > 0 ? ` (${pendientes})` : ''}` },
          ] as { valor: Filtro; label: string }[]
        ).map((f) => (
          <TouchableOpacity
            key={f.valor}
            onPress={() => setFiltro(f.valor)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderWidth: 2,
              borderColor: filtro === f.valor ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
              backgroundColor: filtro === f.valor ? ZM_COLORS.GOLD : ZM_COLORS.DARK_GRAY,
            }}
          >
            <Text
              style={{
                color: filtro === f.valor ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
                fontWeight: '900',
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ color: ZM_COLORS.DIM_GRAY, textAlign: 'center', marginTop: 40 }}>
              {filtro === 'revisar' ? 'Nada por revisar. Todo categorizado.' : 'Sin movimientos todavía.'}
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default HistoryScreen;
