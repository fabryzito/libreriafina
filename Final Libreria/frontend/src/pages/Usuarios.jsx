import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import UsuarioModal from '../components/modales/UsuarioModal'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import {
  fetchUsersPage,
  fetchRecoveryCodes,
  deleteUser,
  createUser,
  updateUser,
} from '../api/services/users'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: ROLES.EMPLEADO,
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const ROLE_FILTERS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'admin', label: 'Administradores' },
  { value: 'empleado', label: 'Empleados' },
]

const ROLE_LABELS = {
  admin: 'Administrador',
  empleado: 'Empleado',
}

function RoleBadge({ role }) {
  const isAdmin = role === ROLES.ADMIN
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
        isAdmin
          ? 'bg-indigo-50 text-indigo-800 border-indigo-100'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function Usuarios() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [users, setUsers] = useState([])
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
  const [roleFilter, setRoleFilter] = useState('all')
  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, pageSize])

  const loadUsers = useCallback(async () => {
    setListError('')
    setLoading(true)
    try {
      const data = await fetchUsersPage({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        sort,
        order,
      })
      setUsers(data.items)
      setPagination(data.pagination)
      setRecoveryCodes(await fetchRecoveryCodes().catch(() => []))
    } catch (e) {
      setListError(e.message || 'Error al cargar usuarios')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, roleFilter, sort, order])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

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

  const openEdit = (u) => {
    setModalError('')
    setEditingId(u.id)
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || ROLES.EMPLEADO,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalError('')
    resetForm()
  }

  const handleDelete = async (id) => {
    const target = users.find((u) => u.id === id)
    const label = target ? `${target.name} (${target.email})` : `ID ${id}`

    if (!window.confirm(`¿Eliminar al usuario ${label}?`)) return

    setListError('')
    setSaving(true)

    try {
      await deleteUser(id)

      if (target && user && Number(target.id) === Number(user.id)) {
        closeModal()
        logout()
        navigate('/login', { replace: true })
        return
      }

      const isLastOnPage = users.length === 1 && page > 1
      if (isLastOnPage) setPage((p) => p - 1)
      else await loadUsers()
      closeModal()
    } catch (e) {
      setListError(e.message || 'Error al eliminar usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setModalError('')
    setSaving(true)

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      }
      if (!editingId) {
        if (!form.password?.trim()) {
          setModalError('La contraseña es obligatoria al crear un usuario')
          setSaving(false)
          return
        }
        payload.password = form.password
      } else if (form.password?.trim()) {
        payload.password = form.password
      }

      if (editingId) {
        await updateUser(editingId, { ...payload, id: editingId })
      } else {
        await createUser(payload)
        setPage(1)
      }

      await loadUsers()
      closeModal()
    } catch (e) {
      setModalError(e.message || 'Error al guardar usuario')
    } finally {
      setSaving(false)
    }
  }

  const hasActiveFilters = debouncedSearch !== '' || roleFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setRoleFilter('all')
    setPage(1)
  }

  return (
    <section className="flex items-start justify-center w-full">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-2">
              Administración
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestión de usuarios
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Equipo del sistema con búsqueda, filtros y paginación.
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
            Nuevo usuario
          </button>
        </header>

        {recoveryCodes.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">Códigos para recuperar contraseña</p>
            <p className="text-xs text-amber-900 mt-0.5">Pasale el código a quien lo pidió. Vence a los 15 minutos.</p>
            <ul className="mt-2 space-y-1">
              {recoveryCodes.map((item) => (
                <li key={`${item.email}-${item.code}`} className="text-sm text-amber-950">
                  {item.name} · {item.email} ·{' '}
                  <span className="font-mono font-semibold tracking-[0.2em]">{item.code}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
              <label htmlFor="user-search" className="sr-only">
                Buscar usuarios
              </label>
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden
              >
                ⌕
              </span>
              <input
                id="user-search"
                type="search"
                placeholder="Buscar por nombre, email o ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filtrar por rol"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[10rem]"
              >
                {ROLE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Usuarios por página"
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
                {pagination.total === 1 ? 'usuario' : 'usuarios'}
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
                  field="name"
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
                  label="Rol"
                  field="role"
                  sort={sort}
                  order={order}
                  onSort={handleSort}
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
                    <td colSpan={5} className="py-3 px-3 border-b border-slate-100">
                      <div className="h-4 bg-slate-200 rounded w-full max-w-md" />
                    </td>
                  </tr>
                ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 px-3 text-center text-slate-500"
                  >
                    <p className="font-medium text-slate-700 mb-1">
                      No se encontraron usuarios
                    </p>
                    <p className="text-sm">
                      {hasActiveFilters
                        ? 'Prueba con otros términos o quita los filtros.'
                        : 'Crea el primer usuario con el botón de arriba.'}
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                users.map((u) => {
                  const isSelf = user && Number(u.id) === Number(user.id)
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelf ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="py-3 px-3 border-b border-slate-100 text-slate-500 font-mono text-xs">
                        #{u.id}
                        {isSelf && (
                          <span className="ml-1.5 text-indigo-600 font-sans font-medium">
                            (tú)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100 font-medium text-slate-900">
                        {u.name}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100 text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            disabled={saving}
                            className="text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-white hover:border-slate-300 transition disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            disabled={saving}
                            className="text-xs font-medium border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 text-red-700 transition disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

        <UsuarioModal
          open={isModalOpen}
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          error={modalError}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      </div>
    </section>
  )
}

export default Usuarios
