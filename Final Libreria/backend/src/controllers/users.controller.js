import bcrypt from 'bcryptjs'
import pool from '../config/database.js'

const SORT_COLUMNS = {
  id: 'id',
  name: 'name',
  email: 'email',
  role: 'role',
}

const SELECT_FIELDS = 'id, name, email, role'

function parseListQuery(query) {
  const q = String(query.q || '').trim()
  const role = String(query.role || 'all')
  const sortKey = String(query.sort || 'id')
  const sortCol = SORT_COLUMNS[sortKey] || 'id'
  const order =
    String(query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  const conditions = []
  const params = []

  if (q) {
    conditions.push('(name LIKE ? OR email LIKE ? OR CAST(id AS CHAR) LIKE ?)')
    const like = `%${q}%`
    params.push(like, like, like)
  }

  if (role === 'admin' || role === 'empleado') {
    conditions.push('role = ?')
    params.push(role)
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
        `SELECT ${SELECT_FIELDS} FROM users ${where} ORDER BY ${sortCol} ${order}`,
        params,
      )
      return res.json(rows)
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params,
    )

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM users ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
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
    res.status(500).json({ error: 'Error al listar usuarios' })
  }
}

export async function recoveryCodes(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS userId, u.name, u.email, pr.code, pr.expires_at AS expiresAt
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.used_at IS NULL AND pr.expires_at > NOW()
       ORDER BY pr.id DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer los códigos' })
  }
}

export async function create(req, res) {
  try {
    const { name, email, password, role } = req.body
    if (!name?.trim() || !email?.trim() || !password) {
      return res
        .status(400)
        .json({ error: 'Nombre, email y contraseña son obligatorios' })
    }
    if (role && !['admin', 'empleado'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        role || 'empleado',
      ],
    )

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM users WHERE id = ?`,
      [result.insertId],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear usuario' })
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const { name, email, password, role } = req.body
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Nombre y email son obligatorios' })
    }
    if (role && !['admin', 'empleado'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' })
    }

    if (password && String(password).length > 0) {
      const passwordHash = await bcrypt.hash(password, 10)
      await pool.query(
        'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), passwordHash, role || 'empleado', id],
      )
    } else {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), role || 'empleado', id],
      )
    }

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM users WHERE id = ?`,
      [id],
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    res.json(rows[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar usuario' })
  }
}

export async function destroy(req, res) {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    res.status(204).send()
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error:
          'No se puede eliminar: el usuario tiene ventas o registros asociados',
      })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar usuario' })
  }
}
