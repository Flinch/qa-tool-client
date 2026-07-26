import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../lib/timeAgo.js'
import Icon from './Icon.jsx'

// Shared bell+dropdown notification pattern, used identically on the client
// dashboard (QualityHealth) and the staff Dashboard — same component, each
// page just normalizes its own activity feed into
// {key, text, time, dotColor, link} first, since what counts as "activity"
// and how to link back to it differs per page.
//
// "New" is tracked client-side only (localStorage last-seen timestamp per
// storageKey) — there's no server-side read state, and none is needed for
// this: opening the dropdown is what clears the dot, same as any standard
// notification bell.
export default function NotificationBell({ activity, storageKey }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem(storageKey))
  const wrapRef = useRef(null)

  const latestTime = activity[0]?.time
  const hasNew = !!latestTime && (!lastSeen || new Date(latestTime) > new Date(lastSeen))

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggle = () => {
    setOpen(o => {
      const next = !o
      if (next) {
        const now = new Date().toISOString()
        localStorage.setItem(storageKey, now)
        setLastSeen(now)
      }
      return next
    })
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button className="notif-bell-btn" onClick={toggle} title="Recent activity" aria-label="Recent activity">
        <Icon name="bell" size={16} />
        {hasNew && <span className="notif-bell-dot" />}
      </button>
      {open && (
        <div className="notif-bell-dropdown">
          <div className="notif-bell-title">Recent activity</div>
          {activity.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Nothing has happened yet.</div>
          ) : (
            <div>
              {activity.map((ev, i) => (
                <div
                  className="health-activity-row"
                  key={ev.key ?? i}
                  onClick={ev.link ? () => { setOpen(false); navigate(ev.link) } : undefined}
                  style={ev.link ? { cursor: 'pointer' } : undefined}
                >
                  <div className="health-activity-dot-wrap">
                    <span className="health-activity-dot" style={{ background: ev.dotColor }} />
                    {i < activity.length - 1 && <span className="health-activity-line" />}
                  </div>
                  <div>
                    <div className="health-activity-text">{ev.text}</div>
                    <div className="health-activity-time">
                      {ev.projectName && <span style={{ color: 'var(--accent2)' }}>{ev.projectName.toUpperCase()} · </span>}
                      {timeAgo(ev.time).toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
