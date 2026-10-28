import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'

const linkBase =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap transition'

function navClass(isActive) {
  return `${linkBase} ${
    isActive
      ? 'bg-white/15 text-white'
      : 'text-white/75 hover:bg-white/10 hover:text-white'
  }`
}

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === ROLES.ADMIN

  const [configOpen, setConfigOpen] = useState(false)
  const configRef = useRef(null)

  const configActive =
    isAdmin && location.pathname.startsWith('/configuracion')

  useEffect(() => {
    function handleClickOutside(ev) {
      if (configRef.current && !configRef.current.contains(ev.target)) {
        setConfigOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setConfigOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="no-print sticky top-0 z-40 bg-indigo-950 text-white shadow-md shadow-slate-900/10">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between min-h-[4.25rem] gap-4 py-2">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 shrink-0"
            aria-label="Ir a inicio"
          >
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

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <ul className="flex flex-nowrap items-center justify-end gap-0.5">
              <li>
                <NavLink to="/" className={({ isActive }) => navClass(isActive)} end>
                  Inicio
                </NavLink>
              </li>
              <li>
                <NavLink to="/caja" className={({ isActive }) => navClass(isActive)}>
                  Caja
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/productos"
                  className={({ isActive }) => navClass(isActive)}
                >
                  Productos
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/ventas"
                  className={({ isActive }) => navClass(isActive)}
                  end
                >
                  Ventas
                </NavLink>
              </li>
              {isAdmin && (
                <li>
                  <NavLink
                    to="/compras"
                    className={({ isActive }) => navClass(isActive)}
                  >
                    Compras
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink
                  to="/reportes/ventas"
                  className={({ isActive }) => navClass(isActive)}
                >
                  Reportes
                </NavLink>
              </li>

              {isAdmin && (
                <li className="relative" ref={configRef}>
                  <button
                    type="button"
                    onClick={() => setConfigOpen((o) => !o)}
                    className={`${linkBase} ${
                      configActive || configOpen
                        ? 'bg-white/15 text-white'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                    aria-expanded={configOpen}
                    aria-haspopup="menu"
                  >
                    Configuración
                    <span className="text-[10px] opacity-80" aria-hidden>
                      ▾
                    </span>
                  </button>
                  {configOpen && (
                    <div
                      className="absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200 text-slate-700"
                      role="menu"
                    >
                      <NavLink
                        to="/configuracion/usuarios"
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-800 font-medium'
                              : 'hover:bg-slate-50'
                          }`
                        }
                        role="menuitem"
                      >
                        Usuarios
                      </NavLink>
                      <NavLink
                        to="/configuracion/clientes"
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-800 font-medium'
                              : 'hover:bg-slate-50'
                          }`
                        }
                        role="menuitem"
                      >
                        Clientes
                      </NavLink>
                      <NavLink
                        to="/configuracion/proveedores"
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-800 font-medium'
                              : 'hover:bg-slate-50'
                          }`
                        }
                        role="menuitem"
                      >
                        Proveedores
                      </NavLink>
                      <NavLink
                        to="/configuracion/negocio"
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-800 font-medium'
                              : 'hover:bg-slate-50'
                          }`
                        }
                        role="menuitem"
                      >
                        Negocio
                      </NavLink>
                    </div>
                  )}
                </li>
              )}
            </ul>

            {user && (
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-white/15 shrink-0">
                <div className="min-w-0 text-right">
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
          </div>
        </div>

        {user && (
          <div className="md:hidden flex items-center justify-between gap-2 pb-2.5 text-xs text-white/80 border-t border-white/10 pt-2">
            <span className="truncate">
              {user.name} · <span className="capitalize">{user.role}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 font-medium rounded-lg bg-white px-2.5 py-1 text-indigo-950"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default NavBar
