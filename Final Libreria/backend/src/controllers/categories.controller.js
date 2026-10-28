import pool from '../config/database.js'

export async function list(_req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name FROM categories ORDER BY name ASC',
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar categorías' })
  }
}

export async function create(req, res) {
  try {
    const name = String(req.body?.name || '').trim()
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' })
    }
    if (name.length > 80) {
      return res.status(400).json({ error: 'La categoría no puede superar 80 caracteres' })
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name) VALUES (?)',
      [name],
    )
    const [rows] = await pool.query(
      'SELECT id, name FROM categories WHERE id = ?',
      [result.insertId],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear categoría' })
  }
}
