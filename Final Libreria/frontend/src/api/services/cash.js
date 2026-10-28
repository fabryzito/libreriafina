import api from '../http.js'

export async function fetchCashCurrent() {
  const { data } = await api.get('/cash/current')
  return data
}

export async function openCash(payload) {
  const { data } = await api.post('/cash/open', payload)
  return data
}

export async function closeCash(payload) {
  const { data } = await api.post('/cash/close', payload)
  return data
}

export async function createCashMovement(payload) {
  const { data } = await api.post('/cash/movements', payload)
  return data
}
