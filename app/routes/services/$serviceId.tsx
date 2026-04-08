import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getService } from '~/server/fns/services'
import { requestQuote, sendOffer } from '~/server/fns/negotiations'
import { listOrganizerEvents } from '~/server/fns/events'
import { PackageCard } from '~/components/services/PackageCard'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/services/$serviceId')({
  loader: async ({ params }) => {
    const service = await getService({ data: { serviceId: params.serviceId } })
    return { service }
  },
  component: ServiceDetailPage,
})

function ServiceDetailPage() {
  const { service } = Route.useLoaderData()
  const session = useSession()
  const navigate = useNavigate()
  const user = session.data?.user
  const isOrganizer = user?.role === 'organizer' || user?.role === 'superadmin'

  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [eventId, setEventId] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [myEvents, setMyEvents] = useState<any[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  async function fetchMyEvents() {
    setEventsLoading(true)
    try {
      const events = await listOrganizerEvents({ data: { status: 'published' } })
      setMyEvents(events)
    } catch {
      setMyEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  async function handleRequestQuote(packageId: string) {
    if (!isOrganizer) { navigate({ to: '/login' }); return }
    setSelectedPackageId(packageId)
    setOfferPrice('')
    setShowOfferModal(true)
    fetchMyEvents()
  }

  async function handleSendOffer(packageId: string) {
    if (!isOrganizer) { navigate({ to: '/login' }); return }
    setSelectedPackageId(packageId)
    const pkg = service.packages.find((p: any) => p.id === packageId)
    if (pkg?.price) setOfferPrice(pkg.price)
    setShowOfferModal(true)
    fetchMyEvents()
  }

  async function submitOffer() {
    if (!eventId) return
    setLoading(true)
    try {
      const pkg = service.packages.find((p: any) => p.id === selectedPackageId)
      const isQuote = !pkg?.priceIsPublic || !pkg?.price

      if (isQuote) {
        await requestQuote({
          data: { serviceId: service.id, packageId: selectedPackageId || undefined, eventId, message: offerMessage || undefined },
        })
      } else {
        await sendOffer({
          data: { serviceId: service.id, packageId: selectedPackageId || undefined, eventId, price: offerPrice, message: offerMessage || undefined },
        })
      }
      setShowOfferModal(false)
      navigate({ to: '/organizer/negotiations' })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {service.bannerImage && (
        <img src={service.bannerImage} alt={service.title} className="mb-6 h-64 w-full rounded-xl object-cover" />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{service.title}</h1>
          {service.category && (
            <span className="mt-2 inline-block rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              {service.category.name}
            </span>
          )}
          {(service.city || service.country) && (
            <p className="mt-2 text-gray-500">{[service.city, service.country].filter(Boolean).join(', ')}</p>
          )}
        </div>
        {service.provider && (
          <div className="flex items-center gap-2">
            {service.provider.image && <img src={service.provider.image} alt="" className="h-10 w-10 rounded-full" />}
            <span className="text-sm font-medium">{service.provider.name}</span>
          </div>
        )}
      </div>

      {service.description && (
        <div className="prose prose-sm mt-6 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: service.description }} />
      )}

      <h2 className="mt-8 mb-4 text-xl font-bold">Packages</h2>
      <div className="space-y-4">
        {service.packages.map((pkg: any) => (
          <PackageCard
            key={pkg.id}
            name={pkg.name}
            description={pkg.description}
            price={pkg.price}
            priceIsPublic={pkg.priceIsPublic}
            onRequestQuote={isOrganizer ? () => handleRequestQuote(pkg.id) : undefined}
            onSendOffer={isOrganizer ? () => handleSendOffer(pkg.id) : undefined}
          />
        ))}
      </div>

      {service.images?.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 text-xl font-bold">Portfolio</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {service.images.map((img: any) => (
              <div key={img.id} className="overflow-hidden rounded-lg">
                <img src={img.imageUrl} alt={img.caption || ''} className="h-48 w-full object-cover" />
                {img.caption && <p className="p-2 text-xs text-gray-500">{img.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold">Send Offer</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Select Event *</label>
                {eventsLoading ? (
                  <p className="text-sm text-gray-400">Loading your events...</p>
                ) : myEvents.length === 0 ? (
                  <p className="text-sm text-amber-600">You have no published events. Publish an event first to send offers.</p>
                ) : (
                  <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
                    <option value="">Choose an event...</option>
                    {myEvents.map((ev: any) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                )}
              </div>
              {offerPrice && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Proposed Price (€)</label>
                  <input type="number" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} rows={3} placeholder="Any notes or terms..." className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowOfferModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitOffer} disabled={loading || !eventId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
