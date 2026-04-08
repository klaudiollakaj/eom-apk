// app/components/events/EventServicesList.tsx
interface EventService {
  id: string
  agreedPrice: string
  provider: { id: string; name: string; image: string | null }
  service: { id: string; title: string }
}

export function EventServicesList({ services }: { services: EventService[] }) {
  if (services.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-bold">Service Providers</h2>
      <div className="space-y-3">
        {services.map((es) => (
          <div key={es.id} className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {es.provider.image ? (
                <img src={es.provider.image} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium dark:bg-gray-700">
                  {es.provider.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-medium">{es.provider.name}</p>
                <p className="text-sm text-gray-500">{es.service.title}</p>
              </div>
            </div>
            <p className="font-semibold text-green-600">{"\u20AC"}{Number(es.agreedPrice).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
