// Elapsed-time heuristic for what to tell the user while a suite run is in
// flight. The server never reports a real "running" sub-phase (CI only calls
// back once, at the very end), so this is a best-effort read of started_at
// rather than a precise state machine.
export function describeRunPhase(status, startedAt) {
  if (status !== 'pending' && status !== 'running') return null
  if (!startedAt) return 'Starting run…'

  const elapsedMs = Date.now() - new Date(startedAt).getTime()

  if (elapsedMs < 15000) return 'Dispatching to GitHub Actions…'
  if (elapsedMs < 60000) return 'Waiting for a CI runner to pick up the job…'
  if (elapsedMs < 3 * 60000) return 'Running tests…'
  return 'Still running — this suite is taking longer than usual…'
}
