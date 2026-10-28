import api from '../http.js'

/**
 * @param {{ page?: number, limit?: number, q?: string, role?: string, sort?: string, order?: string }} params
 */
export async function fetchUsersPage(params = {}) {
  const { data } = await api.get('/users', { params })
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

export async function deleteUser(id) {
  await api.delete(`/users/${id}`)
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload)
  return data
}

export async function fetchRecoveryCodes() {
  const { data } = await api.get('/users/recovery-codes')
  return data
}

export async function updateUser(id, payload) {
  const { data } = await api.put(`/users/${id}`, payload)
  return data
}
