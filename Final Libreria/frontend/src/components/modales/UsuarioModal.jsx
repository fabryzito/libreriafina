import Modal from './Modal'
import { ROLES } from '../../constants/roles'

function UsuarioModal({
  open,
  editingId,
  form,
  setForm,
  saving,
  error,
  onSubmit,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={editingId ? 'Editar usuario' : 'Crear usuario'}
      onClose={onClose}
    >
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contraseña
            {editingId ? (
              <span className="text-slate-400 font-normal"> (opcional al editar)</span>
            ) : null}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required={!editingId}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Rol
          </label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, role: e.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={ROLES.ADMIN}>admin</option>
            <option value={ROLES.EMPLEADO}>empleado</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex justify-center items-center rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving
              ? 'Guardando...'
              : editingId
                ? 'Guardar cambios'
                : 'Crear usuario'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex justify-center items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default UsuarioModal

