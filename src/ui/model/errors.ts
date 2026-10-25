/**
 * Error details that are safe to log: the error type and the code locations only.
 * The message is dropped on purpose, because it can quote values from the uploaded files.
 */
export function safeErrorReport(error: unknown): string {
  if (!(error instanceof Error)) return 'non-Error value thrown'
  const frames = (error.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    // V8: "at fn (url:1:2)"; Firefox/Safari: "fn@url:1:2". The V8 first line ("Name: message") matches neither.
    .filter((line) => line.startsWith('at ') || /@.*:\d+:\d+$/.test(line))
  return [error.name, ...frames].join('\n')
}

/** Logs an application error to the browser console without any data from the files. */
export function reportAppError(context: string, error: unknown): void {
  // oxlint-disable-next-line no-console -- the app's single logging point; safeErrorReport strips the message
  console.error(`[Přehled školení] ${context}\n${safeErrorReport(error)}`)
}
