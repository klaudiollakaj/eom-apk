import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { getSession } from '~/server/fns/auth-helpers'
import { getMyOrders } from '~/server/fns/tickets'
import { RoleHeader } from '~/components/layout/RoleHeader'

export const Route = createFileRoute('/orders/' as never)({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  loader: async () => {
    const orders = await getMyOrders()
    return { orders }
  },
  component: MyOrdersPage,
})

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    partially_refunded:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }

  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {label}
    </span>
  )
}

function MyOrdersPage() {
  const { orders } = Route.useLoaderData() as { orders: any[] }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">Order History</h1>

        {orders.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed p-10 text-center dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No orders yet.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order: any) => (
              <div
                key={order.id}
                className="rounded-lg border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Order #{order.orderNumber}
                    </p>
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: order.eventId }}
                      className="mt-1 text-lg font-semibold hover:underline"
                    >
                      {order.event.title}
                    </Link>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>Placed {formatDate(order.createdAt)}</span>
                  <span>
                    {order.tickets.length} ticket{order.tickets.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="mt-3 border-t pt-3 dark:border-gray-700">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                      <span>{formatCents(order.subtotalCents)}</span>
                    </div>
                    {order.discountCents > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Discount
                          {order.promoCode ? ` (${order.promoCode.code})` : ''}
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          -{formatCents(order.discountCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCents(order.totalCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <Link
                    to="/tickets"
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View tickets
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
