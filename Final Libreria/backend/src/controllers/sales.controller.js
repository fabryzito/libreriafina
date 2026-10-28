import pool from '../config/database.js'
import { httpError } from '../services/errors.js'
import { applyStockChange } from '../services/stock.js'
import { parseDiscount, priceLines, sliceValue, toCents } from '../services/pricing.js'
import {
  addCashMovement,
  assertSameSession,
  requireOpenSession,
  roundMoney,
} from '../services/cash.js'

const PAYMENT_METHODS = new Set([
  'efectivo',
  'transferencia',
  'tarjeta',
  'cuenta_corriente',
])

function formatSaleDate(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

function parseDateQuery(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  return text
}

export async function list(req, res) {
  try {
    const from = parseDateQuery(req.query.from)
    const to = parseDateQuery(req.query.to)
    if (from === undefined || to === undefined) {
      return res.status(400).json({ error: 'La fecha es inválida' })
    }
    const where = []
    const params = []
    if (from) {
      where.push('s.sale_date >= ?')
      params.push(from)
    }
    if (to) {
      where.push('s.sale_date <= ?')
      params.push(to)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows] = await pool.query(
      `SELECT s.id AS sale_id,
              s.user_id AS user_id,
              u.name AS seller_name,
              s.client_id AS client_id,
              c.full_name AS client_name,
              s.sale_date,
              s.total AS sale_total,
              s.discount_total AS discount_total,
              s.payment_method AS payment_method,
              s.status AS sale_status,
              s.cash_session_id AS cash_session_id,
              si.id AS line_id,
              si.product_id,
              si.quantity,
              si.returned_quantity,
              si.unit_price,
              si.list_unit_price,
              si.discount_amount,
              si.subtotal,
              p.name AS product_name
       FROM sales s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN clients c ON c.id = s.client_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN products p ON p.id = si.product_id
       ${whereSql}
       ORDER BY s.sale_date DESC, s.id DESC, si.id ASC`,
      params,
    )

    const map = new Map()
    for (const r of rows) {
      const saleId = r.sale_id
      if (!map.has(saleId)) {
        map.set(saleId, {
          id: saleId,
          userId: r.user_id,
          userName: r.seller_name,
          clientId: r.client_id,
          clientName: r.client_name,
          date: formatSaleDate(r.sale_date),
          total: Number(r.sale_total),
          discountTotal: Number(r.discount_total || 0),
          paymentMethod: r.payment_method,
          status: r.sale_status,
          cashSessionId: r.cash_session_id,
          items: [],
        })
      }
      if (r.line_id) {
        map.get(saleId).items.push({
          productId: r.product_id,
          productName: r.product_name,
          quantity: r.quantity,
          returnedQuantity: Number(r.returned_quantity || 0),
          unitPrice: Number(r.unit_price),
          listUnitPrice: r.list_unit_price != null ? Number(r.list_unit_price) : Number(r.unit_price),
          discountAmount: Number(r.discount_amount || 0),
          subtotal: Number(r.subtotal),
        })
      }
    }

    res.json([...map.values()])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar ventas' })
  }
}

export async function create(req, res) {
  const userId = req.user.id
  const { items, saleDate, paymentMethod, clientId, discount } = req.body

  const pmRaw =
    typeof paymentMethod === 'string'
      ? paymentMethod.trim().toLowerCase()
      : 'efectivo'
  if (!PAYMENT_METHODS.has(pmRaw)) {
    return res.status(400).json({
      error:
        'Forma de pago inválida. Use: efectivo, transferencia, tarjeta o cuenta_corriente',
    })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos una línea de venta' })
  }

  const normalized = []
  for (const raw of items) {
    const productId = Number(raw.productId ?? raw.product_id)
    const quantity = parseInt(raw.quantity, 10)
    if (Number.isNaN(productId) || productId < 1) {
      return res.status(400).json({ error: 'Producto inválido' })
    }
    if (Number.isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Cantidad inválida' })
    }
    let lineDiscount
    try {
      lineDiscount = parseDiscount(raw.discount)
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message })
    }
    normalized.push({ productId, quantity, discount: lineDiscount })
  }

  const seen = new Set()
  for (const line of normalized) {
    if (seen.has(line.productId)) {
      return res.status(400).json({ error: 'Hay un producto repetido en la venta' })
    }
    seen.add(line.productId)
  }
  const lines = normalized
  let saleDiscount
  try {
    saleDiscount = parseDiscount(discount)
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }

  let dateStr = saleDate
  if (!dateStr || typeof dateStr !== 'string') {
    const d = new Date()
    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Fecha de venta inválida' })
  }

  let clientIdNum = null
  if (clientId != null && clientId !== '') {
    clientIdNum = Number(clientId)
    if (Number.isNaN(clientIdNum) || clientIdNum < 1) {
      return res.status(400).json({ error: 'Cliente inválido' })
    }
  }

  if (pmRaw === 'cuenta_corriente') {
    if (clientIdNum == null) {
      return res.status(400).json({
        error: 'En cuenta corriente debe indicar un cliente',
      })
    }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)

    if (clientIdNum != null) {
      const [clientRows] = await conn.query(
        'SELECT id FROM clients WHERE id = ? FOR UPDATE',
        [clientIdNum],
      )
      if (clientRows.length === 0) {
        await conn.rollback()
        return res.status(400).json({ error: 'Cliente no encontrado' })
      }
    }

    const productIds = lines.map((l) => l.productId)
    const placeholders = productIds.map(() => '?').join(',')
    const [prows] = await conn.query(
      `SELECT id, price, cost, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds,
    )
    if (prows.length !== productIds.length) {
      await conn.rollback()
      return res.status(400).json({ error: 'Uno o más productos no existen' })
    }

    const priceById = new Map(
      prows.map((p) => [
        p.id,
        { price: Number(p.price), cost: Number(p.cost), stock: Number(p.stock) },
      ]),
    )

    const pricedInput = []
    for (const line of lines) {
      const meta = priceById.get(line.productId)
      if (meta.stock < line.quantity) {
        await conn.rollback()
        return res
          .status(400)
          .json({ error: `Stock insuficiente para el producto (ID ${line.productId})` })
      }
      pricedInput.push({
        productId: line.productId,
        quantity: line.quantity,
        listCents: toCents(meta.price),
        unitCost: meta.cost,
        discount: line.discount,
      })
    }
    let lineDetails
    try {
      lineDetails = priceLines(pricedInput, saleDiscount)
    } catch (err) {
      await conn.rollback()
      return res.status(err.status || 400).json({ error: err.message })
    }
    const total = roundMoney(lineDetails.reduce((acc, line) => acc + line.subtotal, 0))
    const discountTotal = roundMoney(
      lineDetails.reduce((acc, line) => acc + line.discountAmount, 0),
    )

    const [sres] = await conn.query(
      `INSERT INTO sales (user_id, client_id, sale_date, total, discount_total, payment_method, cash_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, clientIdNum, dateStr, total, discountTotal, pmRaw, session.id],
    )
    const saleId = sres.insertId

    for (const line of lineDetails) {
      await conn.query(
        `INSERT INTO sale_items
          (sale_id, product_id, quantity, unit_price, list_unit_price, discount_amount, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.listUnitPrice,
          line.discountAmount,
          line.unitCost,
          line.subtotal,
        ],
      )
      await applyStockChange(conn, {
        productId: line.productId,
        delta: -line.quantity,
        movementType: 'salida',
        reason: 'venta',
        referenceType: 'sale',
        referenceId: saleId,
        userId,
      })
    }

    if (total > 0 && pmRaw === 'cuenta_corriente' && clientIdNum != null) {
      await conn.query(
        'UPDATE clients SET current_balance = current_balance + ? WHERE id = ?',
        [total, clientIdNum],
      )
    } else if (total > 0) {
      await addCashMovement(conn, {
        sessionId: session.id,
        direction: 'ingreso',
        source: 'venta',
        paymentMethod: pmRaw,
        amount: total,
        description: `Venta #${saleId}`,
        referenceType: 'sale',
        referenceId: saleId,
        userId,
      })
    }

    await conn.commit()

    const [full] = await pool.query(
      `SELECT s.id AS sale_id,
              s.user_id AS user_id,
              u.name AS seller_name,
              s.client_id AS client_id,
              c.full_name AS client_name,
              s.sale_date,
              s.total AS sale_total,
              s.discount_total AS discount_total,
              s.payment_method AS payment_method
       FROM sales s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE s.id = ?`,
      [saleId],
    )
    const row = full[0]
    const [itemRows] = await pool.query(
      `SELECT si.product_id AS product_id,
              p.name AS product_name,
              si.quantity,
              si.unit_price,
              si.list_unit_price,
              si.discount_amount,
              si.subtotal
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`,
      [saleId],
    )

    res.status(201).json({
      id: row.sale_id,
      userId: row.user_id,
      userName: row.seller_name,
      clientId: row.client_id,
      clientName: row.client_name,
      date: formatSaleDate(row.sale_date),
      total: Number(row.sale_total),
      discountTotal,
      paymentMethod: row.payment_method,
      status: 'registrada',
      cashSessionId: session.id,
      items: itemRows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        quantity: r.quantity,
        returnedQuantity: 0,
        unitPrice: Number(r.unit_price),
        listUnitPrice: r.list_unit_price != null ? Number(r.list_unit_price) : Number(r.unit_price),
        discountAmount: Number(r.discount_amount || 0),
        subtotal: Number(r.subtotal),
      })),
    })
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al registrar la venta' })
  } finally {
    conn.release()
  }
}

