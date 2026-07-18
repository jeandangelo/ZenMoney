// =============================================================================
// Un parser por banco. SOLO regex deterministas: si el formato no calza
// exactamente, se retorna null y el correo queda etiquetado zenmoney-error
// para revisión manual. Nada de heurísticas: mejor un error visible que un
// monto inventado.
//
// Cada parser recibe (asunto, cuerpo) y retorna:
//   { monto: entero CLP > 0, tipo: 'gasto' | 'ingreso', comercio: string|null }
// La fecha NO se parsea del correo: se usa la fecha del mensaje (main.js),
// que es determinista y no depende del formato de cada banco.
//
// ⚠ PENDIENTE: los regex se escriben sobre CORREOS REALES que Jean debe
// aportar (1-2 por banco, con datos sensibles tachados). No se inventan
// formatos de memoria. Mientras un parser sea null, ese banco no se ingesta.
// =============================================================================

// Utilidad compartida: "$12.990" / "12.990" / "$ 12.990" → 12990 (entero CLP).
function montoCLP_(texto) {
  if (!texto) return null;
  var limpio = String(texto).replace(/[^0-9]/g, '');
  var n = parseInt(limpio, 10);
  return n > 0 ? n : null;
}

var BANCOS = [
  {
    nombre: 'Banco de Chile',
    slug: 'banco-chile',
    remitente: 'enviodigital@bancochile.cl', // confirmar con un correo real
    parser: function (asunto, cuerpo) {
      // PENDIENTE: regex sobre correo real de Jean.
      return null;
    }
  },
  {
    nombre: 'CuentaRUT (BancoEstado)',
    slug: 'cuentarut',
    remitente: 'bancoestado.cl', // confirmar con un correo real
    parser: function (asunto, cuerpo) {
      // PENDIENTE: regex sobre correo real de Jean.
      return null;
    }
  },
  {
    nombre: 'Tenpo',
    slug: 'tenpo',
    remitente: 'tenpo.cl', // confirmar con un correo real
    parser: function (asunto, cuerpo) {
      // PENDIENTE: regex sobre correo real de Jean.
      return null;
    }
  },
  {
    nombre: 'MercadoPago',
    slug: 'mercadopago',
    remitente: 'mercadopago.com', // confirmar con un correo real
    parser: function (asunto, cuerpo) {
      // PENDIENTE: regex sobre correo real de Jean.
      return null;
    }
  }
];
