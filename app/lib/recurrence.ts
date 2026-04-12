import { RRule } from 'rrule'

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  count?: number
  until?: string // ISO date string
  byDay?: number[] // 0=MO, 1=TU, ... 6=SU (rrule weekday constants)
}

const FREQ_MAP = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  biweekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
} as const

export function buildRRuleString(config: RecurrenceConfig): string {
  const rule = new RRule({
    freq: FREQ_MAP[config.frequency],
    interval: config.frequency === 'biweekly' ? 2 : 1,
    count: config.count || undefined,
    until: config.until ? new Date(config.until) : undefined,
    byweekday: config.byDay,
  })
  return rule.toString()
}

export function generateOccurrenceDates(
  rruleString: string,
  startDate: Date,
  maxCount = 52,
): Date[] {
  const rule = RRule.fromString(rruleString)
  // Override dtstart to the event's actual start date
  const adjusted = new RRule({
    ...rule.origOptions,
    dtstart: startDate,
    count: rule.origOptions.count
      ? Math.min(rule.origOptions.count, maxCount)
      : maxCount,
  })
  // Skip the first date since it's the original event
  return adjusted.all().slice(1)
}
