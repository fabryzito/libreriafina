import pool from '../config/database.js'
import { addCashMovement, assertCashMethod, requireOpenSession } from '../services/cash.js'

const SELECT_FIELDS = `id,
              name,
              contact_name AS contactName,
              email,
              phone,
              document_id AS documentId,
              address,
              current_balance AS balanceDue`

const SORT_COLUMNS = {
  id: 'id',
  name: 'name',
  contactName: 'contact_name',
  email: 'email',
  phone: 'phone',
  balanceDue: 'current_balance',
}

function emptyToNull(value) {
  const text = String(value || '').trim()
  return text ? text : null
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
      `(name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR phone LIKE ? OR document_id LIKE ? OR CAST(id AS CHAR) LIKE ?)`,
    )
    const like = `%${q}%`
    params.push(like, like, like, like, like, like)
  }

  if (balance === 'with_balance') {
    conditions.push('current_balance > 0.009')
  } else if (balance === 'no_balance') {
    conditions.push('current_balance <= 0.009')
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params, sortCol, order }
}

function parseBody(body) {
  const name = String(body?.name || '').trim()
  if (!name) return { error: 'El nombre del proveedor es obligatorio' }
  if (name.length > 180) return { error: 'El nombre no puede superar 180 caracteres' }

  const contactName = emptyToNull(body?.contactName)
  if (contactName && contactName.length > 120) {
    return { error: 'El contacto no puede superar 120 caracteres' }
  }

  const email = emptyToNull(body?.email)
  const phone = emptyToNull(body?.phone)
  const documentId = emptyToNull(body?.documentId)
  const address = emptyToNull(body?.address)

  if (email && email.length > 255) return { error: 'El email es demasiado largo' }
  if (phone && phone.length > 40) return { error: 'El teléfono es demasiado largo' }
  if (documentId && documentId.length > 60) {
    return { error: 'El documento es demasiado largo' }
  }
  if (address && address.length > 255) return { error: 'La dirección es demasiado larga' }

  return {
    value: {
      name,
      contactName,
      email: email ? email.toLowerCase() : null,
      phone,
      documentId,
      address,
    },
  }
}

function mapSupplier(row) {
  return {
    ...row,
    balanceDue: Number(row.balanceDue),
  }
}

export async function list(req, res) {
  try {
    const { where, params, sortCol, order } = parseListQuery(req.query)
    const hasPage = req.query.page != null && req.query.page !== ''
    const hasLimit = req.query.limit != null && req.query.limit !== ''

    if (!hasPage && !hasLimit) {
      const [rows] = await pool.query(
        `SELECT ${SELECT_FIELDS} FROM suppliers ${where} ORDER BY ${sortCol} ${order}`,
        params,
      )
      return res.json(rows.map(mapSupplier))
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM suppliers ${where}`,
      params,
    )
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM suppliers ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )
    const totalNum = Number(total) || 0
    res.json({
      items: rows.map(mapSupplier),
      pagination: {
        page,
        limit,
        total: totalNum,
        totalPages: Math.max(1, Math.ceil(totalNum / limit)),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar proveedores' })
  }
}

export async function create(req, res) {
  try {
    const parsed = parseBody(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const v = parsed.value
    const [result] = await pool.query(
      `INSERT INTO suppliers (name, contact_name, email, phone, document_id, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [v.name, v.contactName, v.email, v.phone, v.documentId, v.address],
    )
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM suppliers WHERE id = ?`,
      [result.insertId],
    )
    res.status(201).json(mapSupplier(rows[0]))
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear proveedor' })
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' })
    const parsed = parseBody(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const v = parsed.value
    const [result] = await pool.query(
      `UPDATE suppliers
       SET name = ?, contact_name = ?, email = ?, phone = ?, document_id = ?, address = ?
       WHERE id = ?`,
      [v.name, v.contactName, v.email, v.phone, v.documentId, v.address, id],
    )
    if (result.affectedRows === 0) {
      const [exists] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [id])
      if (exists.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' })
      }
    }
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM suppliers WHERE id = ?`,
      [id],
    )
    res.json(mapSupplier(rows[0]))
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proveedor' })
  }
}

