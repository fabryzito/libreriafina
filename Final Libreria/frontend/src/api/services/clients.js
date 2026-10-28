import api from '../http.js'

/** Lista completa (sin paginación). Usado en ventas y pickers. */
export async function fetchClients() {
  const { data } = await api.get('/clients')
  return Array.isArray(data) ? data : data.items
}

/**
 * @param {{ page?: number, limit?: number, q?: string, balance?: string, sort?: string, order?: string }} params
 */
export async function fetchClientsPage(params = {}) {
  const { data } = await api.get('/clients', { params })
  if (Array.isArray(data)) {
    return {
      items: data,
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
      },
    }
  }
  return data
}

export async function createClient(payload) {
  const { data } = await api.post('/clients', payload)
  return data
}

export async function updateClient(id, payload) {
  const { data } = await api.put(`/clients/${id}`, payload)
  return data
}

export async function deleteClient(id) {
  await api.delete(`/clients/${id}`)
}

export async function fetchClientPayments(clientId) {
  const { data } = await api.get(`/clients/${clientId}/payments`)
  return data
}

export async function createClientPayment(clientId, payload) {
  const { data } = await api.post(`/clients/${clientId}/payments`, payload)
  return data
}
