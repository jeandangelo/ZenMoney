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
import { api, MoneyAccount, Sobre } from '../services/api';
import { formatCLP } from '../services/format';
import { supabase } from '../services/supabase';
import { showAlert } from './AuthScreen';

// Dashboard: responde "¿cuánto tengo, cuánto queda por destinar y cuánto queda
// en cada sobre?" de un vistazo. Todas las cifras vienen de vistas SQL
// calculadas sobre transacciones y asignaciones; aquí nunca se acumula ni
// persiste un saldo.

const DashboardScreen = ({ navigation }: any) => {
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [sobres, setSobres] = useState<Sobre[]>([]);
  const [disponible, setDisponible] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [mas, sbs, disp] = await Promise.all([
        api.getMoneyAccounts(),
        api.getSobres(),
        api.getDisponible(),
      ]);
      setMoneyAccounts(mas.filter((m) => m.activa));
      setSobres(sbs.filter((s) => s.activa));
      setDisponible(disp);
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

            {/* Disponible sin asignar: el número central del modelo de sobres.
                La plata que todavía no tiene destino. El patrimonio pasa a ser
                referencia secundaria dentro de la misma tarjeta. */}
            <View style={[GLOBAL_STYLES.card, { marginTop: 20, borderColor: ZM_COLORS.GOLD, padding: 20 }]}>
              <Text style={{ color: ZM_COLORS.DIM_GRAY, fontFamily: 'monospace', letterSpacing: 2, fontSize: 12 }}>
                DISPONIBLE SIN ASIGNAR
              </Text>
              <Text
                style={{
                  color: disponible < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.GOLD,
                  fontSize: 40,
                  fontWeight: '900',
                  marginTop: 4,
                }}
              >
                {formatCLP(disponible)}
              </Text>
              <Text style={{ color: ZM_COLORS.DIM_GRAY, fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}>
                PATRIMONIO TOTAL {formatCLP(total)}
              </Text>
            </View>

            {/* Acciones. Flujo de fin de mes: llega el sueldo → REGISTRAR el
                ingreso → ASIGNAR a sobres; ambos deben estar a un toque. */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[GLOBAL_STYLES.primaryButton, { flex: 1 }]}
                onPress={() => navigation.navigate('AddTransaction')}
              >
                <Text style={GLOBAL_STYLES.primaryButtonText}>+ REGISTRAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[GLOBAL_STYLES.primaryButton, { flex: 1, backgroundColor: ZM_COLORS.DEEP_BLACK, borderColor: ZM_COLORS.GOLD }]}
                onPress={() => navigation.navigate('Assign')}
              >
                <Text style={[GLOBAL_STYLES.primaryButtonText, { color: ZM_COLORS.GOLD }]}>ASIGNAR</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
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

            {/* Sobres: lo que QUEDA en cada uno (asignado − gastado, histórico).
                Negativo = gastó más de lo asignado: se informa en rojo, jamás
                se bloquea. Abajo, la referencia del mes que definió el usuario
                — la app nunca sugiere cuánto asignar. */}
            <Text style={GLOBAL_STYLES.sectionTitle}>SOBRES · LO QUE QUEDA</Text>
            {sobres.length === 0 && (
              <Text style={{ color: ZM_COLORS.DIM_GRAY }}>
                Sin sobres todavía. Crea Transporte, Comida, etc. en CUENTAS y reparte tu plata con ASIGNAR.
              </Text>
            )}
            {sobres.map((s) => (
              <View key={s.id} style={GLOBAL_STYLES.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold', fontSize: 16 }}>{s.nombre}</Text>
                  <Text
                    style={{
                      color: s.saldo_sobre < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.WHITE,
                      fontWeight: '900',
                      fontSize: 18,
                    }}
                  >
                    {formatCLP(s.saldo_sobre)}
                  </Text>
                </View>
                <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginTop: 6 }}>
                  {[
                    `ASIGNADO ${formatCLP(s.asignado_mes)}`,
                    s.monto_propuesto != null ? `REF ${formatCLP(s.monto_propuesto)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;
