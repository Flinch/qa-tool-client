// "Date logged" filter for BugsPage: preset pills (24h/7d) plus a custom
// range revealed via two native date inputs. No date-picker library exists
// anywhere in this codebase — plain <input type="date"> matches the
// existing "no extra UI dependencies" convention. Single-select like
// FilterPillGroup (picking a preset clears any custom range and vice versa),
// but kept as its own component since it also owns the from/to inputs,
// which FilterPillGroup's plain-options shape has no room for.
export default function DateLoggedFilter({ value, onChange, groupLabel }) {
  const setPreset = (preset) =>
    onChange(preset === value.preset ? { preset: 'all', from: null, to: null } : { preset, from: null, to: null })

  const dateInputStyle = { width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.78rem' }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', paddingRight: '0.6rem', borderRight: '1px solid var(--border)' }}>
      {groupLabel && (
        <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          {groupLabel}
        </span>
      )}
      <button type="button" className={`filter-btn${value.preset === '24h' ? ' active' : ''}`} onClick={() => setPreset('24h')}>
        Last 24h
      </button>
      <button type="button" className={`filter-btn${value.preset === '7d' ? ' active' : ''}`} onClick={() => setPreset('7d')}>
        Last 7 days
      </button>
      <button type="button" className={`filter-btn${value.preset === 'custom' ? ' active' : ''}`} onClick={() => setPreset('custom')}>
        Custom range
      </button>
      {value.preset === 'custom' && (
        <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="date" className="form-select" style={dateInputStyle}
            value={value.from || ''} onChange={e => onChange({ ...value, from: e.target.value })}
          />
          <span style={{ color: 'var(--muted)' }}>to</span>
          <input
            type="date" className="form-select" style={dateInputStyle}
            value={value.to || ''} onChange={e => onChange({ ...value, to: e.target.value })}
          />
        </span>
      )}
    </div>
  )
}
