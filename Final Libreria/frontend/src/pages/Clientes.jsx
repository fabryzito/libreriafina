import { useCallback, useEffect, useState } from 'react'
import ClienteModal from '../components/modales/ClienteModal'
import ClientePagosModal from '../components/modales/ClientePagosModal'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import {
  createClient,
  deleteClient,
  fetchClients,
  fetchClientsPage,
  updateClient,
} from '../api/services/clients'

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  documentId: '',
  address: '',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const BALANCE_FILTERS = [
  { value: 'all', label: 'Todos los saldos' },
  { value: 'with_balance', label: 'Con saldo pendiente' },
  { value: 'no_balance', label: 'Sin saldo pendiente' },
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

function Clientes() {
  const [clients, setClients] = useState([])
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
  const [pagosClient, setPagosClient] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, balanceFilter, pageSize])

  const loadClients = useCallback(async () => {
    setListError('')
    setLoading(true)
    try {
      const data = await fetchClientsPage({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        balance: balanceFilter !== 'all' ? balanceFilter : undefined,
        sort,
        order,
      })
      setClients(data.items)
      setPagination(data.pagination)
    } catch (e) {
      setListError(e.message || 'Error al cargar clientes')
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, balanceFilter, sort, order])

  useEffect(() => {
    loadClients()
  }, [loadClients])

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

  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      fullName: c.fullName || '',
      email: c.email || '',
      phone: c.phone || '',
      documentId: c.documentId || '',
      address: c.address || '',
    })
    setModalError('')
    setIsModalOpen(true)
  }

  const openPagos = (c) => {
    setPagosClient(c)
    setPagosModalOpen(true)
  }

  const closePagos = () => {
    setPagosModalOpen(false)
    setPagosClient(null)
  }

  const handlePagosSaved = async () => {
    await loadClients()
    if (pagosClient?.id) {
      try {
        const all = await fetchClients()
        const updated = all.find((c) => c.id === pagosClient.id)
        if (updated) setPagosClient(updated)
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
      const payload = { ...form, fullName: form.fullName.trim() }
      if (editingId) await updateClient(editingId, payload)
      else {
        await createClient(payload)
        setPage(1)
      }
      await loadClients()
      closeModal()
    } catch (err) {
      setModalError(err.message || 'Error al guardar cliente')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const target = clients.find((c) => c.id === id)
    const label = target ? target.fullName : `ID ${id}`
    if (!window.confirm(`¿Eliminar al cliente "${label}"?`)) return

    setSaving(true)
    setListError('')
    try {
      await deleteClient(id)
      const isLastOnPage = clients.length === 1 && page > 1
      if (isLastOnPage) setPage((p) => p - 1)
      else await loadClients()
    } catch (e) {
      setListError(e.message || 'Error al eliminar cliente')
    } finally {
      setSaving(false)
    }
  }

  const hasActiveFilters =
    debouncedSearch !== '' || balanceFilter !== 'all'

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
              Cartera
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestión de clientes
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Clientes, cuenta corriente y cobros con búsqueda avanzada.
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
            Nuevo cliente
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
              <label htmlFor="client-search" className="sr-only">
                Buscar clientes
              </label>
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden
              >
                ⌕
              </span>
              <input
                id="client-search"
                type="search"
                placeholder="Nombre, email, teléfono, documento o ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
                aria-label="Filtrar por saldo"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[11rem]"
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
                aria-label="Clientes por página"
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
                {pagination.total === 1 ? 'cliente' : 'clientes'}
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
                  label="ID"
                  field="id"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Nombre"
                  field="fullName"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Email"
                  field="email"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Teléfono"
                  field="phone"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                />
                <th className="text-left py-3 px-3 border-b border-slate-200 font-medium text-slate-600 hidden lg:table-cell">
                  Documento
                </th>
                <SortHeader
                  label="Saldo"
                  field="balanceDue"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                  align="right"
                />
                <th className="text-right py-3 px-3 border-b border-slate-200 font-medium text-slate-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td colSpan={7} className="py-3 px-3 border-b border-slate-100">
                      <div className="h-4 bg-slate-200 rounded w-full max-w-md" />
                    </td>
                  </tr>
                ))}

              {!loading && clients.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 px-3 text-center text-slate-500"
                  >
                    <p className="font-medium text-slate-700 mb-1">
                      No se encontraron clientes
                    </p>
                    <p className="text-sm">
                      {hasActiveFilters
                        ? 'Prueba con otros términos o quita los filtros.'
                        : 'Registra el primer cliente con el botón de arriba.'}
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                clients.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-500 font-mono text-xs">
                      #{c.id}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 font-medium text-slate-900">
                      {c.fullName}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                      {c.email || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                      {c.phone || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-slate-500 hidden lg:table-cell">
                      {c.documentId || '—'}
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <BalanceBadge balanceDue={c.balanceDue} />
                    </td>
                    <td className="py-3 px-3 border-b border-slate-100 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          disabled={saving}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white hover:border-slate-300 transition disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openPagos(c)}
                          disabled={saving}
                          className="text-xs font-medium border border-indigo-200 rounded-md px-2.5 py-1.5 hover:bg-indigo-50 text-indigo-800 transition disabled:opacity-60"
                        >
                          Pagos
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={saving}
                          className="text-xs font-medium border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 text-red-700 transition disabled:opacity-60"
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

        <ClienteModal
          open={isModalOpen}
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          error={modalError}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
        <ClientePagosModal
          open={pagosModalOpen}
          onClose={closePagos}
          client={pagosClient}
          onSaved={handlePagosSaved}
        />
      </div>
    </section>
  )
}

export default Clientes