async function refundCredit(conn, clientId, amount) {
  if (clientId == null) {
    throw httpError(400, 'La venta a crédito no tiene cliente')
  }
  const [rows] = await conn.query(
    'SELECT id, current_balance FROM clients WHERE id = ? FOR UPDATE',
    [clientId],
  )
  if (rows.length === 0) {
    throw httpError(400, 'Cliente no encontrado')
  }
  const balance = Number(rows[0].current_balance)
  if (balance + 1e-6 < amount) {
    throw httpError(
      400,
      `No se puede revertir: la deuda del cliente (${balance.toFixed(2)}) es menor que ${amount.toFixed(2)}. Ya hubo cobros.`,
    )
  }
  await conn.query(
    'UPDATE clients SET current_balance = current_balance - ? WHERE id = ?',
    [amount, clientId],
  )
}

export async function cancel(req, res) {
  const saleId = Number(req.params.id)
  if (Number.isNaN(saleId) || saleId < 1) {
    return res.status(400).json({ error: 'ID inválido' })
  }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)
    const [sales] = await conn.query(
      'SELECT id, client_id, total, payment_method, status, cash_session_id FROM sales WHERE id = ? FOR UPDATE',
      [saleId],
    )
    if (sales.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Venta no encontrada' })
    }
    const sale = sales[0]
    if (sale.status !== 'registrada') {
      await conn.rollback()
      return res.status(400).json({ error: 'La venta ya está anulada' })
    }
    assertSameSession(sale.cash_session_id, session.id)

    const [lines] = await conn.query(
      'SELECT product_id, quantity, returned_quantity, unit_price, subtotal FROM sale_items WHERE sale_id = ? FOR UPDATE',
      [saleId],
    )
    let refund = 0
    const pending = []
    for (const line of lines) {
      const remaining = Number(line.quantity) - Number(line.returned_quantity || 0)
      if (remaining < 1) continue
      const subtotal = sliceValue(line.subtotal, line.quantity, line.returned_quantity || 0, remaining)
      refund = roundMoney(refund + subtotal)
      pending.push({ ...line, remaining, subtotal })
    }
    if (pending.length === 0) {
      await conn.rollback()
      return res.status(400).json({ error: 'No queda mercadería pendiente en esta venta' })
    }

    if (refund > 0 && sale.payment_method === 'cuenta_corriente') {
      await refundCredit(conn, sale.client_id, refund)
    } else if (refund > 0) {
      await addCashMovement(conn, {
        sessionId: session.id,
        direction: 'egreso',
        source: 'anulacion_venta',
        paymentMethod: sale.payment_method,
        amount: refund,
        description: `Anulación de venta #${saleId}`,
        referenceType: 'sale',
        referenceId: saleId,
        userId: req.user.id,
      })
    }

    for (const line of pending) {
      await conn.query(
        'UPDATE sale_items SET returned_quantity = quantity WHERE sale_id = ? AND product_id = ?',
        [saleId, line.product_id],
      )
      await applyStockChange(conn, {
        productId: line.product_id,
        delta: line.remaining,
        movementType: 'devolucion',
        reason: 'anulacion_venta',
        referenceType: 'sale',
        referenceId: saleId,
        userId: req.user.id,
      })
    }

    await conn.query(
      `UPDATE sales
       SET status = 'anulada', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?
       WHERE id = ?`,
      [req.user.id, saleId],
    )
    await conn.commit()
    res.json({ id: saleId, status: 'anulada', refund })
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al anular la venta' })
  } finally {
    conn.release()
  }
}

