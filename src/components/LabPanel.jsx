import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { tcLabel } from '../lib/testCaseLabel.js'
import Icon from './Icon.jsx'
import HealConfirmModal from './HealConfirmModal.jsx'
import DiagnosisModal from './DiagnosisModal.jsx'
import MoveToSuiteModal from './MoveToSuiteModal.jsx'
import { TestCaseRow, TestCaseDetailModal } from '../pages/SuiteTestCasesPage.jsx'

// "The Lab" — every AI-generated test case across every suite in the
// project, its last run, and re-run/diagnose/heal/add-to-suite actions.
// Shared between EngineeringDashboardPage's compact inline panel
// (fixed-height, scrolling, links out via `viewAllHref`) and
// LabTestCasesPage's full page (`fullPage`, unbounded height, no further
// place to link to) so the two never drift out of sync on data-loading or
// action behavior.
export default function LabPanel({ projectId, viewAllHref, fullPage, onAfterRerun, onAfterMove }) {
  const { addToast } = useToastStore()
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [suites, setSuites] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [diagnose, setDiagnose] = useState(null)
  const [healConfirm, setHealConfirm] = useState(null)
  const [healing, setHealing] = useState(false)
  const [moveTarget, setMoveTarget] = useState(null)
  const [moving, setMoving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return apiFetch(`/projects/${projectId}/automation/generated-test-cases`)
      .then(data => setTestCases(data.testCases))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { load() }, [load])

  // For MoveToSuiteModal's suite picker — every suite in the project,
  // regardless of platform/engine (the modal itself filters to matches).
  useEffect(() => { apiFetch(`/projects/${projectId}/automation/suites`).then(setSuites).catch(console.error) }, [projectId])

  const rerun = async (tc) => {
    setBusyId(tc.id)
    try {
      await apiFetch(`/projects/${projectId}/automation/runs/${tc.last_run_id}/rerun`, {
        method: 'POST',
        body: JSON.stringify({ result_ids: [tc.last_result_id], source: 'engineering_page' }),
      })
      addToast(`Re-run started for "${tc.linked_test_case_title ? tcLabel(tc.test_case_id, tc.linked_test_case_title) : tc.title}"`)
      onAfterRerun?.()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const confirmHeal = async (context) => {
    if (!healConfirm) return
    setHealing(true)
    try {
      await apiFetch(`/projects/${projectId}/automation/runs/${healConfirm.runId}/heal`, {
        method: 'POST',
        body: JSON.stringify({ result_id: healConfirm.resultId, context: context || undefined }),
      })
      addToast(`Healing started for "${healConfirm.title}"`)
      setHealConfirm(null)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setHealing(false)
    }
  }

  const confirmMove = async (targetSuiteId) => {
    if (!moveTarget) return
    setMoving(true)
    try {
      await apiFetch(`/projects/${projectId}/automation/test-cases/${moveTarget.atc.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ target_suite_id: targetSuiteId }),
      })
      addToast(`Add-to-suite started for "${moveTarget.title}" — it moves once the PR merges`)
      setMoveTarget(null)
      onAfterMove?.()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className={fullPage ? undefined : 'health-panel'} id={fullPage ? undefined : 'the-lab'}>
      {!fullPage && (
        <div className="health-panel-head">
          <div className="health-panel-title">The Lab</div>
          {viewAllHref ? (
            <Link to={viewAllHref} className="health-panel-link">View all <Icon name="arrowRight" size={11} /></Link>
          ) : (
            <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Every AI-generated test, its last run, and the option to re-run, diagnose, or heal it</span>
          )}
        </div>
      )}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
      ) : testCases.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No AI-generated test cases found yet across any suite in this project.</div>
      ) : (
        <div className={fullPage ? undefined : 'health-panel-body'}>
          {testCases.map(tc => (
            <TestCaseRow
              key={tc.id}
              tc={tc}
              isLab
              busy={busyId === tc.id}
              onView={setDetail}
              onRerun={rerun}
              onDiagnose={(t) => setDiagnose({ runId: t.last_run_id, resultId: t.last_result_id, title: t.linked_test_case_title ? tcLabel(t.test_case_id, t.linked_test_case_title) : t.title, suiteName: t.suite_name })}
              onRequestHeal={(t) => setHealConfirm({ runId: t.last_run_id, resultId: t.last_result_id, title: t.linked_test_case_title ? tcLabel(t.test_case_id, t.linked_test_case_title) : t.title, suiteName: t.suite_name })}
              onMoveToSuite={(t) => setMoveTarget({ atc: t, title: t.linked_test_case_title ? tcLabel(t.test_case_id, t.linked_test_case_title) : t.title })}
            />
          ))}
        </div>
      )}

      {detail && (
        <TestCaseDetailModal test={detail} projectId={projectId} onClose={() => setDetail(null)} />
      )}

      {diagnose && (
        <DiagnosisModal
          projectId={projectId}
          runId={diagnose.runId}
          resultId={diagnose.resultId}
          testTitle={diagnose.title}
          suiteName={diagnose.suiteName}
          onClose={() => setDiagnose(null)}
          onRequestHeal={() => { setHealConfirm(diagnose); setDiagnose(null) }}
        />
      )}

      {healConfirm && (
        <HealConfirmModal
          testTitle={healConfirm.title}
          suiteName={healConfirm.suiteName}
          healing={healing}
          onCancel={() => setHealConfirm(null)}
          onConfirm={confirmHeal}
        />
      )}

      {moveTarget && (
        <MoveToSuiteModal
          testCaseTitle={moveTarget.title}
          sourceSuiteId={moveTarget.atc.suite_id}
          sourceSuiteName={moveTarget.atc.suite_name}
          sourcePlatform={moveTarget.atc.suite_platform}
          sourceEngine={moveTarget.atc.suite_engine}
          suites={suites}
          moving={moving}
          onCancel={() => setMoveTarget(null)}
          onConfirm={confirmMove}
        />
      )}
    </div>
  )
}
