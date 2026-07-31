// Merges bugs + execution runs + requirements into one chronological feed.
// No dedicated activity-log table exists server-side, so this is built from
// the same list endpoints the rest of the app already uses. Shared between
// QualityHealth's 5-item preview and the full QualityTimelinePage — never
// includes AI-pipeline events (generation/heal runs), only real state
// changes, so it stays safe as client-visible content.
export function buildActivity(bugs, runs, requirements, limit = 5) {
  const events = []

  for (const b of bugs) {
    if (b.status === 'resolved') {
      events.push({ time: b.updated_at, text: `Bug #${b.id} "${b.title}" resolved`, dotColor: 'var(--success)', bugId: b.id })
    } else {
      events.push({
        time: b.created_at,
        text: `Bug #${b.id} "${b.title}" reported`,
        dotColor: (b.severity === 'critical' || b.severity === 'high') ? 'var(--severity-high)' : 'var(--border2)',
        bugId: b.id,
      })
    }
  }

  for (const r of runs) {
    if (r.status === 'completed' && r.completed_at) {
      events.push({
        time: r.completed_at,
        text: `Execution run "${r.name}" finished — ${r.passed}/${r.total_test_cases} passed`,
        dotColor: 'var(--accent2)',
        runId: r.id,
      })
    }
  }

  // Requirements added within ~10 minutes of each other came from the same
  // upload/generation batch — group them into one line instead of five.
  const sortedReqs = [...requirements].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const bucketMs = 10 * 60 * 1000
  let i = 0
  while (i < sortedReqs.length) {
    let j = i + 1
    while (j < sortedReqs.length && new Date(sortedReqs[j].created_at) - new Date(sortedReqs[i].created_at) < bucketMs) j++
    const group = sortedReqs.slice(i, j)
    const latest = group[group.length - 1]
    events.push({
      time: latest.created_at,
      text: group.length === 1 ? `Requirement "${latest.title}" added` : `${group.length} requirements added`,
      dotColor: 'var(--border2)',
    })
    i = j
  }

  return events.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, limit)
}