export async function createReturn(req, res) {
  const saleId = Number(req.params.id)
  if (Number.isNaN(saleId) || saleId < 1) {
    return res.status(400).json({ error: 'ID inválido' })
  }
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
  if (rawItems.length === 0) {
    return res.status(400).json({ error: 'Indicá al menos un producto a devolver' })
  }
  const notes =
    req.body?.notes != null && String(req.body.notes).trim()
      ? String(req.body.notes).trim().slice(0, 500)
      : null

  const requested = new Map()
  for (const raw of rawItems) {
    const productId = Number(raw.productId ?? raw.product_id)
    const quantity = parseInt(raw.quantity, 10)
    if (Number.isNaN(productId) || productId < 1 || Number.isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Línea de devolución inválida' })
    }
    requested.set(productId, (requested.get(productId) || 0) + quantity)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const session = await requireOpenSession(conn)
    const [sales] = await conn.query(
      'SELECT id, client_id, payment_method, status, cash_session_id FROM sales WHERE id = ? FOR UPDATE',
      [saleId],
    )
    if (sales.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Venta no encontrada' })
    }
    const sale = sales[0]
    if (sale.status !== 'registrada') {
      await conn.rollback()
      return res.status(400).json({ error: 'La venta está anulada' })
    }
    assertSameSession(sale.cash_session_id, session.id)

    const [lines] = await conn.query(
      'SELECT product_id, quantity, returned_quantity, unit_price, subtotal FROM sale_items WHERE sale_id = ? FOR UPDATE',
      [saleId],
    )
    const byProduct = new Map(lines.map((line) => [line.product_id, line]))
    let refund = 0
    const details = []
    for (const [productId, quantity] of requested) {
      const line = byProduct.get(productId)
      if (!line) {
        await conn.rollback()
        return res.status(400).json({ error: 'El producto no está en la venta' })
      }
      const remaining = Number(line.quantity) - Number(line.returned_quantity || 0)
      if (quantity > remaining) {
        await conn.rollback()
        return res.status(400).json({
          error: `Solo se pueden devolver ${remaining} unidades del producto ${productId}`,
        })
      }
      const subtotal = sliceValue(line.subtotal, line.quantity, line.returned_quantity || 0, quantity)
      refund = roundMoney(refund + subtotal)
      details.push({ productId, quantity, unitPrice: Number(line.unit_price), subtotal })
    }

    if (refund > 0 && sale.payment_method === 'cuenta_corriente') {
      await refundCredit(conn, sale.client_id, refund)
    } else if (refund > 0) {
      await addCashMovement(conn, {
        sessionId: session.id,
        direction: 'egreso',
        source: 'devolucion_venta',
        paymentMethod: sale.payment_method,
        amount: refund,
        description: `Devolución de venta #${saleId}`,
        referenceType: 'sale',
        referenceId: saleId,
        userId: req.user.id,
      })
    }

    const [inserted] = await conn.query(
      `INSERT INTO sale_returns (sale_id, cash_session_id, user_id, total, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [saleId, session.id, req.user.id, refund, notes],
    )
    for (const line of details) {
      await conn.query(
        `INSERT INTO sale_return_items (return_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [inserted.insertId, line.productId, line.quantity, line.unitPrice, line.subtotal],
      )
      await conn.query(
        'UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE sale_id = ? AND product_id = ?',
        [line.quantity, saleId, line.productId],
      )
      await applyStockChange(conn, {
        productId: line.productId,
        delta: line.quantity,
        movementType: 'devolucion',
        reason: 'devolucion_venta',
        notes,
        referenceType: 'sale_return',
        referenceId: inserted.insertId,
        userId: req.user.id,
      })
    }

    await conn.commit()
    res.status(201).json({ id: inserted.insertId, saleId, total: refund })
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al registrar la devolución' })
  } finally {
    conn.release()
  }
}
