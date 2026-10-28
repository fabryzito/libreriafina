import { useCallback, useEffect, useState } from 'react'
import { fetchShop, updateShop } from '../api/services/shop'

const empty = { name: '', address: '', phone: '', documentId: '' }

function Negocio() {
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setForm({ ...empty, ...(await fetchShop()) })
    } catch (err) {
      setError(err.message || 'No se pudieron leer los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      setForm({ ...empty, ...(await updateShop(form)) })
      setNotice('Datos guardados. Van a salir en el ticket de venta.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-lg font-semibold text-slate-900">Datos del negocio</h2>
      <p className="text-sm text-slate-600 mt-1 mb-4">
        Nombre, dirección y teléfono que se imprimen en el comprobante de cada venta.
      </p>
      {error && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
      {notice && <p className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">{notice}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1" htmlFor="shop-name">Nombre</label>
            <input id="shop-name" value={form.name} onChange={setField('name')} required maxLength={180} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1" htmlFor="shop-address">Dirección</label>
            <input id="shop-address" value={form.address} onChange={setField('address')} maxLength={255} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="shop-phone">Teléfono</label>
            <input id="shop-phone" value={form.phone} onChange={setField('phone')} maxLength={40} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1" htmlFor="shop-doc">CUIT o documento</label>
            <input id="shop-doc" value={form.documentId} onChange={setField('documentId')} maxLength={60} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <button type="submit" disabled={saving} className="md:col-span-2 justify-self-start rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
    </section>
  )
}

export default Negocio
