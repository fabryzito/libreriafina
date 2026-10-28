import { httpError } from './errors.js'

export async function applyStockChange(conn, {
  productId,
  delta,
  movementType,
  reason,
  notes = null,
  referenceType = null,
  referenceId = null,
  userId = null,
}) {
  const change = Number(delta)
  if (!Number.isInteger(change) || change === 0) {
    throw httpError(400, 'El movimiento de stock no cambia la cantidad')
  }

  const [rows] = await conn.query(
    'SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE',
    [productId],
  )
  if (rows.length === 0) {
    throw httpError(400, 'Producto no encontrado')
  }

  const current = Number(rows[0].stock)
  const next = current + change
  if (next < 0) {
    throw httpError(
      400,
      `Stock insuficiente de «${rows[0].name}» (hay ${current}).`,
    )
  }

  await conn.query('UPDATE products SET stock = ? WHERE id = ?', [next, productId])
  await conn.query(
    `INSERT INTO stock_movements
      (product_id, movement_type, reason, quantity, stock_after, notes,
       reference_type, reference_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      movementType,
      reason,
      change,
      next,
      notes,
      referenceType,
      referenceId,
      userId,
    ],
  )
  return next
}
