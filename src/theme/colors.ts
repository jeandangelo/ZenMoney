import { StyleSheet } from 'react-native';

// Identidad ZenMoney: base Y2K del ecosistema (negro profundo, bordes duros,
// monospace) con acento propio DORADO — el verde ácido queda para ZenTask.
// Verde/rosa se reservan para semántica financiera (ingreso/gasto).
export const ZM_COLORS = {
  GOLD: '#FFC400',          // Acento de marca (botones, títulos, FAB)
  DEEP_BLACK: '#0D0D0D',    // Fondo
  DARK_GRAY: '#1A1A1A',     // Fondo tarjetas e inputs
  BORDER: '#333333',
  WHITE: '#FFFFFF',
  DIM_GRAY: '#888888',

  // Semántica financiera
  INCOME: '#4ADE80',        // Ingresos
  EXPENSE: '#FF4D6D',       // Gastos / acciones destructivas
  TRANSFER: '#38BDF8',      // Traspasos entre cuentas propias

  ERROR: '#FF4D6D',
};

export const GLOBAL_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ZM_COLORS.DEEP_BLACK,
    padding: 20,
  },
  appName: {
    fontSize: 42,
    color: ZM_COLORS.GOLD,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: ZM_COLORS.DIM_GRAY,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'monospace',
  },
  headerTitle: {
    fontSize: 28,
    color: ZM_COLORS.GOLD,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 13,
    color: ZM_COLORS.DIM_GRAY,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: ZM_COLORS.DARK_GRAY,
    borderWidth: 2,
    borderColor: ZM_COLORS.BORDER,
    padding: 14,
    marginBottom: 8,
  },
  input: {
    color: ZM_COLORS.WHITE,
    backgroundColor: ZM_COLORS.DARK_GRAY,
    borderWidth: 2,
    borderColor: ZM_COLORS.BORDER,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: 'bold',
    borderRadius: 0,
  },
  primaryButton: {
    backgroundColor: ZM_COLORS.GOLD,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ZM_COLORS.WHITE,
  },
  primaryButtonText: {
    color: ZM_COLORS.DEEP_BLACK,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
});
