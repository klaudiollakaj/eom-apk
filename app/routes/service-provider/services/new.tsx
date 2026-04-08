import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ServiceForm, type ServiceFormData } from '~/components/services/ServiceForm'
import { createService, createPackage, updateService } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'

export const Route = createFileRoute('/service-provider/services/new')({
  component: NewServicePage,
})

function NewServicePage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => { listServiceCategories().then(setCategories) }, [])

  async function handleSubmit(data: ServiceFormData) {
    const service = await createService({
      data: {
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        bannerImage: data.bannerImage || undefined,
      },
    })

    for (const pkg of data.packages) {
      if (!pkg.name) continue
      await createPackage({
        data: {
          serviceId: service.id,
          name: pkg.name,
          description: pkg.description || undefined,
          price: pkg.price || null,
          priceIsPublic: pkg.priceIsPublic,
          sortOrder: pkg.sortOrder,
        },
      })
    }

    if (data.galleryImages.length > 0) {
      await updateService({
        data: { id: service.id, galleryImages: data.galleryImages },
      })
    }

    navigate({ to: '/service-provider' })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Create Service</h1>
      <ServiceForm categories={categories} onSubmit={handleSubmit} />
    </div>
  )
}
