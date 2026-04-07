import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '~/server/fns/categories'

export const Route = createFileRoute('/admin/categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  async function fetchCategories() {
    const result = await listAllCategories()
    setCategories(result)
  }

  useEffect(() => { fetchCategories() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Category Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <CategoryForm onSaved={() => { setShowForm(false); fetchCategories() }} />
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{cat.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{cat.slug}</span>
              {cat.description && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{cat.description}</span>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">Order: {cat.sortOrder}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await updateCategory({ data: { id: cat.id, isActive: !cat.isActive } })
                  fetchCategories()
                }}
                className={`rounded px-2 py-1 text-xs ${
                  cat.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {cat.isActive ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Delete "${cat.name}"? This will fail if events use it.`)) {
                    try {
                      await deleteCategory({ data: { id: cat.id } })
                      fetchCategories()
                    } catch (err: any) {
                      alert(err.message || 'Cannot delete this category')
                    }
                  }
                }}
                className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900 dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createCategory({ data: { name, description: description || undefined, sortOrder } })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-gray-50 p-4 space-y-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="grid grid-cols-3 gap-3">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" required className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort Order" className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
      </div>
      <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Add Category</button>
    </form>
  )
}
