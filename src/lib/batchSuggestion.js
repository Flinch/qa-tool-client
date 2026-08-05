// Heuristic batch suggestion for automated test generation.
//
// This is deliberately NOT a general similarity/clustering model. It's a
// cheap, deterministic, zero-extra-cost heuristic tied to a mechanism
// already proven to save generation cost (see qa-tool-server/DECISIONS.md,
// "skip re-verifying helper-covered setup steps"): test cases whose steps
// reference the same known setup helper are the ones that actually benefit
// from being batched together, since the shared setup gets skipped entirely
// instead of re-explored per TC. It only knows about today's helpers —
// extend KNOWN_SETUP_PATTERNS if new shared helpers get added.
const KNOWN_SETUP_PATTERNS = [
  {
    key: 'createTicket',
    keywords: [/new ticket/i, /create (a |an )?ticket/i, /existing ticket/i, /select (a |an )?ticket/i],
  },
]

function matchedSetupKeys(tc) {
  // KNOWN_SETUP_PATTERNS are all browser-navigation helpers (e.g.
  // helpers/createTicket.ts) — an api-type test case never calls one of
  // those, even if its title happens to share words like "create ticket"
  // with a UI test (e.g. "POST /api/tickets creates a new ticket"). Without
  // this guard, keyword matching alone would mislabel such a group as
  // "Share a 'createTicket' setup step," implying a shared browser helper
  // that doesn't apply — now reachable since API test cases are visible in
  // the generate-tests modal for api-engine suites.
  if (tc.type === 'api') return []
  const text = `${(tc.steps || []).join(' ')} ${tc.title || ''}`.toLowerCase()
  return KNOWN_SETUP_PATTERNS.filter(p => p.keywords.some(re => re.test(text))).map(p => p.key)
}

// Groups candidate TCs into batches of up to `maxSize`, prioritizing putting
// TCs that share a known setup pattern together. TCs matching no known
// pattern still get grouped (by leftover order), not excluded.
export function suggestBatches(candidates, maxSize = 3) {
  const grouped = new Map() // setup key -> tc[]
  const unmatched = []

  for (const tc of candidates) {
    const keys = matchedSetupKeys(tc)
    if (keys.length === 0) {
      unmatched.push(tc)
    } else {
      const key = keys[0] // good enough for this heuristic's purpose
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(tc)
    }
  }

  const batches = []
  for (const [key, tcs] of grouped) {
    for (let i = 0; i < tcs.length; i += maxSize) {
      batches.push({ tcs: tcs.slice(i, i + maxSize), reason: `Share a "${key}" setup step` })
    }
  }
  for (let i = 0; i < unmatched.length; i += maxSize) {
    const tcs = unmatched.slice(i, i + maxSize)
    if (tcs.length > 1) batches.push({ tcs, reason: 'No shared setup detected — grouped only to amortize fixed overhead' })
  }

  return batches
}
