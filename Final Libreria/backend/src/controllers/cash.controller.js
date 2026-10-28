import pool from '../config/database.js'
import {
  addCashMovement,
  getOpenSession,
  requireOpenSession,
  roundMoney,
  sessionTotals,
} from '../services/cash.js'

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message })
  console.error(err)
  return res.status(500).json({ error: fallback })
}

async function loadMovements(sessionId) {
  const [rows] = await pool.query(
    `SELECT m.id,
            m.direction,
            m.source,
            m.payment_method AS paymentMethod,
            m.amount,
            m.description,
            m.reference_type AS referenceType,
            m.reference_id AS referenceId,
            m.created_at AS createdAt,
            u.name AS userName
     FROM cash_movements m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.session_id = ?
     ORDER BY m.id DESC`,
    [sessionId],
  )
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }))
}

async function loadHistory() {
  const [closed] = await pool.query(
    `SELECT cs.id,
            cs.opened_at AS openedAt,
            cs.closed_at AS closedAt,
            cs.opening_amount AS openingAmount,
            cs.expected_cash AS expectedCash,
            cs.counted_cash AS countedCash,
            cs.cash_difference AS cashDifference,
            u.name AS openedByName
     FROM cash_sessions cs
     JOIN users u ON u.id = cs.opened_by
     WHERE cs.status = 'cerrada'
     ORDER BY cs.id DESC
     LIMIT 8`,
  )
  return closed.map((row) => ({
    ...row,
    openingAmount: Number(row.openingAmount),
    expectedCash: Number(row.expectedCash),
    countedCash: Number(row.countedCash),
    cashDifference: Number(row.cashDifference),
  }))
}

export async function current(req, res) {
  try {
    const session = await getOpenSession(pool)
    const history = await loadHistory()
    if (!session) {
      return res.json({
        open: false,
        session: null,
        movements: [],
        totals: null,
        history,
      })
    }

    const totals = await sessionTotals(pool, session.id)
    const movements = await loadMovements(session.id)
    res.json({
      open: true,
      session: {
        id: session.id,
        openedBy: session.openedBy,
        openedByName: session.openedByName,
        openingAmount: Number(session.openingAmount),
        notes: session.notes,
        openedAt: session.openedAt,
      },
      totals,
      movements,
      history,
    })
  } catch (err) {
    sendError(res, err, 'Error al consultar la caja')
  }
}

export async function open(req, res) {
  const openingAmount = roundMoney(req.body?.openingAmount ?? 0)
  if (Number.isNaN(openingAmount) || openingAmount < 0) {
    return res.status(400).json({ error: 'El monto inicial es inválido' })
  }
  const notes =
    req.body?.notes != null && String(req.body.notes).trim()
      ? String(req.body.notes).trim().slice(0, 500)
      : null

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const existing = await getOpenSession(conn, { lock: true })
    if (existing) {
      await conn.rollback()
      return res.status(400).json({ error: 'Ya hay una caja abierta' })
    }
    const [inserted] = await conn.query(
      `INSERT INTO cash_sessions (opened_by, opening_amount, notes)
       VALUES (?, ?, ?)`,
      [req.user.id, openingAmount, notes],
    )
    if (openingAmount > 0) {
      await addCashMovement(conn, {
        sessionId: inserted.insertId,
        direction: 'ingreso',
        source: 'apertura',
        paymentMethod: 'efectivo',
        amount: openingAmount,
        description: 'Apertura de caja',
        userId: req.user.id,
      })
    }
    await conn.commit()
    res.status(201).json({ id: inserted.insertId })
  } catch (err) {
    await conn.rollback()
    sendError(res, err, 'Error al abrir la caja')
  } finally {
    conn.release()
  }
}

export async function close(req, res) {
  const countedCash = roundMoney(req.body?.countedCash)
  if (Number.isNaN(countedCash) || countedCash < 0) {
    return res.status(400).json({ error: 'El arqueo de efectivo es inválido' })
  }
  const notes =
    req.body?.notes != null && String(req.body.notes).trim()
      ? String(req.body.notes).trim().slice(0, 500)
      : null

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)
    const totals = await sessionTotals(conn, session.id)
    const expected = totals.expectedCash
    const difference = roundMoney(countedCash - expected)
    await conn.query(
      `UPDATE cash_sessions
       SET status = 'cerrada',
           closed_by = ?,
           closed_at = CURRENT_TIMESTAMP,
           counted_cash = ?,
           expected_cash = ?,
           cash_difference = ?,
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [req.user.id, countedCash, expected, difference, notes, session.id],
    )
    await conn.commit()
    res.json({
      id: session.id,
      expectedCash: expected,
      countedCash,
      cashDifference: difference,
    })
  } catch (err) {
    await conn.rollback()
    sendError(res, err, 'Error al cerrar la caja')
  } finally {
    conn.release()
  }
}

export async function createMovement(req, res) {
  const kind = String(req.body?.kind || '')
  const allowed = {
    ingreso_manual: 'ingreso',
    egreso_manual: 'egreso',
    gasto: 'egreso',
  }
  if (!allowed[kind]) {
    return res.status(400).json({ error: 'Tipo de movimiento inválido' })
  }
  const description = String(req.body?.description || '').trim()
  if (!description) {
    return res.status(400).json({ error: 'Indicá una descripción' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)
    await addCashMovement(conn, {
      sessionId: session.id,
      direction: allowed[kind],
      source: kind,
      paymentMethod: String(req.body?.paymentMethod || '').trim().toLowerCase(),
      amount: req.body?.amount,
      description: description.slice(0, 255),
      userId: req.user.id,
    })
    await conn.commit()
    res.status(201).json({ ok: true })
  } catch (err) {
    await conn.rollback()
    sendError(res, err, 'Error al registrar el movimiento')
  } finally {
    conn.release()
  }
}
