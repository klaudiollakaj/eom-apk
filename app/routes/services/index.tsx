import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { browseServices } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'
import { ServiceCard } from '~/components/services/ServiceCard'
import { ServiceFilters } from '~/components/services/ServiceFilters'

export const Route = createFileRoute('/services/')({
  component: ServicesPage,
})

function ServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function fetchCategories() {
    const cats = await listServiceCategories()
    setCategories(cats)
  }

  async function fetchServices() {
    setLoading(true)
    const result = await browseServices({
      data: {
        categoryId: categoryId || undefined,
        keyword: keyword || undefined,
        city: city || undefined,
        page,
      },
    })
    setServices(result)
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])
  useEffect(() => { setPage(1); fetchServices() }, [categoryId, keyword, city])
  useEffect(() => { fetchServices() }, [page])

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">Service Marketplace</h1>
      <div className="flex gap-8">
        <aside className="w-64 shrink-0">
          <ServiceFilters
            categories={categories}
            selectedCategory={categoryId}
            keyword={keyword}
            city={city}
            onCategoryChange={setCategoryId}
            onKeywordChange={setKeyword}
            onCityChange={setCity}
          />
        </aside>
        <main className="flex-1">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : services.length === 0 ? (
            <p className="text-gray-500">No services found.</p>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    id={s.id}
                    title={s.title}
                    bannerImage={s.bannerImage}
                    city={s.city}
                    country={s.country}
                    category={s.category}
                    packages={s.packages}
                    provider={s.provider}
                    avgRating={(s as any).avgRating}
                    reviewCount={(s as any).reviewCount}
                  />
                ))}
              </div>
              <div className="mt-8 flex justify-center gap-2">
                {page > 1 && (
                  <button onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 text-sm">Previous</button>
                )}
                {services.length === 12 && (
                  <button onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 text-sm">Next</button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