export async function listPayments(req, res) {
  try {
    const supplierId = Number(req.params.id)
    if (Number.isNaN(supplierId) || supplierId < 1) {
      return res.status(400).json({ error: 'ID inválido' })
    }
    const [exists] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [
      supplierId,
    ])
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' })
    }
    const [rows] = await pool.query(
      `SELECT sp.id,
              sp.amount AS amount,
              sp.payment_method AS paymentMethod,
              DATE_FORMAT(sp.payment_date, '%Y-%m-%d') AS paymentDate,
              sp.notes AS notes,
              sp.created_at AS createdAt,
              sp.recorded_by AS recordedByUserId,
              u.name AS recordedByName
       FROM supplier_payments sp
       LEFT JOIN users u ON u.id = sp.recorded_by
       WHERE sp.supplier_id = ?
       ORDER BY sp.payment_date DESC, sp.id DESC`,
      [supplierId],
    )
    res.json(
      rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        paymentMethod: r.paymentMethod,
        paymentDate: r.paymentDate,
        notes: r.notes,
        createdAt: r.createdAt,
        recordedByUserId: r.recordedByUserId,
        recordedByName: r.recordedByName,
      })),
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar pagos' })
  }
}

export async function createPayment(req, res) {
  const supplierId = Number(req.params.id)
  if (Number.isNaN(supplierId) || supplierId < 1) {
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
    const [rows] = await conn.query(
      'SELECT id, current_balance FROM suppliers WHERE id = ? FOR UPDATE',
      [supplierId],
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Proveedor no encontrado' })
    }
    const balance = Number(rows[0].current_balance)
    if (balance + 1e-6 < amt) {
      await conn.rollback()
      return res.status(400).json({
        error: `El monto supera la deuda pendiente (${balance.toFixed(2)})`,
      })
    }
    const [ins] = await conn.query(
      `INSERT INTO supplier_payments
        (supplier_id, amount, payment_method, cash_session_id, payment_date, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [supplierId, amt, method, session.id, dateStr, notesStr, userId],
    )
    await addCashMovement(conn, {
      sessionId: session.id,
      direction: 'egreso',
      source: 'pago_proveedor',
      paymentMethod: method,
      amount: amt,
      description: `Pago a proveedor`,
      referenceType: 'supplier_payment',
      referenceId: ins.insertId,
      userId,
    })
    await conn.query(
      'UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?',
      [amt, supplierId],
    )
    await conn.commit()

    const [created] = await pool.query(
      `SELECT sp.id,
              sp.amount AS amount,
              sp.payment_method AS paymentMethod,
              DATE_FORMAT(sp.payment_date, '%Y-%m-%d') AS paymentDate,
              sp.notes AS notes,
              sp.created_at AS createdAt,
              sp.recorded_by AS recordedByUserId,
              u.name AS recordedByName
       FROM supplier_payments sp
       LEFT JOIN users u ON u.id = sp.recorded_by
       WHERE sp.id = ?`,
      [ins.insertId],
    )
    const r = created[0]
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
    res.status(500).json({ error: 'Error al registrar el pago' })
  } finally {
    conn.release()
  }
}

export async function destroy(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' })
    const [info] = await pool.query(
      'SELECT current_balance FROM suppliers WHERE id = ?',
      [id],
    )
    if (info.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' })
    }
    if (Number(info[0].current_balance) > 0.009) {
      return res.status(400).json({
        error: 'No se puede eliminar: el proveedor tiene deuda pendiente',
      })
    }
    const [pays] = await pool.query(
      'SELECT COUNT(*) AS c FROM supplier_payments WHERE supplier_id = ?',
      [id],
    )
    if (Number(pays[0].c) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: hay pagos registrados a este proveedor',
      })
    }
    const [result] = await pool.query('DELETE FROM suppliers WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' })
    }
    res.status(204).send()
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'No se puede eliminar: el proveedor tiene compras asociadas',
      })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar proveedor' })
  }
}
