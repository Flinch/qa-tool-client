import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { timeAgo } from '../lib/timeAgo.js'
import DashboardNotes from '../components/DashboardNotes.jsx'

function activityDotColor(ev) {
  if (ev.kind === 'bug_resolved') return 'var(--success)'
  if (ev.kind === 'execution_run') return 'var(--accent2)'
  if (ev.kind === 'bug_reported') return (ev.severity === 'critical' || ev.severity === 'high') ? 'var(--severity-high)' : 'var(--border2)'
  return 'var(--border2)'
}

function runPassColor(passed, total) {
  if (total === 0) return 'var(--muted)'
  const rate = passed / total
  if (rate >= 0.9) return 'var(--success)'
  if (rate >= 0.7) return 'var(--warning)'
  return 'var(--danger)'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, p] = await Promise.all([
          apiFetch('/stats'),
          apiFetch('/projects'),
        ])
        setStats(s)
        setRecentProjects(p.slice(0, 4))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Dashboard</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  const firstName = user?.name?.split(' ')[0]
  const openBugsTotal = stats ? ['critical', 'high', 'medium', 'low'].reduce((sum, s) => sum + (stats.bugsBySeverity?.[s] || 0), 0) : 0

  return (
    <>
      <div className="topbar"><span className="topbar-title">Dashboard</span></div>
      <div className="page-content fade-in" style={{ maxWidth: 1280 }}>
        <div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}>
            Hey{firstName ? `, ${firstName}` : ''}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Here's what's happening across your projects.</p>
        </div>

        <div className="section-header" style={{ marginTop: '1.5rem' }}>
          <div>
            <div className="section-title">Most active projects</div>
            <div className="section-sub">Ranked by most recent activity</div>
          </div>
          <Link to="/projects" className="btn btn-ghost btn-sm">View all</Link>
        </div>
        {recentProjects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project to get started.</p>
            <Link to="/projects" className="btn btn-primary">Create project</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '0.5rem' }}>
            {recentProjects.map(p => (
              <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div className="card-sm" style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, color: 'var(--white)', marginBottom: '0.25rem', fontSize: '0.92rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>{p.client_name}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                    <span><strong style={{ color: 'var(--light)' }}>{p.test_case_count ?? 0}</strong> tests</span>
                    <span><strong style={{ color: 'var(--danger)' }}>{p.open_bug_count ?? 0}</strong> open bugs</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="dash-kpi-band">
          <div className="dash-kpi accent">
            <div className="dash-kpi-label">Projects</div>
            <div className="dash-kpi-num">{stats?.projects ?? 0}</div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Test cases</div>
            <div className="dash-kpi-num">{stats?.testCases ?? 0}</div>
            <div className="dash-kpi-sub">{stats?.passRate !== null && stats?.passRate !== undefined ? `${stats.passRate}% overall pass rate` : 'No runs yet'}</div>
            {stats?.testCases > 0 && (
              <div className="progress-bar" style={{ marginTop: '0.6rem' }}>
                <div className="progress-fill green" style={{ width: `${stats.passRate ?? 0}%` }} />
              </div>
            )}
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Open bugs</div>
            <div className="dash-kpi-num" style={{ color: openBugsTotal > 0 ? 'var(--severity-high)' : 'var(--white)' }}>{openBugsTotal}</div>
            {openBugsTotal > 0 && (
              <div className="sev-bars">
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = stats.bugsBySeverity?.[sev] || 0
                  const height = openBugsTotal > 0 ? Math.max(12, Math.round((count / openBugsTotal) * 100)) : 0
                  return <div key={sev} className="sev-bar" title={`${sev}: ${count}`} style={{ height: `${count > 0 ? height : 4}%`, background: `var(--severity-${sev})`, opacity: count > 0 ? 1 : 0.25 }} />
                })}
              </div>
            )}
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Automated</div>
            <div className="dash-kpi-num">{stats?.automationCoverage !== null && stats?.automationCoverage !== undefined ? `${stats.automationCoverage}%` : '—'}</div>
            <div className="dash-kpi-sub">{stats?.totalTestCases > 0 ? `${stats.automatedTestCases} of ${stats.totalTestCases} cases` : 'No test cases yet'}</div>
            {stats?.totalTestCases > 0 && (
              <div className="progress-bar" style={{ marginTop: '0.6rem' }}>
                <div className="progress-fill" style={{ width: `${stats.automationCoverage}%` }} />
              </div>
            )}
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Pass rate</div>
            <div className="dash-kpi-num" style={{ color: 'var(--success)' }}>{stats?.passRate !== null && stats?.passRate !== undefined ? `${stats.passRate}%` : '—'}</div>
            <div className="dash-kpi-sub">Across all projects</div>
            {stats?.testCases > 0 && (
              <div className="progress-bar" style={{ marginTop: '0.6rem' }}>
                <div className="progress-fill green" style={{ width: `${stats.passRate ?? 0}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="health-body-grid">
          <div>
            <div className="health-panel">
              <div className="health-panel-head">
                <div className="health-panel-title">Recent activity</div>
              </div>
              {!stats?.recentActivity?.length ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nothing has happened yet.</div>
              ) : (
                <div>
                  {stats.recentActivity.map((ev, i) => (
                    <div className="health-activity-row" key={i}>
                      <div className="health-activity-dot-wrap">
                        <span className="health-activity-dot" style={{ background: activityDotColor(ev) }} />
                        {i < stats.recentActivity.length - 1 && <span className="health-activity-line" />}
                      </div>
                      <div>
                        <div className="health-activity-text">{ev.text}</div>
                        <div className="health-activity-time">
                          <span style={{ color: 'var(--accent2)' }}>{ev.projectName?.toUpperCase()}</span> · {timeAgo(ev.time).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="health-panel">
              <div className="health-panel-head">
                <div className="health-panel-title">Recent test runs</div>
              </div>
              {!stats?.recentRuns?.length ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No completed execution runs yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Project</th><th>Run</th><th>Result</th><th>When</th></tr></thead>
                    <tbody>
                      {stats.recentRuns.map((r, i) => (
                        <tr key={i}>
                          <td>{r.projectName}</td>
                          <td>{r.runName}</td>
                          <td>
                            <span className="run-pass" style={{ color: runPassColor(r.passed, r.total) }}>
                              {r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0}%
                            </span>{' '}
                            <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{r.passed}/{r.total}</span>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{timeAgo(r.completedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="health-panel">
              <div className="health-panel-head">
                <div className="health-panel-title">Needs attention</div>
              </div>
              {!stats?.needsAttention?.length ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                  Nothing urgent open right now.
                </div>
              ) : (
                stats.needsAttention.map(b => (
                  <div className="health-attn-row" key={b.id}>
                    <div className="health-sev-stripe" style={{ background: `var(--severity-${b.severity})` }} />
                    <div>
                      <div className="health-attn-title">{b.title}</div>
                      <div className="health-attn-meta">
                        <span className="health-sev-tag" style={{ color: `var(--severity-${b.severity})` }}>{b.severity}</span>
                        {' '}· {b.projectName} · opened {timeAgo(b.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DashboardNotes />
          </div>
        </div>
      </div>
    </>
  )
}
