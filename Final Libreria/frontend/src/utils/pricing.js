function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

function discountCents(grossCents, type, value) {
  const amount = Number(value)
  if (!type || type === 'none' || !amount || grossCents <= 0) return 0
  if (type === 'percent') {
    const percent = Math.min(100, Math.max(0, amount))
    return Math.min(grossCents, Math.round((grossCents * percent) / 100))
  }
  return Math.min(grossCents, Math.max(0, toCents(amount)))
}

export function quoteCart(lines, saleType, saleValue) {
  const prepared = lines.map((line) => {
    const gross = toCents(line.price) * Number(line.quantity)
    const lineOff = discountCents(gross, line.discountType, line.discountValue)
    return { ...line, gross, lineOff, net: gross - lineOff }
  })
  const nets = prepared.reduce((acc, line) => acc + line.net, 0)
  const saleOff = discountCents(nets, saleType, saleValue)
  let assigned = 0
  const items = prepared.map((line, index) => {
    let share = 0
    if (saleOff > 0 && nets > 0) {
      if (index === prepared.length - 1) share = saleOff - assigned
      else {
        share = Math.floor((saleOff * line.net) / nets)
        assigned += share
      }
    }
    return {
      productId: line.productId,
      subtotal: (line.net - share) / 100,
      discount: (line.lineOff + share) / 100,
      listTotal: line.gross / 100,
    }
  })
  const total = Math.round(items.reduce((acc, line) => acc + line.subtotal, 0) * 100) / 100
  const discountTotal = Math.round(items.reduce((acc, line) => acc + line.discount, 0) * 100) / 100
  return { items, total, discountTotal }
}
