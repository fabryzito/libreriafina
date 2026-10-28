import { formatPaymentMethodLabel } from '../constants/paymentMethods'

function money(n) {
  const value = Number(n)
  if (Number.isNaN(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

function TicketVenta({ sale, shop, onClose }) {
  if (!sale) return null

  const printTicket = () => {
    document.body.classList.add('printing-ticket')
    window.print()
    window.addEventListener(
      'afterprint',
      () => document.body.classList.remove('printing-ticket'),
      { once: true },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-auto">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div id="sale-ticket" className="px-6 py-5 text-slate-900">
          <header className="text-center border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-lg font-bold">{shop?.name || 'Librería'}</h2>
            {shop?.address ? <p className="text-xs mt-1">{shop.address}</p> : null}
            {shop?.phone ? <p className="text-xs">Tel. {shop.phone}</p> : null}
            {shop?.documentId ? <p className="text-xs">{shop.documentId}</p> : null}
          </header>
          <p className="mt-3 text-sm font-semibold">Venta #{sale.id}</p>
          <p className="text-xs text-slate-600">
            {sale.date} · {sale.userName || 'Vendedor'}
          </p>
          <p className="text-xs text-slate-600">
            {sale.clientName || 'Consumidor final'} · {formatPaymentMethodLabel(sale.paymentMethod)}
          </p>
          <table className="w-full text-xs mt-3">
            <tbody>
              {(sale.items || []).map((item, index) => (
                <tr key={`${item.productId}-${index}`} className="align-top">
                  <td className="py-1 pr-2">
                    {item.productName}
                    <span className="block text-slate-500">
                      {item.quantity} × {money(item.listUnitPrice ?? item.unitPrice)}
                      {Number(item.discountAmount) > 0 ? ` · desc. ${money(item.discountAmount)}` : ''}
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{money(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Number(sale.discountTotal) > 0 && (
            <p className="mt-2 text-xs text-right text-slate-600">
              Descuento {money(sale.discountTotal)}
            </p>
          )}
          <p className="mt-1 pt-2 border-t border-dashed border-slate-300 text-right text-base font-bold tabular-nums">
            Total {money(sale.total)}
          </p>
          <p className="mt-4 text-center text-[11px] text-slate-500">Gracias por su compra</p>
        </div>
        <div className="no-print flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Cerrar
          </button>
          <button
            type="button"
            onClick={printTicket}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium"
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}

export default TicketVenta
