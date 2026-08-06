import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiFetch } from './api.js'

const ACCENT = [184, 70, 31]
const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : '—'
}

// Executive-facing weekly summary — built entirely from data the client
// Dashboard already has loaded (health, bugs, execution runs, automation
// runs). Headline number first, supporting detail below, deliberately not a
// raw data dump: this is meant to be forwardable to a client's own
// leadership, not read by a QA engineer. Async: fetches an AI-written
// narrative paragraph from the exact same aggregates the PDF's own tables
// use (never re-derived server-side), so the two can't disagree — a failed
// or skipped narrative call just omits that one section, the rest of the
// PDF is unaffected (see executiveSummary.js's fail-open contract).
export async function generateWeeklySummaryPdf({ projectId, project, data, bugs = [], runs = [], automationRuns = [] }) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const inLastWeek = (dateStr) => dateStr && new Date(dateStr) >= weekAgo

  const weekRuns = runs.filter(r => inLastWeek(r.created_at))
  const weekAutomationRuns = automationRuns.filter(r => inLastWeek(r.started_at))
  const bugsOpenedThisWeek = bugs.filter(b => inLastWeek(b.created_at))
  const bugsResolvedThisWeek = bugs.filter(b => b.status === 'resolved' && inLastWeek(b.updated_at))

  const bugCountsByStatus = { open: 0, in_progress: 0, resolved: 0 }
  const bugCountsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const b of bugs) {
    if (bugCountsByStatus[b.status] !== undefined) bugCountsByStatus[b.status]++
    if (b.status !== 'resolved' && bugCountsBySeverity[b.severity] !== undefined) bugCountsBySeverity[b.severity]++
  }

  const { narrative } = await apiFetch(`/projects/${projectId}/weekly-summary-narrative`, {
    method: 'POST',
    body: JSON.stringify({
      project: { name: project?.name, client_name: project?.client_name },
      healthStatus: data.healthStatus,
      qualityScore: data.qualityScore,
      passRateThisWeek: data.passRateThisWeek,
      passRatePriorWeek: data.passRatePriorWeek,
      bugCountsByStatus,
      bugCountsBySeverity,
      bugsOpenedThisWeek: bugsOpenedThisWeek.length,
      bugsResolvedThisWeek: bugsResolvedThisWeek.length,
      bugHotspots: data.bugHotspots || [],
      automationCoverage: data.automationCoverage,
      requirementCoverage: data.requirementCoverage,
      weekAutomationRuns,
    }),
  }).catch(() => ({ narrative: null }))

  const doc = new jsPDF()
  const marginX = 14
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Weekly Quality Summary', marginX, y)
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(project?.name || 'Project', marginX, y)
  y += 6

  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${fmtDate(weekAgo)} – ${fmtDate(now)} · Generated ${now.toLocaleString()}`, marginX, y)
  doc.setTextColor(0)
  y += 12

  // Headline: quality score + status, the one number this whole report
  // hangs off of — everything else below is supporting detail, not
  // competing top-line information.
  doc.setFillColor(...ACCENT)
  doc.rect(marginX, y, 182, 22, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(data.qualityScore !== null ? `${data.qualityScore}` : '—', marginX + 6, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Quality Score', marginX + 30, y + 10)
  const statusLabel = { insufficient_data: 'Insufficient data', needs_attention: 'Needs attention', good: 'Good', excellent: 'Excellent' }[data.healthStatus] || ''
  doc.text(statusLabel, marginX + 30, y + 17)
  if (data.passRateThisWeek !== null) {
    doc.text(`${data.passRateThisWeek}% pass rate this week`, marginX + 110, y + 10)
  }
  doc.text(`${data.requirementCoverage ?? '—'}% requirement coverage`, marginX + 110, y + 17)
  doc.setTextColor(0)
  y += 32

  // Omitted entirely (not a placeholder/error message) when the narrative
  // call failed or wasn't configured — the tables/numbers below stand on
  // their own either way, per generateExecutiveSummary's fail-open contract.
  if (narrative) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Executive summary', marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(narrative, 182)
    doc.text(lines, marginX, y)
    y += lines.length * 5 + 8
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Execution runs this week', marginX, y)
  y += 4
  if (weekRuns.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('No execution runs this week.', marginX, y + 5)
    y += 12
  } else {
    autoTable(doc, {
      startY: y + 2,
      head: [['Run', 'Passed', 'Failed', 'Blocked', 'Not run']],
      body: weekRuns.map(r => [r.name, r.passed, r.failed, r.blocked, r.not_run]),
      theme: 'striped',
      headStyles: { fillColor: ACCENT },
      margin: { left: marginX, right: marginX },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  if (y > 240) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Bug status', marginX, y)
  y += 4
  autoTable(doc, {
    startY: y + 2,
    head: [['Open', 'In progress', 'Resolved', 'Opened this week', 'Resolved this week']],
    body: [[bugCountsByStatus.open, bugCountsByStatus.in_progress, bugCountsByStatus.resolved, bugsOpenedThisWeek.length, bugsResolvedThisWeek.length]],
    theme: 'grid',
    headStyles: { fillColor: ACCENT },
    margin: { left: marginX, right: marginX },
  })
  y = doc.lastAutoTable.finalY + 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Currently open, by severity:', marginX, y)
  y += 5
  autoTable(doc, {
    startY: y,
    head: [['Critical', 'High', 'Medium', 'Low']],
    body: [[bugCountsBySeverity.critical, bugCountsBySeverity.high, bugCountsBySeverity.medium, bugCountsBySeverity.low]],
    theme: 'grid',
    headStyles: { fillColor: ACCENT },
    margin: { left: marginX, right: marginX },
  })
  y = doc.lastAutoTable.finalY + 10

  if (y > 240) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Automation runs this week', marginX, y)
  y += 4
  if (weekAutomationRuns.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('No automation runs this week.', marginX, y + 5)
  } else {
    autoTable(doc, {
      startY: y + 2,
      head: [['Suite', 'Result', 'Passed', 'Failed', 'When']],
      body: weekAutomationRuns.map(r => [
        r.suite_name,
        r.status === 'completed' && r.total > 0 ? `${Math.round((r.passed / r.total) * 100)}%` : (r.status || '—'),
        r.passed ?? '—',
        r.failed ?? '—',
        fmtDate(r.started_at),
      ]),
      theme: 'striped',
      headStyles: { fillColor: ACCENT },
      margin: { left: marginX, right: marginX },
    })
  }

  const fileSafeName = (project?.name || 'project').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`weekly-summary-${fileSafeName}-${now.toISOString().slice(0, 10)}.pdf`)
}
