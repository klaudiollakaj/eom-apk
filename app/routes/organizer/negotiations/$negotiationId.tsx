import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { getNegotiation, respondToNegotiation, cancelNegotiation } from '~/server/fns/negotiations'
import { NegotiationThread } from '~/components/negotiations/NegotiationThread'
import { NegotiationActions } from '~/components/negotiations/NegotiationActions'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/organizer/negotiations/$negotiationId')({
  loader: async ({ params }) => {
    const negotiation = await getNegotiation({ data: { negotiationId: params.negotiationId } })
    return { negotiation }
  },
  component: OrganizerNegotiationDetailPage,
})

function OrganizerNegotiationDetailPage() {
  const [negotiation, setNegotiation] = useState(Route.useLoaderData().negotiation)
  const session = useSession()
  const userId = session.data?.user?.id ?? ''

  const lastRound = negotiation.rounds?.[negotiation.rounds.length - 1]
  const isMyTurn = lastRound ? lastRound.senderId !== userId : false

  const reload = useCallback(async () => {
    const updated = await getNegotiation({ data: { negotiationId: negotiation.id } })
    setNegotiation(updated)
  }, [negotiation.id])

  async function handleRespond(action: 'accept' | 'reject' | 'counter' | 'offer', price?: string, message?: string) {
    await respondToNegotiation({
      data: { negotiationId: negotiation.id, action, price, message },
    })
    await reload()
  }

  async function handleCancel() {
    await cancelNegotiation({ data: { negotiationId: negotiation.id } })
    await reload()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{negotiation.service?.title}</h1>
          <p className="text-sm text-gray-500">for {negotiation.event?.title}</p>
        </div>
        <NegotiationStatusBadge status={negotiation.status} />
      </div>

      <NegotiationThread rounds={negotiation.rounds ?? []} currentUserId={userId} />

      <div className="mt-6">
        <NegotiationActions
          negotiationId={negotiation.id}
          status={negotiation.status}
          canRespond={isMyTurn}
          onRespond={handleRespond}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
