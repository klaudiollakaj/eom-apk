import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ServiceForm, type ServiceFormData } from '~/components/services/ServiceForm'
import { getService, updateService, createPackage, updatePackage, deletePackage, deleteService } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'

export const Route = createFileRoute('/service-provider/services/$serviceId/edit')({
  loader: async ({ params }) => {
    const service = await getService({ data: { serviceId: params.serviceId } })
    return { service }
  },
  component: EditServicePage,
})

function EditServicePage() {
  const { service } = Route.useLoaderData()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => { listServiceCategories().then(setCategories) }, [])

  const initialData: Partial<ServiceFormData> = {
    categoryId: service.categoryId,
    title: service.title,
    description: service.description ?? '',
    city: service.city ?? '',
    country: service.country ?? '',
    bannerImage: service.bannerImage,
    galleryImages: (service.images ?? []).map((img: any) => ({
      imageUrl: img.imageUrl,
      caption: img.caption ?? '',
      sortOrder: img.sortOrder,
    })),
    packages: (service.packages ?? []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? '',
      price: pkg.price ?? '',
      priceIsPublic: pkg.priceIsPublic,
      sortOrder: pkg.sortOrder,
    })),
  }

  async function handleSubmit(data: ServiceFormData) {
    await updateService({
      data: {
        id: service.id,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        bannerImage: data.bannerImage,
        galleryImages: data.galleryImages,
      },
    })

    const existingIds = new Set(data.packages.filter((p) => p.id).map((p) => p.id!))
    const originalIds = (service.packages ?? []).map((p: any) => p.id)

    for (const oldId of originalIds) {
      if (!existingIds.has(oldId)) {
        await deletePackage({ data: { id: oldId } })
      }
    }

    for (const pkg of data.packages) {
      if (!pkg.name) continue
      if (pkg.id) {
        await updatePackage({
          data: {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description || undefined,
            price: pkg.price || null,
            priceIsPublic: pkg.priceIsPublic,
            sortOrder: pkg.sortOrder,
          },
        })
      } else {
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
    }

    navigate({ to: '/service-provider' })
  }

  async function handleDelete() {
    if (!confirm('Delete this service?')) return
    try {
      await deleteService({ data: { id: service.id } })
      navigate({ to: '/service-provider' })
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Service</h1>
        <button onClick={handleDelete} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
          Delete Service
        </button>
      </div>
      <ServiceForm initialData={initialData} categories={categories} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </div>
  )
}
