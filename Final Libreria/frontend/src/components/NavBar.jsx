import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition'

function navClass(isActive) {
  return `${linkBase} ${
    isActive
      ? 'bg-white/15 text-white font-semibold'
      : 'text-white/75 hover:bg-white/10 hover:text-white'
  }`
}

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === ROLES.ADMIN

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const sidebarRef = useRef(null)

  const configActive =
    isAdmin && location.pathname.startsWith('/configuracion')

  // Cerrar sidebar al cambiar de ruta en mobile
  useEffect(() => {
    setSidebarOpen(false)
    setConfigOpen(false)
  }, [location.pathname])

  // Cerrar sidebar al hacer click fuera en mobile
  useEffect(() => {
    function handleClickOutside(ev) {
      if (sidebarRef.current && !sidebarRef.current.contains(ev.target)) {
        // Opcional si querés cerrar al hacer click fuera, pero en mobile el overlay es mejor
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Barra superior fija con el botón hamburguesa */}
      <header className="no-print sticky top-0 z-40 bg-indigo-950 text-white shadow-md shadow-slate-900/10 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {/* Botón Hamburguesa */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition focus:outline-none"
            aria-label="Abrir menú"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Ir a inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
                <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight text-base sm:text-lg">
              Librería
            </span>
          </NavLink>
        </div>

        {/* Info de usuario en la barra superior */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-white/15 shrink-0">
            <div className="min-w-0 text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight truncate max-w-[10rem]">
                {user.name}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-white/60">
                {user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium rounded-lg bg-white px-3 py-1.5 text-indigo-950 hover:bg-indigo-50 transition"
            >
              Salir
            </button>
          </div>
        )}
      </header>

      {/* Overlay oscuro para mobile cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Menú Lateral (Sidebar) */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-indigo-950 text-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10">
          <span className="font-semibold text-lg tracking-tight">Menú Principal</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-white/75 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Enlaces de navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          <NavLink to="/" className={({ isActive }) => navClass(isActive)} end>
            <span></span> Inicio
          </NavLink>
          <NavLink to="/caja" className={({ isActive }) => navClass(isActive)}>
            <span></span> Caja
          </NavLink>
          <NavLink to="/productos" className={({ isActive }) => navClass(isActive)}>
            <span></span> Productos
          </NavLink>
          <NavLink to="/ventas" className={({ isActive }) => navClass(isActive)} end>
            <span></span> Ventas
          </NavLink>

          {isAdmin && (
            <>
              <NavLink to="/compras" className={({ isActive }) => navClass(isActive)}>
                <span></span> Compras
              </NavLink>
              <NavLink to="/reportes/ventas" className={({ isActive }) => navClass(isActive)}>
                <span></span> Reportes
              </NavLink>

              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Configuración
                </p>
              </div>

              <NavLink to="/configuracion/usuarios" className={({ isActive }) => navClass(isActive)}>
                <span></span> Usuarios
              </NavLink>
              <NavLink to="/configuracion/clientes" className={({ isActive }) => navClass(isActive)}>
                <span></span> Clientes
              </NavLink>
              <NavLink to="/configuracion/proveedores" className={({ isActive }) => navClass(isActive)}>
                <span></span> Proveedores
              </NavLink>
              <NavLink to="/configuracion/negocio" className={({ isActive }) => navClass(isActive)}>
                <span></span> Negocio
              </NavLink>
            </>
          )}
        </div>

        {/* Pie del Sidebar con datos de sesión en mobile */}
        {user && (
          <div className="p-4 border-t border-white/10 bg-indigo-900/40">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-white">{user.name}</p>
                <p className="text-xs uppercase tracking-wide text-white/60">{user.role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-medium rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/20 transition"
              >
                Salir
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export default NavBar