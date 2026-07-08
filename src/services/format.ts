// Formato de montos en pesos chilenos (enteros, sin decimales).
const clp = (() => {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    });
  } catch {
    return null; // Hermes sin Intl completo: usamos el fallback manual
  }
})();

export function formatCLP(monto: number): string {
  if (clp) return clp.format(monto);
  const signo = monto < 0 ? '-' : '';
  const miles = Math.trunc(Math.abs(monto))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${miles}`;
}
