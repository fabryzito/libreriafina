import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, allow }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (Array.isArray(allow) && allow.length > 0) {
    if (!allow.includes(user.role)) {
      return <Navigate to="/" replace />
    }
  }

  return children
}

export default ProtectedRoute

