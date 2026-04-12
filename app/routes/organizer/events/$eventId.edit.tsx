import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { EventForm, type EventFormData } from '~/components/events/EventForm'
import { getEvent, updateEvent, publishEvent } from '~/server/fns/events'

export const Route = createFileRoute('/organizer/events/$eventId/edit')({
  loader: async ({ params }) => {
    const event = await getEvent({ data: { eventId: params.eventId } })
    return { event }
  },
  component: EditEventPage,
})

function EditEventPage() {
  const { event } = Route.useLoaderData()
  const navigate = useNavigate()

  const initialData: Partial<EventFormData> = {
    title: event.title,
    description: event.description,
    categoryId: event.categoryId || '',
    type: event.type as any,
    startDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '',
    endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    venueName: event.venueName || '',
    address: event.address || '',
    city: event.city || '',
    country: event.country || '',
    latitude: event.latitude || '',
    longitude: event.longitude || '',
    onlineUrl: event.onlineUrl || '',
    bannerImage: event.bannerImage || null,
    price: event.price || '',
    capacity: event.capacity?.toString() || '',
    visibility: event.visibility as any,
    ageRestriction: event.ageRestriction || '',
    contactEmail: event.contactEmail || '',
    contactPhone: event.contactPhone || '',
    tagNames: event.tags?.map((t: any) => t.tag.name) || [],
    galleryImages: event.images?.map((img: any) => ({
      imageUrl: img.imageUrl,
      caption: img.caption || '',
      sortOrder: img.sortOrder,
    })) || [],
  }

  async function handleSubmit(data: EventFormData, action: 'draft' | 'publish') {
    await updateEvent({
      data: {
        id: event.id,
        title: data.title,
        description: data.description,
        categoryId: data.categoryId || undefined,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate || undefined,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        venueName: data.venueName || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        onlineUrl: data.onlineUrl || undefined,
        bannerImage: data.bannerImage || undefined,
        price: data.price || undefined,
        capacity: data.capacity ? Number(data.capacity) : undefined,
        visibility: data.visibility,
        ageRestriction: data.ageRestriction || undefined,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        tagNames: data.tagNames,
        galleryImages: data.galleryImages.filter((img) => img.imageUrl),
      },
    })

    if (action === 'publish' && event.status === 'draft') {
      await publishEvent({ data: { id: event.id } })
    }

    navigate({ to: '/organizer' })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">{event.title}</h1>
      <div className="mb-6 flex gap-4 border-b dark:border-gray-700">
        <span className="-mb-px border-b-2 border-indigo-600 pb-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Details
        </span>
        <Link
          to="/organizer/events/$eventId/tickets"
          params={{ eventId: event.id }}
          className="pb-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          Tickets
        </Link>
        <Link
          to="/organizer/events/$eventId/sales"
          params={{ eventId: event.id }}
          className="pb-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          Sales
        </Link>
        <Link
          to="/organizer/events/$eventId/invites"
          params={{ eventId: event.id }}
          className="pb-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          Invites
        </Link>
      </div>
      <EventForm initialData={initialData} onSubmit={handleSubmit} submitLabel={event.status === 'draft' ? 'Publish' : 'Save'} />
    </div>
  )
}
