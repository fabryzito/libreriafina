import api from '../http.js'

export async function fetchShop() {
  const { data } = await api.get('/shop')
  return data
}

export async function updateShop(payload) {
  const { data } = await api.put('/shop', payload)
  return data
}
