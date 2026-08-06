// One mutually-exclusive pill group: clicking a pill selects it, clicking
// the already-active pill clears the group back to 'all'. Independent
// FilterPillGroups on the same page are meant to be combined with AND logic
// by the caller (see BugsPage.jsx/ExecutionRunDetailPage.jsx) — this
// component only owns the single-select-within-itself behavior. Same
// filter-btn/active classes the pill row already used before this existed,
// so the visual result is unchanged from the old single hand-rolled row.
//
// `groupLabel` (distinct from `labels`, which relabels individual options)
// names the group itself — confirmed live (2026-08-06) that without one,
// adjacent groups in the same row were indistinguishable, most visibly two
// identical "All" pills back to back (one resets severity, one resets
// status) with nothing showing which was which. Wrapped in its own flex
// container (not a bare fragment) so the label and its pills can't get
// separated by flex-wrap on a narrow row, and a trailing divider visually
// separates this group from whatever sits next to it.
export default function FilterPillGroup({ options, value, onChange, labels = {}, groupLabel }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', paddingRight: '0.6rem', borderRight: '1px solid var(--border)' }}>
      {groupLabel && (
        <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          {groupLabel}
        </span>
      )}
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          className={`filter-btn${value === opt ? ' active' : ''}`}
          onClick={() => onChange(opt === 'all' ? 'all' : (value === opt ? 'all' : opt))}
        >
          {labels[opt] || (opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' '))}
        </button>
      ))}
    </div>
  )
}
