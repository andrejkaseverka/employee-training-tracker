import type { LocalDate } from './config.ts'
import { compareDates, daysBetween } from './date.ts'
import { compareValidity, type Completion } from './completion.ts'

/**
 * `valid` – valid beyond the warning window (or never expires),
 * `expiring` – valid, but ends within the warning window,
 * `expired` – validity ended before today,
 * `missing` – no usable completion,
 * `undetermined` – a completion exists but its validity cannot be determined.
 */
export type TrainingStatus = 'valid' | 'expiring' | 'expired' | 'missing' | 'undetermined'

export const TRAINING_STATUSES: readonly TrainingStatus[] = ['expired', 'missing', 'undetermined', 'expiring', 'valid']

export interface StatusEvaluation {
  readonly status: TrainingStatus
  readonly completion: Completion | null
  /** Days from today to the last valid day (0 = last day today, negative = expired); null if not applicable. */
  readonly daysLeft: number | null
}

/** The newest completion counts (renewals replace older ones); same day → the longer validity. */
export function pickEffectiveCompletion(completions: readonly Completion[]): Completion | null {
  let best: Completion | null = null
  for (const completion of completions) {
    if (best === null) {
      best = completion
      continue
    }
    const byDate = compareDates(completion.completedOn, best.completedOn)
    if (byDate > 0 || (byDate === 0 && compareValidity(completion, best) > 0)) best = completion
  }
  return best
}

export function evaluateStatus(
  completion: Completion | null,
  today: LocalDate,
  expiringSoonDays: number,
): StatusEvaluation {
  if (completion === null) return { status: 'missing', completion, daysLeft: null }
  if (completion.validitySource === 'unknown') return { status: 'undetermined', completion, daysLeft: null }
  if (completion.validUntil === null) return { status: 'valid', completion, daysLeft: null }

  const daysLeft = daysBetween(today, completion.validUntil)
  if (daysLeft < 0) return { status: 'expired', completion, daysLeft }
  if (daysLeft <= expiringSoonDays) return { status: 'expiring', completion, daysLeft }
  return { status: 'valid', completion, daysLeft }
}
