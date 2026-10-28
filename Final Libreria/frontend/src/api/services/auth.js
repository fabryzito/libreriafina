import api from '../http.js'

/**
 * Login público (no envía token).
 * Nombre `loginRequest` para no confundir con `login` del AuthContext.
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function loginRequest({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function requestPasswordReset(email) {
  const { data } = await api.post('/auth/forgot', { email })
  return data
}

export async function resetPassword({ email, code, password }) {
  const { data } = await api.post('/auth/reset', { email, code, password })
  return data
}
