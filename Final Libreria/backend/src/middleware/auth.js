import jwt from 'jsonwebtoken'

export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.id, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' })
    }
    next()
  }
}
