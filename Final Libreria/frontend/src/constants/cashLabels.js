export const CASH_METHOD_IDS = Object.freeze([
  'efectivo',
  'transferencia',
  'tarjeta',
])

export const CASH_SOURCE_LABELS = {
  apertura: 'Apertura',
  venta: 'Venta',
  cobro_cliente: 'Cobro de cliente',
  pago_proveedor: 'Pago a proveedor',
  compra: 'Compra',
  gasto: 'Gasto',
  ingreso_manual: 'Ingreso manual',
  egreso_manual: 'Egreso manual',
  anulacion_venta: 'Anulación de venta',
  devolucion_venta: 'Devolución',
  anulacion_compra: 'Anulación de compra',
}

export const STOCK_REASON_LABELS = {
  compra: 'Entrada por compra',
  venta: 'Salida por venta',
  anulacion_compra: 'Salida por anulación de compra',
  anulacion_venta: 'Devolución por anulación',
  devolucion_venta: 'Devolución',
  conteo: 'Ajuste por conteo',
  merma: 'Ajuste por merma',
  error: 'Ajuste por error',
  stock_inicial: 'Stock inicial',
}

export function cashSourceLabel(source) {
  return CASH_SOURCE_LABELS[source] || source || '—'
}

export function stockReasonLabel(reason) {
  return STOCK_REASON_LABELS[reason] || reason || '—'
}
