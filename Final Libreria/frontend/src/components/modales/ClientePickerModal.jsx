import { useMemo, useState } from 'react'
import Modal from './Modal'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

/**
 * @param {{ open: boolean, onClose: () => void, clients: Array<{ id: number, fullName: string, balanceDue?: number }>, onSelect: (c: { id: number, fullName: string }) => void }} props
 */
function ClientePickerModal({ open, onClose, clients, onSelect }) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients
    return clients.filter((c) => {
      const name = String(c.fullName || '').toLowerCase()
      const idStr = String(c.id)
      const email = String(c.email || '').toLowerCase()
      const phone = String(c.phone || '').toLowerCase()
      const doc = String(c.documentId || '').toLowerCase()
      return (
        name.includes(s) ||
        idStr === s ||
        idStr.includes(s) ||
        email.includes(s) ||
        phone.includes(s) ||
        doc.includes(s)
      )
    })
  }, [clients, q])

  const handlePick = (c) => {
    onSelect({ id: c.id, fullName: c.fullName })
    setQ('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Cliente para cuenta corriente"
      onClose={() => {
        setQ('')
        onClose()
      }}
    >
      <p className="text-sm text-slate-600 mb-3">
        Busca y elige el cliente al que se cargará esta venta.
      </p>
      <input
        type="search"
        autoComplete="off"
        placeholder="Nombre, teléfono, email, documento o ID…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-3"
      />
      <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 px-3 py-6 text-center">
            No hay clientes que coincidan.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handlePick(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm"
                >
                  <span className="font-medium text-slate-900">{c.fullName}</span>
                  <span className="text-slate-400 font-mono text-xs ml-2">#{c.id}</span>
                  {c.balanceDue != null && (
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Saldo actual:{' '}
                      <span className="font-semibold tabular-nums text-slate-700">
                        {money(c.balanceDue)}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export default ClientePickerModal
