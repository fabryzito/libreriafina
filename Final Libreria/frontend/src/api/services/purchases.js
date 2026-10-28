import api from '../http.js'

export async function fetchPurchases() {
  const { data } = await api.get('/purchases')
  return Array.isArray(data) ? data : []
}

export async function createPurchase(payload) {
  const { data } = await api.post('/purchases', payload)
  return data
}

export async function cancelPurchase(id) {
  const { data } = await api.post(`/purchases/${id}/cancel`)
  return data
}
