// One mutually-exclusive pill group: clicking a pill selects it, clicking
// the already-active pill clears the group back to 'all'. Independent
// FilterPillGroups on the same page are meant to be combined with AND logic
// by the caller (see BugsPage.jsx/ExecutionRunDetailPage.jsx) — this
// component only owns the single-select-within-itself behavior. Same
// filter-btn/active classes the pill row already used before this existed,
// so the visual result is unchanged from the old single hand-rolled row.
export default function FilterPillGroup({ options, value, onChange, labels = {} }) {
  return (
    <>
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
    </>
  )
}
