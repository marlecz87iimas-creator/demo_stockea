import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { DemoProvider } from './demo/DataContext';
import ConfiguracionPage from './pages/ConfiguracionPage';
import DashboardPage from './pages/DashboardPage';
import InventarioPage from './pages/InventarioPage';
import MaterialesPage from './pages/MaterialesPage';
import MovimientosPage from './pages/MovimientosPage';
import ProductosPage from './pages/ProductosPage';
import ReportesPage from './pages/ReportesPage';
import SistemasPage from './pages/SistemasPage';
import UsuariosPage from './pages/UsuariosPage';
import VentasPage from './pages/VentasPage';

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="ventas" element={<VentasPage />} />
            <Route path="inventario" element={<InventarioPage />} />
            <Route path="productos" element={<ProductosPage />} />
            <Route path="materiales" element={<MaterialesPage />} />
            <Route path="movimientos" element={<MovimientosPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="admin/sistemas" element={<SistemasPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </DemoProvider>
  );
}
