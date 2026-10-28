import api from '../http.js'

export async function fetchSuppliers() {
  const { data } = await api.get('/suppliers')
  return Array.isArray(data) ? data : data.items
}

/**
 * @param {{ page?: number, limit?: number, q?: string, balance?: string, sort?: string, order?: string }} params
 */
export async function fetchSuppliersPage(params = {}) {
  const { data } = await api.get('/suppliers', { params })
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

export async function createSupplier(payload) {
  const { data } = await api.post('/suppliers', payload)
  return data
}

export async function updateSupplier(id, payload) {
  const { data } = await api.put(`/suppliers/${id}`, payload)
  return data
}

export async function deleteSupplier(id) {
  await api.delete(`/suppliers/${id}`)
}

export async function fetchSupplierPayments(supplierId) {
  const { data } = await api.get(`/suppliers/${supplierId}/payments`)
  return data
}

export async function createSupplierPayment(supplierId, payload) {
  const { data } = await api.post(`/suppliers/${supplierId}/payments`, payload)
  return data
}
