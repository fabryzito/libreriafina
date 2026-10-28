import { httpError } from './errors.js'

export const CASH_METHODS = new Set(['efectivo', 'transferencia', 'tarjeta'])

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

export function assertCashMethod(method) {
  if (!CASH_METHODS.has(method)) {
    throw httpError(
      400,
      'En caja el método debe ser efectivo, transferencia o tarjeta',
    )
  }
}

export async function getOpenSession(conn, { lock = false } = {}) {
  const [rows] = await conn.query(
    `SELECT cs.id,
            cs.opened_by AS openedBy,
            u.name AS openedByName,
            cs.opening_amount AS openingAmount,
            cs.status,
            cs.notes,
            cs.opened_at AS openedAt
     FROM cash_sessions cs
     JOIN users u ON u.id = cs.opened_by
     WHERE cs.status = 'abierta'
     ORDER BY cs.id DESC
     LIMIT 1
     ${lock ? 'FOR UPDATE' : ''}`,
  )
  return rows[0] || null
}

export async function requireOpenSession(conn) {
  const session = await getOpenSession(conn, { lock: true })
  if (!session) {
    throw httpError(400, 'No hay una caja abierta. Abrí la caja antes de continuar.')
  }
  return session
}

export function assertSameSession(documentSessionId, openSessionId) {
  if (
    documentSessionId == null ||
    Number(documentSessionId) !== Number(openSessionId)
  ) {
    throw httpError(
      400,
      'No se puede modificar: pertenece a otra sesión de caja.',
    )
  }
}

export async function addCashMovement(conn, {
  sessionId,
  direction,
  source,
  paymentMethod,
  amount,
  description = null,
  referenceType = null,
  referenceId = null,
  userId = null,
}) {
  assertCashMethod(paymentMethod)
  if (direction !== 'ingreso' && direction !== 'egreso') {
    throw httpError(400, 'Dirección de caja inválida')
  }
  const value = roundMoney(amount)
  if (!(value > 0)) {
    throw httpError(400, 'El monto de caja debe ser mayor a cero')
  }
  await conn.query(
    `INSERT INTO cash_movements
      (session_id, direction, source, payment_method, amount, description,
       reference_type, reference_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      direction,
      source,
      paymentMethod,
      value,
      description,
      referenceType,
      referenceId,
      userId,
    ],
  )
}

export async function sessionTotals(conn, sessionId) {
  const [rows] = await conn.query(
    `SELECT direction, payment_method AS paymentMethod, source, SUM(amount) AS amount
     FROM cash_movements
     WHERE session_id = ?
     GROUP BY direction, payment_method, source`,
    [sessionId],
  )
  const methods = ['efectivo', 'transferencia', 'tarjeta']
  const byMethod = {}
  for (const method of methods) {
    byMethod[method] = { in: 0, out: 0, net: 0 }
  }
  const bySource = []
  for (const row of rows) {
    const amount = roundMoney(row.amount)
    if (byMethod[row.paymentMethod]) {
      if (row.direction === 'ingreso') byMethod[row.paymentMethod].in = roundMoney(byMethod[row.paymentMethod].in + amount)
      else byMethod[row.paymentMethod].out = roundMoney(byMethod[row.paymentMethod].out + amount)
    }
    bySource.push({
      direction: row.direction,
      paymentMethod: row.paymentMethod,
      source: row.source,
      amount,
    })
  }
  for (const method of methods) {
    byMethod[method].net = roundMoney(byMethod[method].in - byMethod[method].out)
  }
  return {
    byMethod,
    bySource,
    expectedCash: byMethod.efectivo.net,
  }
}
