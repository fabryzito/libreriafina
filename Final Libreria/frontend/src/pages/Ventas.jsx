import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import { fetchProducts } from '../api/services/products'
import { createSale } from '../api/services/sales'
import { fetchCashCurrent } from '../api/services/cash'
import { fetchShop } from '../api/services/shop'
import TicketVenta from '../components/TicketVenta'
import { quoteCart } from '../utils/pricing'
import { fetchClients } from '../api/services/clients'
import ClientePickerModal from '../components/modales/ClientePickerModal'
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

function Ventas() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [listError, setListError] = useState('')
  const [clients, setClients] = useState([])

  const [saleDate, setSaleDate] = useState(() => localDateYYYYMMDD())
  const [pickId, setPickId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [barcode, setBarcode] = useState('')
  const [pickQty, setPickQty] = useState('1')

  /** @type {[Array<{ productId: number, name: string, price: number, quantity: number, maxStock: number }>, Function]} */
  const [cart, setCart] = useState([])
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(
    /** @type {'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'} */ (
      'efectivo'
    ),
  )
  /** Cliente opcional para ventas al contado / tarjeta / transferencia */
  const [optionalClientId, setOptionalClientId] = useState('')
  /** Cliente obligatorio si paymentMethod === cuenta_corriente */
  const [creditClient, setCreditClient] = useState(
    /** @type {{ id: number, fullName: string } | null} */ (null),
  )
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(true)
  const [shop, setShop] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [saleDiscountType, setSaleDiscountType] = useState('none')
  const [saleDiscountValue, setSaleDiscountValue] = useState('')

  const loadProducts = useCallback(async () => {
    setListError('')
    setLoadingProducts(true)
    try {
      const data = await fetchProducts()
      setProducts(data)
      setPickId((prev) => {
        if (!prev) return ''
        const p = data.find(
          (x) => String(x.id) === prev && Number(x.stock) > 0,
        )
        return p ? prev : ''
      })
    } catch (e) {
      setListError(e.message || 'Error al cargar productos')
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const reloadClients = useCallback(async () => {
    try {
      setClients(await fetchClients())
    } catch {
      // no bloquea la venta
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    reloadClients()
  }, [reloadClients])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4200)
    return () => clearTimeout(t)
  }, [successMsg])

  const productsInStock = useMemo(
    () => products.filter((p) => Number(p.stock) > 0),
    [products],
  )

  const filteredForPicker = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return productsInStock
    return productsInStock.filter((p) => {
      const name = String(p.name).toLowerCase()
      const sku = String(p.sku || '').toLowerCase()
      const idStr = String(p.id)
      return (
        name.includes(q) ||
        (sku && sku.includes(q)) ||
        String(p.barcode || '').toLowerCase().includes(q) ||
        idStr === q ||
        idStr.includes(q)
      )
    })
  }, [productsInStock, productSearch])

  const quote = useMemo(
    () => quoteCart(cart, saleDiscountType, saleDiscountValue),
    [cart, saleDiscountType, saleDiscountValue],
  )
  const lineQuote = (productId) => quote.items.find((line) => line.productId === productId)

  const selectedProduct = products.find((x) => String(x.id) === pickId)

  const selectProductRow = (p) => {
    setCheckoutError('')
    setPickId(String(p.id))
    setProductSearch('')
  }

  const clearProductSelection = () => {
    setPickId('')
  }

  const addToCart = () => {
    setCheckoutError('')
    setSuccessMsg('')
    const pid = Number(pickId)
    const qty = parseInt(pickQty, 10)
    const p = products.find((x) => Number(x.id) === pid)
    if (!p) {
      setCheckoutError('Selecciona un producto válido.')
      return
    }
    if (Number.isNaN(qty) || qty < 1) {
      setCheckoutError('Indica una cantidad válida (mínimo 1).')
      return
    }

    const stock = Number(p.stock)
    
    if (qty > stock) {
      setCheckoutError(`Stock insuficiente. Disponible: ${stock}.`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === pid)
      if (existing) {
        const nextQty = existing.quantity + qty
        if (nextQty > stock) {
          setCheckoutError(
            `Stock insuficiente. Máximo para este producto: ${stock}.`,
          )
          return prev
        }
        return prev.map((l) =>
          l.productId === pid ? { ...l, quantity: nextQty } : l,
        )
      }
      return [
        ...prev,
        {
          productId: pid,
          name: p.name,
          price: Number(p.price),
          sku: p.sku || '',
          barcode: p.barcode || '',
          quantity: qty,
          maxStock: stock,
          discountType: 'none',
          discountValue: '',
        },
      ]
    })
    setPickQty('1')
  }

  const updateLineQty = (productId, next) => {
    setCheckoutError('')
    const q = parseInt(String(next), 10)
    if (Number.isNaN(q) || q < 1) return
    setCart((prev) => {
      const line = prev.find((l) => l.productId === productId)
      if (!line) return prev
      const currentStock =
        products.find((x) => Number(x.id) === productId)?.stock ?? line.maxStock
      const max = Math.min(line.maxStock, Number(currentStock))
      if (q > max) {
        setCheckoutError(`Cantidad máxima para «${line.name}»: ${max}.`)
        return prev
      }
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity: q } : l,
      )
    })
  }

  const removeLine = (productId) => {
    setCheckoutError('')
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const clearCart = () => {
    setCheckoutError('')
    setCart([])
    setSaleDiscountType('none')
    setSaleDiscountValue('')
  }

  const updateLineDiscount = (productId, patch) => {
    setCart((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)),
    )
  }

  const addByCode = (code) => {
    const normalized = code.trim().toLowerCase()
    if (!normalized) return
    const product = productsInStock.find((item) => {
      const sku = String(item.sku || '').toLowerCase()
      const bar = String(item.barcode || '').toLowerCase()
      return bar === normalized || sku === normalized
    })
    if (!product) {
      setCheckoutError('No hay un producto activo con ese código.')
      return
    }
    setPickId(String(product.id))
    setPickQty((current) => current || '1')
    setBarcode('')
    setProductSearch('')
    const qty = parseInt(pickQty, 10)
    const amount = Number.isNaN(qty) || qty < 1 ? 1 : qty
    const stock = Number(product.stock)
    if (amount > stock) {
      setCheckoutError(`Stock insuficiente. Disponible: ${stock}.`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id)
      if (existing) {
        const nextQty = existing.quantity + amount
        if (nextQty > stock) {
          setCheckoutError(`Stock insuficiente. Máximo para este producto: ${stock}.`)
          return prev
        }
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: nextQty } : line,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          sku: product.sku || '',
          barcode: product.barcode || '',
          quantity: amount,
          maxStock: stock,
          discountType: 'none',
          discountValue: '',
        },
      ]
    })
    setPickQty('1')
  }

  const handlePaymentMethodChange = (id) => {
    setCheckoutError('')
    setPaymentMethod(id)
    if (id === 'cuenta_corriente') {
      setOptionalClientId('')
      setClientPickerOpen(true)
    } else {
      setCreditClient(null)
    }
  }

  useEffect(() => {
    let active = true
    fetchCashCurrent()
      .then((data) => {
        if (active) setCashOpen(Boolean(data.open))
      })
      .catch(() => {
        if (active) setCashOpen(false)
      })
    fetchShop()
      .then((data) => {
        if (active) setShop(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleCheckout = async (e) => {
    e.preventDefault()
    setCheckoutError('')
    setSuccessMsg('')
    if (!cashOpen) {
      setCheckoutError('La caja está cerrada. Abrila antes de vender.')
      return
    }
    if (cart.length === 0) {
      setCheckoutError('Agrega al menos un producto al carrito.')
      return
    }
    if (paymentMethod === 'cuenta_corriente') {
      if (!creditClient) {
        setCheckoutError('Selecciona un cliente para vender en cuenta corriente.')
        setClientPickerOpen(true)
        return
      }
    }
    setCheckoutLoading(true)
    try {
      const resolvedClientId =
        paymentMethod === 'cuenta_corriente'
          ? creditClient.id
          : optionalClientId
            ? Number(optionalClientId)
            : null
      const created = await createSale({
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount:
            line.discountType && line.discountType !== 'none'
              ? { type: line.discountType, value: Number(line.discountValue) || 0 }
              : undefined,
        })),
        discount:
          saleDiscountType !== 'none'
            ? { type: saleDiscountType, value: Number(saleDiscountValue) || 0 }
            : undefined,
        saleDate,
        paymentMethod,
        clientId: resolvedClientId,
      })
      setTicket(created)
      clearCart()
      setCreditClient(null)
      setSuccessMsg('Venta registrada correctamente.')
      await loadProducts()
      await reloadClients()
    } catch (err) {
      setCheckoutError(err.message || 'No se pudo registrar la venta')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const noStockMsg =
    products.length > 0 && productsInStock.length === 0

  return (
    <section className="w-full pb-8">
      <header className="mb-8 text-center sm:text-left">
        <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-3">
          Punto de venta
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Nueva venta
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto sm:mx-0">
          Operador:{' '}
          <span className="font-semibold text-slate-800">{user?.name}</span>. Historial y
          métricas en{' '}
          <NavLink
            to="/reportes/ventas"
            className="text-indigo-700 hover:text-indigo-600 font-medium underline-offset-2 hover:underline"
          >
            Reporte de ventas
          </NavLink>
          .
        </p>
      </header>

      {successMsg && (
        <div
          className="mb-6 text-sm font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-start gap-3"
          role="status"
        >
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs"
            aria-hidden
          >
            ✓
          </span>
          <span>{successMsg}</span>
        </div>
      )}

      {!cashOpen && (
        <div className="mb-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3" role="status">
          La caja está cerrada. No se puede registrar una venta hasta abrirla en{' '}
          <NavLink to="/caja" className="font-semibold underline underline-offset-2">
            Caja
          </NavLink>
          .
        </div>
      )}

      {listError && (
        <div
          className="mb-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
          role="alert"
        >
          {listError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Agregar líneas
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Elige producto en stock, cantidad y añádelo al pedido actual.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="saleDate"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Fecha de la venta
                </label>
                <input
                  id="saleDate"
                  type="date"
                  value={saleDate}
                  onChange={(ev) => setSaleDate(ev.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500 focus:bg-white transition"
                  required
                />
              </div>
              {paymentMethod !== 'cuenta_corriente' && (
                <div>
                  <label
                    htmlFor="optionalClientId"
                    className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                  >
                    Cliente (opcional)
                  </label>
                  <select
                    id="optionalClientId"
                    value={optionalClientId}
                    onChange={(e) => setOptionalClientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500"
                  >
                    <option value="">Sin cliente / Cliente general</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="barcode"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Código de barras
                </label>
                <input
                  id="barcode"
                  type="text"
                  autoComplete="off"
                  placeholder="Escaneá o escribí el código y Enter"
                  value={barcode}
                  onChange={(ev) => setBarcode(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key !== 'Enter') return
                    ev.preventDefault()
                    addByCode(barcode)
                  }}
                  disabled={loadingProducts || productsInStock.length === 0}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500 focus:bg-white transition disabled:opacity-60"
                />
              </div>

              <div className="relative">
                <label
                  htmlFor="productSearch"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Buscar producto
                </label>
                <div className="relative">
                  <input
                    id="productSearch"
                    type="search"
                    autoComplete="off"
                    placeholder={
                      loadingProducts
                        ? 'Cargando catálogo…'
                        : 'Nombre o código (ID)…'
                    }
                    value={productSearch}
                    onChange={(ev) => {
                      const v = ev.target.value
                      const q = v.trim().toLowerCase()
                      setProductSearch(v)
                      setPickId((prev) => {
                        if (!prev) return ''
                        const sel = productsInStock.find(
                          (x) => String(x.id) === prev,
                        )
                        if (!sel) return ''
                        if (!q) return prev
                        const nm = String(sel.name).toLowerCase()
                        const idStr = String(sel.id).trim()
                        const qTrim = v.trim()
                        if (
                          nm.includes(q) ||
                          idStr === qTrim ||
                          idStr.includes(qTrim)
                        ) {
                          return prev
                        }
                        return ''
                      })
                    }}
                    disabled={loadingProducts || productsInStock.length === 0}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 text-sm text-slate-900 bg-slate-50/50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500 focus:bg-white transition disabled:opacity-60"
                  />
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                    aria-hidden
                  >
                    ⌕
                  </span>
                </div>

                {selectedProduct && Number(selectedProduct.stock) > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2">
                    <p className="text-xs text-slate-700 flex-1 min-w-0">
                      <span className="text-slate-500">Seleccionado:</span>{' '}
                      <span className="font-semibold text-slate-900 truncate inline-block max-w-[12rem] sm:max-w-none align-bottom">
                        {selectedProduct.name}
                      </span>
                      <span className="text-slate-600">
                        {' '}
                        · {money(selectedProduct.price)} · stock{' '}
                        <span className="font-semibold tabular-nums">
                          {selectedProduct.stock}
                        </span>
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={clearProductSelection}
                      className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 shrink-0"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                <div
                  className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                  role="listbox"
                  aria-label="Resultados de búsqueda"
                >
                  <div className="max-h-48 overflow-y-auto overscroll-contain">
                    {loadingProducts ? (
                      <p className="text-xs text-slate-500 px-3 py-4 text-center">
                        Cargando…
                      </p>
                    ) : productsInStock.length === 0 ? (
                      <p className="text-xs text-slate-500 px-3 py-4 text-center">
                        Sin productos con stock
                      </p>
                    ) : filteredForPicker.length === 0 ? (
                      <p className="text-xs text-slate-500 px-3 py-4 text-center">
                        Ningún producto coincide. Prueba otro término o el ID.
                      </p>
                    ) : (
                      filteredForPicker.map((p) => {
                        const active = pickId === String(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => selectProductRow(p)}
                            className={`flex w-full text-left gap-3 px-3 py-2.5 text-sm border-b border-slate-100 last:border-0 transition ${
                              active
                                ? 'bg-indigo-50 ring-inset ring-1 ring-indigo-100/80'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-mono text-xs text-slate-400 w-16 shrink-0 pt-0.5 truncate">
                              {p.sku || `#${p.id}`}
                            </span>
                            <span className="flex-1 min-w-0 font-medium text-slate-900 truncate">
                              {p.name}
                            </span>
                            <span className="text-slate-600 tabular-nums shrink-0">
                              {money(p.price)}
                            </span>
                            <span className="text-[11px] text-slate-500 tabular-nums shrink-0 w-14 text-right">
                              {p.stock} uds.
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Escribe para filtrar y pulsa una fila para seleccionar.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[6rem]">
                  <label
                    htmlFor="qty"
                    className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                  >
                    Cantidad
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    value={pickQty}
                    onChange={(ev) => setPickQty(ev.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-end flex-1 min-w-[8rem]">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={
                      loadingProducts ||
                      productsInStock.length === 0 ||
                      !pickId
                    }
                    className="w-full rounded-xl bg-slate-900 text-white text-sm font-semibold py-2.5 px-4 hover:bg-slate-800 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-900/15"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              {noStockMsg && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  No hay productos con stock disponible.
                  {isAdmin ? (
                    <>
                      {' '}
                      Puedes cargar más en{' '}
                      <NavLink className="font-medium underline" to="/productos">
                        Productos
                      </NavLink>
                      .
                    </>
                  ) : (
                    ' Pídele a un administrador que reponga inventario.'
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <form
            onSubmit={handleCheckout}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-5 border-b border-indigo-100/80">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Resumen del pedido
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajusta cantidades o elimina líneas antes de cobrar.
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-medium text-slate-500 hover:text-red-600 shrink-0"
                >
                  Vaciar todo
                </button>
              )}
            </div>

            {checkoutError && (
              <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {checkoutError}
              </p>
            )}

            <div className="rounded-2xl border border-white/80 bg-white/90 backdrop-blur-sm overflow-hidden min-h-[140px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <span className="text-4xl mb-3 opacity-40" aria-hidden>
                    🛒
                  </span>
                  <p className="text-sm font-medium text-slate-700">
                    El carrito está vacío
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Añade artículos desde el panel izquierdo para registrar la venta.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((line) => (
                    <li
                      key={line.productId}
                      className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {line.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {money(line.price)} c/u · hasta {line.maxStock} uds.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select
                            value={line.discountType}
                            onChange={(ev) =>
                              updateLineDiscount(line.productId, {
                                discountType: ev.target.value,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            aria-label="Tipo de descuento de la línea"
                          >
                            <option value="none">Sin descuento</option>
                            <option value="percent">% línea</option>
                            <option value="amount">$ línea</option>
                          </select>
                          {line.discountType !== 'none' && (
                            <input
                              type="number"
                              min={0}
                              max={line.discountType === 'percent' ? 100 : undefined}
                              step="0.01"
                              value={line.discountValue}
                              onChange={(ev) =>
                                updateLineDiscount(line.productId, {
                                  discountValue: ev.target.value,
                                })
                              }
                              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs tabular-nums"
                              aria-label="Valor del descuento"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <input
                          type="number"
                          min={1}
                          max={line.maxStock}
                          value={line.quantity}
                          onChange={(ev) =>
                            updateLineQty(line.productId, ev.target.value)
                          }
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center tabular-nums"
                          aria-label="Cantidad"
                        />
                        <span className="text-sm font-bold text-slate-900 w-[5.5rem] text-right tabular-nums">
                          {money(lineQuote(line.productId)?.subtotal ?? line.price * line.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.productId)}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-700 uppercase tracking-wide"
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <fieldset className="mt-6 rounded-2xl border border-indigo-100/90 bg-white/60 px-4 py-4">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Forma de pago
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
                {PAYMENT_METHOD_IDS.map((id) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition sm:flex-1 sm:min-w-[7rem] ${
                      paymentMethod === id
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={id}
                      checked={paymentMethod === id}
                      onChange={() => handlePaymentMethodChange(id)}
                      className="sr-only"
                    />
                    {PAYMENT_METHOD_LABELS[id]}
                  </label>
                ))}
              </div>
              {paymentMethod === 'cuenta_corriente' && (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800 mb-2">
                    Cliente en cuenta corriente
                  </p>
                  {creditClient ? (
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold">{creditClient.fullName}</span>
                        <span className="text-slate-500 ml-2 font-mono text-xs">
                          #{creditClient.id}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setClientPickerOpen(true)}
                        className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Cambiar cliente
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClientPickerOpen(true)}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-50"
                    >
                      Seleccionar cliente
                    </button>
                  )}
                </div>
              )}
            </fieldset>

            {cart.length > 0 && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="sale-discount-type">
                    Descuento de la venta
                  </label>
                  <select
                    id="sale-discount-type"
                    value={saleDiscountType}
                    onChange={(ev) => setSaleDiscountType(ev.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="none">Sin descuento</option>
                    <option value="percent">Porcentaje</option>
                    <option value="amount">Importe</option>
                  </select>
                </div>
                {saleDiscountType !== 'none' && (
                  <input
                    type="number"
                    min={0}
                    max={saleDiscountType === 'percent' ? 100 : undefined}
                    step="0.01"
                    value={saleDiscountValue}
                    onChange={(ev) => setSaleDiscountValue(ev.target.value)}
                    className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    aria-label="Valor del descuento de la venta"
                  />
                )}
                {quote.discountTotal > 0 && (
                  <p className="text-xs text-slate-500 pb-2">Descuento {money(quote.discountTotal)}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-indigo-100/90">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total a cobrar
                </p>
                <p className="text-3xl font-bold text-indigo-700 tabular-nums mt-0.5">
                  {money(quote.total)}
                </p>
              </div>
              <button
                type="submit"
                disabled={
                  checkoutLoading ||
                  !cashOpen ||
                  cart.length === 0 ||
                  productsInStock.length === 0
                }
                className="rounded-2xl bg-indigo-600 text-white text-sm font-bold px-8 py-3.5 shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-[0.98] transition disabled:opacity-45 disabled:cursor-not-allowed min-w-[10rem]"
              >
                {checkoutLoading ? 'Registrando…' : 'Confirmar venta'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ClientePickerModal
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        clients={clients}
        onSelect={(c) => setCreditClient(c)}
      />
      {ticket && (
        <TicketVenta sale={ticket} shop={shop} onClose={() => setTicket(null)} />
      )}
    </section>
  )
}

export default Ventas
