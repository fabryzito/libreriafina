import Modal from './Modal'

const fieldClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ProveedorModal({
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
      title={editingId ? 'Editar proveedor' : 'Crear proveedor'}
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
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Persona de contacto
          </label>
          <input
            className={fieldClass}
            value={form.contactName}
            onChange={(e) =>
              setForm((p) => ({ ...p, contactName: e.target.value }))
            }
            placeholder="Opcional"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Teléfono
            </label>
            <input
              className={fieldClass}
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Documento
          </label>
          <input
            className={fieldClass}
            value={form.documentId}
            onChange={(e) =>
              setForm((p) => ({ ...p, documentId: e.target.value }))
            }
            placeholder="RNC, cédula u otro"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Dirección
          </label>
          <input
            className={fieldClass}
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-md bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ProveedorModal
