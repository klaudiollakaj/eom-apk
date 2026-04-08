import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listAllServiceCategories, createServiceCategory,
  updateServiceCategory, deleteServiceCategory,
} from '~/server/fns/service-categories'

export const Route = createFileRoute('/admin/service-categories')({
  component: ServiceCategoriesPage,
})

function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function fetchCategories() {
    const result = await listAllServiceCategories()
    setCategories(result)
  }

  useEffect(() => { fetchCategories() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId) {
      await updateServiceCategory({ data: { id: editingId, name, description, sortOrder } })
    } else {
      await createServiceCategory({ data: { name, description, sortOrder } })
    }
    setShowForm(false)
    setEditingId(null)
    setName('')
    setDescription('')
    setSortOrder(0)
    fetchCategories()
  }

  function startEdit(cat: any) {
    setEditingId(cat.id)
    setName(cat.name)
    setDescription(cat.description ?? '')
    setSortOrder(cat.sortOrder)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    try {
      await deleteServiceCategory({ data: { id } })
      fetchCategories()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function toggleActive(cat: any) {
    await updateServiceCategory({ data: { id: cat.id, isActive: !cat.isActive } })
    fetchCategories()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Categories</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setName(''); setDescription(''); setSortOrder(0) }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : '+ Add Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name *" required className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort order" className="w-32 rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {editingId ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
            <div>
              <span className="font-medium">{cat.name}</span>
              <span className="ml-2 text-xs text-gray-400">#{cat.sortOrder}</span>
              {!cat.isActive && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(cat)} className="text-xs text-gray-500 hover:underline">
                {cat.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => startEdit(cat)} className="text-xs text-indigo-600 hover:underline">Edit</button>
              <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
