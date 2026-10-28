import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import { createClientPayment, fetchClientPayments } from '../../api/services/clients'
import { formatPaymentMethodLabel } from '../../constants/paymentMethods'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function todayYYYYMMDD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * @param {{ open: boolean, onClose: () => void, client: { id: number, fullName: string, balanceDue?: number } | null, onSaved: () => void }} props
 */
function ClientePagosModal({ open, onClose, client, onSaved }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [paymentDate, setPaymentDate] = useState(() => todayYYYYMMDD())
  const [notes, setNotes] = useState('')
  const [balanceDue, setBalanceDue] = useState(0)

  useEffect(() => {
    setBalanceDue(Number(client?.balanceDue ?? 0))
  }, [client?.id, client?.balanceDue])

  const loadPayments = useCallback(async () => {
    if (!client?.id) return
    setError('')
    setLoading(true)
    try {
      setPayments(await fetchClientPayments(client.id))
    } catch (e) {
      setError(e.message || 'Error al cargar historial')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [client?.id])

  useEffect(() => {
    if (!open || !client?.id) return
    setPaymentDate(todayYYYYMMDD())
    setAmount('')
    setPaymentMethod('efectivo')
    setNotes('')
    loadPayments()
  }, [open, client?.id, loadPayments])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!client?.id) return
    setError('')
    const amt = Number(String(amount).replace(',', '.'))
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Indica un monto válido mayor a cero.')
      return
    }
    setSaving(true)
    try {
      await createClientPayment(client.id, {
        amount: amt,
        paymentMethod,
        paymentDate,
        notes: notes.trim() || undefined,
      })
      setBalanceDue((prev) => Math.max(0, prev - amt))
      await loadPayments()
      onSaved()
      setAmount('')
      setNotes('')
    } catch (err) {
      setError(err.message || 'No se pudo registrar el cobro')
    } finally {
      setSaving(false)
    }
  }

  if (!client) return null

  return (
    <Modal
      open={open}
      wide
      title={`Cuenta corriente — ${client.fullName}`}
      onClose={onClose}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
        <p className="text-sm text-slate-600">
          Saldo pendiente
        </p>
        <p className="text-xl font-bold text-slate-900 tabular-nums">
          {money(balanceDue)}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Registrar cobro
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="payAmount">
              Monto
            </label>
            <input
              id="payAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="payDate">
              Fecha
            </label>
            <input
              id="payDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="payMethod">
            Método
          </label>
          <select
            id="payMethod"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            El cobro entra en la caja abierta con este método. Hace falta tener la caja abierta.
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="payNotes">
            Notas (opcional)
          </label>
          <input
            id="payNotes"
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Referencia, comprobante…"
          />
        </div>
        <button
          type="submit"
          disabled={saving || balanceDue <= 0}
          className="rounded-md bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Registrar cobro'}
        </button>
        {balanceDue <= 0 && (
          <p className="text-xs text-slate-500">No hay saldo pendiente.</p>
        )}
      </form>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        Historial de cobros
      </p>
      <div className="max-h-52 overflow-auto rounded-md border border-slate-200">
        {loading ? (
          <p className="text-sm text-slate-500 py-6 text-center">Cargando…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Aún no hay cobros registrados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-left">
                <th className="py-2 px-2 border-b">Fecha</th>
                <th className="py-2 px-2 border-b">Método</th>
                <th className="py-2 px-2 border-b text-right">Monto</th>
                <th className="py-2 px-2 border-b">Registró</th>
                <th className="py-2 px-2 border-b">Notas</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 px-2 tabular-nums whitespace-nowrap">
                    {p.paymentDate}
                  </td>
                  <td className="py-2 px-2 text-slate-600">
                    {formatPaymentMethodLabel(p.paymentMethod)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium tabular-nums">
                    {money(p.amount)}
                  </td>
                  <td className="py-2 px-2 text-slate-600 max-w-[8rem] truncate" title={p.recordedByName || ''}>
                    {p.recordedByName || '—'}
                  </td>
                  <td className="py-2 px-2 text-slate-600 max-w-[10rem] truncate" title={p.notes || ''}>
                    {p.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

export default ClientePagosModal
