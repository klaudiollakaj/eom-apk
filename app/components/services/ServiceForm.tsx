// app/components/services/ServiceForm.tsx
import { useState } from 'react'
import { RichTextEditor } from '~/components/events/RichTextEditor'
import { ImageUploader } from '~/components/events/ImageUploader'
import { GalleryUploader, type GalleryImage } from '~/components/events/GalleryUploader'

export interface ServiceFormData {
  categoryId: string
  title: string
  description: string
  city: string
  country: string
  bannerImage: string | null
  galleryImages: GalleryImage[]
  packages: {
    id?: string
    name: string
    description: string
    price: string
    priceIsPublic: boolean
    sortOrder: number
  }[]
}

interface ServiceFormProps {
  initialData?: Partial<ServiceFormData>
  categories: { id: string; name: string }[]
  onSubmit: (data: ServiceFormData) => Promise<void>
  submitLabel?: string
}

export function ServiceForm({ initialData, categories, onSubmit, submitLabel }: ServiceFormProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ServiceFormData>({
    categoryId: initialData?.categoryId ?? '',
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    city: initialData?.city ?? '',
    country: initialData?.country ?? '',
    bannerImage: initialData?.bannerImage ?? null,
    galleryImages: initialData?.galleryImages ?? [],
    packages: initialData?.packages ?? [{ name: '', description: '', price: '', priceIsPublic: true, sortOrder: 0 }],
  })
  const [loading, setLoading] = useState(false)

  function updateField<K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addPackage() {
    setForm((prev) => ({
      ...prev,
      packages: [...prev.packages, { name: '', description: '', price: '', priceIsPublic: true, sortOrder: prev.packages.length }],
    }))
  }

  function updatePackage(index: number, field: string, value: unknown) {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg, i) => i === index ? { ...pkg, [field]: value } : pkg),
    }))
  }

  function removePackage(index: number) {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index).map((pkg, i) => ({ ...pkg, sortOrder: i })),
    }))
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              step === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {s === 1 ? 'Details' : s === 2 ? 'Packages' : 'Gallery'}
          </button>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category *</label>
            <select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <RichTextEditor
              content={form.description}
              onChange={(html) => updateField('description', html)}
              placeholder="Describe your service..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Country</label>
              <input type="text" value={form.country} onChange={(e) => updateField('country', e.target.value)} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" />
            </div>
          </div>
          <ImageUploader value={form.bannerImage} onChange={(url) => updateField('bannerImage', url)} purpose="banner" label="Banner Image" />
          <button onClick={() => setStep(2)} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Next: Packages
          </button>
        </div>
      )}

      {/* Step 2: Packages */}
      {step === 2 && (
        <div className="space-y-4">
          {form.packages.map((pkg, i) => (
            <div key={i} className="rounded-lg border p-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Package {i + 1}</h4>
                {form.packages.length > 1 && (
                  <button onClick={() => removePackage(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                )}
              </div>
              <div className="space-y-3">
                <input type="text" value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)} placeholder="Package name *" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                <input type="text" value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)} placeholder="Description" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                <div className="flex gap-3">
                  <input type="number" step="0.01" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)} placeholder="Price (\u20AC) \u2014 leave empty for quote" className="flex-1 rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pkg.priceIsPublic} onChange={(e) => updatePackage(i, 'priceIsPublic', e.target.checked)} />
                    Public price
                  </label>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addPackage} className="rounded-lg border border-dashed px-4 py-2 text-sm text-gray-500 hover:border-gray-400">
            + Add Package
          </button>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-lg border px-6 py-2 text-sm">Back</button>
            <button onClick={() => setStep(3)} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Next: Gallery
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Gallery */}
      {step === 3 && (
        <div className="space-y-4">
          <GalleryUploader images={form.galleryImages} onChange={(imgs) => updateField('galleryImages', imgs)} />
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-lg border px-6 py-2 text-sm">Back</button>
            <button onClick={handleSubmit} disabled={loading || !form.title || !form.categoryId} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : submitLabel ?? 'Create Service'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
