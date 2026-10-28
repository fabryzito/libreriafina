import pool from '../config/database.js'

function todayString() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function parseDate(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  return text
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function periodFromQuery(query) {
  const from = parseDate(query.from)
  const to = parseDate(query.to)
  if (from === undefined || to === undefined) {
    return { error: 'La fecha es inválida' }
  }
  if (from && to && from > to) {
    return { error: 'La fecha inicial no puede ser posterior a la final' }
  }
  return { from, to }
}

function dateFilter(column, from, to) {
  const parts = []
  const params = []
  if (from) {
    parts.push(`${column} >= ?`)
    params.push(from)
  }
  if (to) {
    parts.push(`${column} <= ?`)
    params.push(to)
  }
  return {
    sql: parts.length ? parts.join(' AND ') : '1 = 1',
    params,
  }
}

export async function home(req, res) {
  try {
    const date = todayString()
    const isAdmin = req.user?.role === 'admin'

    const [saleRows] = await pool.query(
      `SELECT s.id,
              s.payment_method AS paymentMethod,
              s.status,
              COALESCE(SUM(si.subtotal * (si.quantity - si.returned_quantity) / si.quantity), 0) AS net
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.sale_date = ?
       GROUP BY s.id, s.payment_method, s.status`,
      [date],
    )

    const byMethod = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      cuenta_corriente: 0,
    }
    let netTotal = 0
    let count = 0
    let cancelled = 0
    for (const row of saleRows) {
      if (row.status === 'anulada') {
        cancelled += 1
        continue
      }
      const net = roundMoney(row.net)
      count += 1
      netTotal = roundMoney(netTotal + net)
      if (byMethod[row.paymentMethod] != null) {
        byMethod[row.paymentMethod] = roundMoney(byMethod[row.paymentMethod] + net)
      }
    }

    const [lowRows] = await pool.query(
      `SELECT id, sku, name, stock, min_stock AS minStock
       FROM products
       WHERE is_active = 1 AND stock > 0 AND stock <= min_stock
       ORDER BY stock ASC, name ASC
       LIMIT 12`,
    )
    const [outRows] = await pool.query(
      `SELECT id, sku, name, stock, min_stock AS minStock
       FROM products
       WHERE is_active = 1 AND stock = 0
       ORDER BY name ASC
       LIMIT 12`,
    )
    const [[{ lowCount }]] = await pool.query(
      `SELECT COUNT(*) AS lowCount FROM products
       WHERE is_active = 1 AND stock > 0 AND stock <= min_stock`,
    )
    const [[{ outCount }]] = await pool.query(
      `SELECT COUNT(*) AS outCount FROM products
       WHERE is_active = 1 AND stock = 0`,
    )

    const [clientRows] = await pool.query(
      `SELECT id, full_name AS fullName, current_balance AS balanceDue
       FROM clients
       WHERE current_balance > 0
       ORDER BY current_balance DESC
       LIMIT 8`,
    )
    const [[{ receivableTotal, receivableCount }]] = await pool.query(
      `SELECT COALESCE(SUM(current_balance), 0) AS receivableTotal,
              COUNT(*) AS receivableCount
       FROM clients
       WHERE current_balance > 0`,
    )

    const [cashRows] = await pool.query(
      `SELECT id FROM cash_sessions WHERE status = 'abierta' LIMIT 1`,
    )

    let payables = null
    if (isAdmin) {
      const [supplierRows] = await pool.query(
        `SELECT id, name, current_balance AS balanceDue
         FROM suppliers
         WHERE current_balance > 0
         ORDER BY current_balance DESC
         LIMIT 8`,
      )
      const [[{ payableTotal, payableCount }]] = await pool.query(
        `SELECT COALESCE(SUM(current_balance), 0) AS payableTotal,
                COUNT(*) AS payableCount
         FROM suppliers
         WHERE current_balance > 0`,
      )
      payables = {
        total: roundMoney(payableTotal),
        count: Number(payableCount),
        items: supplierRows.map((row) => ({
          id: row.id,
          name: row.name,
          balanceDue: roundMoney(row.balanceDue),
        })),
      }
    }

    res.json({
      date,
      cashOpen: cashRows.length > 0,
      sales: { count, cancelled, netTotal, byMethod },
      lowStock: {
        count: Number(lowCount),
        items: lowRows.map((row) => ({
          ...row,
          stock: Number(row.stock),
          minStock: Number(row.minStock),
        })),
      },
      outOfStock: {
        count: Number(outCount),
        items: outRows.map((row) => ({
          ...row,
          stock: Number(row.stock),
          minStock: Number(row.minStock),
        })),
      },
      receivables: {
        total: roundMoney(receivableTotal),
        count: Number(receivableCount),
        items: clientRows.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          balanceDue: roundMoney(row.balanceDue),
        })),
      },
      payables,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar el inicio' })
  }
}

