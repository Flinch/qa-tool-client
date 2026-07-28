import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function AutomationLink({ projectId }) {
  return (
    <Link to={`/projects/${projectId}/automation`} className="btn btn-ghost btn-sm" title="Automation">
      <Icon name="gear" size={13} />
    </Link>
  )
}
