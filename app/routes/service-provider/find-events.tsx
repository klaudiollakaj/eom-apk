import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listPublicEvents } from '~/server/fns/events'
import { listMyServices } from '~/server/fns/services'
import { sendProviderOffer } from '~/server/fns/negotiations'
import { Search } from 'lucide-react'

export const Route = createFileRoute('/service-provider/find-events')({
  component: FindEventsPage,
})

function FindEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 12
  const [loading, setLoading] = useState(true)

  const [myServices, setMyServices] = useState<any[]>([])
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function fetchEvents() {
    setLoading(true)
    const result = await listPublicEvents({
      data: {
        search: search || undefined,
        offset,
        limit,
      },
    })
    setEvents(result.events)
    setTotal(result.total)
    setLoading(false)
  }

  useEffect(() => {
    listMyServices().then(setMyServices)
  }, [])

  useEffect(() => { setOffset(0); fetchEvents() }, [search])
  useEffect(() => { fetchEvents() }, [offset])

  function openOfferModal(event: any) {
    setSelectedEvent(event)
    setSelectedServiceId('')
    setSelectedPackageId('')
    setOfferPrice('')
    setOfferMessage('')
    setShowOfferModal(true)
  }

  const selectedService = myServices.find((s) => s.id === selectedServiceId)
  const packages = selectedService?.packages ?? []

  async function submitOffer() {
    if (!selectedServiceId || !selectedEvent || !offerPrice) return
    setSending(true)
    try {
      await sendProviderOffer({
        data: {
          serviceId: selectedServiceId,
          packageId: selectedPackageId || undefined,
          eventId: selectedEvent.id,
          price: offerPrice,
          message: offerMessage || undefined,
        },
      })
      setShowOfferModal(false)
      alert('Offer sent successfully!')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Find Events</h1>
      <p className="mb-6 text-gray-500">Browse published events and offer your services to organizers.</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events by name..."
          className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500">No published events found.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="overflow-hidden rounded-xl border dark:border-gray-700">
                {event.bannerImage && (
                  <img src={event.bannerImage} alt={event.title} className="h-36 w-full object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{event.title}</h3>
                  {event.category && (
                    <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">{event.category.name}</p>
                  )}
                  {event.startDate && (
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {event.organizer && (
                    <p className="mt-1 text-xs text-gray-400">by {event.organizer.name}</p>
                  )}
                  <button
                    onClick={() => openOfferModal(event)}
                    disabled={myServices.length === 0}
                    className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {myServices.length === 0 ? 'Create a service first' : 'Offer Services'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <button onClick={() => setOffset((page - 2) * limit)} className="rounded-lg border px-4 py-2 text-sm">Previous</button>
              )}
              <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <button onClick={() => setOffset(page * limit)} className="rounded-lg border px-4 py-2 text-sm">Next</button>
              )}
            </div>
          )}
        </>
      )}

      {showOfferModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-1 text-lg font-bold">Offer Services</h3>
            <p className="mb-4 text-sm text-gray-500">to <span className="font-medium text-gray-700 dark:text-gray-300">{selectedEvent.title}</span></p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Select Service *</label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => { setSelectedServiceId(e.target.value); setSelectedPackageId(''); setOfferPrice('') }}
                  className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                >
                  <option value="">Choose a service...</option>
                  {myServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} ({s.category?.name})</option>
                  ))}
                </select>
              </div>

              {packages.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Package (optional)</label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value)
                      const pkg = packages.find((p: any) => p.id === e.target.value)
                      if (pkg?.price) setOfferPrice(pkg.price)
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">No specific package</option>
                    {packages.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.price ? ` — €${p.price}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Proposed Price (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="Your price for this event"
                  className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  rows={3}
                  placeholder="Describe what you can offer for this event..."
                  className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowOfferModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={submitOffer}
                disabled={sending || !selectedServiceId || !offerPrice}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
