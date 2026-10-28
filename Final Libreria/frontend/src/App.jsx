import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Inicio from './pages/Inicio'
import Productos from './pages/Productos'
import Ventas from './pages/Ventas'
import ReporteVentas from './pages/ReporteVentas'
import Login from './pages/Login'
import { ROLES } from './constants/roles'
import Usuarios from './pages/Usuarios'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import Compras from './pages/Compras'
import HistorialCompras from './pages/HistorialCompras'
import Caja from './pages/Caja'
import Negocio from './pages/Negocio'
import ConfiguracionLayout from './pages/ConfiguracionLayout'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex flex-col min-h-screen">
                <NavBar />
                <main className="flex-1 bg-slate-100">
                  <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
                    <Routes>
                      <Route path="/" element={<Inicio />} />
                      <Route path="/caja" element={<Caja />} />
                      <Route path="/productos" element={<Productos />} />
                      <Route
                        path="/configuracion"
                        element={
                          <ProtectedRoute allow={[ROLES.ADMIN]}>
                            <ConfiguracionLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<Navigate to="usuarios" replace />} />
                        <Route path="usuarios" element={<Usuarios />} />
                        <Route path="clientes" element={<Clientes />} />
                        <Route path="proveedores" element={<Proveedores />} />
                        <Route path="negocio" element={<Negocio />} />
                      </Route>
                      <Route path="/ventas" element={<Ventas />} />
                      <Route
                        path="/compras"
                        element={
                          <ProtectedRoute allow={[ROLES.ADMIN]}>
                            <Compras />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/compras/historial"
                        element={
                          <ProtectedRoute allow={[ROLES.ADMIN]}>
                            <HistorialCompras />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reportes/ventas"
                        element={<ReporteVentas />}
                      />
                      <Route
                        path="/usuarios"
                        element={
                          <Navigate to="/configuracion/usuarios" replace />
                        }
                      />
                      <Route
                        path="/clientes"
                        element={<Navigate to="/configuracion/clientes" replace />}
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
