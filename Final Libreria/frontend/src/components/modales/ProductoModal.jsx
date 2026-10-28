import { useState } from 'react'
import Modal from './Modal'

const fieldClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ProductoModal({
  open,
  editingId,
  form,
  setForm,
  categories,
  saving,
  error,
  onSubmit,
  onClose,
  onCreateCategory,
}) {
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  const price = Number(String(form.price).replace(',', '.'))
  const cost = Number(String(form.cost).replace(',', '.'))
  const margin =
    Number.isFinite(price) && price > 0 && Number.isFinite(cost)
      ? ((price - cost) / price) * 100
      : null

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) {
      setCategoryError('Escribe el nombre de la categoría')
      return
    }
    setCategoryError('')
    setAddingCategory(true)
    try {
      const created = await onCreateCategory(name)
      setForm((prev) => ({ ...prev, categoryId: String(created.id) }))
      setNewCategory('')
    } catch (e) {
      setCategoryError(e.message || 'No se pudo crear la categoría')
    } finally {
      setAddingCategory(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editingId ? 'Editar producto' : 'Crear producto'}
      onClose={onClose}
      wide
    >
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Código
            </label>
            <input
              type="text"
              value={form.sku}
              maxLength={40}
              placeholder="Opcional, único"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sku: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Código de barras
            </label>
            <input
              type="text"
              value={form.barcode || ''}
              maxLength={64}
              placeholder="Opcional, único"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, barcode: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className={fieldClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Categoría
          </label>
          <select
            value={form.categoryId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, categoryId: e.target.value }))
            }
            className={fieldClass}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newCategory}
              maxLength={80}
              placeholder="Nueva categoría"
              onChange={(e) => setNewCategory(e.target.value)}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={addingCategory || saving}
              className="shrink-0 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {addingCategory ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
          {categoryError && (
            <p className="mt-1 text-xs text-red-600">{categoryError}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Precio de venta
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, price: e.target.value }))
              }
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Costo
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, cost: e.target.value }))
              }
              className={fieldClass}
              required
            />
          </div>
        </div>

        {margin != null && (
          <p className="text-xs text-slate-500 -mt-2">
            Margen sobre el precio:{' '}
            <span className="font-medium text-slate-700">
              {margin.toFixed(1)}%
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {editingId != null ? 'Stock actual' : 'Stock inicial'}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, stock: e.target.value }))
              }
              className={fieldClass}
              required={editingId == null}
              readOnly={editingId != null}
              disabled={editingId != null}
            />
            {editingId != null && (
              <p className="mt-1 text-xs text-slate-500">
                El stock se cambia con un ajuste, para que quede quién y por qué.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Stock mínimo
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.minStock}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, minStock: e.target.value }))
              }
              className={fieldClass}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Si el stock llega a este número o menos, se marca como bajo.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, isActive: e.target.checked }))
            }
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Producto activo (disponible para vender)
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || addingCategory}
            className="flex-1 inline-flex justify-center items-center rounded-md bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving
              ? 'Guardando...'
              : editingId
                ? 'Guardar cambios'
                : 'Crear producto'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex justify-center items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ProductoModal
