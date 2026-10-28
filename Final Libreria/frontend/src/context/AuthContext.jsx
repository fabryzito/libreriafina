import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function loadAuth() {
  try {
    const userStr = window.localStorage.getItem('user')
    const token = window.localStorage.getItem('token')
    return {
      user: userStr ? JSON.parse(userStr) : null,
      token: token || null,
    }
  } catch {
    return { user: null, token: null }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadAuth().user)
  const [token, setToken] = useState(() => loadAuth().token)

  const login = ({ user: userData, token: tokenData }) => {
    setUser(userData)
    setToken(tokenData)
    window.localStorage.setItem('user', JSON.stringify(userData))
    window.localStorage.setItem('token', tokenData)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    window.localStorage.removeItem('user')
    window.localStorage.removeItem('token')
  }

  const value = { user, token, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
