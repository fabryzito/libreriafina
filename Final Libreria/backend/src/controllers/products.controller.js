import pool from '../config/database.js'
import { applyStockChange } from '../services/stock.js'

const SORT_COLUMNS = {
  id: 'p.id',
  sku: 'p.sku',
  name: 'p.name',
  price: 'p.price',
  cost: 'p.cost',
  stock: 'p.stock',
  minStock: 'p.min_stock',
  category: 'c.name',
}

const SELECT_FIELDS = `
  p.id,
  p.sku,
  p.barcode,
  p.name,
  p.price,
  p.cost,
  p.stock,
  p.min_stock AS minStock,
  p.category_id AS categoryId,
  c.name AS categoryName,
  p.is_active AS isActive
`

const FROM = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

function mapProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    minStock: Number(row.minStock),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    isActive: Boolean(row.isActive),
  }
}

function parseListQuery(query) {
  const q = String(query.q || '').trim()
  const stock = String(query.stock || 'all')
  const status = String(query.status || 'all')
  const sortKey = String(query.sort || 'id')
  const sortCol = SORT_COLUMNS[sortKey] || 'p.id'
  const order =
    String(query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  const conditions = []
  const params = []

  if (q) {
    conditions.push(
      '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR CAST(p.id AS CHAR) LIKE ?)',
    )
    const like = `%${q}%`
    params.push(like, like, like, like)
  }

  if (stock === 'in_stock') {
    conditions.push('p.stock > 0')
  } else if (stock === 'out') {
    conditions.push('p.stock = 0')
  } else if (stock === 'low') {
    conditions.push('p.stock > 0 AND p.stock <= p.min_stock')
  }

  if (status === 'active') {
    conditions.push('p.is_active = 1')
  } else if (status === 'inactive') {
    conditions.push('p.is_active = 0')
  }

  const categoryRaw = query.categoryId
  if (categoryRaw != null && categoryRaw !== '' && categoryRaw !== 'all') {
    const categoryId = Number(categoryRaw)
    if (!Number.isNaN(categoryId) && categoryId > 0) {
      conditions.push('p.category_id = ?')
      params.push(categoryId)
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return { where, params, sortCol, order }
}

function parseProductBody(body, { requireStock = true } = {}) {
  const name = String(body?.name || '').trim()
  if (!name) {
    return { error: 'El nombre es obligatorio' }
  }
  if (name.length > 200) {
    return { error: 'El nombre no puede superar 200 caracteres' }
  }

  let sku = String(body?.sku || '').trim()
  if (!sku) sku = null
  else if (sku.length > 40) {
    return { error: 'El código no puede superar 40 caracteres' }
  }

  let barcode = String(body?.barcode || '').trim()
  if (!barcode) barcode = null
  else if (barcode.length > 64) {
    return { error: 'El código de barras no puede superar 64 caracteres' }
  }

  const price = Number(body?.price)
  const cost = Number(body?.cost)
  const stock = parseInt(body?.stock, 10)
  const minStock = parseInt(body?.minStock, 10)

  if (Number.isNaN(price) || price < 0) {
    return { error: 'El precio de venta es inválido' }
  }
  if (Number.isNaN(cost) || cost < 0) {
    return { error: 'El costo es inválido' }
  }
  if (requireStock && (Number.isNaN(stock) || stock < 0)) {
    return { error: 'El stock es inválido' }
  }
  if (Number.isNaN(minStock) || minStock < 0) {
    return { error: 'El stock mínimo es inválido' }
  }

  let categoryId = null
  if (body?.categoryId != null && body.categoryId !== '') {
    categoryId = Number(body.categoryId)
    if (Number.isNaN(categoryId) || categoryId < 1) {
      return { error: 'Categoría inválida' }
    }
  }

  const isActive = body?.isActive === false || body?.isActive === 0 ? 0 : 1

  return {
    value: {
      sku,
      barcode,
      name,
      price,
      cost,
      stock,
      minStock,
      categoryId,
      isActive,
    },
  }
}

async function categoryExists(categoryId) {
  if (categoryId == null) return true
  const [rows] = await pool.query('SELECT id FROM categories WHERE id = ?', [
    categoryId,
  ])
  return rows.length > 0
}

function duplicateProductMessage(err) {
  if (err.code !== 'ER_DUP_ENTRY') return null
  if (String(err.sqlMessage || '').includes('barcode')) {
    return 'Ya existe un producto con ese código de barras'
  }
  return 'Ya existe un producto con ese código'
}

function presentProduct(row, isAdmin) {
  const product = mapProduct(row)
  if (isAdmin) return product
  const { cost, ...rest } = product
  return rest
}

export async function list(req, res) {
  try {
    const parsed = parseListQuery(req.query)
    const isAdmin = req.user?.role === 'admin'
    let { where, params } = parsed
    const { sortCol, order } = parsed
    if (!isAdmin) {
      where = where ? `${where} AND p.is_active = 1` : 'WHERE p.is_active = 1'
    }

    const hasPage = req.query.page != null && req.query.page !== ''
    const hasLimit = req.query.limit != null && req.query.limit !== ''

    if (!hasPage && !hasLimit) {
      const includeInactive =
        String(req.query.includeInactive || '') === '1' &&
        req.user?.role === 'admin'
      const saleWhere = includeInactive
        ? where
        : where
          ? `${where} AND p.is_active = 1`
          : 'WHERE p.is_active = 1'
      const [rows] = await pool.query(
        `SELECT ${SELECT_FIELDS} ${FROM} ${saleWhere} ORDER BY ${sortCol} ${order}`,
        params,
      )
      return res.json(rows.map((row) => presentProduct(row, isAdmin)))
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${FROM} ${where}`,
      params,
    )

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} ${FROM} ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    const totalNum = Number(total) || 0
    res.json({
      items: rows.map((row) => presentProduct(row, isAdmin)),
      pagination: {
        page,
        limit,
        total: totalNum,
        totalPages: Math.max(1, Math.ceil(totalNum / limit)),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar productos' })
  }
}

export async function create(req, res) {
  try {
    const parsed = parseProductBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error })
    }
    const v = parsed.value
    if (!(await categoryExists(v.categoryId))) {
      return res.status(400).json({ error: 'La categoría no existe' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [result] = await conn.query(
        `INSERT INTO products
          (sku, barcode, name, price, cost, stock, min_stock, category_id, is_active)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [v.sku, v.barcode, v.name, v.price, v.cost, v.minStock, v.categoryId, v.isActive],
      )
      if (v.stock > 0) {
        await applyStockChange(conn, {
          productId: result.insertId,
          delta: v.stock,
          movementType: 'ajuste',
          reason: 'stock_inicial',
          notes: 'Stock inicial',
          userId: req.user?.id ?? null,
        })
      }
      await conn.commit()
      const [rows] = await pool.query(
        `SELECT ${SELECT_FIELDS} ${FROM} WHERE p.id = ?`,
        [result.insertId],
      )
      res.status(201).json(mapProduct(rows[0]))
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    const duplicate = duplicateProductMessage(err)
    if (duplicate) return res.status(409).json({ error: duplicate })
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al crear producto' })
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const parsed = parseProductBody(req.body, { requireStock: false })
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error })
    }
    const v = parsed.value
    if (!(await categoryExists(v.categoryId))) {
      return res.status(400).json({ error: 'La categoría no existe' })
    }

    const [result] = await pool.query(
      `UPDATE products
       SET sku = ?, barcode = ?, name = ?, price = ?, cost = ?,
           min_stock = ?, category_id = ?, is_active = ?
       WHERE id = ?`,
      [
        v.sku,
        v.barcode,
        v.name,
        v.price,
        v.cost,
        v.minStock,
        v.categoryId,
        v.isActive,
        id,
      ],
    )
    if (result.affectedRows === 0) {
      const [exists] = await pool.query('SELECT id FROM products WHERE id = ?', [id])
      if (exists.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' })
      }
    }

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} ${FROM} WHERE p.id = ?`,
      [id],
    )
    res.json(mapProduct(rows[0]))
  } catch (err) {
    const duplicate = duplicateProductMessage(err)
    if (duplicate) return res.status(409).json({ error: duplicate })
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar producto' })
  }
}

export async function destroy(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    res.status(204).send()
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error:
          'No se puede eliminar: el producto está asociado a ventas o compras',
      })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar producto' })
  }
}

export async function movements(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID inválido' })
    }
    const [exists] = await pool.query(
      'SELECT id, name, stock FROM products WHERE id = ?',
      [id],
    )
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const [rows] = await pool.query(
      `SELECT m.id,
              m.movement_type AS movementType,
              m.reason,
              m.quantity,
              m.stock_after AS stockAfter,
              m.notes,
              m.reference_type AS referenceType,
              m.reference_id AS referenceId,
              m.created_at AS createdAt,
              u.name AS userName
       FROM stock_movements m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.product_id = ?
       ORDER BY m.id DESC
       LIMIT 200`,
      [id],
    )
    res.json({
      productId: id,
      productName: exists[0].name,
      stock: Number(exists[0].stock),
      movements: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        stockAfter: Number(row.stockAfter),
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar movimientos' })
  }
}

export async function adjust(req, res) {
  const id = Number(req.params.id)
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'ID inválido' })
  }
  const reason = String(req.body?.reason || '').trim()
  if (!['conteo', 'merma', 'error'].includes(reason)) {
    return res.status(400).json({ error: 'Motivo de ajuste inválido' })
  }
  const notes = String(req.body?.notes || '').trim()
  if (!notes) {
    return res.status(400).json({ error: 'Indicá el motivo del ajuste' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query(
      'SELECT id, stock FROM products WHERE id = ? FOR UPDATE',
      [id],
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const current = Number(rows[0].stock)
    let delta
    if (reason === 'merma') {
      const quantity = parseInt(req.body?.quantity, 10)
      if (!Number.isInteger(quantity) || quantity < 1) {
        await conn.rollback()
        return res.status(400).json({ error: 'Indicá cuántas unidades se perdieron' })
      }
      delta = -quantity
    } else {
      const newStock = parseInt(req.body?.newStock, 10)
      if (!Number.isInteger(newStock) || newStock < 0) {
        await conn.rollback()
        return res.status(400).json({ error: 'El stock contado es inválido' })
      }
      delta = newStock - current
    }

    const stockAfter = await applyStockChange(conn, {
      productId: id,
      delta,
      movementType: 'ajuste',
      reason,
      notes: notes.slice(0, 500),
      userId: req.user?.id ?? null,
    })
    await conn.commit()
    res.json({ productId: id, stock: stockAfter, delta })
  } catch (err) {
    await conn.rollback()
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al ajustar el stock' })
  } finally {
    conn.release()
  }
}
