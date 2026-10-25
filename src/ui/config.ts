import { EXPIRING_SOON_DAYS } from '../domain/config.ts'

/** "Expiring soon" windows offered in the UI (assumption #2); the domain default is preselected. */
export const EXPIRY_WINDOW_OPTIONS: readonly number[] = [30, EXPIRING_SOON_DAYS, 90]
