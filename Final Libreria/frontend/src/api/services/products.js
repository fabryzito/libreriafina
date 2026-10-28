import api from '../http.js'

/**
 * Lista completa (sin paginación). Usado en ventas y pickers.
 * @returns {Promise<Array>}
 */
export async function fetchProducts(params = {}) {
  const { data } = await api.get('/products', { params })
  return Array.isArray(data) ? data : data.items
}

/**
 * Lista paginada con filtros y ordenamiento.
 * @param {{ page?: number, limit?: number, q?: string, stock?: string, status?: string, categoryId?: string | number, sort?: string, order?: string }} params
 * @returns {Promise<{ items: Array, pagination: { page: number, limit: number, total: number, totalPages: number } }>}
 */
export async function fetchProductsPage(params = {}) {
  const { data } = await api.get('/products', { params })
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

export async function deleteProduct(id) {
  await api.delete(`/products/${id}`)
}

export async function createProduct(payload) {
  const { data } = await api.post('/products', payload)
  return data
}

export async function updateProduct(id, payload) {
  const { data } = await api.put(`/products/${id}`, payload)
  return data
}

export async function fetchProductMovements(id) {
  const { data } = await api.get(`/products/${id}/movements`)
  return data
}

export async function adjustProductStock(id, payload) {
  const { data } = await api.post(`/products/${id}/adjust`, payload)
  return data
}
