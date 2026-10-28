import pool from '../config/database.js'

function mapShop(row) {
  if (!row) {
    return { name: 'Librería', address: '', phone: '', documentId: '' }
  }
  return {
    name: row.name,
    address: row.address || '',
    phone: row.phone || '',
    documentId: row.documentId || '',
  }
}

export async function get(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT name, address, phone, document_id AS documentId
       FROM shop_settings WHERE id = 1`,
    )
    res.json(mapShop(rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al leer los datos del negocio' })
  }
}

export async function update(req, res) {
  try {
    const name = String(req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'El nombre del negocio es obligatorio' })
    if (name.length > 180) {
      return res.status(400).json({ error: 'El nombre no puede superar 180 caracteres' })
    }
    const address = String(req.body?.address || '').trim().slice(0, 255) || null
    const phone = String(req.body?.phone || '').trim().slice(0, 40) || null
    const documentId = String(req.body?.documentId || '').trim().slice(0, 60) || null
    await pool.query(
      `INSERT INTO shop_settings (id, name, address, phone, document_id)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         address = VALUES(address),
         phone = VALUES(phone),
         document_id = VALUES(document_id)`,
      [name, address, phone, documentId],
    )
    res.json(mapShop({ name, address, phone, documentId }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar los datos del negocio' })
  }
}
