function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  disabled = false,
}) {
  if (totalPages <= 1 && total <= limit) return null

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 mt-4">
      <p className="text-sm text-slate-600 order-2 sm:order-1">
        {total === 0 ? (
          'Sin resultados'
        ) : (
          <>
            Mostrando <span className="font-medium text-slate-800">{from}</span>–
            <span className="font-medium text-slate-800">{to}</span> de{' '}
            <span className="font-medium text-slate-800">{total}</span>
          </>
        )}
      </p>

      <nav
        className="flex items-center gap-1 order-1 sm:order-2"
        aria-label="Paginación"
      >
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2.5 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Página anterior"
        >
          ‹
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(1)}
              className="min-w-[2rem] px-2 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              1
            </button>
            {start > 2 && (
              <span className="px-1 text-slate-400 select-none">…</span>
            )}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[2rem] px-2 py-1.5 text-sm rounded-md border transition disabled:opacity-40 ${
              p === page
                ? 'bg-indigo-600 border-indigo-600 text-white font-medium'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && (
              <span className="px-1 text-slate-400 select-none">…</span>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(totalPages)}
              className="min-w-[2rem] px-2 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2.5 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Página siguiente"
        >
          ›
        </button>
      </nav>
    </div>
  )
}

export default Pagination
