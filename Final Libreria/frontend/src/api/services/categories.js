import api from '../http.js'

export async function fetchCategories() {
  const { data } = await api.get('/categories')
  return Array.isArray(data) ? data : []
}

export async function createCategory(name) {
  const { data } = await api.post('/categories', { name })
  return data
}
