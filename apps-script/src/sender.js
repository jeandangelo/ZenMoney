// =============================================================================
// Envío del payload a la Edge Function. Los secretos viven en
// PropertiesService (Configuración del proyecto → Propiedades del script),
// JAMÁS en este código ni en git:
//   INGEST_URL    = https://<REF>.supabase.co/functions/v1/ingest-email-tx
//   INGEST_SECRET = el mismo hex configurado en supabase secrets
// =============================================================================

function enviarMovimiento(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('INGEST_URL');
  var secreto = props.getProperty('INGEST_SECRET');
  if (!url || !secreto) {
    throw new Error('Faltan INGEST_URL / INGEST_SECRET en Propiedades del script');
  }

  var respuesta = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-secret': secreto },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // el error lo maneja main.js etiquetando el correo
  });

  return {
    ok: respuesta.getResponseCode() === 200,
    status: respuesta.getResponseCode(),
    body: respuesta.getContentText()
  };
}
