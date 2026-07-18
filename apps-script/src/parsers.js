// =============================================================================
// Un parser por banco. SOLO regex deterministas escritos sobre correos REALES
// de Jean (jul-2026): si el formato no calza exactamente, se retorna null y el
// correo queda etiquetado zenmoney-error para revisión manual. Nada de
// heurísticas: mejor un error visible que un monto inventado.
//
// Cada parser recibe (asunto, cuerpo) — cuerpo = getPlainBody() — y retorna:
//   { monto: entero CLP > 0, tipo: 'gasto' | 'ingreso', comercio: string|null }
// La fecha NO se parsea del correo: se usa la fecha del mensaje (main.js).
//
// Formatos cubiertos (correos de ejemplo del 17-jul-2026):
//   BancoEstado · compra con débito  → "Se ha realizado una compra por $8.500
//                                       en MERCADOPAGO*... asociado a su tarjeta"
//   BancoEstado · TEF enviada        → "Monto transferido: $5.000 ... Hacia:
//                                       Nombre: <destinatario>"
//   MercadoPago · transferencia env. → "Ya enviamos tu transferencia de $ 5.000
//                                       ... Nombre y apellido: <beneficiario>"
// PENDIENTES (a la espera de correos reales): recepción de dinero BancoEstado
// (ingreso), otros formatos MercadoPago, Tenpo, Banco de Chile.
// =============================================================================

// "$12.990" / "12.990" / "$ 12.990" → 12990 (entero CLP).
function montoCLP_(texto) {
  if (!texto) return null;
  var limpio = String(texto).replace(/[^0-9]/g, '');
  var n = parseInt(limpio, 10);
  return n > 0 ? n : null;
}

// Colapsa espacios/saltos de línea de un texto capturado por regex.
function limpiarTexto_(texto) {
  if (!texto) return null;
  var t = String(texto).replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t : null;
}

var BANCOS = [
  {
    nombre: 'BancoEstado (CuentaRUT)',
    slug: 'cuentarut',
    // Cubre noreply@ y notificaciones@ — ambos @correo.bancoestado.cl
    remitente: 'correo.bancoestado.cl',
    parser: function (asunto, cuerpo) {
      // ── Compra con tarjeta de débito ──────────────────────────────────
      // "Se ha realizado una compra por $ / 8.500 / en / MERCADOPAGO*... /
      //  asociado a su tarjeta" (el monto y el comercio vienen en líneas
      //  separadas; \s+ tolera los saltos).
      var compra = cuerpo.match(/compra por\s*\$\s*([\d.,]+)\s+en\s+([\s\S]+?)\s+asociado/i);
      if (compra) {
        var montoCompra = montoCLP_(compra[1]);
        if (!montoCompra) return null;
        return {
          monto: montoCompra,
          tipo: 'gasto',
          comercio: limpiarTexto_(compra[2])
        };
      }

      // ── TEF enviada ───────────────────────────────────────────────────
      // Solo si el texto afirma que Jean la REALIZÓ (la recepción de dinero
      // tiene otro formato que aún no tenemos de ejemplo → null → error).
      if (/Acabas de realizar una Transferencia/i.test(cuerpo)) {
        var montoTef = cuerpo.match(/Monto transferido:\s*\$?\s*([\d.,]+)/i);
        if (!montoTef) return null;
        var monto = montoCLP_(montoTef[1]);
        if (!monto) return null;
        // Destinatario como "comercio": permite reglas por persona frecuente.
        var hacia = cuerpo.match(/Hacia:[\s\S]*?Nombre:\s*([^\n]+)/i);
        return {
          monto: monto,
          tipo: 'gasto',
          comercio: hacia ? limpiarTexto_('TEF ' + hacia[1]) : 'TEF'
        };
      }

      return null;
    }
  },
  {
    nombre: 'MercadoPago',
    slug: 'mercadopago',
    remitente: 'info@mercadopago.com',
    parser: function (asunto, cuerpo) {
      // ── Transferencia enviada ─────────────────────────────────────────
      // "Ya enviamos tu transferencia de $ 5.000" + beneficiario.
      // OJO: si la transferencia es a una cuenta propia (MP→CuentaRUT) en
      // realidad es un traspaso; entra como gasto POR REVISAR y Jean decide.
      if (/transferencia/i.test(asunto)) {
        var m = cuerpo.match(/transferencia de\s*\$\s*([\d.,]+)/i);
        if (!m) return null;
        var monto = montoCLP_(m[1]);
        if (!monto) return null;
        var ben = cuerpo.match(/Nombre y apellido:\s*([\s\S]+?)\s*Entidad/i);
        return {
          monto: monto,
          tipo: 'gasto',
          comercio: ben ? limpiarTexto_('TEF ' + ben[1]) : 'TEF'
        };
      }
      // Otros correos de MercadoPago (pagos, compras): pendientes de ejemplo.
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
    nombre: 'Banco de Chile',
    slug: 'banco-chile',
    remitente: 'bancochile.cl', // confirmar con un correo real
    parser: function (asunto, cuerpo) {
      // PENDIENTE: regex sobre correo real de Jean.
      return null;
    }
  }
];
