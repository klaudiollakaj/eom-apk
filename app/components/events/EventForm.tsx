import { useState, useEffect } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { ImageUploader } from './ImageUploader'
import { GalleryUploader, type GalleryImage } from './GalleryUploader'
import { listCategories } from '~/server/fns/categories'

export interface EventFormData {
  title: string
  description: string
  categoryId: string
  type: 'single_day' | 'multi_day'
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  venueName: string
  address: string
  city: string
  country: string
  onlineUrl: string
  bannerImage: string | null
  price: string
  capacity: string
  visibility: 'public' | 'unlisted'
  ageRestriction: string
  contactEmail: string
  contactPhone: string
  tagNames: string[]
  galleryImages: GalleryImage[]
}

const EMPTY_FORM: EventFormData = {
  title: '', description: '', categoryId: '', type: 'single_day',
  startDate: '', endDate: '', startTime: '', endTime: '',
  venueName: '', address: '', city: '', country: '', onlineUrl: '',
  bannerImage: null, price: '', capacity: '', visibility: 'public',
  ageRestriction: '', contactEmail: '', contactPhone: '',
  tagNames: [], galleryImages: [],
}

interface EventFormProps {
  initialData?: Partial<EventFormData>
  onSubmit: (data: EventFormData, action: 'draft' | 'publish') => Promise<void>
  submitLabel?: string
}

export function EventForm({ initialData, onSubmit, submitLabel }: EventFormProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<EventFormData>({ ...EMPTY_FORM, ...initialData })
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { listCategories().then(setCategories) }, [])

  function update(partial: Partial<EventFormData>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !form.tagNames.includes(tag)) {
      update({ tagNames: [...form.tagNames, tag] })
    }
    setTagInput('')
  }

  async function handleSubmit(action: 'draft' | 'publish') {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(form, action)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === s
                ? 'bg-indigo-600 text-white'
                : step > s
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="text-sm text-gray-500">
          {step === 1 ? 'Details' : step === 2 ? 'Media' : 'Review'}
        </span>
      </div>

      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-300">{error}</p>}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Title *</label>
              <input type="text" value={form.title} onChange={(e) => update({ title: e.target.value })} required className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select value={form.type} onChange={(e) => update({ type: e.target.value as any })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="single_day">Single Day</option>
                <option value="multi_day">Multi Day</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => update({ startDate: e.target.value })} required className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            {form.type === 'multi_day' && (
              <div>
                <label className="mb-1 block text-sm font-medium">End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => update({ endDate: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Start Time</label>
              <input type="time" value={form.startTime} onChange={(e) => update({ startTime: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Time</label>
              <input type="time" value={form.endTime} onChange={(e) => update({ endTime: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description *</label>
            <RichTextEditor content={form.description} onChange={(html) => update({ description: html })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Venue Name</label><input type="text" value={form.venueName} onChange={(e) => update({ venueName: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Address</label><input type="text" value={form.address} onChange={(e) => update({ address: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">City</label><input type="text" value={form.city} onChange={(e) => update({ city: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Country</label><input type="text" value={form.country} onChange={(e) => update({ country: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Online URL</label><input type="url" value={form.onlineUrl} onChange={(e) => update({ onlineUrl: e.target.value })} placeholder="For virtual/hybrid events" className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Price</label><input type="number" step="0.01" min="0" value={form.price} onChange={(e) => update({ price: e.target.value })} placeholder="Leave empty for free" className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Capacity</label><input type="number" min="0" value={form.capacity} onChange={(e) => update({ capacity: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Age Restriction</label><input type="text" value={form.ageRestriction} onChange={(e) => update({ ageRestriction: e.target.value })} placeholder="e.g. 18+" className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Contact Email</label><input type="email" value={form.contactEmail} onChange={(e) => update({ contactEmail: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-sm font-medium">Contact Phone</label><input type="tel" value={form.contactPhone} onChange={(e) => update({ contactPhone: e.target.value })} className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Visibility</label>
            <select value={form.visibility} onChange={(e) => update({ visibility: e.target.value as any })} className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tags</label>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Add a tag..." className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              <button type="button" onClick={addTag} className="rounded bg-gray-100 px-3 py-2 text-sm dark:bg-gray-700">Add</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.tagNames.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  {tag}
                  <button type="button" onClick={() => update({ tagNames: form.tagNames.filter((t) => t !== tag) })} className="text-indigo-500 hover:text-indigo-700">&times;</button>
                </span>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setStep(2)} className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700">Next: Media</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <ImageUploader value={form.bannerImage} onChange={(url) => update({ bannerImage: url })} purpose="banner" label="Banner Image *" />
          <GalleryUploader images={form.galleryImages} onChange={(imgs) => update({ galleryImages: imgs })} />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded border px-6 py-2 text-sm dark:border-gray-600">Back</button>
            <button type="button" onClick={() => setStep(3)} className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700">Next: Review</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 dark:border-gray-700">
            <h2 className="text-xl font-bold">{form.title || 'Untitled Event'}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
              {form.startDate && <span>{new Date(form.startDate).toLocaleDateString()}</span>}
              {form.city && <span>| {form.city}</span>}
              {form.price ? <span>| ${form.price}</span> : <span>| Free</span>}
            </div>
            {form.bannerImage && <img src={form.bannerImage} alt="Banner" className="mt-4 h-48 w-full rounded-lg object-cover" />}
            {form.description && <div className="prose prose-sm mt-4 dark:prose-invert" dangerouslySetInnerHTML={{ __html: form.description }} />}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="rounded border px-6 py-2 text-sm dark:border-gray-600">Back</button>
            <button type="button" onClick={() => handleSubmit('draft')} disabled={submitting} className="rounded bg-gray-600 px-6 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save as Draft'}
            </button>
            <button type="button" onClick={() => handleSubmit('publish')} disabled={submitting} className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Publishing...' : submitLabel || 'Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
