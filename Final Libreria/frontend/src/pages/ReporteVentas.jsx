import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import { cancelSale, fetchSales, returnSale } from '../api/services/sales'
import { fetchCashCurrent } from '../api/services/cash'
import { fetchBusinessReport } from '../api/services/reports'
import { fetchShop } from '../api/services/shop'
import TicketVenta from '../components/TicketVenta'
import { formatPaymentMethodLabel, PAYMENT_METHOD_LABELS } from '../constants/paymentMethods.js'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function remainingOf(item) {
  return Math.max(0, Number(item.quantity || 0) - Number(item.returnedQuantity || 0))
}

function lineNet(item) {
  const qty = Number(item.quantity) || 0
  const returned = Number(item.returnedQuantity || 0)
  const sub = Number(item.subtotal)
  if (qty < 1) return 0
  if (!Number.isFinite(sub)) {
    return Math.max(0, (qty - returned) * Number(item.unitPrice || 0))
  }
  if (returned <= 0) return sub
  if (returned >= qty) return 0
  const before = Math.round(((sub * returned) / qty) * 100) / 100
  return Math.round((sub - before) * 100) / 100
}

function netOf(sale) {
  if (sale.status === 'anulada') return 0
  return Math.round((sale.items || []).reduce((acc, item) => acc + lineNet(item), 0) * 100) / 100
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function saleStateLabel(sale) {
  if (sale.status === 'anulada') return 'Anulada'
  const items = sale.items || []
  if (items.length > 0 && items.every((item) => remainingOf(item) === 0)) return 'Devuelta'
  if (items.some((item) => Number(item.returnedQuantity || 0) > 0)) return 'Con devolución'
  return 'Registrada'
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function yearStartISO() {
  return `${new Date().getFullYear()}-01-01`
}

function ReporteVentas() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const [fromDate, setFromDate] = useState(monthStartISO)
  const [toDate, setToDate] = useState(todayISO)
  const [report, setReport] = useState(null)
  const [sales, setSales] = useState([])
  const [openSessionId, setOpenSessionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSaleId, setExpandedSaleId] = useState(null)
  const [returnQty, setReturnQty] = useState({})
  const [returnNotes, setReturnNotes] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [shop, setShop] = useState(null)
  const [ticket, setTicket] = useState(null)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    const params = {}
    if (fromDate) params.from = fromDate
    if (toDate) params.to = toDate
    try {
      const [data, cash, business, shopData] = await Promise.all([
        fetchSales(params),
        fetchCashCurrent().catch(() => ({ open: false })),
        fetchBusinessReport(params),
        fetchShop().catch(() => null),
      ])
      setSales(data)
      setOpenSessionId(cash.open ? cash.session?.id : null)
      setReport(business)
      setShop(shopData)
    } catch (e) {
      setError(e.message || 'Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    load()
  }, [load])

  const kpis = useMemo(() => {
    const active = sales.filter((sale) => sale.status !== 'anulada')
    const total = active.reduce((acc, sale) => acc + netOf(sale), 0)
    const count = active.length
    const avg = count ? total / count : 0
    return { total, count, avg }
  }, [sales])

  const exportCsv = () => {
    const rows = [
      ['Reporte', fromDate || 'inicio', toDate || 'hoy'],
      ['Ventas netas', kpis.total.toFixed(2)],
      ['Cantidad', kpis.count],
      ['Ticket medio', kpis.avg.toFixed(2)],
    ]
    if (isAdmin && report?.profit) {
      rows.push(['Ganancia', Number(report.profit.profit || 0).toFixed(2)])
      rows.push(['Costo de lo vendido', Number(report.profit.cost || 0).toFixed(2)])
    }
    rows.push([])
    rows.push(['Venta', 'Fecha', 'Vendedor', 'Cliente', 'Pago', 'Estado', 'Total', 'Descuento', 'Neto'])
    for (const sale of sales) {
      rows.push([
        sale.id,
        sale.date,
        sale.userName,
        sale.clientName,
        formatPaymentMethodLabel(sale.paymentMethod),
        saleStateLabel(sale),
        Number(sale.total || 0).toFixed(2),
        Number(sale.discountTotal || 0).toFixed(2),
        netOf(sale).toFixed(2),
      ])
    }
    const body = rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
    const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-${fromDate || 'inicio'}-${toDate || 'hoy'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCancel = async (sale) => {
    const ok = window.confirm(
      `¿Anular la venta #${sale.id}?\n\nVuelve el stock pendiente. Si fue a cuenta corriente, baja la deuda. Si se cobró, sale de esta caja con el mismo método.`,
    )
    if (!ok) return
    setBusyId(sale.id)
    setError('')
    try {
      await cancelSale(sale.id)
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo anular la venta')
    } finally {
      setBusyId(null)
    }
  }

  const handleReturn = async (sale) => {
    const items = (sale.items || [])
      .map((item) => ({
        productId: item.productId,
        quantity: parseInt(returnQty[`${sale.id}:${item.productId}`] || '0', 10) || 0,
      }))
      .filter((item) => item.quantity > 0)
    if (items.length === 0) {
      setError('Indicá cuántas unidades devolver.')
      return
    }
    setBusyId(sale.id)
    setError('')
    try {
      await returnSale(sale.id, {
        items,
        notes: returnNotes.trim() || undefined,
      })
      setReturnQty({})
      setReturnNotes('')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar la devolución')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Reportes
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Ventas del período, ganancia, stock, deudas y compras. El detalle sigue
            en el historial. Para registrar nuevas ventas ve a{' '}
            <NavLink
              to="/ventas"
              className="font-medium text-indigo-700 hover:text-indigo-600 underline-offset-2 hover:underline"
            >
              Ventas
            </NavLink>
            .
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar datos'}
          </button>
        </div>
      </header>

      <form
        className="no-print flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          load()
        }}
      >
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="report-from">Desde</label>
          <input
            id="report-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="report-to">Hasta</label>
          <input
            id="report-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700">
          Ver período
        </button>
        <button type="button" onClick={() => { setFromDate(todayISO()); setToDate(todayISO()) }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Hoy
        </button>
        <button type="button" onClick={() => { setFromDate(monthStartISO()); setToDate(todayISO()) }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Este mes
        </button>
        <button type="button" onClick={() => { setFromDate(yearStartISO()); setToDate(todayISO()) }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Este año
        </button>
        <button type="button" onClick={() => { setFromDate(''); setToDate('') }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Todo
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total facturado
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {money(kpis.total)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ventas registradas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {kpis.count}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ticket medio
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {kpis.count ? money(kpis.avg) : '$0.00'}
          </p>
        </div>
      </div>

      {error && (
        <div
          className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
          role="alert"
        >
          {error}
        </div>
      )}

      {report?.profit && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ganancia</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{money(report.profit.profit)}</p>
            <p className="text-xs text-slate-500 mt-1">Precio menos costo de lo vendido</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Costo de lo vendido</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{money(report.profit.cost)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock valorizado</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{money(report.stock.costValue)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {report.stock.units} unidades · a precio de venta {money(report.stock.saleValue)}
            </p>
          </article>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Más vendidos</h2>
              <p className="text-xs text-slate-500">Unidades netas del período, sin anulaciones ni lo devuelto.</p>
            </div>
            {report.topProducts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">Sin ventas en el período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 font-medium text-right">Cant.</th>
                    <th className="px-4 py-2 font-medium text-right">Venta</th>
                    {isAdmin && <th className="px-4 py-2 font-medium text-right">Ganancia</th>}
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-800">
                        {item.name}
                        {item.sku ? <span className="ml-2 text-xs text-slate-400">{item.sku}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(item.revenue)}</td>
                      {isAdmin && (
                        <td className="px-4 py-2 text-right tabular-nums">{money(item.profit)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Cuentas por cobrar</h2>
              <p className="text-xs text-slate-500">
                Saldo actual: {money(report.receivables.total)} en {report.receivables.count} clientes.
              </p>
            </div>
            {report.receivables.items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">No hay saldos pendientes.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-72 overflow-auto">
                {report.receivables.items.map((item) => (
                  <li key={item.id} className="px-4 py-2.5 flex justify-between text-sm">
                    <span>{item.fullName}</span>
                    <span className="tabular-nums font-medium">{money(item.balanceDue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Stock actual</h2>
              <p className="text-xs text-slate-500">
                {report.stock.units} unidades en existencia
                {isAdmin ? `, valorizadas a costo en ${money(report.stock.costValue)}` : ''}.
              </p>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 font-medium text-right">Stock</th>
                    <th className="px-4 py-2 font-medium text-right">Mínimo</th>
                    {isAdmin && <th className="px-4 py-2 font-medium text-right">A costo</th>}
                    {isAdmin && <th className="px-4 py-2 font-medium text-right">A venta</th>}
                  </tr>
                </thead>
                <tbody>
                  {report.stock.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-800">
                        {item.name}
                        {item.sku ? <span className="ml-2 text-xs text-slate-400">{item.sku}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{item.stock}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{item.minStock}</td>
                      {isAdmin && <td className="px-4 py-2 text-right tabular-nums">{money(item.costValue)}</td>}
                      {isAdmin && <td className="px-4 py-2 text-right tabular-nums">{money(item.saleValue)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {isAdmin && report.purchases && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Compras por proveedor</h2>
                <p className="text-xs text-slate-500">
                  {report.purchases.count} compras registradas por {money(report.purchases.total)}. Las anuladas no entran.
                </p>
              </div>
              {report.purchases.suppliers.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-500 text-center">Sin compras en el período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-2 font-medium">Proveedor</th>
                      <th className="px-4 py-2 font-medium text-right">Compras</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.purchases.suppliers.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{item.purchases}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      )}

      {report?.sales && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.sales.byMethod)
            .filter(([, amount]) => amount > 0)
            .map(([method, amount]) => (
              <span key={method} className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-700">
                {PAYMENT_METHOD_LABELS[method] || method}: {money(amount)}
              </span>
            ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden min-h-[280px]">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pulsa una fila para ver productos y subtotales.
            </p>
          </div>
        </div>

        {loading && sales.length === 0 ? (
          <p className="text-sm text-slate-500 px-5 py-12 text-center">
            Cargando ventas…
          </p>
        ) : !loading && sales.length === 0 ? (
          <p className="text-sm text-slate-500 px-5 py-12 text-center">
            No hay ventas en el período elegido.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/90 border-b border-slate-100">
                  <th className="px-4 py-3 font-medium">Venta</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Pago</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="w-10 px-2" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => {
                  const open = expandedSaleId === sale.id
                  return (
                    <Fragment key={sale.id}>
                      <tr
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedSaleId(open ? null : sale.id)
                        }
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            setExpandedSaleId(open ? null : sale.id)
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-slate-700">
                          <span>#{sale.id}</span>
                          <button
                            type="button"
                            className="no-print ml-2 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900"
                            onClick={(event) => {
                              event.stopPropagation()
                              setTicket(sale)
                            }}
                          >
                            Ticket
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {sale.date}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {sale.userName ?? `Usuario #${sale.userId}`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {sale.clientName || 'Sin cliente'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm hidden sm:table-cell whitespace-nowrap">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                            {formatPaymentMethodLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-xs">
                          {saleStateLabel(sale)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                          {money(sale.total)}
                        </td>
                        <td className="px-2 py-3 text-slate-400 text-center text-xs">
                          {open ? '▾' : '▸'}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-xs text-slate-600">
                              <span>
                                <span className="text-slate-500">Cliente: </span>
                                <span className="font-semibold text-slate-800">
                                  {sale.clientName || 'Sin cliente'}
                                </span>
                              </span>
                              <span>
                                <span className="text-slate-500">Forma de pago: </span>
                                <span className="font-semibold text-slate-800">
                                  {formatPaymentMethodLabel(sale.paymentMethod)}
                                </span>
                              </span>
                            </div>
                            {(sale.items || []).length === 0 ? (
                              <p className="text-xs text-slate-500">
                                Sin líneas detalladas (venta anterior al registro por
                                producto).
                              </p>
                            ) : (
                              <div className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                                <table className="w-full text-xs sm:text-sm">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                      <th className="text-left px-3 py-2 font-medium">
                                        Producto
                                      </th>
                                      <th className="text-right px-3 py-2 font-medium">
                                        Cant.
                                      </th>
                                      <th className="text-right px-3 py-2 font-medium">
                                        Devuelto
                                      </th>
                                      <th className="text-right px-3 py-2 font-medium">
                                        P. unit.
                                      </th>
                                      <th className="text-right px-3 py-2 font-medium">
                                        Subtotal
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sale.items.map((it, idx) => (
                                      <tr
                                        key={`${sale.id}-${it.productId}-${idx}`}
                                        className="border-b border-slate-50 last:border-0"
                                      >
                                        <td className="px-3 py-2 text-slate-800">
                                          {it.productName}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {it.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {it.returnedQuantity || 0}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {money(it.unitPrice)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                                          {money(it.subtotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {(() => {
                              const sameSession =
                                sale.status !== 'anulada' &&
                                openSessionId != null &&
                                Number(sale.cashSessionId) === Number(openSessionId)
                              const pending = (sale.items || []).filter((item) => remainingOf(item) > 0)
                              if (sale.status === 'anulada') {
                                return (
                                  <p className="mt-3 text-xs text-slate-500">Esta venta está anulada.</p>
                                )
                              }
                              if (!sameSession) {
                                return (
                                  <p className="mt-3 text-xs text-slate-500">
                                    Solo se anula o devuelve mientras siga abierta la misma caja en la que se vendió.
                                  </p>
                                )
                              }
                              if (pending.length === 0) {
                                return (
                                  <p className="mt-3 text-xs text-slate-500">No queda mercadería pendiente.</p>
                                )
                              }
                              return (
                                <div className="mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Devolución parcial
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {pending.map((item) => (
                                      <label key={item.productId} className="text-xs text-slate-600">
                                        {item.productName} (máx. {remainingOf(item)})
                                        <input
                                          type="number"
                                          min="0"
                                          max={remainingOf(item)}
                                          step="1"
                                          value={returnQty[`${sale.id}:${item.productId}`] || ''}
                                          onChange={(event) =>
                                            setReturnQty((prev) => ({
                                              ...prev,
                                              [`${sale.id}:${item.productId}`]: event.target.value,
                                            }))
                                          }
                                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                  <input
                                    value={expandedSaleId === sale.id ? returnNotes : ''}
                                    onChange={(event) => setReturnNotes(event.target.value)}
                                    maxLength={500}
                                    placeholder="Motivo de la devolución"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={busyId === sale.id}
                                      onClick={() => handleReturn(sale)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      Registrar devolución
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busyId === sale.id}
                                      onClick={() => handleCancel(sale)}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                    >
                                      Anular venta
                                    </button>
                                  </div>
                                </div>
                              )
                            })()}
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
      {ticket && (
        <TicketVenta sale={ticket} shop={shop} onClose={() => setTicket(null)} />
      )}
    </section>
  )
}

export default ReporteVentas
