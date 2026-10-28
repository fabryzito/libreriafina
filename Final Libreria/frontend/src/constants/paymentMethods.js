/** @typedef {'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'} PaymentMethod */

/** @type {readonly PaymentMethod[]} */
export const PAYMENT_METHOD_IDS = Object.freeze([
  'efectivo',
  'transferencia',
  'tarjeta',
  'cuenta_corriente',
])

/** @type {Record<PaymentMethod, string>} */
export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
}

/** @param {string | undefined} value */
export function formatPaymentMethodLabel(value) {
  if (value != null && value in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[/** @type {PaymentMethod} */ (value)]
  }
  return '—'
}
