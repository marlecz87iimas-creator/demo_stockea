import { type FormEvent, useState } from 'react';
import Modal from '../components/Modal';
import { useDemo } from '../demo/DataContext';

const empty = { name: '', code: '' };

export default function SistemasPage() {
  const {
    sistemas, sucursales, canAdd, remaining,
    addSistema, addSucursal, remove,
  } = useDemo();
  const [sysOpen, setSysOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [sysForm, setSysForm] = useState({ name: '', tipo: 'REFACCIONARIA' });
  const [branchForm, setBranchForm] = useState(empty);
  const [error, setError] = useState('');

  const submitSistema = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sysForm.name.trim()) {
      setError('Escribe el nombre del sistema');
      return;
    }
    const err = addSistema({ name: sysForm.name.trim(), tipo: sysForm.tipo });
    if (err) { setError(err); return; }
    setSysForm({ name: '', tipo: 'REFACCIONARIA' });
    setSysOpen(false);
  };

  const submitSucursal = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!branchForm.name.trim()) {
      setError('Escribe el nombre de la sucursal');
      return;
    }
    const err = addSucursal({
      name: branchForm.name.trim(),
      code: branchForm.code.trim() || `S${sucursales.length + 1}`,
    });
    if (err) { setError(err); return; }
    setBranchForm(empty);
    setBranchOpen(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Sistemas</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canAdd('sucursales')}
            onClick={() => { setError(''); setBranchOpen(true); }}
          >
            + Sucursal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canAdd('sistemas')}
            onClick={() => { setError(''); setSysOpen(true); }}
          >
            + Sistema
          </button>
        </div>
      </div>
      <p className="page-subtitle">
        Sistemas {remaining('sistemas')}/2 · Sucursales {remaining('sucursales')}/2 disponibles
      </p>

      <div className="panel">
        <div className="panel-header"><h3>Sistemas</h3></div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Tipo</th><th /></tr>
            </thead>
            <tbody>
              {sistemas.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.tipo}</td>
                  <td>
                    {sistemas.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('sistemas', s.id)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-header"><h3>Sucursales</h3></div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Código</th><th /></tr>
            </thead>
            <tbody>
              {sucursales.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.code}</td>
                  <td>
                    {sucursales.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('sucursales', b.id)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={sysOpen}
        title="Nuevo sistema"
        onClose={() => setSysOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setSysOpen(false)}>Cancelar</button>
            <button type="submit" form="sistema-form" className="btn btn-primary">Guardar</button>
          </>
        )}
      >
        <form id="sistema-form" onSubmit={submitSistema} className="form-grid">
          <div className="form-field full">
            <label>Nombre</label>
            <input value={sysForm.name} onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })} required />
          </div>
          <div className="form-field full">
            <label>Tipo</label>
            <select value={sysForm.tipo} onChange={(e) => setSysForm({ ...sysForm, tipo: e.target.value })}>
              <option value="REFACCIONARIA">Refaccionaria</option>
              <option value="FRUTERIA">Frutería</option>
              <option value="MERCERIA">Mercería</option>
              <option value="OTROS">Otros</option>
            </select>
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>

      <Modal
        open={branchOpen}
        title="Nueva sucursal"
        onClose={() => setBranchOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setBranchOpen(false)}>Cancelar</button>
            <button type="submit" form="sucursal-form" className="btn btn-primary">Guardar</button>
          </>
        )}
      >
        <form id="sucursal-form" onSubmit={submitSucursal} className="form-grid">
          <div className="form-field">
            <label>Nombre</label>
            <input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Código</label>
            <input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} />
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
