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
import { format } from 'date-fns';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api, Assignment, Sobre } from '../services/api';
import { formatCLP } from '../services/format';
import { showAlert } from './AuthScreen';

// Asignar: repartir el disponible en sobres ANTES de gastarlo. Es el flujo de
// fin de mes (llega el sueldo → registrar ingreso → asignar), así que tiene el
// mismo estándar de velocidad que el gasto: menos de 10 segundos.
// La pantalla NO navega atrás al guardar: refresca cifras y limpia el monto,
// para encadenar varias asignaciones seguidas (Transporte, Comida, …).
// En la UI nunca se muestra el signo del monto: se muestra la DIRECCIÓN
// (asignar al sobre / devolver al disponible).

type Direccion = 'asignar' | 'devolver';

const DIRECCIONES: { valor: Direccion; label: string }[] = [
  { valor: 'asignar', label: 'ASIGNAR AL SOBRE' },
  { valor: 'devolver', label: 'DEVOLVER AL DISPONIBLE' },
];

const AssignScreen = ({ navigation }: any) => {
  const [sobres, setSobres] = useState<Sobre[]>([]);
  const [disponible, setDisponible] = useState(0);
  const [asignaciones, setAsignaciones] = useState<Assignment[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [direccion, setDireccion] = useState<Direccion>('asignar');
  const [monto, setMonto] = useState('');
  const [sobreId, setSobreId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nota, setNota] = useState('');
  const [verDetalle, setVerDetalle] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [sbs, disp, asgs] = await Promise.all([
        api.getSobres(),
        api.getDisponible(),
        api.getAssignments(10),
      ]);
      setSobres(sbs.filter((s) => s.activa));
      setDisponible(disp);
      setAsignaciones(asgs);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Previsualización en vivo: cómo quedarían el disponible y el sobre elegido.
  // Solo informa — si el disponible queda negativo se advierte en rojo, pero
  // la app nunca bloquea ni decide por el usuario.
  const montoNum = parseInt(monto.replace(/[.\s$]/g, ''), 10) || 0;
  const montoFirmado = direccion === 'asignar' ? montoNum : -montoNum;
  const sobreElegido = useMemo(() => sobres.find((s) => s.id === sobreId), [sobres, sobreId]);
  const disponibleResultante = disponible - montoFirmado;
  const saldoSobreResultante = sobreElegido ? sobreElegido.saldo_sobre + montoFirmado : null;

  const guardar = useCallback(async () => {
    if (!montoNum || montoNum <= 0) {
      showAlert('Falta el monto', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!sobreId) {
      showAlert('Falta el sobre', 'Elige a qué sobre va (o de cuál vuelve).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return;
    }
    setGuardando(true);
    try {
      await api.createAssignment({
        budget_account_id: sobreId,
        monto: montoFirmado,
        fecha,
        nota: nota.trim() || null,
      });
      // Limpiar solo el monto y la nota: sobre y fecha suelen repetirse
      // al encadenar asignaciones del mismo día.
      setMonto('');
      setNota('');
      await cargar();
    } catch (err: any) {
      showAlert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  }, [montoNum, montoFirmado, sobreId, fecha, nota, cargar]);

  const eliminarAsignacion = useCallback(
    async (a: Assignment) => {
      const confirmado =
        Platform.OS === 'web'
          ? window.confirm('¿Borrar esta asignación? Los saldos se recalculan solos.')
          : true; // en nativo el enlace ya exige un toque deliberado
      if (!confirmado) return;
      try {
        await api.deleteAssignment(a.id);
        await cargar();
      } catch (err: any) {
        showAlert('Error al borrar', err.message);
      }
    },
    [cargar]
  );

  if (cargando) {
    return (
      <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ZM_COLORS.GOLD} />
      </SafeAreaView>
    );
  }

  if (sobres.length === 0) {
    return (
      <SafeAreaView style={GLOBAL_STYLES.container}>
        <Text style={GLOBAL_STYLES.headerTitle}>ASIGNAR</Text>
        <Text style={{ color: ZM_COLORS.DIM_GRAY, marginTop: 20 }}>
          No tienes sobres activos. Crea primero una cuenta de propósito (Transporte, Comida…) en CUENTAS.
        </Text>
        <TouchableOpacity
          style={[GLOBAL_STYLES.primaryButton, { marginTop: 20 }]}
          onPress={() => navigation.navigate('Accounts')}
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
          <Text style={GLOBAL_STYLES.headerTitle}>ASIGNAR</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline' }}>volver</Text>
          </TouchableOpacity>
        </View>

        {/* El disponible siempre a la vista mientras se reparte */}
        <View style={[GLOBAL_STYLES.card, { marginTop: 16, borderColor: ZM_COLORS.GOLD }]}>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, fontFamily: 'monospace', letterSpacing: 2, fontSize: 12 }}>
            DISPONIBLE SIN ASIGNAR
          </Text>
          <Text
            style={{
              color: disponible < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.GOLD,
              fontSize: 28,
              fontWeight: '900',
              marginTop: 2,
            }}
          >
            {formatCLP(disponible)}
          </Text>
        </View>

        {/* Dirección */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          {DIRECCIONES.map((d) => (
            <TouchableOpacity
              key={d.valor}
              onPress={() => setDireccion(d.valor)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: direccion === d.valor ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
                backgroundColor: direccion === d.valor ? ZM_COLORS.GOLD : ZM_COLORS.DARK_GRAY,
              }}
            >
              <Text
                style={{
                  color: direccion === d.valor ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
                  fontWeight: '900',
                  fontSize: 13,
                }}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monto: teclado numérico directo, camino de 10 segundos */}
        <TextInput
          style={[GLOBAL_STYLES.input, { fontSize: 28, fontWeight: '900' }]}
          value={monto}
          onChangeText={setMonto}
          placeholder="$ MONTO"
          placeholderTextColor={ZM_COLORS.DIM_GRAY}
          keyboardType="number-pad"
          autoFocus
        />

        {/* Sobre */}
        <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, marginBottom: 8, fontFamily: 'monospace' }}>
          {direccion === 'asignar' ? 'AL SOBRE:' : 'DESDE EL SOBRE:'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
          {sobres.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSobreId(s.id)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: sobreId === s.id ? ZM_COLORS.GOLD : ZM_COLORS.BORDER,
                backgroundColor: sobreId === s.id ? ZM_COLORS.GOLD : ZM_COLORS.DARK_GRAY,
              }}
            >
              <Text
                style={{
                  color: sobreId === s.id ? ZM_COLORS.DEEP_BLACK : ZM_COLORS.WHITE,
                  fontWeight: '900',
                  fontSize: 13,
                }}
              >
                {s.nombre}
              </Text>
              <Text
                style={{
                  color: sobreId === s.id ? ZM_COLORS.DEEP_BLACK : s.saldo_sobre < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.DIM_GRAY,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  marginTop: 2,
                }}
              >
                {formatCLP(s.saldo_sobre)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Previsualización del resultado */}
        {montoNum > 0 && sobreElegido && (
          <View style={[GLOBAL_STYLES.card, { borderColor: disponibleResultante < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.BORDER }]}>
            <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace' }}>
              QUEDARÍA → DISPONIBLE{' '}
              <Text style={{ color: disponibleResultante < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.WHITE, fontWeight: '900' }}>
                {formatCLP(disponibleResultante)}
              </Text>
              {' · '}
              {sobreElegido.nombre.toUpperCase()}{' '}
              <Text style={{ color: (saldoSobreResultante ?? 0) < 0 ? ZM_COLORS.EXPENSE : ZM_COLORS.WHITE, fontWeight: '900' }}>
                {formatCLP(saldoSobreResultante ?? 0)}
              </Text>
            </Text>
            {disponibleResultante < 0 && (
              <Text style={{ color: ZM_COLORS.EXPENSE, fontSize: 12, marginTop: 6 }}>
                Estarías asignando más de lo que tienes disponible. Se permite, pero revisa.
              </Text>
            )}
          </View>
        )}

        {/* Fecha y nota, colapsadas: el camino rápido no las necesita */}
        <TouchableOpacity onPress={() => setVerDetalle(!verDetalle)}>
          <Text style={{ color: ZM_COLORS.DIM_GRAY, textDecorationLine: 'underline', marginBottom: 12 }}>
            {verDetalle ? '− ocultar detalle' : '+ detalle (fecha, nota)'}
          </Text>
        </TouchableOpacity>
        {verDetalle && (
          <View>
            <TextInput
              style={GLOBAL_STYLES.input}
              value={fecha}
              onChangeText={setFecha}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
            />
            <TextInput
              style={GLOBAL_STYLES.input}
              value={nota}
              onChangeText={setNota}
              placeholder="NOTA (OPCIONAL)"
              placeholderTextColor={ZM_COLORS.DIM_GRAY}
            />
          </View>
        )}

        <TouchableOpacity style={GLOBAL_STYLES.primaryButton} onPress={guardar} disabled={guardando}>
          <Text style={GLOBAL_STYLES.primaryButtonText}>
            {guardando ? 'GUARDANDO...' : direccion === 'asignar' ? 'ASIGNAR' : 'DEVOLVER'}
          </Text>
        </TouchableOpacity>

        {/* Últimas asignaciones: corregir un error = borrar la fila */}
        {asignaciones.length > 0 && (
          <View>
            <Text style={GLOBAL_STYLES.sectionTitle}>ÚLTIMAS ASIGNACIONES</Text>
            {asignaciones.map((a) => (
              <View
                key={a.id}
                style={[GLOBAL_STYLES.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ZM_COLORS.WHITE, fontWeight: 'bold' }}>
                    {a.monto >= 0 ? '→ ' : '← '}
                    {a.budget_account?.nombre ?? 'Sobre'}
                    <Text style={{ color: a.monto >= 0 ? ZM_COLORS.WHITE : ZM_COLORS.TRANSFER, fontWeight: '900' }}>
                      {'  '}{formatCLP(Math.abs(a.monto))}
                    </Text>
                  </Text>
                  <Text style={{ color: ZM_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
                    {a.fecha}
                    {a.monto < 0 ? ' · DEVOLUCIÓN' : ''}
                    {a.nota ? ` · ${a.nota}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => eliminarAsignacion(a)}>
                  <Text style={{ color: ZM_COLORS.EXPENSE, textDecorationLine: 'underline', fontSize: 12 }}>
                    borrar
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AssignScreen;
