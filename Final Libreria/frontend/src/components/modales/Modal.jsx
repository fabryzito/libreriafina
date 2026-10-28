import { useEffect } from 'react'

function Modal({ open, title, children, onClose, wide = false }) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-4 gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Cerrar
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export default Modal

