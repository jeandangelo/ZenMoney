// =============================================================================
// ZenMoney — ingesta de correos bancarios (extractor TONTO)
// Este script NO decide nada: lee correos, extrae datos con los regex de
// parsers.js y los manda a la Edge Function. Toda la lógica vive en Supabase.
//
// Trigger: temporal cada 10-15 min sobre procesarCorreos() (ver README.md).
// Etiquetas: zenmoney-procesado (OK o duplicado) / zenmoney-error (revisar).
// Un correo malo jamás frena la cola: se etiqueta error y se sigue.
// =============================================================================

var ETIQUETA_OK = 'zenmoney-procesado';
var ETIQUETA_ERROR = 'zenmoney-error';

function procesarCorreos() {
  var etiquetaOk = obtenerEtiqueta_(ETIQUETA_OK);
  var etiquetaError = obtenerEtiqueta_(ETIQUETA_ERROR);

  // Solo correos de bancos configurados, sin procesar, de la última semana
  // (la ventana evita re-escanear todo el buzón en cada corrida).
  var remitentes = BANCOS.map(function (b) { return 'from:(' + b.remitente + ')'; }).join(' OR ');
  var query = '(' + remitentes + ') -label:' + ETIQUETA_OK + ' -label:' + ETIQUETA_ERROR + ' newer_than:7d';
  var hilos = GmailApp.search(query, 0, 50);

  hilos.forEach(function (hilo) {
    try {
      // Los bancos mandan un correo por hilo; se procesa el primero.
      var mensaje = hilo.getMessages()[0];
      var banco = identificarBanco_(mensaje.getFrom());
      if (!banco) throw new Error('remitente sin banco configurado');

      var datos = banco.parser(mensaje.getSubject(), mensaje.getPlainBody());
      if (!datos) throw new Error('el parser no reconoció el formato');

      var payload = {
        gmail_message_id: mensaje.getId(),
        fecha: Utilities.formatDate(mensaje.getDate(), 'America/Santiago', 'yyyy-MM-dd'),
        monto: datos.monto,
        tipo: datos.tipo,
        cuenta_slug: banco.slug,
        comercio: datos.comercio || null,
        raw_asunto: mensaje.getSubject()
      };

      var respuesta = enviarMovimiento(payload);
      if (respuesta.ok) {
        hilo.addLabel(etiquetaOk);
      } else {
        Logger.log('Edge Function respondió ' + respuesta.status + ': ' + respuesta.body);
        hilo.addLabel(etiquetaError);
      }
    } catch (e) {
      Logger.log('Error en hilo "' + hilo.getFirstMessageSubject() + '": ' + e.message);
      hilo.addLabel(etiquetaError);
    }
  });
}

// La etiqueta se crea sola la primera vez.
function obtenerEtiqueta_(nombre) {
  return GmailApp.getUserLabelByName(nombre) || GmailApp.createLabel(nombre);
}

function identificarBanco_(remitente) {
  for (var i = 0; i < BANCOS.length; i++) {
    if (remitente.toLowerCase().indexOf(BANCOS[i].remitente.toLowerCase()) !== -1) {
      return BANCOS[i];
    }
  }
  return null;
}
