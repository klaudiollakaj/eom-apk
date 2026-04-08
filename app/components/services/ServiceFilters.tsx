// app/components/services/ServiceFilters.tsx
interface ServiceFiltersProps {
  categories: { id: string; name: string }[]
  selectedCategory: string
  keyword: string
  city: string
  onCategoryChange: (id: string) => void
  onKeywordChange: (keyword: string) => void
  onCityChange: (city: string) => void
}

export function ServiceFilters({
  categories, selectedCategory, keyword, city,
  onCategoryChange, onKeywordChange, onCityChange,
}: ServiceFiltersProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Search</label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Search services..."
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Location</label>
        <input
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="City..."
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
    </div>
  )
}
