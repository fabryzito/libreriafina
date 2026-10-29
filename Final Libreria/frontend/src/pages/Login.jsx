import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginRequest, requestPasswordReset, resetPassword } from '../api/services/auth'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-700 focus:ring-2 focus:ring-indigo-500/30'

function EyeIcon({ off }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 4.1" />
        <path d="M6.1 6.1C3.6 7.8 2 12 2 12s4 7 10 7a10.7 10.7 0 0 0 4.1-.8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-indigo-900"
          aria-label={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  )
}

function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const navigate = useNavigate()
  const { login } = useAuth()

  const resetMessages = () => {
    setError('')
    setNotice('')
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const data = await loginRequest({ email, password })
      login({ user: data.user, token: data.token })
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message || 'Ocurrió un error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async (event) => {
    event.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const data = await requestPasswordReset(email.trim())
      setNotice(data.message)
      setMode('code')
    } catch (e) {
      setError(e.message || 'No se pudo pedir el código')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (event) => {
    event.preventDefault()
    resetMessages()
    if (nextPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const data = await resetPassword({
        email: email.trim(),
        code: code.trim(),
        password: nextPassword,
      })
      setPassword('')
      setCode('')
      setNextPassword('')
      setConfirmPassword('')
      setNotice(data.message)
      setMode('login')
    } catch (e) {
      setError(e.message || 'No se pudo cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <aside className="relative hidden lg:flex flex-col justify-between bg-indigo-950 text-white px-12 py-12">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
              <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Librería</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight max-w-md">
            LUZ MORENA, SISTEMA DE GESTION 
          </h1>
          <p className="mt-4 max-w-sm text-white/70">
            Entrá con tu usuario del equipo para vender, cobrar y revisar el día.
          </p>
        </div>
        <p className="text-sm text-white/45">Acceso del personal</p>
      </aside>

      <main className="flex items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 flex items-center gap-3 text-indigo-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
                <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" />
              </svg>
            </span>
            <span className="text-lg font-semibold">Librería</span>
          </div>

          <div className="rounded-3xl bg-white shadow-xl shadow-slate-200/80 border border-slate-200/80 p-6 sm:p-8">
            {mode === 'login' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h2>
                <p className="mt-1 text-sm text-slate-500">Usá el correo y la contraseña de tu cuenta.</p>
                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                      className={fieldClass}
                    />
                  </div>
                  <PasswordField
                    id="password"
                    label="Contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        resetMessages()
                        setMode('request')
                      }}
                      className="text-sm font-medium text-indigo-800 hover:text-indigo-950"
                    >
                      Olvidé mi contraseña
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                  {notice && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{notice}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-800 text-white text-sm font-semibold py-2.5 hover:bg-indigo-900 disabled:opacity-60"
                  >
                    {loading ? 'Ingresando…' : 'Entrar'}
                  </button>
                </form>
              </>
            )}

            {mode === 'request' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Recuperar contraseña</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Te generamos un código. El administrador lo ve en Usuarios y te lo pasa.
                </p>
                <form onSubmit={handleRequest} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="recover-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="recover-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                      className={fieldClass}
                    />
                  </div>
                  {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-800 text-white text-sm font-semibold py-2.5 hover:bg-indigo-900 disabled:opacity-60"
                  >
                    {loading ? 'Generando…' : 'Pedir código'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages()
                      setMode('login')
                    }}
                    className="w-full text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Volver al ingreso
                  </button>
                </form>
              </>
            )}

            {mode === 'code' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Nueva contraseña</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ingresá el código de 6 números que te dio el administrador.
                </p>
                <form onSubmit={handleReset} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Código
                    </label>
                    <input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      className={`${fieldClass} tracking-[0.35em] font-semibold`}
                    />
                  </div>
                  <PasswordField
                    id="next-password"
                    label="Nueva contraseña"
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <PasswordField
                    id="confirm-password"
                    label="Repetir contraseña"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  {notice && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{notice}</p>}
                  {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-800 text-white text-sm font-semibold py-2.5 hover:bg-indigo-900 disabled:opacity-60"
                  >
                    {loading ? 'Guardando…' : 'Cambiar contraseña'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages()
                      setMode('login')
                    }}
                    className="w-full text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Volver al ingreso
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Login
