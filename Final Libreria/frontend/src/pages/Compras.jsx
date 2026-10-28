import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { fetchProducts } from '../api/services/products'
import { createPurchase } from '../api/services/purchases'
import { fetchSuppliers } from '../api/services/suppliers'
import { fetchCashCurrent } from '../api/services/cash'
import {
  PAYMENT_METHOD_IDS,
  PAYMENT_METHOD_LABELS,
} from '../constants/paymentMethods.js'

function localDateYYYYMMDD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function Compras() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [purchaseDate, setPurchaseDate] = useState(() => localDateYYYYMMDD())
  const [supplierId, setSupplierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [updateCost, setUpdateCost] = useState(true)
  const [notes, setNotes] = useState('')

  const [productSearch, setProductSearch] = useState('')
  const [pickId, setPickId] = useState('')
  const [pickQty, setPickQty] = useState('1')
  const [pickCost, setPickCost] = useState('')

  const [lines, setLines] = useState([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [cashOpen, setCashOpen] = useState(true)

  const load = useCallback(async () => {
    setListError('')
    setLoading(true)
    try {
      const [productData, supplierData] = await Promise.all([
        fetchProducts({ includeInactive: '1' }),
        fetchSuppliers(),
      ])
      setProducts(productData)
      setSuppliers(supplierData)
    } catch (e) {
      setListError(e.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let active = true
    fetchCashCurrent()
      .then((data) => {
        if (active) setCashOpen(Boolean(data.open))
      })
      .catch(() => {
        if (active) setCashOpen(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4500)
    return () => clearTimeout(t)
  }, [successMsg])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const name = String(p.name).toLowerCase()
      const sku = String(p.sku || '').toLowerCase()
      const idStr = String(p.id)
      return name.includes(q) || (sku && sku.includes(q)) || idStr.includes(q)
    })
  }, [products, productSearch])

  const selectedProduct = products.find((p) => String(p.id) === pickId)

  const total = useMemo(
    () =>
      lines.reduce(
        (acc, line) => acc + Number(line.unitCost) * Number(line.quantity),
        0,
      ),
    [lines],
  )

  const selectProduct = (p) => {
    setFormError('')
    setPickId(String(p.id))
    setPickCost(p.cost != null ? String(p.cost) : '0')
    setProductSearch('')
  }

  const addLine = () => {
    setFormError('')
    setSuccessMsg('')
    const product = products.find((p) => String(p.id) === pickId)
    const qty = parseInt(pickQty, 10)
    const cost = Number(String(pickCost).replace(',', '.'))
    if (!product) {
      setFormError('Selecciona un producto.')
      return
    }
    if (Number.isNaN(qty) || qty < 1) {
      setFormError('La cantidad debe ser un entero mayor a 0.')
      return
    }
    if (Number.isNaN(cost) || cost < 0) {
      setFormError('El costo debe ser un número mayor o igual a 0.')
      return
    }

    const existing = lines.find((l) => l.productId === product.id)
    if (existing && Math.abs(existing.unitCost - cost) > 0.001) {
      setFormError(
        `«${product.name}» ya está en la compra con otro costo. Quitá la línea o usá el mismo costo.`,
      )
      return
    }
    setLines((prev) => {
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + qty } : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: qty,
          unitCost: cost,
        },
      ]
    })
    setPickQty('1')
  }

  const removeLine = (productId) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccessMsg('')
    if (!supplierId) {
      setFormError('Selecciona un proveedor.')
      return
    }
    if (lines.length === 0) {
      setFormError('Agrega al menos un producto.')
      return
    }
    if (paymentMethod !== 'cuenta_corriente' && !cashOpen) {
      setFormError('La caja está cerrada. Una compra en efectivo, transferencia o tarjeta necesita caja abierta.')
      return
    }
    setSaving(true)
    try {
      const created = await createPurchase({
        supplierId: Number(supplierId),
        purchaseDate,
        paymentMethod,
        updateCost,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      })
      setLines([])
      setNotes('')
      setPickId('')
      setSuccessMsg(`Compra #${created.id} registrada por ${money(created.total)}.`)
      await load()
    } catch (err) {
      setFormError(err.message || 'No se pudo registrar la compra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-2">
            Inventario
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nueva compra
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Al guardar, entra el stock. Si dejás marcada la opción, el costo del
            producto pasa a ser el de esta compra.
          </p>
        </div>
        <NavLink
          to="/compras/historial"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ver historial
        </NavLink>
      </header>

      {listError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
          {listError}
        </p>
      )}
      {successMsg && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
          {successMsg}
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="purchase-date">
                Fecha
              </label>
              <input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="purchase-supplier">
                Proveedor
              </label>
              <select
                id="purchase-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                required
              >
                <option value="">Seleccionar…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Si no está en la lista, dalo de alta en{' '}
                <NavLink to="/configuracion/proveedores" className="text-indigo-700 hover:underline">
                  Configuración → Proveedores
                </NavLink>
                .
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Forma de pago</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_IDS.map((id) => (
                <label
                  key={id}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                    paymentMethod === id
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={id}
                    checked={paymentMethod === id}
                    onChange={() => setPaymentMethod(id)}
                  />
                  {PAYMENT_METHOD_LABELS[id]}
                </label>
              ))}
            </div>
            {paymentMethod === 'cuenta_corriente' && (
              <p className="mt-2 text-xs text-amber-800">
                La compra suma la deuda pendiente de este proveedor.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={updateCost}
              onChange={(e) => setUpdateCost(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600"
            />
            <span>
              Actualizar el costo de cada producto con el costo de esta compra.
            </span>
          </label>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="purchase-search">
              Producto
            </label>
            <input
              id="purchase-search"
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar por nombre, código o ID…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="text-xs text-slate-500 px-3 py-4 text-center">Cargando…</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-xs text-slate-500 px-3 py-4 text-center">
                  Ningún producto coincide.
                </p>
              ) : (
                filteredProducts.slice(0, 30).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className={`flex w-full text-left gap-3 px-3 py-2 text-sm border-b border-slate-100 last:border-0 ${
                      pickId === String(p.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-400 w-16 shrink-0 pt-0.5 truncate">
                      {p.sku || `#${p.id}`}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-slate-900">
                      {p.name}
                      {!p.isActive && (
                        <span className="ml-2 text-[10px] uppercase text-slate-400">
                          Inactivo
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      costo {money(p.cost)} · stock {p.stock}
                    </span>
                  </button>
                ))
              )}
            </div>
            {selectedProduct && (
              <p className="mt-2 text-xs text-slate-600">
                Seleccionado: <span className="font-medium">{selectedProduct.name}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="purchase-qty">
                Cantidad
              </label>
              <input
                id="purchase-qty"
                type="number"
                min="1"
                step="1"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="purchase-cost">
                Costo unitario
              </label>
              <input
                id="purchase-cost"
                type="number"
                min="0"
                step="0.01"
                value={pickCost}
                onChange={(e) => setPickCost(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              Agregar
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-900">Detalle</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500 mt-4">Todavía no hay productos.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {lines.map((line) => (
                <li key={line.productId} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{line.name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {line.quantity} × {money(line.unitCost)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {money(line.quantity * line.unitCost)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-4 space-y-3">
            <label className="block text-xs text-slate-500" htmlFor="purchase-notes">
              Notas (opcional)
            </label>
            <input
              id="purchase-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nº de factura, observación…"
            />
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-xl font-bold tabular-nums text-slate-900">
                {money(total)}
              </span>
            </div>
            {paymentMethod !== 'cuenta_corriente' && !cashOpen && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                La caja está cerrada. Abrila en{' '}
                <NavLink to="/caja" className="font-semibold underline underline-offset-2">
                  Caja
                </NavLink>{' '}
                o registrá la compra a cuenta corriente.
              </p>
            )}
            <button
              type="submit"
              disabled={
                saving ||
                lines.length === 0 ||
                (paymentMethod !== 'cuenta_corriente' && !cashOpen)
              }
              className="w-full rounded-lg bg-indigo-600 text-white text-sm font-medium py-2.5 hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Registrar compra'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default Compras
