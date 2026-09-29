import { useDemo } from '../demo/DataContext';

export default function ConfiguracionPage() {
  const { orgName, sucursales } = useDemo();

  return (
    <div>
      <div className="page-header">
        <h2>Configuración</h2>
      </div>
      <div className="panel">
        <div className="panel-header"><h3>Sistema activo</h3></div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <p><strong>Nombre:</strong> {orgName}</p>
          <p style={{ marginTop: '0.5rem' }}><strong>Sucursales:</strong> {sucursales.map((s) => s.name).join(', ')}</p>
          <p className="page-subtitle" style={{ marginTop: '1rem' }}>
            En la demo no se guarda logo ni configuración fiscal. Solo se muestra la apariencia del panel.
          </p>
        </div>
      </div>
    </div>
  );
}
