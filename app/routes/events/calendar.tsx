import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '~/components/layout/Header'
import { Footer } from '~/components/layout/Footer'
import { getNavLinks } from '~/server/fns/navigation'
import { listPublicEvents } from '~/server/fns/events'

export const Route = createFileRoute('/events/calendar')({
  loader: async () => {
    try {
      const now = new Date()
      const startAfter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startBefore = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const [headerLinks, footerLinks, { events }] = await Promise.all([
        getNavLinks({ data: { position: 'header' } }),
        getNavLinks({ data: { position: 'footer' } }),
        listPublicEvents({ data: { startAfter, startBefore, limit: 200 } }),
      ])
      return { headerLinks, footerLinks, initialEvents: events, initialMonth: now.getMonth(), initialYear: now.getFullYear() }
    } catch {
      return { headerLinks: [], footerLinks: [], initialEvents: [], initialMonth: new Date().getMonth(), initialYear: new Date().getFullYear() }
    }
  },
  component: CalendarPage,
})

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Deterministic color from event id
const PILL_COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500',
]

function colorForEvent(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length]
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatPrice(price: string | null | undefined) {
  if (!price || Number(price) === 0) return 'Free'
  return `$${Number(price).toFixed(2)}`
}

function CalendarPage() {
  const { headerLinks, footerLinks, initialEvents, initialMonth, initialYear } = Route.useLoaderData()

  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [events, setEvents] = useState<any[]>(initialEvents)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch events when month/year changes (skip initial)
  useEffect(() => {
    if (month === initialMonth && year === initialYear) {
      setEvents(initialEvents)
      return
    }

    let cancelled = false
    setLoading(true)

    const startAfter = new Date(year, month, 1).toISOString()
    const startBefore = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    listPublicEvents({ data: { startAfter, startBefore, limit: 200 } })
      .then((result) => {
        if (!cancelled) {
          setEvents(result.events)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [month, year])

  // Group events by day-of-month
  const eventsByDay = useMemo(() => {
    const map = new Map<number, any[]>()
    for (const event of events) {
      const d = new Date(event.startDate)
      const day = d.getDate()
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(event)
    }
    return map
  }, [events])

  // Calendar grid math
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year
  const todayDate = today.getDate()

  // Events for selected date
  const selectedDayEvents = selectedDate
    ? eventsByDay.get(Number(selectedDate)) ?? []
    : []

  function prevMonth() {
    setSelectedDate(null)
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  function nextMonth() {
    setSelectedDate(null)
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  function goToToday() {
    const now = new Date()
    setMonth(now.getMonth())
    setYear(now.getFullYear())
    setSelectedDate(String(now.getDate()))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header links={headerLinks} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Event Calendar</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Browse events by date</p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            List View
          </Link>
        </div>

        {/* Month navigation */}
        <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <button
            onClick={prevMonth}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Previous month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
              {MONTH_NAMES[month]} {year}
            </h2>
            {!isCurrentMonth && (
              <button
                onClick={goToToday}
                className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              >
                Today
              </button>
            )}
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            )}
          </div>

          <button
            onClick={nextMonth}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Next month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDayOfMonth + 1
              const isValidDay = dayNum >= 1 && dayNum <= daysInMonth
              const dayEvents = isValidDay ? eventsByDay.get(dayNum) ?? [] : []
              const isToday = isCurrentMonth && dayNum === todayDate
              const isSelected = selectedDate === String(dayNum)

              return (
                <button
                  key={i}
                  disabled={!isValidDay}
                  onClick={() => isValidDay && setSelectedDate(isSelected ? null : String(dayNum))}
                  className={`
                    relative flex min-h-[4.5rem] flex-col items-start border-b border-r border-gray-100 p-1.5
                    text-left transition-colors sm:min-h-[5.5rem] sm:p-2
                    dark:border-gray-700/50
                    ${!isValidDay ? 'bg-gray-50 dark:bg-gray-800/50' : 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}
                    ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-900/20' : ''}
                  `}
                >
                  {isValidDay && (
                    <>
                      <span
                        className={`
                          inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm
                          ${isToday
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 dark:text-gray-300'}
                        `}
                      >
                        {dayNum}
                      </span>

                      {/* Event dots / pills */}
                      {dayEvents.length > 0 && (
                        <div className="mt-0.5 flex w-full flex-col gap-0.5">
                          {/* Mobile: dots only */}
                          <div className="flex gap-0.5 sm:hidden">
                            {dayEvents.slice(0, 4).map((ev: any) => (
                              <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${colorForEvent(ev.id)}`} />
                            ))}
                            {dayEvents.length > 4 && (
                              <span className="text-[9px] text-gray-400">+{dayEvents.length - 4}</span>
                            )}
                          </div>

                          {/* Desktop: pills */}
                          <div className="hidden flex-col gap-0.5 sm:flex">
                            {dayEvents.slice(0, 3).map((ev: any) => (
                              <span
                                key={ev.id}
                                className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white ${colorForEvent(ev.id)}`}
                              >
                                {ev.title}
                              </span>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="px-1 text-[10px] text-gray-500 dark:text-gray-400">
                                +{dayEvents.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day event list */}
        {selectedDate && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              {MONTH_NAMES[month]} {selectedDate}, {year}
            </h3>

            {selectedDayEvents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No events on this date.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {selectedDayEvents.map((event: any) => (
                  <Link
                    key={event.id}
                    to="/events/$eventId"
                    params={{ eventId: event.id }}
                    className="group flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Color bar */}
                    <div className={`mt-1 h-10 w-1 flex-shrink-0 rounded-full ${colorForEvent(event.id)}`} />

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                        {event.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatTime(event.startDate)}</span>
                        {event.city && (
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            {event.city}
                          </span>
                        )}
                        <span>{formatPrice(event.price)}</span>
                        {event.category && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                            {event.category.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <svg
                      className="mt-2 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500"
                      fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {events.length} event{events.length !== 1 ? 's' : ''} in {MONTH_NAMES[month]} {year}
        </div>
      </div>

      <Footer links={footerLinks} />
    </div>
  )
}
