import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EventForm, type EventFormData } from '~/components/events/EventForm'
import { createEvent, publishEvent } from '~/server/fns/events'

export const Route = createFileRoute('/organizer/events/new')({
  component: NewEventPage,
})

function NewEventPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: EventFormData, action: 'draft' | 'publish') {
    const event = await createEvent({
      data: {
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
        tagNames: data.tagNames.length > 0 ? data.tagNames : undefined,
        galleryImages: data.galleryImages.filter((img) => img.imageUrl).length > 0
          ? data.galleryImages.filter((img) => img.imageUrl)
          : undefined,
      },
    })

    if (action === 'publish') {
      await publishEvent({ data: { id: event.id } })
    }

    navigate({ to: '/organizer' })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Create Event</h1>
      <EventForm onSubmit={handleSubmit} />
    </div>
  )
}
