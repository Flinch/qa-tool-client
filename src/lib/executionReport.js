import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_LABELS = { pass: 'Pass', fail: 'Fail', not_run: 'Not run', blocked: 'Blocked' }
const SUITE_STATUS_LABELS = { completed: 'Completed', pending: 'Pending', running: 'Running', failed: 'Failed' }

function fmtDate(d) {
  return d ? new Date(d).toLocaleString() : '—'
}

// Builds and downloads a PDF summarizing an execution run: manual test case
// results, bugs found during the run, and automation suite results. Runs
// entirely client-side against data already loaded on the detail page.
export function generateExecutionReportPdf({ run, project, bugs = [] }) {
  const doc = new jsPDF()
  const marginX = 14
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Execution Run Report', marginX, y)
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(run.name, marginX, y)
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(100)
  const metaLines = [
    `Project: ${project?.name || '—'}`,
    `Status: ${run.status.replace('_', ' ')}`,
    `Started: ${fmtDate(run.started_at)}`,
    `Completed: ${fmtDate(run.completed_at)}`,
    `Generated: ${fmtDate(new Date())}`,
  ]
  metaLines.forEach(line => { doc.text(line, marginX, y); y += 5 })
  doc.setTextColor(0)
  y += 3

  const total = run.test_cases.length
  const passed = run.test_cases.filter(t => t.status === 'pass').length
  const failed = run.test_cases.filter(t => t.status === 'fail').length
  const blocked = run.test_cases.filter(t => t.status === 'blocked').length
  const notRun = run.test_cases.filter(t => t.status === 'not_run').length

  autoTable(doc, {
    startY: y,
    head: [['Total', 'Passed', 'Failed', 'Blocked', 'Not run']],
    body: [[total, passed, failed, blocked, notRun]],
    theme: 'grid',
    headStyles: { fillColor: [184, 70, 31] },
    margin: { left: marginX, right: marginX },
  })
  y = doc.lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Manual test cases', marginX, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Title', 'Type', 'Result', 'Notes']],
    body: run.test_cases.map(tc => [
      tc.title,
      tc.type,
      STATUS_LABELS[tc.status] || tc.status,
      tc.notes || (tc.bug_count > 0 ? `${tc.bug_count} bug(s) linked` : ''),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [184, 70, 31] },
    margin: { left: marginX, right: marginX },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = data.cell.raw
        if (val === 'Pass') data.cell.styles.textColor = [122, 155, 87]
        if (val === 'Fail') data.cell.styles.textColor = [193, 68, 58]
        if (val === 'Blocked') data.cell.styles.textColor = [201, 162, 39]
      }
    },
  })
  y = doc.lastAutoTable.finalY + 10

  if (bugs.length > 0) {
    if (y > 250) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Bugs found', marginX, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Title', 'Severity', 'Status']],
      body: bugs.map(b => [b.title, b.severity, b.status.replace('_', ' ')]),
      theme: 'striped',
      headStyles: { fillColor: [184, 70, 31] },
      margin: { left: marginX, right: marginX },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  if (run.suites.length > 0) {
    if (y > 250) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Automation suites', marginX, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Suite', 'Status', 'Total', 'Passed', 'Failed', 'Skipped', 'Duration']],
      body: run.suites.map(s => [
        s.suite_name,
        SUITE_STATUS_LABELS[s.latest_status] || 'Not run',
        s.total ?? '—',
        s.passed ?? '—',
        s.failed ?? '—',
        s.skipped ?? '—',
        s.duration_ms != null ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [184, 70, 31] },
      margin: { left: marginX, right: marginX },
    })
  }

  const fileSafeName = run.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`execution-report-${fileSafeName || run.id}.pdf`)
}
