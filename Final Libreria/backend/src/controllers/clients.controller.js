import pool from '../config/database.js'
import { addCashMovement, assertCashMethod, requireOpenSession } from '../services/cash.js'

const SELECT_FIELDS = `id,
              full_name AS fullName,
              email,
              phone,
              document_id AS documentId,
              address,
              current_balance AS balanceDue`

const SORT_COLUMNS = {
  id: 'id',
  fullName: 'full_name',
  email: 'email',
  phone: 'phone',
  balanceDue: 'current_balance',
}

function parseListQuery(query) {
  const q = String(query.q || '').trim()
  const balance = String(query.balance || 'all')
  const sortKey = String(query.sort || 'id')
  const sortCol = SORT_COLUMNS[sortKey] || 'id'
  const order =
    String(query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  const conditions = []
  const params = []

  if (q) {
    conditions.push(
      `(full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR document_id LIKE ? OR CAST(id AS CHAR) LIKE ?)`,
    )
    const like = `%${q}%`
    params.push(like, like, like, like, like)
  }

  if (balance === 'with_balance') {
    conditions.push('current_balance > 0.009')
  } else if (balance === 'no_balance') {
    conditions.push('current_balance <= 0.009')
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return { where, params, sortCol, order }
}

export async function list(req, res) {
  try {
    const { where, params, sortCol, order } = parseListQuery(req.query)

    const hasPage = req.query.page != null && req.query.page !== ''
    const hasLimit = req.query.limit != null && req.query.limit !== ''

    if (!hasPage && !hasLimit) {
      const [rows] = await pool.query(
        `SELECT ${SELECT_FIELDS} FROM clients ${where} ORDER BY ${sortCol} ${order}`,
        params,
      )
      return res.json(rows)
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM clients ${where}`,
      params,
    )

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM clients ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    const totalNum = Number(total) || 0
    res.json({
      items: rows,
      pagination: {
        page,
        limit,
        total: totalNum,
        totalPages: Math.max(1, Math.ceil(totalNum / limit)),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar clientes' })
  }
}

export async function create(req, res) {
  try {
    const { fullName, email, phone, documentId, address } = req.body
    if (!fullName?.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' })
    }
    const [result] = await pool.query(
      `INSERT INTO clients (full_name, email, phone, document_id, address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        fullName.trim(),
        email?.trim() ? email.trim().toLowerCase() : null,
        phone?.trim() || null,
        documentId?.trim() || null,
        address?.trim() || null,
      ],
    )
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM clients WHERE id = ?`,
      [result.insertId],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear cliente' })
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' })
    const { fullName, email, phone, documentId, address } = req.body
    if (!fullName?.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' })
    }
    const [result] = await pool.query(
      `UPDATE clients
       SET full_name = ?, email = ?, phone = ?, document_id = ?, address = ?
       WHERE id = ?`,
      [
        fullName.trim(),
        email?.trim() ? email.trim().toLowerCase() : null,
        phone?.trim() || null,
        documentId?.trim() || null,
        address?.trim() || null,
        id,
      ],
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM clients WHERE id = ?`,
      [id],
    )
    res.json(rows[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar cliente' })
  }
}

export async function listPayments(req, res) {
  try {
    const clientId = Number(req.params.id)
    if (Number.isNaN(clientId) || clientId < 1) {
      return res.status(400).json({ error: 'ID inválido' })
    }
    const [exists] = await pool.query('SELECT id FROM clients WHERE id = ?', [
      clientId,
    ])
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    const [rows] = await pool.query(
      `SELECT cp.id,
              cp.amount AS amount,
              cp.payment_method AS paymentMethod,
              DATE_FORMAT(cp.payment_date, '%Y-%m-%d') AS paymentDate,
              cp.notes AS notes,
              cp.created_at AS createdAt,
              cp.recorded_by AS recordedByUserId,
              u.name AS recordedByName
       FROM credit_payments cp
       LEFT JOIN users u ON u.id = cp.recorded_by
       WHERE cp.client_id = ?
       ORDER BY cp.payment_date DESC, cp.id DESC`,
      [clientId],
    )
    const mapped = rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod,
      paymentDate: r.paymentDate,
      notes: r.notes,
      createdAt: r.createdAt,
      recordedByUserId: r.recordedByUserId,
      recordedByName: r.recordedByName,
    }))
    res.json(mapped)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar cobros' })
  }
}

