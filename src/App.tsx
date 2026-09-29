import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import HomeRedirect from './components/HomeRedirect';
import Layout from './components/Layout';
import OrgRoute from './components/OrgRoute';
import StockeaAccessRoute from './components/StockeaAccessRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';
import OrgUsersRoute from './components/OrgUsersRoute';
import ProtectedRoute from './components/ProtectedRoute';
import SystemConfigRoute from './components/SystemConfigRoute';
import { WorkingBranchProvider } from './components/WorkingBranch';
import AuthHandoffPage from './pages/AuthHandoffPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import DashboardPage from './pages/DashboardPage';
import InventarioPage from './pages/InventarioPage';
import LoginPage from './pages/LoginPage';
import MovimientosPage from './pages/MovimientosPage';
import MaterialesPage from './pages/MaterialesPage';
import ProductosPage from './pages/ProductosPage';
import ReportesPage from './pages/ReportesPage';
import SistemasPage from './pages/SistemasPage';
import UsuariosPage from './pages/UsuariosPage';
import VentasPage from './pages/VentasPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/handoff" element={<AuthHandoffPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<WorkingBranchProvider />}>
            <Route element={<Layout />}>
              <Route index element={<HomeRedirect />} />
              <Route element={<OrgRoute />}>
                <Route element={<StockeaAccessRoute />}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="ventas" element={<VentasPage />} />
                  <Route path="inventario" element={<InventarioPage />} />
                  <Route path="productos" element={<ProductosPage />} />
                  <Route path="materiales" element={<MaterialesPage />} />
                  <Route path="movimientos" element={<MovimientosPage />} />
                  <Route path="reportes" element={<ReportesPage />} />
                </Route>
                <Route element={<SystemConfigRoute />}>
                  <Route path="configuracion" element={<ConfiguracionPage />} />
                </Route>
              </Route>
              <Route element={<PlatformAdminRoute />}>
                <Route path="admin/sistemas" element={<SistemasPage />} />
              </Route>
              <Route element={<OrgUsersRoute />}>
                <Route path="usuarios" element={<UsuariosPage />} />
              </Route>
            </Route>
            </Route>
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
