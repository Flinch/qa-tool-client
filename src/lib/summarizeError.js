const MAX_LENGTH = 140

// Raw CI error messages are multi-line Playwright/CI output (the real
// message on line 1, followed by "Call log:"/"Call Log:" boilerplate and
// stack noise) — shown collapsed to one line via CSS, that whole blob reads
// as a wall of text and blows out any container that doesn't clamp its
// width. This extracts just the actual message and caps its length so the
// UI only ever has to render something short.
export function summarizeError(message) {
  if (!message) return ''
  const firstLine = message.split('\n').find(l => l.trim()) || ''
  const trimmed = firstLine.split(/Call [Ll]og:/)[0].trim()
  if (trimmed.length <= MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_LENGTH - 1).trimEnd()}…`
}
