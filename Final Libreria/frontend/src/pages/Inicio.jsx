import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import { fetchHomeReport } from '../api/services/reports'
import { fetchProducts } from '../api/services/products'
import { PAYMENT_METHOD_LABELS } from '../constants/paymentMethods'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function stockLabel(stock, minStock) {
  const amount = Number(stock)
  const minimum = Number(minStock)
  if (amount <= 0) return { text: 'Sin stock', className: 'text-rose-700 bg-rose-50 border-rose-100' }
  if (Number.isFinite(minimum) && amount <= minimum) {
    return { text: `${amount} en stock · bajo`, className: 'text-amber-800 bg-amber-50 border-amber-100' }
  }
  return { text: `${amount} en stock`, className: 'text-emerald-800 bg-emerald-50 border-emerald-100' }
}

function Inicio() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const [data, setData] = useState(null)
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setSearchError('')
    setLoading(true)
    const [reportResult, catalogResult] = await Promise.allSettled([
      fetchHomeReport(),
      fetchProducts(),
    ])
    if (reportResult.status === 'fulfilled') {
      setData(reportResult.value)
    } else {
      setError(reportResult.reason?.message || 'No se pudo cargar el inicio')
    }
    if (catalogResult.status === 'fulfilled') {
      setProducts(catalogResult.value)
    } else {
      setProducts([])
      setSearchError(catalogResult.reason?.message || 'No se pudieron cargar los productos')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sales = data?.sales
  const methods = sales
    ? Object.entries(sales.byMethod).filter(([, amount]) => amount > 0)
    : []

  const search = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!search) return []
    return products.filter((product) => {
      const name = String(product.name || '').toLowerCase()
      const sku = String(product.sku || '').toLowerCase()
      const barcode = String(product.barcode || '').toLowerCase()
      return name.includes(search) || sku.includes(search) || barcode.includes(search)
    })
  }, [products, search])
  const visibleMatches = matches.slice(0, 8)

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Hola, {user?.name || 'bienvenido'}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hoy</h1>
          <p className="text-sm text-slate-600 mt-1">
            Ventas del día, stock que hay que reponer y deudas pendientes.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {data && !data.cashOpen && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          La caja está cerrada. Abrila en{' '}
          <NavLink to="/caja" className="font-semibold underline underline-offset-2">
            Caja
          </NavLink>{' '}
          para vender y cobrar.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-4 sm:px-5">
          <label htmlFor="product-quick-search" className="block text-sm font-semibold text-slate-900">
            Buscar producto
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Escribí el nombre, el código o el código de barras para ver el precio y el stock.
          </p>
          <input
            id="product-quick-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. cuaderno, BOL-AZ o código de barras"
            autoComplete="off"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-800/20"
          />
        </div>
        {searchError && (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-red-700 sm:px-5" role="alert">
            {searchError}
          </p>
        )}
        {search && !searchError && visibleMatches.length === 0 && (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500 sm:px-5">
            {loading && products.length === 0
              ? 'Cargando productos…'
              : 'Ningún producto coincide con esa búsqueda.'}
          </p>
        )}
        {visibleMatches.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {visibleMatches.map((product) => {
              const stock = stockLabel(product.stock, product.minStock)
              const codes = [product.sku, product.barcode].filter(Boolean).join(' · ')
              return (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {codes || 'Sin código'}
                      {product.categoryName ? ` · ${product.categoryName}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums text-slate-900">{money(product.price)}</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stock.className}`}>
                      {stock.text}
                    </span>
                  </div>
                </li>
              )
            })}
            {matches.length > visibleMatches.length && (
              <li className="px-4 py-2.5 text-center text-xs text-slate-500 sm:px-5">
                Hay {matches.length - visibleMatches.length} coincidencias más. Afiná la búsqueda.
              </li>
            )}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-slate-200 border-t-[3px] border-t-indigo-800 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventas del día</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {money(sales?.netTotal || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {sales?.count || 0} operaciones
            {sales?.cancelled ? ` · ${sales.cancelled} anuladas` : ''}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock bajo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {data?.lowStock.count || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">{data?.outOfStock.count || 0} sin stock</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por cobrar</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {money(data?.receivables.total || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">{data?.receivables.count || 0} clientes</p>
        </article>
        {isAdmin ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por pagar</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {money(data?.payables?.total || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data?.payables?.count || 0} proveedores</p>
          </article>
        ) : (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caja</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {data?.cashOpen ? 'Abierta' : 'Cerrada'}
            </p>
            <NavLink to="/caja" className="text-xs font-medium text-indigo-700 hover:underline">
              Ir a caja
            </NavLink>
          </article>
        )}
      </div>

      {methods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {methods.map(([method, amount]) => (
            <span
              key={method}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-700"
            >
              {PAYMENT_METHOD_LABELS[method] || method}: {money(amount)}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Stock para reponer</h2>
            {isAdmin && (
              <NavLink to="/productos" className="text-xs font-medium text-indigo-700 hover:underline">
                Productos
              </NavLink>
            )}
          </div>
          {loading && !data ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Cargando…</p>
          ) : (data?.lowStock?.items.length || 0) + (data?.outOfStock?.items.length || 0) === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">
              No hay productos en el mínimo ni agotados.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.outOfStock.items.map((item) => (
                <li key={`out-${item.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-800">
                    {item.name}
                    {item.sku ? <span className="ml-2 text-xs text-slate-400">{item.sku}</span> : null}
                  </span>
                  <span className="text-rose-700 font-medium">Sin stock</span>
                </li>
              ))}
              {data.lowStock.items.map((item) => (
                <li key={`low-${item.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-800">
                    {item.name}
                    {item.sku ? <span className="ml-2 text-xs text-slate-400">{item.sku}</span> : null}
                  </span>
                  <span className="tabular-nums text-amber-800 font-medium">
                    {item.stock} / mín. {item.minStock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Deudas de clientes</h2>
            {isAdmin && (
              <NavLink to="/configuracion/clientes" className="text-xs font-medium text-indigo-700 hover:underline">
                Clientes
              </NavLink>
            )}
          </div>
          {!data?.receivables?.items?.length ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Nadie debe saldo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.receivables.items.map((item) => (
                <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-800">{item.fullName}</span>
                  <span className="tabular-nums font-medium text-slate-900">{money(item.balanceDue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Deudas con proveedores</h2>
              <NavLink to="/configuracion/proveedores" className="text-xs font-medium text-indigo-700 hover:underline">
                Proveedores
              </NavLink>
            </div>
            {!data?.payables?.items?.length ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">No hay deuda con proveedores.</p>
            ) : (
              <ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
                {data.payables.items.map((item) => (
                  <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm border-b border-slate-100">
                    <span className="text-slate-800">{item.name}</span>
                    <span className="tabular-nums font-medium text-slate-900">{money(item.balanceDue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </section>
  )
}

export default Inicio
