import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/database.js'

const RECOVERY_MESSAGE =
  'Si el correo está registrado, el administrador ya puede ver el código en Usuarios. Dura 15 minutos.'

export async function login(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

    const emailNorm = email.trim().toLowerCase()
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [emailNorm],
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const user = rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    )

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
}

export async function forgot(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ingresá un correo válido' })
    }

    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
    if (users.length > 0) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
      const userId = users[0].id
      await pool.query(
        'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
        [userId],
      )
      await pool.query(
        `INSERT INTO password_resets (user_id, code, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
        [userId, code],
      )
    }

    res.json({ message: RECOVERY_MESSAGE })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo iniciar la recuperación' })
  }
}

export async function reset(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const code = String(req.body?.code || '').trim()
    const password = String(req.body?.password || '')
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'El código no es válido o venció' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const [rows] = await pool.query(
      `SELECT pr.id, pr.code, pr.user_id, pr.attempts
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE u.email = ? AND pr.used_at IS NULL AND pr.expires_at > NOW()
       ORDER BY pr.id DESC
       LIMIT 1`,
      [email],
    )
    if (rows.length === 0 || rows[0].attempts >= 5) {
      return res.status(400).json({ error: 'El código no es válido o venció' })
    }

    const row = rows[0]
    const given = Buffer.from(code)
    const expected = Buffer.from(String(row.code))
    const matches = given.length === expected.length && crypto.timingSafeEqual(given, expected)
    if (!matches) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [row.id])
      return res.status(400).json({ error: 'El código no es válido o venció' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id])
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [row.id])
    res.json({ message: 'Contraseña actualizada. Ya podés entrar.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo cambiar la contraseña' })
  }
}

export async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [req.user.id],
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el usuario' })
  }
}
