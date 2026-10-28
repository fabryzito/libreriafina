function SortHeader({ label, field, sort, order, onSort, align = 'left' }) {
  const active = sort === field
  const nextOrder = active && order === 'asc' ? 'desc' : 'asc'
  const alignClass =
    align === 'right' ? 'text-right justify-end' : 'text-left justify-start'

  return (
    <th className={`py-3 px-3 border-b border-slate-200 ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(field, nextOrder)}
        className={`inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 transition group ${alignClass}`}
      >
        {label}
        <span
          className={`text-xs ${active ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}
          aria-hidden
        >
          {active ? (order === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

export default SortHeader
