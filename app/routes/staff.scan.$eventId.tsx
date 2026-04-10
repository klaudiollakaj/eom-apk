import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getSession } from '~/server/fns/auth-helpers'
import { getEvent } from '~/server/fns/events'
import { validateTicket, getEventAttendeeList } from '~/server/fns/tickets'
import { ScannerCamera } from '~/components/tickets/ScannerCamera'
import { RoleHeader } from '~/components/layout/RoleHeader'

type ScanResult =
  | { kind: 'success'; attendeeName: string; tierName: string; at: Date }
  | { kind: 'failure'; reason: string; details?: string }

export const Route = createFileRoute('/staff/scan/$eventId')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const [event, attendees] = await Promise.all([
      getEvent({ data: { eventId: params.eventId } }),
      getEventAttendeeList({ data: { eventId: params.eventId } }),
    ])
    return { event, attendees }
  },
  component: ScannerPage,
})

function friendlyReason(reason: string): string {
  const map: Record<string, string> = {
    INVALID_SIGNATURE: 'Invalid QR code',
    WRONG_EVENT: 'Ticket is for a different event',
    NOT_FOUND: 'Ticket not found',
    ALREADY_CHECKED_IN: 'Already checked in',
    REFUNDED: 'Ticket was refunded',
    INVALID_STATUS: 'Ticket is not valid',
  }
  return map[reason] || reason
}

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = success ? 880 : 220
    gain.gain.value = 0.1
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {}
}

function ScannerPage() {
  const { event, attendees: initialAttendees } = Route.useLoaderData()
  const [scans, setScans] = useState<Array<{ at: Date; result: ScanResult }>>([])
  const [current, setCurrent] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [search, setSearch] = useState('')
  const [attendees, setAttendees] = useState(initialAttendees)
  const [lastToken, setLastToken] = useState<string | null>(null)

  async function handleToken(token: string, manual = false) {
    if (scanning) return
    if (!manual && token === lastToken) return
    setLastToken(token)
    setScanning(true)
    try {
      const result = await validateTicket({
        data: { token, eventId: event.id, manual },
      })
      let scanResult: ScanResult
      if (result.success) {
        scanResult = {
          kind: 'success',
          attendeeName: result.attendee.name,
          tierName: result.tier.name,
          at: new Date(result.checkedInAt),
        }
      } else {
        scanResult = {
          kind: 'failure',
          reason: friendlyReason(result.reason),
          details:
            result.reason === 'ALREADY_CHECKED_IN' && result.details?.checkedInAt
              ? new Date(result.details.checkedInAt).toLocaleTimeString()
              : undefined,
        }
      }
      setCurrent(scanResult)
      setScans((s) => [{ at: new Date(), result: scanResult }, ...s].slice(0, 10))
      playBeep(scanResult.kind === 'success')
      // Clear current result after 3s
      setTimeout(() => {
        setCurrent(null)
        setLastToken(null)
      }, 3000)
    } catch (err: any) {
      setCurrent({ kind: 'failure', reason: err?.message || 'Scan failed' })
      playBeep(false)
    } finally {
      setScanning(false)
    }
  }

  async function handleSearch(value: string) {
    setSearch(value)
    const result = await getEventAttendeeList({
      data: { eventId: event.id, search: value || undefined },
    })
    setAttendees(result)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scan Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{event.title}</p>
        </div>
        <Link
          to="/organizer/events/$eventId/sales"
          params={{ eventId: event.id }}
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ScannerCamera onScan={(t) => handleToken(t, false)} paused={showManual} />

        {current && (
          <div
            className={`w-full max-w-md rounded-lg border-2 p-4 text-center ${
              current.kind === 'success'
                ? 'border-green-600 bg-green-50 dark:bg-green-950'
                : 'border-red-600 bg-red-50 dark:bg-red-950'
            }`}
          >
            {current.kind === 'success' ? (
              <>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  ✓ Checked in
                </div>
                <div className="mt-1 font-medium">{current.attendeeName}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {current.tierName}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-red-700 dark:text-red-300">
                  ✗ {current.reason}
                </div>
                {current.details && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {current.details}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setShowManual(!showManual)}
          className="rounded border px-4 py-2 text-sm dark:border-gray-700"
        >
          {showManual ? 'Close Manual Lookup' : 'Manual Lookup'}
        </button>
      </div>

      {showManual && (
        <div className="mt-6 rounded-lg border p-4 dark:border-gray-700">
          <input
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="mt-3 max-h-64 divide-y overflow-y-auto dark:divide-gray-700">
            {attendees.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No matches</p>
            ) : (
              attendees.map((a: any) => (
                <div
                  key={a.ticketId}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{a.attendee.name}</div>
                    <div className="text-xs text-gray-500">
                      {a.attendee.email} · {a.tier.name}
                    </div>
                  </div>
                  {a.status === 'checked_in' ? (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      ✓ Checked in
                    </span>
                  ) : a.status === 'refunded' ? (
                    <span className="text-xs text-red-600">Refunded</span>
                  ) : (
                    <button
                      onClick={() => handleToken(a.ticketId, true)}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                    >
                      Check In
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {scans.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-500">Recent scans</h2>
          <div className="space-y-2">
            {scans.map((s, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded border px-3 py-2 text-sm dark:border-gray-700 ${
                  s.result.kind === 'success'
                    ? 'border-green-300'
                    : 'border-red-300'
                }`}
              >
                <span>
                  {s.result.kind === 'success'
                    ? `✓ ${s.result.attendeeName} (${s.result.tierName})`
                    : `✗ ${s.result.reason}`}
                </span>
                <span className="text-xs text-gray-500">
                  {s.at.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
