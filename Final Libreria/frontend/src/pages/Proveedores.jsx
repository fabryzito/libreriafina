import { useCallback, useEffect, useState } from 'react'
import ProveedorModal from '../components/modales/ProveedorModal'
import ProveedorPagosModal from '../components/modales/ProveedorPagosModal'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  fetchSuppliersPage,
  updateSupplier,
} from '../api/services/suppliers'

const emptyForm = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  documentId: '',
  address: '',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const BALANCE_FILTERS = [
  { value: 'all', label: 'Todas las deudas' },
  { value: 'with_balance', label: 'Con deuda' },
  { value: 'no_balance', label: 'Sin deuda' },
]

function money(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${v.toFixed(2)}`
}

function BalanceBadge({ balanceDue }) {
  const bal = Number(balanceDue ?? 0)
  if (bal <= 0.009) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-xs font-medium">
        Al día
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-900 border border-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums">
      {money(bal)}
    </span>
  )
}

function Proveedores() {
  const [suppliers, setSuppliers] = useState([])
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
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pagosModalOpen, setPagosModalOpen] = useState(false)
  const [pagosSupplier, setPagosSupplier] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, balanceFilter, pageSize])

  const loadSuppliers = useCallback(async () => {
    setListError('')
    setLoading(true)
    try {
      const data = await fetchSuppliersPage({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        balance: balanceFilter !== 'all' ? balanceFilter : undefined,
        sort,
        order,
      })
      setSuppliers(data.items)
      setPagination(data.pagination)
    } catch (e) {
      setListError(e.message || 'Error al cargar proveedores')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, balanceFilter, sort, order])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const handleSort = (field, nextOrder) => {
    setSort(field)
    setOrder(nextOrder)
    setPage(1)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setModalError('')
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalError('')
    setIsModalOpen(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({
      name: s.name || '',
      contactName: s.contactName || '',
      email: s.email || '',
      phone: s.phone || '',
      documentId: s.documentId || '',
      address: s.address || '',
    })
    setModalError('')
    setIsModalOpen(true)
  }

  const openPagos = (s) => {
    setPagosSupplier(s)
    setPagosModalOpen(true)
  }

  const closePagos = () => {
    setPagosModalOpen(false)
    setPagosSupplier(null)
  }

  const handlePagosSaved = async () => {
    await loadSuppliers()
    if (pagosSupplier?.id) {
      try {
        const all = await fetchSuppliers()
        const updated = all.find((s) => s.id === pagosSupplier.id)
        if (updated) setPagosSupplier(updated)
      } catch {
        /* la lista principal ya se actualizó */
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setModalError('')
    try {
      const payload = { ...form, name: form.name.trim() }
      if (editingId) await updateSupplier(editingId, payload)
      else {
        await createSupplier(payload)
        setPage(1)
      }
      await loadSuppliers()
      closeModal()
    } catch (err) {
      setModalError(err.message || 'Error al guardar proveedor')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const target = suppliers.find((s) => s.id === id)
    const label = target ? target.name : `ID ${id}`
    if (!window.confirm(`¿Eliminar al proveedor "${label}"?`)) return

    setSaving(true)
    setListError('')
    try {
      await deleteSupplier(id)
      const isLastOnPage = suppliers.length === 1 && page > 1
      if (isLastOnPage) setPage((p) => p - 1)
      else await loadSuppliers()
    } catch (e) {
      setListError(e.message || 'Error al eliminar proveedor')
    } finally {
      setSaving(false)
    }
  }

  const hasActiveFilters = debouncedSearch !== '' || balanceFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setBalanceFilter('all')
    setPage(1)
  }

  return (
    <section className="flex items-start justify-center w-full">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-2">
              Compras
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Proveedores
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Contacto y deuda pendiente. Los pagos bajan la cuenta corriente.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-indigo-700 transition shadow-sm"
          >
            <span className="text-lg leading-none" aria-hidden>
              +
            </span>
            Nuevo proveedor
          </button>
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
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <label htmlFor="supplier-search" className="sr-only">
                Buscar proveedores
              </label>
              <input
                id="supplier-search"
                type="search"
                placeholder="Nombre, contacto, teléfono, documento o ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
                aria-label="Filtrar por deuda"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {BALANCE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Proveedores por página"
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
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
                <span className="font-medium text-slate-700">{pagination.total}</span>{' '}
                {pagination.total === 1 ? 'proveedor' : 'proveedores'}
                {hasActiveFilters ? ' con los filtros aplicados' : ' en total'}
              </>
            )}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <SortHeader label="Nombre" field="name" sort={sort} order={order} onSort={handleSort} />
                <SortHeader label="Contacto" field="contactName" sort={sort} order={order} onSort={handleSort} />
                <SortHeader label="Teléfono" field="phone" sort={sort} order={order} onSort={handleSort} />
                <SortHeader label="Deuda" field="balanceDue" sort={sort} order={order} onSort={handleSort} align="right" />
                <th className="text-right py-3 px-3 border-b border-slate-200 font-medium text-slate-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td colSpan={5} className="py-3 px-3 border-b border-slate-100">
                      <div className="h-4 bg-slate-200 rounded w-full max-w-md" />
                    </td>
                  </tr>
                ))}
              {!loading && suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 px-3 text-center text-slate-500">
                    <p className="font-medium text-slate-700 mb-1">
                      No se encontraron proveedores
                    </p>
                    <p className="text-sm">
                      {hasActiveFilters
                        ? 'Prueba con otros términos o quita los filtros.'
                        : 'Registra el primer proveedor con el botón de arriba.'}
                    </p>
                  </td>
                </tr>
              )}
              {!loading &&
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 border-b border-slate-100">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.email || s.documentId || '—'}</p>
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                      {s.contactName || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                      {s.phone || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <BalanceBadge balanceDue={s.balanceDue} />
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          disabled={saving}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openPagos(s)}
                          disabled={saving}
                          className="text-xs font-medium border border-indigo-200 rounded-md px-2.5 py-1.5 hover:bg-indigo-50 text-indigo-800"
                        >
                          Pagos
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={saving}
                          className="text-xs font-medium border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
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

        <ProveedorModal
          open={isModalOpen}
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          error={modalError}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
        <ProveedorPagosModal
          open={pagosModalOpen}
          onClose={closePagos}
          supplier={pagosSupplier}
          onSaved={handlePagosSaved}
        />
      </div>
    </section>
  )
}

export default Proveedores