export async function business(req, res) {
  try {
    const period = periodFromQuery(req.query)
    if (period.error) return res.status(400).json({ error: period.error })
    const { from, to } = period
    const isAdmin = req.user?.role === 'admin'
    const saleDates = dateFilter('s.sale_date', from, to)
    const purchaseDates = dateFilter('pu.purchase_date', from, to)

    const [saleRows] = await pool.query(
      `SELECT s.payment_method AS paymentMethod,
              COALESCE(SUM(si.subtotal * (si.quantity - si.returned_quantity) / si.quantity), 0) AS net,
              COUNT(DISTINCT s.id) AS sales
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.status = 'registrada' AND ${saleDates.sql}
       GROUP BY s.payment_method`,
      saleDates.params,
    )
    const byMethod = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      cuenta_corriente: 0,
    }
    let netTotal = 0
    let count = 0
    for (const row of saleRows) {
      const net = roundMoney(row.net)
      count += Number(row.sales)
      netTotal = roundMoney(netTotal + net)
      if (byMethod[row.paymentMethod] != null) byMethod[row.paymentMethod] = net
    }

    const [topRows] = await pool.query(
      `SELECT p.id,
              p.sku,
              p.name,
              SUM(si.quantity - si.returned_quantity) AS quantity,
              SUM(si.subtotal * (si.quantity - si.returned_quantity) / si.quantity) AS revenue,
              SUM((si.quantity - si.returned_quantity) * COALESCE(si.unit_cost, p.cost)) AS cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.status = 'registrada' AND ${saleDates.sql}
       GROUP BY p.id, p.sku, p.name
       HAVING SUM(si.quantity - si.returned_quantity) > 0
       ORDER BY quantity DESC, revenue DESC
       LIMIT 10`,
      saleDates.params,
    )

    const [profitRows] = await pool.query(
      `SELECT COALESCE(SUM(si.subtotal * (si.quantity - si.returned_quantity) / si.quantity), 0) AS revenue,
              COALESCE(SUM((si.quantity - si.returned_quantity) * COALESCE(si.unit_cost, p.cost)), 0) AS cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.status = 'registrada' AND ${saleDates.sql}`,
      saleDates.params,
    )
    const revenue = roundMoney(profitRows[0].revenue)
    const cost = roundMoney(profitRows[0].cost)

    const [stockRows] = await pool.query(
      `SELECT id, sku, name, stock, min_stock AS minStock, cost, price, is_active AS isActive
       FROM products
       ORDER BY stock ASC, name ASC`,
    )
    let units = 0
    let costValue = 0
    let saleValue = 0
    for (const row of stockRows) {
      const stock = Number(row.stock)
      units += stock
      costValue += stock * Number(row.cost)
      saleValue += stock * Number(row.price)
    }
    costValue = roundMoney(costValue)
    saleValue = roundMoney(saleValue)

    const [clientRows] = await pool.query(
      `SELECT id, full_name AS fullName, current_balance AS balanceDue
       FROM clients
       WHERE current_balance > 0
       ORDER BY current_balance DESC`,
    )
    const receivableTotal = roundMoney(
      clientRows.reduce((acc, row) => acc + Number(row.balanceDue), 0),
    )

    let purchases = null
    if (isAdmin) {
      const [purchaseRows] = await pool.query(
        `SELECT s.id,
                s.name,
                COUNT(pu.id) AS purchases,
                COALESCE(SUM(pu.total), 0) AS total
         FROM purchases pu
         JOIN suppliers s ON s.id = pu.supplier_id
         WHERE pu.status = 'registrada' AND ${purchaseDates.sql}
         GROUP BY s.id, s.name
         ORDER BY total DESC, s.name ASC`,
        purchaseDates.params,
      )
      purchases = {
        total: roundMoney(purchaseRows.reduce((acc, row) => acc + Number(row.total), 0)),
        count: purchaseRows.reduce((acc, row) => acc + Number(row.purchases), 0),
        suppliers: purchaseRows.map((row) => ({
          id: row.id,
          name: row.name,
          purchases: Number(row.purchases),
          total: roundMoney(row.total),
        })),
      }
    }

    res.json({
      from,
      to,
      sales: { count, netTotal, byMethod },
      profit: isAdmin
        ? { revenue, cost, profit: roundMoney(revenue - cost) }
        : null,
      topProducts: topRows.map((row) => {
        const item = {
          id: row.id,
          sku: row.sku,
          name: row.name,
          quantity: Number(row.quantity),
          revenue: roundMoney(row.revenue),
        }
        if (isAdmin) {
          item.cost = roundMoney(row.cost)
          item.profit = roundMoney(item.revenue - item.cost)
        }
        return item
      }),
      stock: {
        units,
        costValue: isAdmin ? costValue : null,
        saleValue: isAdmin ? saleValue : null,
        items: stockRows.map((row) => {
          const stock = Number(row.stock)
          const item = {
            id: row.id,
            sku: row.sku,
            name: row.name,
            stock,
            minStock: Number(row.minStock),
            isActive: Boolean(row.isActive),
          }
          if (isAdmin) {
            item.cost = roundMoney(row.cost)
            item.price = roundMoney(row.price)
            item.costValue = roundMoney(stock * Number(row.cost))
            item.saleValue = roundMoney(stock * Number(row.price))
          }
          return item
        }),
      },
      receivables: {
        total: receivableTotal,
        count: clientRows.length,
        items: clientRows.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          balanceDue: roundMoney(row.balanceDue),
        })),
      },
      purchases,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar los reportes' })
  }
}
