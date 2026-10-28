import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import { fetchProductMovements } from '../../api/services/products'
import { stockReasonLabel } from '../../constants/cashLabels'

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function MovimientosStockModal({ open, product, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!product?.id) return
    setError('')
    setLoading(true)
    try {
      setData(await fetchProductMovements(product.id))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [product?.id])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  if (!product) return null

  const movements = data?.movements || []

  return (
    <Modal open={open} wide title={`Movimientos — ${product.name}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-3">
        Stock actual: <span className="font-semibold tabular-nums">{data?.stock ?? product.stock}</span>
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500 py-6 text-center">Cargando…</p>
      ) : movements.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Este producto todavía no tiene movimientos registrados.
        </p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Movimiento</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Quedó</th>
                <th className="px-3 py-2">Quién</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatWhen(row.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-800">
                    {stockReasonLabel(row.reason)}
                    {row.notes ? <span className="block text-xs text-slate-500">{row.notes}</span> : null}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${row.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.stockAfter}</td>
                  <td className="px-3 py-2 text-slate-600">{row.userName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default MovimientosStockModal
