import { useEffect, useState } from 'react'
import Modal from './Modal'
import { adjustProductStock } from '../../api/services/products'

function AjusteStockModal({ open, product, onClose, onSaved }) {
  const [reason, setReason] = useState('conteo')
  const [newStock, setNewStock] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !product) return
    setReason('conteo')
    setNewStock(String(product.stock ?? 0))
    setQuantity('')
    setNotes('')
    setError('')
  }, [open, product])

  if (!product) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!notes.trim()) {
      setError('Indicá por qué se ajusta el stock.')
      return
    }
    const payload = { reason, notes: notes.trim() }
    if (reason === 'merma') {
      const qty = parseInt(quantity, 10)
      if (!Number.isInteger(qty) || qty < 1) {
        setError('Indicá cuántas unidades se perdieron.')
        return
      }
      payload.quantity = qty
    } else {
      const next = parseInt(newStock, 10)
      if (!Number.isInteger(next) || next < 0) {
        setError('El stock contado es inválido.')
        return
      }
      payload.newStock = next
    }
    setSaving(true)
    try {
      await adjustProductStock(product.id, payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo ajustar el stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={`Ajustar stock — ${product.name}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Stock actual: <span className="font-semibold tabular-nums">{product.stock}</span>.
        El cambio queda anotado con tu usuario.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="adjust-reason">Motivo</label>
          <select
            id="adjust-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="conteo">Conteo</option>
            <option value="merma">Merma</option>
            <option value="error">Error</option>
          </select>
        </div>
        {reason === 'merma' ? (
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="adjust-qty">Unidades perdidas</label>
            <input
              id="adjust-qty"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="adjust-new">Stock real</label>
            <input
              id="adjust-new"
              type="number"
              min="0"
              step="1"
              value={newStock}
              onChange={(event) => setNewStock(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="adjust-notes">Detalle</label>
          <input
            id="adjust-notes"
            value={notes}
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Faltaban 2 en el estante, rotura…"
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AjusteStockModal
