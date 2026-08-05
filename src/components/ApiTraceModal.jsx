// Shows the captured request/response for a failed API-engine test result
// (test_run_results.api_trace, written by helpers/apiTrace.ts on the server
// side). Follows GenerationLogModal's dark-terminal styling precedent
// (AutomationPage.jsx) since that's this codebase's one existing pattern
// for "needs more room than a standard modal because it holds code-shaped
// content" — no JSON-viewer library exists here, so this is hand-rolled.

function statusColor(status) {
  if (status == null) return 'var(--muted)'
  if (status >= 500) return 'var(--danger)'
  if (status >= 400) return 'var(--warning)'
  if (status >= 200) return 'var(--success)'
  return 'var(--muted)'
}

function CodeBlock({ value }) {
  const text = value === null || value === undefined
    ? '(empty)'
    : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <pre
      style={{
        background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 4,
        padding: '0.6rem 0.75rem', margin: 0, maxHeight: 240, overflow: 'auto',
        fontFamily: "'JetBrains Mono', 'Menlo', monospace", fontSize: '0.74rem',
        lineHeight: 1.5, color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}
    >
      {text}
    </pre>
  )
}

function HeaderRow({ label, value, secondaryLabel }) {
  const entries = Object.entries(value || {})
  if (entries.length === 0) return null
  return (
    <details style={{ marginTop: '0.4rem' }}>
      <summary style={{ fontSize: '0.72rem', color: 'var(--muted)', cursor: 'pointer' }}>
        {secondaryLabel || label} ({entries.length})
      </summary>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.3rem', paddingLeft: '0.5rem' }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '0.4rem' }}>
            <span style={{ color: 'var(--light)' }}>{k}:</span>
            <span style={{ wordBreak: 'break-all' }}>{v}</span>
          </div>
        ))}
      </div>
    </details>
  )
}

function TraceCard({ entry }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)',
          border: '1px solid var(--accent)', borderRadius: 0, padding: '0.1rem 0.4rem',
        }}>
          {entry.method}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--light)', wordBreak: 'break-all', flex: 1 }}>
          {entry.url}
        </span>
        {entry.status != null && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, color: statusColor(entry.status),
            border: `1px solid ${statusColor(entry.status)}`, borderRadius: 0, padding: '0.1rem 0.4rem',
            flexShrink: 0,
          }}>
            {entry.status}
          </span>
        )}
      </div>

      {entry.error ? (
        <div style={{
          fontSize: '0.78rem', color: 'var(--danger)', background: 'rgba(193,68,58,0.08)',
          border: '1px solid var(--danger)', borderRadius: 4, padding: '0.5rem 0.75rem',
        }}>
          {entry.error}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Request body</div>
            <CodeBlock value={entry.requestBody} />
            <HeaderRow value={entry.requestHeaders} secondaryLabel="Request headers" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Response body</div>
            <CodeBlock value={entry.responseBody} />
            <HeaderRow value={entry.responseHeaders} secondaryLabel="Response headers" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiTraceModal({ trace, testTitle, onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720, width: '90vw' }}>
        <div className="modal-title">Request/response — {testTitle}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          {trace.length} call{trace.length === 1 ? '' : 's'} made during this test.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 480, overflowY: 'auto' }}>
          {trace.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', textAlign: 'center' }}>
              No calls captured for this test.
            </div>
          ) : (
            trace.map((entry, i) => <TraceCard key={i} entry={entry} />)
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
