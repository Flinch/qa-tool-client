import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api.js'

const STATUS_META = {
  excellent:        { label: 'Excellent',         color: 'var(--success)' },
  good:             { label: 'Good',               color: 'var(--warning)' },
  needs_attention:  { label: 'Needs attention',    color: 'var(--danger)' },
  insufficient_data:{ label: 'Not enough data yet', color: 'var(--muted)' },
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

function Sparkline({ points }) {
  const w = 100, h = 32, pad = 2
  const xs = points.map((_, i) => points.length > 1 ? pad + (i / (points.length - 1)) * (w - pad * 2) : w / 2)
  const ys = points.map(p => pad + (1 - p.passRate / 100) * (h - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 64 }}>
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="1.6" fill="var(--accent)" />
      ))}
    </svg>
  )
}

export default function QualityHealth({ projectId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch(`/projects/${projectId}/health`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
  }
  if (!data) {
    return <div className="empty-state"><h3>Couldn't load quality data</h3></div>
  }

  const status = STATUS_META[data.healthStatus] || STATUS_META.insufficient_data
  const tc = data.testCases

  return (
    <div className="fade-in">
      <div className="health-hero">
        <div className="health-status-pill" style={{ borderColor: status.color, color: status.color }}>
          <span className="health-status-dot" style={{ background: status.color }} />
          {status.label}
        </div>
        <div className="health-hero-number">{data.passRate !== null ? `${data.passRate}%` : '—'}</div>
        <div className="health-hero-sub">
          {tc.total > 0 ? `Pass rate across ${tc.total} test case${tc.total === 1 ? '' : 's'}` : 'No test cases yet'}
        </div>
      </div>

      <div className="health-tiles">
        <div className="card-sm">
          <div className="health-tile-title">Test results</div>
          <div className="health-tile-row"><span style={{ color: 'var(--muted)' }}>Passed</span><strong style={{ color: 'var(--success)' }}>{tc.passed}</strong></div>
          <div className="health-tile-row"><span style={{ color: 'var(--muted)' }}>Failed</span><strong style={{ color: 'var(--danger)' }}>{tc.failed}</strong></div>
          <div className="health-tile-row"><span style={{ color: 'var(--muted)' }}>Not run</span><strong style={{ color: 'var(--muted)' }}>{tc.notRun}</strong></div>
        </div>

        <div className="card-sm">
          <div className="health-tile-title">Open issues</div>
          {SEVERITY_ORDER.map(sev => (
            <div className="health-tile-row" key={sev}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
                <span className="health-dot" style={{ background: `var(--severity-${sev})` }} />
                {SEVERITY_LABEL[sev]}
              </span>
              <strong style={{ color: data.bugsBySeverity[sev] > 0 ? `var(--severity-${sev})` : 'var(--muted)' }}>
                {data.bugsBySeverity[sev]}
              </strong>
            </div>
          ))}
        </div>

        <div className="card-sm">
          <div className="health-tile-title">Automation coverage</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.4rem' }}>
            {data.automationCoverage !== null ? `${data.automationCoverage}%` : '—'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {data.automatedTestCases} of {data.totalTestCases} test case{data.totalTestCases === 1 ? '' : 's'} automated
          </div>
          {data.totalTestCases > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${data.automationCoverage}%` }} />
            </div>
          )}
        </div>

        <div className="card-sm">
          <div className="health-tile-title">Requirement coverage</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.4rem' }}>
            {data.requirementCoverage !== null ? `${data.requirementCoverage}%` : '—'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {data.totalRequirements > 0
              ? `${data.coveredRequirements} of ${data.totalRequirements} requirement${data.totalRequirements === 1 ? '' : 's'} covered`
              : 'No requirements tracked yet'}
          </div>
          {data.totalRequirements > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${data.requirementCoverage}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="card-sm">
        <div className="health-tile-title">Pass rate trend</div>
        {data.passRateTrend.length >= 2 ? (
          <>
            <Sparkline points={data.passRateTrend} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--faint)', marginTop: '0.4rem' }}>
              <span>{new Date(data.passRateTrend[0].date).toLocaleDateString()}</span>
              <span>{new Date(data.passRateTrend[data.passRateTrend.length - 1].date).toLocaleDateString()}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '0.75rem 0' }}>
            Run your first execution to start tracking trends over time.
          </div>
        )}
      </div>
    </div>
  )
}
