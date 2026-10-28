import { NavLink, Outlet } from 'react-router-dom'

function ConfiguracionLayout() {
  return (
    <div className="w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Configuración
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Usuarios, clientes, proveedores y los datos que salen en el ticket.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-60 shrink-0">
          <nav
            className="flex flex-row lg:flex-col gap-1 p-2 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto lg:overflow-visible"
            aria-label="Secciones de configuración"
          >
            <NavLink
              to="/configuracion/usuarios"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              Usuarios
            </NavLink>
            <NavLink
              to="/configuracion/proveedores"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              Proveedores
            </NavLink>
            <NavLink
              to="/configuracion/clientes"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              Clientes
            </NavLink>
            <NavLink
              to="/configuracion/negocio"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              Negocio
            </NavLink>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default ConfiguracionLayout
