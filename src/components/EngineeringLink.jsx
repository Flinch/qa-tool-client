import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

// projectId is optional: rendered globally (AppShell) where there may be no
// active project yet (Dashboard, Projects list) as well as from inside a
// project's own pages, where it's always known.
export default function EngineeringLink({ projectId, className = 'btn btn-ghost btn-sm' }) {
  if (!projectId) {
    return (
      <span className={className} style={{ opacity: 0.4, cursor: 'default' }} title="Open a project to view its engineering page">
        <Icon name="hammer" size={17} />
      </span>
    )
  }
  return (
    <Link to={`/projects/${projectId}/engineering`} className={className} title="Engineering">
      <Icon name="hammer" size={17} />
    </Link>
  )
}
