import { httpError } from './errors.js'

export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

export function fromCents(cents) {
  return cents / 100
}

export function parseDiscount(raw) {
  if (raw == null || raw === '') return { type: null, value: 0 }
  const type = String(raw.type || '').trim().toLowerCase()
  if (!type || type === 'none') return { type: null, value: 0 }
  const value = Number(raw.value)
  if (type !== 'percent' && type !== 'amount') {
    throw httpError(400, 'Tipo de descuento inválido')
  }
  if (!Number.isFinite(value) || value < 0) {
    throw httpError(400, 'El descuento es inválido')
  }
  if (type === 'percent' && value > 100) {
    throw httpError(400, 'El porcentaje de descuento no puede superar 100')
  }
  return { type, value }
}

export function discountCents(grossCents, discount) {
  if (!discount?.type || !discount.value || grossCents <= 0) return 0
  if (discount.type === 'percent') {
    return Math.min(grossCents, Math.round((grossCents * discount.value) / 100))
  }
  const cents = toCents(discount.value)
  if (cents > grossCents) {
    throw httpError(400, 'El descuento no puede superar el importe')
  }
  return cents
}

export function priceLines(lines, saleDiscount) {
  const prepared = lines.map((line) => {
    const gross = line.listCents * line.quantity
    const lineOff = discountCents(gross, line.discount)
    return { ...line, lineOff, net: gross - lineOff }
  })
  const nets = prepared.reduce((acc, line) => acc + line.net, 0)
  const saleOff = discountCents(nets, saleDiscount)
  let assigned = 0
  return prepared.map((line, index) => {
    let share = 0
    if (saleOff > 0 && nets > 0) {
      if (index === prepared.length - 1) share = saleOff - assigned
      else {
        share = Math.floor((saleOff * line.net) / nets)
        assigned += share
      }
    }
    const subtotalCents = line.net - share
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      listUnitPrice: fromCents(line.listCents),
      unitPrice: fromCents(Math.round(subtotalCents / line.quantity)),
      discountAmount: fromCents(line.lineOff + share),
      subtotal: fromCents(subtotalCents),
    }
  })
}

export function sliceValue(subtotal, quantity, alreadyReturned, take) {
  const qty = Number(quantity)
  const sub = Number(subtotal)
  const beforeQty = Number(alreadyReturned)
  const nextQty = beforeQty + Number(take)
  if (qty < 1 || take < 1 || nextQty > qty) return 0
  const before = beforeQty <= 0 ? 0 : Math.round(((sub * beforeQty) / qty) * 100) / 100
  const after =
    nextQty >= qty ? Math.round(sub * 100) / 100 : Math.round(((sub * nextQty) / qty) * 100) / 100
  return Math.round((after - before) * 100) / 100
}
