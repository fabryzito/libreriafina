import pool from '../config/database.js'
import { applyStockChange } from '../services/stock.js'
import {
  addCashMovement,
  assertSameSession,
  requireOpenSession,
} from '../services/cash.js'

const PAYMENT_METHODS = new Set([
  'efectivo',
  'transferencia',
  'tarjeta',
  'cuenta_corriente',
])

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function sameMoney(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.001
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mapPurchase(row, items) {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    userId: row.userId,
    userName: row.userName,
    date: row.purchaseDate,
    total: Number(row.total),
    paymentMethod: row.paymentMethod,
    status: row.status,
    cashSessionId: row.cashSessionId ?? null,
    updateCost: Boolean(row.updateCost),
    notes: row.notes,
    cancelledAt: row.cancelledAt,
    items,
  }
}

async function loadItems(purchaseIds) {
  if (purchaseIds.length === 0) return new Map()
  const placeholders = purchaseIds.map(() => '?').join(',')
  const [rows] = await pool.query(
    `SELECT pi.purchase_id AS purchaseId,
            pi.product_id AS productId,
            p.name AS productName,
            p.sku AS sku,
            pi.quantity,
            pi.unit_cost AS unitCost,
            pi.subtotal
     FROM purchase_items pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id IN (${placeholders})
     ORDER BY pi.id ASC`,
    purchaseIds,
  )
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.purchaseId)) map.set(row.purchaseId, [])
    map.get(row.purchaseId).push({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantity: Number(row.quantity),
      unitCost: Number(row.unitCost),
      subtotal: Number(row.subtotal),
    })
  }
  return map
}

