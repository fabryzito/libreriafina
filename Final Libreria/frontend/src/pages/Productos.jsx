import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import ProductoModal from '../components/modales/ProductoModal'
import AjusteStockModal from '../components/modales/AjusteStockModal'
import MovimientosStockModal from '../components/modales/MovimientosStockModal'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import {
  fetchProductsPage,
  deleteProduct,
  createProduct,
  updateProduct,
} from '../api/services/products'
import { createCategory, fetchCategories } from '../api/services/categories'

const emptyForm = {
  sku: '',
  barcode: '',
  name: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '5',
  categoryId: '',
  isActive: true,
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos los stocks' },
  { value: 'in_stock', label: 'Con stock' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'Activos e inactivos' },
  { value: 'active', label: 'Solo activos' },
  { value: 'inactive', label: 'Solo inactivos' },
]

function money(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${v.toFixed(2)}`
}

function StockBadge({ stock, minStock }) {
  const s = Number(stock)
  const min = Number(minStock)
  const limit = Number.isFinite(min) ? min : 5
  if (s === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 text-xs font-medium">
        Sin stock
      </span>
    )
  }
  if (s <= limit) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 text-xs font-medium">
        Bajo ({s})
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-xs font-medium">
      {s} uds.
    </span>
  )
}

function Productos() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState('')
  const [modalError, setModalError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [historyProduct, setHistoryProduct] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, stockFilter, statusFilter, categoryFilter, pageSize])

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const loadProducts = useCallback(async () => {
    setListError('')
    setLoading(true)
    try {
      const data = await fetchProductsPage({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        stock: stockFilter !== 'all' ? stockFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        sort,
        order,
      })
      setProducts(data.items)
      setPagination(data.pagination)
    } catch (e) {
      setListError(e.message || 'Error al cargar productos')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    stockFilter,
    statusFilter,
    categoryFilter,
    sort,
    order,
  ])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSort = (field, nextOrder) => {
    setSort(field)
    setOrder(nextOrder)
    setPage(1)
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const openCreate = () => {
    setModalError('')
    resetForm()
    setIsModalOpen(true)
  }

  const openEdit = (p) => {
    setModalError('')
    setEditingId(p.id)
    setForm({
      sku: p.sku || '',
      barcode: p.barcode || '',
      name: p.name || '',
      price: p.price != null ? String(p.price) : '',
      cost: p.cost != null ? String(p.cost) : '0',
      stock: p.stock != null ? String(p.stock) : '',
      minStock: p.minStock != null ? String(p.minStock) : '5',
      categoryId: p.categoryId != null ? String(p.categoryId) : '',
      isActive: p.isActive !== false,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalError('')
    resetForm()
  }

  const handleCreateCategory = async (name) => {
    const created = await createCategory(name)
    setCategories((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    )
    return created
  }

  const handleDelete = async (id) => {
    const target = products.find((p) => p.id === id)
    const label = target ? target.name : `ID ${id}`

    if (!window.confirm(`¿Eliminar el producto "${label}"?`)) return

    setListError('')
    setSaving(true)
    try {
      await deleteProduct(id)
      const isLastOnPage = products.length === 1 && page > 1
      if (isLastOnPage) setPage((p) => p - 1)
      else await loadProducts()
      closeModal()
    } catch (e) {
      setListError(e.message || 'Error al eliminar producto')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setModalError('')
    setSaving(true)

    const priceNum = Number(String(form.price).replace(',', '.'))
    const costNum = Number(String(form.cost).replace(',', '.'))
    const stockNum = parseInt(String(form.stock), 10)
    const minStockNum = parseInt(String(form.minStock), 10)

    if (Number.isNaN(priceNum) || priceNum < 0) {
      setModalError('El precio de venta debe ser un número mayor o igual a 0')
      setSaving(false)
      return
    }
    if (Number.isNaN(costNum) || costNum < 0) {
      setModalError('El costo debe ser un número mayor o igual a 0')
      setSaving(false)
      return
    }
    if (editingId == null && (Number.isNaN(stockNum) || stockNum < 0)) {
      setModalError('El stock debe ser un número entero mayor o igual a 0')
      setSaving(false)
      return
    }
    if (Number.isNaN(minStockNum) || minStockNum < 0) {
      setModalError('El stock mínimo debe ser un número entero mayor o igual a 0')
      setSaving(false)
      return
    }

    const payload = {
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      name: form.name.trim(),
      price: priceNum,
      cost: costNum,
      minStock: minStockNum,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      isActive: form.isActive,
    }
    if (editingId == null) payload.stock = stockNum

    try {
      if (editingId != null) {
        await updateProduct(editingId, payload)
      } else {
        await createProduct(payload)
        setPage(1)
      }
      await loadProducts()
      closeModal()
    } catch (e) {
      setModalError(e.message || 'Error al guardar producto')
    } finally {
      setSaving(false)
    }
  }

  const hasActiveFilters =
    debouncedSearch !== '' ||
    stockFilter !== 'all' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setStockFilter('all')
    setStatusFilter('all')
    setCategoryFilter('all')
    setPage(1)
  }

  return (
    <section className="flex items-start justify-center w-full">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-2">
              Inventario
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestión de productos
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {isAdmin
                ? 'Código, costo, categoría y stock mínimo. Un producto inactivo no aparece en ventas.'
                : 'Consulta de precio y stock. El alta y los cambios los hace un administrador.'}
            </p>
          </div>
          {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-indigo-700 transition shadow-sm"
          >
            <span className="text-lg leading-none" aria-hidden>
              +
            </span>
            Nuevo producto
          </button>
          )}
        </header>

        {listError && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4"
          >
            {listError}
          </p>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 mb-5">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <label htmlFor="product-search" className="sr-only">
                Buscar productos
              </label>
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden
              >
                ⌕
              </span>
              <input
                id="product-search"
                type="search"
                placeholder="Buscar por nombre, código o ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoría"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[10rem]"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                aria-label="Filtrar por stock"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[10rem]"
              >
                {STOCK_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              {isAdmin && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por estado"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[10rem]"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              )}

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Productos por página"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} por página
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            {loading ? (
              'Actualizando resultados…'
            ) : (
              <>
                <span className="font-medium text-slate-700">
                  {pagination.total}
                </span>{' '}
                {pagination.total === 1 ? 'producto' : 'productos'}
                {hasActiveFilters ? ' con los filtros aplicados' : ' en total'}
              </>
            )}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <SortHeader
                  label="Código"
                  field="sku"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Nombre"
                  field="name"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Categoría"
                  field="category"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Precio"
                  field="price"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                  align="right"
                />
                {isAdmin && (
                <SortHeader
                  label="Costo"
                  field="cost"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                  align="right"
                />
                )}
                <SortHeader
                  label="Stock"
                  field="stock"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                  align="right"
                />
                <th className="text-left py-3 px-3 border-b border-slate-200 font-medium text-slate-600">
                  Estado
                </th>
                {isAdmin && (
                <th className="text-right py-3 px-3 border-b border-slate-200 font-medium text-slate-600">
                  Acciones
                </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td colSpan={isAdmin ? 8 : 6} className="py-3 px-3 border-b border-slate-100">
                      <div className="h-4 bg-slate-200 rounded w-full max-w-md" />
                    </td>
                  </tr>
                ))}

              {!loading && products.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 6}
                    className="py-12 px-3 text-center text-slate-500"
                  >
                    <p className="font-medium text-slate-700 mb-1">
                      No se encontraron productos
                    </p>
                    <p className="text-sm">
                      {hasActiveFilters
                        ? 'Prueba con otros términos o quita los filtros.'
                        : isAdmin
                          ? 'Crea el primer producto con el botón de arriba.'
                          : 'Todavía no hay productos activos.'}
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      p.isActive ? 'hover:bg-slate-50/80' : 'bg-slate-50/70 text-slate-500'
                    }`}
                  >
                    <td className="py-3 px-3 border-b border-slate-100 font-mono text-xs text-slate-500">
                      {p.sku || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 font-medium text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                      {p.categoryName || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-right tabular-nums text-slate-800">
                      {money(p.price)}
                    </td>
                    {isAdmin && (
                    <td className="py-3 px-3 border-b border-slate-100 text-right tabular-nums text-slate-600">
                      {money(p.cost)}
                    </td>
                    )}
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <StockBadge stock={p.stock} minStock={p.minStock} />
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100">
                      {p.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-xs font-medium">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-xs font-medium">
                          Inactivo
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryProduct(p)}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white hover:border-slate-300 transition"
                        >
                          Movimientos
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustProduct(p)}
                          disabled={saving}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white hover:border-slate-300 transition disabled:opacity-60"
                        >
                          Ajustar
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          disabled={saving}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white hover:border-slate-300 transition disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          disabled={saving}
                          className="text-xs font-medium border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 text-red-700 transition disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
          disabled={loading || saving}
        />

        <ProductoModal
          open={isModalOpen}
          editingId={editingId}
          form={form}
          setForm={setForm}
          categories={categories}
          saving={saving}
          error={modalError}
          onSubmit={handleSubmit}
          onClose={closeModal}
          onCreateCategory={handleCreateCategory}
        />
        <AjusteStockModal
          open={adjustProduct != null}
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSaved={loadProducts}
        />
        <MovimientosStockModal
          open={historyProduct != null}
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      </div>
    </section>
  )
}

export default Productos
