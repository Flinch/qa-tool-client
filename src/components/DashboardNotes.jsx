import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

const STORAGE_KEY = 'blueprint_dashboard_notes'

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Deliberately local-only (no backend) — a personal scratchpad, not a shared
// or cross-device feature. See DECISIONS.md if that changes.
export default function DashboardNotes() {
  const [notes, setNotes] = useState(loadNotes)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const addNote = () => {
    if (!draft.trim()) return
    setNotes(n => [...n, { id: Date.now(), text: draft.trim(), done: false }])
    setDraft('')
  }

  const toggleNote = (id) => setNotes(n => n.map(note => note.id === id ? { ...note, done: !note.done } : note))
  const removeNote = (id) => setNotes(n => n.filter(note => note.id !== id))

  return (
    <div className="health-panel">
      <div className="health-panel-head">
        <div className="health-panel-title">My notes</div>
      </div>
      {notes.length === 0 ? (
        <div className="note-empty">Nothing here yet — jot down anything you want to remember.</div>
      ) : (
        <div>
          {notes.map(note => (
            <div className="note-row" key={note.id}>
              <input type="checkbox" checked={note.done} onChange={() => toggleNote(note.id)} />
              <div className={`note-text${note.done ? ' done' : ''}`}>{note.text}</div>
              <button className="note-remove" onClick={() => removeNote(note.id)} title="Remove">
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="note-add">
        <input
          className="form-input"
          placeholder="Add a note..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
        />
        <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  )
}
