import api from '../http.js'

export async function fetchHomeReport() {
  const { data } = await api.get('/reports/home')
  return data
}

export async function fetchBusinessReport(params = {}) {
  const { data } = await api.get('/reports/business', { params })
  return data
}
