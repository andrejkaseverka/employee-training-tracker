import type { EnrolmentPlan, SessionUsage } from '../../use-cases/recommend-enrolments.ts'

/** Sessions by id; for a repeated id the first one wins (only that one can be offered). */
export function indexSessions(plan: EnrolmentPlan): ReadonlyMap<string, SessionUsage> {
  const index = new Map<string, SessionUsage>()
  for (const usage of plan.sessions) {
    if (!index.has(usage.session.id)) index.set(usage.session.id, usage)
  }
  return index
}
