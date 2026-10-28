import axios from 'axios'

/**
 * URL base de la API (sin barra final).
 * Configurable con VITE_API_URL en .env del frontend.
 */
export function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
  return String(base).replace(/\/$/, '')
}

/**
 * Cliente HTTP único: todas las peticiones pasan por aquí.
 * - Añade JWT salvo en login.
 * - Si 401 en rutas protegidas, limpia sesión y redirige a /login.
 */
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const isPublicAuth = /auth\/(login|forgot|reset)/.test(config.url || '')
  if (!isPublicAuth) {
    const token = window.localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''
    const isPublicAuth = /auth\/(login|forgot|reset)/.test(url)

    if (status === 401 && !isPublicAuth) {
      window.localStorage.removeItem('user')
      window.localStorage.removeItem('token')
      window.location.href = '/login'
    }

    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Error de red'

    return Promise.reject(new Error(msg))
  },
)

export default api
