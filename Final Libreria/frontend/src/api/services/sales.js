import api from '../http.js'

/** @returns {Promise<Array>} */
export async function fetchSales(params = {}) {
  const { data } = await api.get('/sales', { params })
  return data
}

/**
 * @param {{
 *   items: Array<{ productId: number, quantity: number }>,
 *   saleDate?: string,
 *   paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente',
 *   clientId?: number | null,
 * }} payload
 * @returns {Promise<object>}
 */


export async function createSale(payload) {
  const { data } = await api.post('/sales', payload)
  return data
}

export async function cancelSale(id) {
  const { data } = await api.post(`/sales/${id}/cancel`)
  return data
}

export async function returnSale(id, payload) {
  const { data } = await api.post(`/sales/${id}/returns`, payload)
  return data
}
