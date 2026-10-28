import { Fragment, useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cancelPurchase, fetchPurchases } from '../api/services/purchases'
import { formatPaymentMethodLabel } from '../constants/paymentMethods.js'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function HistorialCompras() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setPurchases(await fetchPurchases())
    } catch (e) {
      setError(e.message || 'Error al cargar compras')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCancel = async (purchase) => {
    const ok = window.confirm(
      `¿Anular la compra #${purchase.id}?\n\nSe descuenta el stock ingresado. Si fue a cuenta corriente, baja la deuda. Si se pagó por caja, el dinero vuelve a la misma sesión abierta. El costo vuelve al anterior solo si no se cambió después.`,
    )
    if (!ok) return
    setCancellingId(purchase.id)
    setError('')
    try {
      await cancelPurchase(purchase.id)
      await load()
    } catch (e) {
      setError(e.message || 'No se pudo anular la compra')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Historial de compras
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Consultá cada compra y anulá las que todavía se puedan revertir.
          </p>
        </div>
        <NavLink
          to="/compras"
          end
          className="shrink-0 rounded-lg bg-indigo-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-indigo-700"
        >
          Nueva compra
        </NavLink>
      </header>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-500 px-5 py-12 text-center">Cargando compras…</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-slate-500 px-5 py-12 text-center">
            Todavía no hay compras registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 font-medium">Compra</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const open = expandedId === purchase.id
                  const cancelled = purchase.status === 'anulada'
                  return (
                    <Fragment key={purchase.id}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer ${
                          cancelled ? 'bg-slate-50/80 text-slate-500' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setExpandedId(open ? null : purchase.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            setExpandedId(open ? null : purchase.id)
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-mono">#{purchase.id}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{purchase.date}</td>
                        <td className="px-4 py-3">{purchase.supplierName}</td>
                        <td className="px-4 py-3">
                          {formatPaymentMethodLabel(purchase.paymentMethod)}
                        </td>
                        <td className="px-4 py-3">
                          {cancelled ? (
                            <span className="inline-flex rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs font-medium">
                              Anulada
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-xs font-medium">
                              Registrada
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {money(purchase.total)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{open ? '▾' : '▸'}</td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                              <p className="text-xs text-slate-600">
                                Registró {purchase.userName || '—'}
                                {purchase.updateCost ? ' · actualizó costos' : ' · no cambió costos'}
                                {purchase.notes ? ` · ${purchase.notes}` : ''}
                              </p>
                              {!cancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleCancel(purchase)}
                                  disabled={cancellingId === purchase.id}
                                  className="text-xs font-medium border border-red-200 rounded-md px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-60"
                                >
                                  {cancellingId === purchase.id ? 'Anulando…' : 'Anular compra'}
                                </button>
                              )}
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 text-left">
                                    <th className="px-3 py-2 font-medium">Producto</th>
                                    <th className="px-3 py-2 font-medium text-right">Cant.</th>
                                    <th className="px-3 py-2 font-medium text-right">Costo</th>
                                    <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchase.items.map((item) => (
                                    <tr key={`${purchase.id}-${item.productId}`} className="border-t border-slate-100">
                                      <td className="px-3 py-2">
                                        {item.productName}
                                        {item.sku ? (
                                          <span className="ml-2 font-mono text-xs text-slate-400">
                                            {item.sku}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{money(item.unitCost)}</td>
                                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                                        {money(item.subtotal)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default HistorialCompras
