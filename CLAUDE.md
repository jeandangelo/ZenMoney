# CLAUDE.md — ZenMoney

## Qué es
App de finanzas personales de Jean (Fase 2 del ecosistema, hermana de ZenTask).
Responde "¿cuánto tengo y en qué lo gasté?" sin decidir por el usuario.
Documento de diseño: el MD de contexto de Fase 2 (decisiones ya tomadas;
ante ambigüedad, preguntar antes de asumir).

## Modelo conceptual (terminología de la UI)
- **Cuentas Digitales** (`fin_money_accounts`) = dónde está la plata
  (Banco de Chile, CuentaRUT, Tenpo, MercadoPago, efectivo…).
- **Cuentas de propósito / SOBRES** (`fin_budget_accounts`) = para qué es la
  plata (Transporte, Comida…), con `monto_propuesto` como referencia mensual
  que define el usuario — la app NUNCA sugiere montos.
- **Asignaciones** (`fin_budget_assignments`) = destinar plata del "disponible
  sin asignar" a un sobre ANTES de gastarla. No son transacciones: no mueven
  plata de banco ni cambian el patrimonio. Saldo de sobre = asignado − gastado
  (vista `fin_v_sobres`); disponible = patrimonio − suma de sobres
  (vista `fin_v_disponible`). Un sobre puede quedar negativo: se informa en
  rojo, nunca se bloquea. Corregir una asignación = borrar la fila.
- Toda transacción pertenece a una cuenta digital; gastos/ingresos además
  pueden apuntar a una cuenta de propósito (y así descuentan del sobre).

## Invariantes que no se negocian
1. **El saldo NUNCA se almacena en una fila.** Todo saldo es una vista SQL
   calculada sobre `fin_transactions` (la corrupción del sistema anterior
   nació de acumular saldo fila a fila).
2. **Traspasos entre cuentas propias NO son gastos**: una sola fila con
   origen y destino; el patrimonio total no cambia.
3. **RLS en todas las tablas `fin_`** desde el primer SQL.
4. **Cero secretos en el código**: credenciales solo en `.env`
   (EXPO_PUBLIC_*, ver `.env.example`).
5. Registrar un gasto manual toma **menos de 10 segundos**.
6. Presupuesto **$0**: tiers gratuitos solamente.

## Arquitectura
- **Backend**: Supabase — LA MISMA instancia que ZenTask; las tablas de
  finanzas usan prefijo `fin_`. Esquema completo en `supabase/fin_schema.sql`
  (fuente de verdad; cualquier cambio de esquema se hace ahí y se re-ejecuta
  en el SQL Editor). Mostrar todo SQL al usuario ANTES de ejecutarlo.
- **Frontend**: Expo / React Native con soporte web (mismo patrón que
  ZenTask-App). `src/services/api.ts` es la única capa que habla con
  Supabase; las pantallas no hacen queries directas.
- **Identidad visual**: base Y2K del ecosistema con acento propio DORADO
  (`src/theme/colors.ts`, decisión jul-2026). Verde/rosa/cian quedan para
  semántica ingreso/gasto/traspaso.
- **Despliegue**: PWA en GitHub Pages vía `scripts/deploy-web.ps1`
  (mismo camino probado de ZenTask).

## Fases
- **Fase A (actual)**: MVP manual — cuentas, registro <10s, dashboard,
  historial con edición, corriendo en PC y celular.
- **Fase B**: ingesta de correos con Apps Script profesionalizado (clasp +
  git, secretos en PropertiesService, parser determinista, idempotencia por
  `gmail_message_id` UNIQUE). El script es extractor tonto; la lógica vive
  en Supabase. `fin_merchant_rules` ya existe para el aprendizaje de
  categorías.
- **Fase C**: integración con la shopping list de ZenTask.
No agregar features de fases futuras sin preguntar.

## Comandos
```powershell
npm run web        # dev server web
npm run android    # dev en celular vía Expo Go
npm run typecheck  # tsc --noEmit — correr antes de commit
powershell -ExecutionPolicy Bypass -File scripts\deploy-web.ps1  # publicar PWA
```

## Estilo (mismas reglas de Fase 1)
Comentarios y UI en español. Commits chicos y descriptivos. Cambios
incrementales, no reescrituras. Explicar lo que se hace: Jean está
aprendiendo de su propio sistema. No agregar dependencias sin justificarlas.