export async function list(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT pu.id,
              pu.supplier_id AS supplierId,
              s.name AS supplierName,
              pu.user_id AS userId,
              u.name AS userName,
              DATE_FORMAT(pu.purchase_date, '%Y-%m-%d') AS purchaseDate,
              pu.total,
              pu.payment_method AS paymentMethod,
              pu.cash_session_id AS cashSessionId,
              pu.status,
              pu.update_cost AS updateCost,
              pu.notes,
              pu.cancelled_at AS cancelledAt
       FROM purchases pu
       JOIN suppliers s ON s.id = pu.supplier_id
       JOIN users u ON u.id = pu.user_id
       ORDER BY pu.purchase_date DESC, pu.id DESC`,
    )
    const itemsByPurchase = await loadItems(rows.map((r) => r.id))
    res.json(
      rows.map((row) => mapPurchase(row, itemsByPurchase.get(row.id) || [])),
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar compras' })
  }
}

export async function create(req, res) {
  const userId = req.user.id
  const { items, purchaseDate, paymentMethod, supplierId, updateCost, notes } = req.body

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

  const supplierIdNum = Number(supplierId)
  if (Number.isNaN(supplierIdNum) || supplierIdNum < 1) {
    return res.status(400).json({ error: 'Debe indicar un proveedor' })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un producto' })
  }

  const normalized = []
  for (const raw of items) {
    const productId = Number(raw.productId ?? raw.product_id)
    const quantity = parseInt(raw.quantity, 10)
    const unitCost = Number(raw.unitCost ?? raw.unit_cost)
    if (Number.isNaN(productId) || productId < 1) {
      return res.status(400).json({ error: 'Producto inválido' })
    }
    if (Number.isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Cantidad inválida' })
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      return res.status(400).json({ error: 'Costo inválido' })
    }
    normalized.push({ productId, quantity, unitCost: roundMoney(unitCost) })
  }

  const merged = new Map()
  for (const line of normalized) {
    const prev = merged.get(line.productId)
    if (!prev) {
      merged.set(line.productId, { ...line })
      continue
    }
    if (!sameMoney(prev.unitCost, line.unitCost)) {
      return res.status(400).json({
        error: 'Un producto no puede repetirse con costos distintos',
      })
    }
    prev.quantity += line.quantity
  }
  const lines = [...merged.values()]

  let dateStr = purchaseDate
  if (!dateStr || typeof dateStr !== 'string') dateStr = today()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Fecha de compra inválida' })
  }

  const shouldUpdateCost = updateCost !== false && updateCost !== 0
  const notesStr =
    notes != null && String(notes).trim() ? String(notes).trim().slice(0, 500) : null

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let cashSessionId = null
    if (pmRaw !== 'cuenta_corriente') {
      const session = await requireOpenSession(conn)
      cashSessionId = session.id
    }

    const [supplierRows] = await conn.query(
      'SELECT id FROM suppliers WHERE id = ? FOR UPDATE',
      [supplierIdNum],
    )
    if (supplierRows.length === 0) {
      await conn.rollback()
      return res.status(400).json({ error: 'Proveedor no encontrado' })
    }

    const productIds = lines.map((l) => l.productId)
    const placeholders = productIds.map(() => '?').join(',')
    const [prows] = await conn.query(
      `SELECT id, name, cost, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds,
    )
    if (prows.length !== productIds.length) {
      await conn.rollback()
      return res.status(400).json({ error: 'Uno o más productos no existen' })
    }
    const productById = new Map(prows.map((p) => [p.id, p]))

    let total = 0
    const lineDetails = lines.map((line) => {
      const product = productById.get(line.productId)
      const subtotal = roundMoney(line.unitCost * line.quantity)
      total = roundMoney(total + subtotal)
      return {
        ...line,
        subtotal,
        previousCost: Number(product.cost),
        productName: product.name,
      }
    })

    const [inserted] = await conn.query(
      `INSERT INTO purchases
        (supplier_id, user_id, cash_session_id, purchase_date, total, payment_method, update_cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierIdNum,
        userId,
        cashSessionId,
        dateStr,
        total,
        pmRaw,
        shouldUpdateCost ? 1 : 0,
        notesStr,
      ],
    )
    const purchaseId = inserted.insertId

    for (const line of lineDetails) {
      await conn.query(
        `INSERT INTO purchase_items
          (purchase_id, product_id, quantity, unit_cost, subtotal, previous_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          line.productId,
          line.quantity,
          line.unitCost,
          line.subtotal,
          shouldUpdateCost ? line.previousCost : null,
        ],
      )
      await applyStockChange(conn, {
        productId: line.productId,
        delta: line.quantity,
        movementType: 'entrada',
        reason: 'compra',
        referenceType: 'purchase',
        referenceId: purchaseId,
        userId,
      })
      if (shouldUpdateCost) {
        await conn.query('UPDATE products SET cost = ? WHERE id = ?', [
          line.unitCost,
          line.productId,
        ])
      }
    }

    if (pmRaw === 'cuenta_corriente') {
      await conn.query(
        'UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?',
        [total, supplierIdNum],
      )
    } else {
      await addCashMovement(conn, {
        sessionId: cashSessionId,
        direction: 'egreso',
        source: 'compra',
        paymentMethod: pmRaw,
        amount: total,
        description: `Compra #${purchaseId}`,
        referenceType: 'purchase',
        referenceId: purchaseId,
        userId,
      })
    }

    await conn.commit()

    const [full] = await pool.query(
      `SELECT pu.id,
              pu.supplier_id AS supplierId,
              s.name AS supplierName,
              pu.user_id AS userId,
              u.name AS userName,
              DATE_FORMAT(pu.purchase_date, '%Y-%m-%d') AS purchaseDate,
              pu.total,
              pu.payment_method AS paymentMethod,
              pu.cash_session_id AS cashSessionId,
              pu.status,
              pu.update_cost AS updateCost,
              pu.notes,
              pu.cancelled_at AS cancelledAt
       FROM purchases pu
       JOIN suppliers s ON s.id = pu.supplier_id
       JOIN users u ON u.id = pu.user_id
       WHERE pu.id = ?`,
      [purchaseId],
    )
    const itemsByPurchase = await loadItems([purchaseId])
    res.status(201).json(mapPurchase(full[0], itemsByPurchase.get(purchaseId) || []))
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al registrar la compra' })
  } finally {
    conn.release()
  }
}

