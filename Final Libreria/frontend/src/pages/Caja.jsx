import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeCash,
  createCashMovement,
  fetchCashCurrent,
  openCash,
} from '../api/services/cash'
import { cashSourceLabel, CASH_METHOD_IDS } from '../constants/cashLabels'
import { PAYMENT_METHOD_LABELS } from '../constants/paymentMethods'

function money(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}

function signedMoney(n) {
  const v = Number(n) || 0
  const prefix = v > 0 ? '+' : ''
  return `${prefix}${money(v)}`
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function MethodChart({ byMethod }) {
  const methods = CASH_METHOD_IDS
  const max = Math.max(
    1,
    ...methods.flatMap((method) => [
      byMethod?.[method]?.in || 0,
      byMethod?.[method]?.out || 0,
    ]),
  )
  return (
    <svg viewBox="0 0 360 170" className="w-full h-44" role="img" aria-label="Ingresos y egresos por método">
      {methods.map((method, index) => {
        const x = 28 + index * 112
        const incoming = byMethod?.[method]?.in || 0
        const outgoing = byMethod?.[method]?.out || 0
        const inH = (incoming / max) * 110
        const outH = (outgoing / max) * 110
        return (
          <g key={method}>
            <rect x={x} y={128 - inH} width={28} height={Math.max(inH, 0)} rx="4" fill="#059669" />
            <rect x={x + 34} y={128 - outH} width={28} height={Math.max(outH, 0)} rx="4" fill="#e11d48" />
            <text x={x + 31} y={148} textAnchor="middle" fontSize="11" fill="#475569">
              {PAYMENT_METHOD_LABELS[method]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SourceChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.amount))
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">Todavía no hay movimientos.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={`${row.source}-${row.direction}`} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="text-slate-600 truncate" title={cashSourceLabel(row.source)}>
            {cashSourceLabel(row.source)}
          </span>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${row.direction === 'ingreso' ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }}
            />
          </div>
          <span className="text-right tabular-nums font-medium text-slate-800">
            {money(row.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function HistoryChart({ history }) {
  if (!history.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">Aún no hay cierres.</p>
  }
  const rows = [...history].reverse()
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.expectedCash || 0, row.countedCash || 0]),
  )
  const width = Math.max(320, rows.length * 72)
  return (
    <svg viewBox={`0 0 ${width} 160`} className="w-full h-40" role="img" aria-label="Arqueo de sesiones cerradas">
      {rows.map((row, index) => {
        const x = 16 + index * 72
        const expectedH = ((row.expectedCash || 0) / max) * 100
        const countedH = ((row.countedCash || 0) / max) * 100
        return (
          <g key={row.id}>
            <rect x={x} y={118 - expectedH} width={18} height={expectedH} rx="3" fill="#1f4f86" />
            <rect x={x + 22} y={118 - countedH} width={18} height={countedH} rx="3" fill="#0f766e" />
            <text x={x + 20} y={136} textAnchor="middle" fontSize="10" fill="#64748b">
              #{row.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const emptyTotals = {
  byMethod: {
    efectivo: { in: 0, out: 0, net: 0 },
    transferencia: { in: 0, out: 0, net: 0 },
    tarjeta: { in: 0, out: 0, net: 0 },
  },
  bySource: [],
  expectedCash: 0,
}

function Caja() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNotes, setOpeningNotes] = useState('')
  const [opening, setOpening] = useState(false)

  const [kind, setKind] = useState('ingreso_manual')
  const [method, setMethod] = useState('efectivo')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [savingMove, setSavingMove] = useState(false)

  const [countedCash, setCountedCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setData(await fetchCashCurrent())
    } catch (err) {
      setError(err.message || 'No se pudo consultar la caja')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = data?.totals || emptyTotals
  const history = data?.history || []
  const movements = data?.movements || []

  const sourceRows = useMemo(() => {
    const map = new Map()
    for (const row of totals.bySource || []) {
      const key = `${row.source}:${row.direction}`
      const prev = map.get(key) || { source: row.source, direction: row.direction, amount: 0 }
      prev.amount = Math.round((prev.amount + Number(row.amount)) * 100) / 100
      map.set(key, prev)
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }, [totals])

  const grand = useMemo(() => {
    let incoming = 0
    let outgoing = 0
    for (const methodId of CASH_METHOD_IDS) {
      incoming += totals.byMethod[methodId]?.in || 0
      outgoing += totals.byMethod[methodId]?.out || 0
    }
    return {
      incoming: Math.round(incoming * 100) / 100,
      outgoing: Math.round(outgoing * 100) / 100,
    }
  }, [totals])

  const countedText = String(countedCash).trim()
  const countedNumber = countedText === '' ? NaN : Number(countedText.replace(',', '.'))
  const liveDifference = Number.isNaN(countedNumber)
    ? null
    : Math.round((countedNumber - totals.expectedCash) * 100) / 100

  const handleOpen = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const value = Number(String(openingAmount).replace(',', '.'))
    if (Number.isNaN(value) || value < 0) {
      setError('El monto inicial es inválido.')
      return
    }
    setOpening(true)
    try {
      await openCash({
        openingAmount: value,
        notes: openingNotes.trim() || undefined,
      })
      setOpeningNotes('')
      setNotice('Caja abierta.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo abrir la caja')
    } finally {
      setOpening(false)
    }
  }

  const handleMovement = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const value = Number(String(amount).replace(',', '.'))
    if (Number.isNaN(value) || value <= 0) {
      setError('El monto debe ser mayor a cero.')
      return
    }
    if (!description.trim()) {
      setError('Indicá una descripción.')
      return
    }
    setSavingMove(true)
    try {
      await createCashMovement({
        kind,
        paymentMethod: method,
        amount: value,
        description: description.trim(),
      })
      setAmount('')
      setDescription('')
      setNotice('Movimiento registrado.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento')
    } finally {
      setSavingMove(false)
    }
  }

  const handleClose = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (Number.isNaN(countedNumber) || countedNumber < 0) {
      setError('Indicá el efectivo contado.')
      return
    }
    const ok = window.confirm(
      `¿Cerrar la caja?\n\nEsperado en efectivo: ${money(totals.expectedCash)}\nContado: ${money(countedNumber)}\nDiferencia: ${signedMoney(liveDifference)}`,
    )
    if (!ok) return
    setClosing(true)
    try {
      const result = await closeCash({
        countedCash: countedNumber,
        notes: closeNotes.trim() || undefined,
      })
      setCountedCash('')
      setCloseNotes('')
      setNotice(
        `Caja cerrada. Diferencia ${signedMoney(result.cashDifference)}.`,
      )
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la caja')
    } finally {
      setClosing(false)
    }
  }

  return (
    <section className="w-full space-y-6">
      <header>
        <div className="inline-flex rounded-full bg-indigo-600/10 text-indigo-800 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 mb-2">
          Tesorería
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Caja</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Las ventas en efectivo, transferencia y tarjeta entran en la sesión abierta.
          Las ventas a cuenta corriente no mueven caja: entra el cobro, con el método con el que se cobró.
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3" role="status">
          {notice}
        </p>
      )}

      {loading && !data ? (
        <p className="text-sm text-slate-500">Cargando caja…</p>
      ) : !data?.open ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleOpen} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Abrir caja</h2>
            <p className="text-sm text-slate-600">
              No hay una sesión abierta. Sin caja no se pueden registrar ventas, cobros ni pagos.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="opening-amount">
                Efectivo inicial
              </label>
              <input
                id="opening-amount"
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="opening-notes">
                Notas
              </label>
              <input
                id="opening-notes"
                value={openingNotes}
                maxLength={500}
                onChange={(event) => setOpeningNotes(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Turno mañana, cambio…"
              />
            </div>
            <button
              type="submit"
              disabled={opening}
              className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-indigo-700 disabled:opacity-50"
            >
              {opening ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Últimos arqueos</h2>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Azul: efectivo esperado. Verde: efectivo contado.
            </p>
            <HistoryChart history={history} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Efectivo esperado</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(totals.expectedCash)}</p>
              <p className="text-xs text-slate-500 mt-1">Incluye la apertura</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transferencia</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(totals.byMethod.transferencia.net)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tarjeta</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(totals.byMethod.tarjeta.net)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sesión #{data.session.id}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{data.session.openedByName}</p>
              <p className="text-xs text-slate-500 mt-1">{formatWhen(data.session.openedAt)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-semibold text-slate-900">Por método</h2>
                <p className="text-xs text-slate-500">
                  <span className="text-emerald-700">Ingresos {money(grand.incoming)}</span>
                  {' · '}
                  <span className="text-rose-700">Egresos {money(grand.outgoing)}</span>
                </p>
              </div>
              <div className="flex gap-4 text-xs text-slate-500 mb-1">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-600" /> Ingreso</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-600" /> Egreso</span>
              </div>
              <MethodChart byMethod={totals.byMethod} />
              <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                {CASH_METHOD_IDS.map((methodId) => (
                  <div key={methodId} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="text-slate-500">{PAYMENT_METHOD_LABELS[methodId]}</p>
                    <p className="font-semibold tabular-nums text-slate-900">{money(totals.byMethod[methodId].net)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Por origen</h2>
              <SourceChart rows={sourceRows} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleMovement} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Ingreso o egreso</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1" htmlFor="move-kind">Tipo</label>
                  <select
                    id="move-kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ingreso_manual">Ingreso manual</option>
                    <option value="egreso_manual">Egreso manual</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1" htmlFor="move-method">Método</label>
                  <select
                    id="move-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {CASH_METHOD_IDS.map((methodId) => (
                      <option key={methodId} value={methodId}>
                        {PAYMENT_METHOD_LABELS[methodId]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1" htmlFor="move-amount">Monto</label>
                <input
                  id="move-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1" htmlFor="move-desc">Descripción</label>
                <input
                  id="move-desc"
                  value={description}
                  maxLength={255}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Alquiler, cambio, retiro…"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingMove}
                className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 disabled:opacity-50"
              >
                {savingMove ? 'Guardando…' : 'Registrar movimiento'}
              </button>
            </form>

            <form onSubmit={handleClose} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Cierre y arqueo</h2>
              <p className="text-sm text-slate-600">
                Contá solo el efectivo. Transferencia y tarjeta quedan registrados, pero no forman parte del arqueo físico.
              </p>
              <p className="text-sm">
                Esperado en efectivo:{' '}
                <span className="font-semibold tabular-nums">{money(totals.expectedCash)}</span>
              </p>
              <div>
                <label className="block text-xs text-slate-500 mb-1" htmlFor="counted-cash">Efectivo contado</label>
                <input
                  id="counted-cash"
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {liveDifference != null && (
                <p className={`text-sm font-medium ${liveDifference === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Diferencia: {signedMoney(liveDifference)}
                </p>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1" htmlFor="close-notes">Notas del cierre</label>
                <input
                  id="close-notes"
                  value={closeNotes}
                  maxLength={500}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={closing}
                className="rounded-lg bg-rose-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-rose-700 disabled:opacity-50"
              >
                {closing ? 'Cerrando…' : 'Cerrar caja'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Movimientos de la sesión</h2>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-500 px-5 py-8 text-center">Esta sesión todavía no tiene movimientos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-4 py-3 font-medium">Hora</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Origen</th>
                      <th className="px-4 py-3 font-medium">Método</th>
                      <th className="px-4 py-3 font-medium">Detalle</th>
                      <th className="px-4 py-3 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatWhen(row.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={row.direction === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'}>
                            {row.direction === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{cashSourceLabel(row.source)}</td>
                        <td className="px-4 py-2.5 text-slate-700">{PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.description || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Cierres anteriores</h2>
              <p className="text-xs text-slate-500 mt-1 mb-2">
                Azul: efectivo esperado. Verde: efectivo contado.
              </p>
              <HistoryChart history={history} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default Caja
