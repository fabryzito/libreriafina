import Modal from './Modal'

function ClienteModal({ open, editingId, form, setForm, saving, error, onSubmit, onClose }) {
  return (
    <Modal open={open} title={editingId ? 'Editar cliente' : 'Crear cliente'} onClose={onClose}>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Teléfono (opcional)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Documento (opcional)" value={form.documentId} onChange={(e) => setForm((p) => ({ ...p, documentId: e.target.value }))} />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Dirección (opcional)" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="flex-1 rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cliente'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ClienteModal