export async function cancel(req, res) {
  const id = Number(req.params.id)
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'ID inválido' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [purchases] = await conn.query(
      `SELECT id, supplier_id, total, payment_method, status, update_cost, cash_session_id
       FROM purchases WHERE id = ? FOR UPDATE`,
      [id],
    )
    if (purchases.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Compra no encontrada' })
    }
    const purchase = purchases[0]
    if (purchase.status === 'anulada') {
      await conn.rollback()
      return res.status(400).json({ error: 'La compra ya está anulada' })
    }

    let session = null
    if (purchase.payment_method !== 'cuenta_corriente') {
      session = await requireOpenSession(conn)
      assertSameSession(purchase.cash_session_id, session.id)
    }

    const [items] = await conn.query(
      `SELECT pi.product_id, pi.quantity, pi.unit_cost, pi.previous_cost, p.name
       FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = ?`,
      [id],
    )
    const productIds = items.map((item) => item.product_id)
    if (productIds.length === 0) {
      await conn.rollback()
      return res.status(400).json({ error: 'La compra no tiene productos' })
    }

    const placeholders = productIds.map(() => '?').join(',')
    const [prows] = await conn.query(
      `SELECT id, name, cost, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds,
    )
    const productById = new Map(prows.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productById.get(item.product_id)
      if (!product || Number(product.stock) < Number(item.quantity)) {
        await conn.rollback()
        const available = product ? Number(product.stock) : 0
        return res.status(400).json({
          error: `No se puede anular: stock insuficiente de «${item.name}» (hay ${available}, la compra ingresó ${item.quantity}).`,
        })
      }
    }

    if (purchase.payment_method === 'cuenta_corriente') {
      const [supplierRows] = await conn.query(
        'SELECT id, current_balance FROM suppliers WHERE id = ? FOR UPDATE',
        [purchase.supplier_id],
      )
      const balance = Number(supplierRows[0]?.current_balance ?? 0)
      if (balance + 1e-6 < Number(purchase.total)) {
        await conn.rollback()
        return res.status(400).json({
          error: `No se puede anular: la deuda del proveedor (${balance.toFixed(2)}) es menor que el total de la compra. Revertí los pagos antes de anular.`,
        })
      }
      await conn.query(
        'UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?',
        [purchase.total, purchase.supplier_id],
      )
    }

    for (const item of items) {
      const product = productById.get(item.product_id)
      await applyStockChange(conn, {
        productId: item.product_id,
        delta: -Number(item.quantity),
        movementType: 'salida',
        reason: 'anulacion_compra',
        referenceType: 'purchase',
        referenceId: id,
        userId: req.user.id,
      })
      if (
        purchase.update_cost &&
        item.previous_cost != null &&
        sameMoney(product.cost, item.unit_cost)
      ) {
        await conn.query('UPDATE products SET cost = ? WHERE id = ?', [
          item.previous_cost,
          item.product_id,
        ])
        product.cost = item.previous_cost
      }
    }

    if (session) {
      await addCashMovement(conn, {
        sessionId: session.id,
        direction: 'ingreso',
        source: 'anulacion_compra',
        paymentMethod: purchase.payment_method,
        amount: purchase.total,
        description: `Anulación de compra #${id}`,
        referenceType: 'purchase',
        referenceId: id,
        userId: req.user.id,
      })
    }

    await conn.query(
      `UPDATE purchases
       SET status = 'anulada', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?
       WHERE id = ?`,
      [req.user.id, id],
    )

    await conn.commit()

    const [full] = await pool.query(
      `SELECT pu.id,
              pu.supplier_id AS supplierId,
              s.name AS supplierName,
              pu.user_id AS userId,
              u.name AS userName,
              DATE_FORMAT(pu.purchase_date, '%Y-%m-%d') AS purchaseDate,
              pu.total,
              pu.payment_method AS paymentMethod,
              pu.cash_session_id AS cashSessionId,
              pu.status,
              pu.update_cost AS updateCost,
              pu.notes,
              pu.cancelled_at AS cancelledAt
       FROM purchases pu
       JOIN suppliers s ON s.id = pu.supplier_id
       JOIN users u ON u.id = pu.user_id
       WHERE pu.id = ?`,
      [id],
    )
    const itemsByPurchase = await loadItems([id])
    res.json(mapPurchase(full[0], itemsByPurchase.get(id) || []))
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al anular la compra' })
  } finally {
    conn.release()
  }
}