export async function createPayment(req, res) {
  const clientId = Number(req.params.id)
  if (Number.isNaN(clientId) || clientId < 1) {
    return res.status(400).json({ error: 'ID inválido' })
  }
  const { amount, paymentDate, notes, paymentMethod } = req.body
  const method = String(paymentMethod || 'efectivo').trim().toLowerCase()
  try {
    assertCashMethod(method)
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }
  const amt = Number(amount)
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' })
  }
  let dateStr = paymentDate
  if (!dateStr || typeof dateStr !== 'string') {
    const d = new Date()
    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Fecha de pago inválida' })
  }
  const notesStr =
    notes != null && String(notes).trim() ? String(notes).trim().slice(0, 500) : null
  const userId = req.user?.id ?? null

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)
    const [crows] = await conn.query(
      'SELECT id, current_balance FROM clients WHERE id = ? FOR UPDATE',
      [clientId],
    )
    if (crows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    const balance = Number(crows[0].current_balance)
    if (balance + 1e-6 < amt) {
      await conn.rollback()
      return res.status(400).json({
        error: `El monto supera el saldo pendiente (${balance.toFixed(2)})`,
      })
    }
    const [ins] = await conn.query(
      `INSERT INTO credit_payments
        (client_id, amount, payment_method, cash_session_id, payment_date, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, amt, method, session.id, dateStr, notesStr, userId],
    )
    await addCashMovement(conn, {
      sessionId: session.id,
      direction: 'ingreso',
      source: 'cobro_cliente',
      paymentMethod: method,
      amount: amt,
      description: `Cobro de cuenta corriente`,
      referenceType: 'credit_payment',
      referenceId: ins.insertId,
      userId,
    })
    await conn.query(
      'UPDATE clients SET current_balance = current_balance - ? WHERE id = ?',
      [amt, clientId],
    )
    await conn.commit()

    const [rows] = await pool.query(
      `SELECT cp.id,
              cp.amount AS amount,
              cp.payment_method AS paymentMethod,
              DATE_FORMAT(cp.payment_date, '%Y-%m-%d') AS paymentDate,
              cp.notes AS notes,
              cp.created_at AS createdAt,
              cp.recorded_by AS recordedByUserId,
              u.name AS recordedByName
       FROM credit_payments cp
       LEFT JOIN users u ON u.id = cp.recorded_by
       WHERE cp.id = ?`,
      [ins.insertId],
    )
    const r = rows[0]
    res.status(201).json({
      id: r.id,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod,
      paymentDate: r.paymentDate,
      notes: r.notes,
      createdAt: r.createdAt,
      recordedByUserId: r.recordedByUserId,
      recordedByName: r.recordedByName,
    })
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al registrar el cobro' })
  } finally {
    conn.release()
  }
}

export async function destroy(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' })
    const [info] = await pool.query(
      'SELECT current_balance FROM clients WHERE id = ?',
      [id],
    )
    if (info.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    const bal = Number(info[0].current_balance)
    if (bal > 0.009) {
      return res.status(400).json({
        error: 'No se puede eliminar: el cliente tiene saldo pendiente en cuenta corriente',
      })
    }
    const [cp] = await pool.query(
      'SELECT COUNT(*) AS c FROM credit_payments WHERE client_id = ?',
      [id],
    )
    if (Number(cp[0].c) > 0) {
      return res.status(400).json({
        error:
          'No se puede eliminar: hay cobros registrados en cuenta corriente',
      })
    }
    const [result] = await pool.query('DELETE FROM clients WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.status(204).send()
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'No se puede eliminar: el cliente tiene ventas asociadas',
      })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar cliente' })
  }
}
