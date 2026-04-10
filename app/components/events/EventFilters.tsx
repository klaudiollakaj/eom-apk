import { useState, useEffect } from 'react'
import { listCategories } from '~/server/fns/categories'
import { listTags } from '~/server/fns/tags'
import { getPublicEventCities } from '~/server/fns/events'

export interface FilterState {
  search: string
  categoryId: string
  startAfter: string
  startBefore: string
  priceFilter: '' | 'free' | 'paid'
  city: string
  tagIds: string[]
}

interface EventFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

export function EventFilters({ filters, onChange }: EventFiltersProps) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [cities, setCities] = useState<string[]>([])

  useEffect(() => {
    listCategories().then(setCategories)
    listTags({ data: {} }).then(setAllTags)
    getPublicEventCities().then(setCities)
  }, [])

  function update(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial })
  }

  function toggleTag(tagId: string) {
    const tagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((t) => t !== tagId)
      : [...filters.tagIds, tagId]
    update({ tagIds })
  }

  return (
    <aside className="w-64 shrink-0 space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Search</label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search events..."
          className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Category</label>
        <select
          value={filters.categoryId}
          onChange={(e) => update({ categoryId: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {cities.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">City</label>
          <select
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Date Range</label>
        <input
          type="date"
          value={filters.startAfter}
          onChange={(e) => update({ startAfter: e.target.value })}
          className="mb-2 w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <input
          type="date"
          value={filters.startBefore}
          onChange={(e) => update({ startBefore: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Price</label>
        <div className="flex gap-2">
          {(['', 'free', 'paid'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => update({ priceFilter: p })}
              className={`rounded-full px-3 py-1 text-xs ${
                filters.priceFilter === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {p === '' ? 'Any' : p === 'free' ? 'Free' : 'Paid'}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Tags</label>
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 15).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  filters.tagIds.includes(tag.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange({ search: '', categoryId: '', startAfter: '', startBefore: '', priceFilter: '', city: '', tagIds: [] })}
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Reset Filters
      </button>
    </aside>
  )
}
