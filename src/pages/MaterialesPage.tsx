import { type FormEvent, useState } from 'react';
import Modal from '../components/Modal';
import { money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

const empty = { sku: '', name: '', category: '', quantity: '1', unitPrice: '0' };

export default function MaterialesPage() {
  const { materiales, canAdd, remaining, addMaterial, remove } = useDemo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Escribe el nombre del material');
      return;
    }
    const err = addMaterial({
      sku: form.sku.trim() || `MAT-${materiales.length + 1}`,
      name: form.name.trim(),
      category: form.category.trim() || 'Insumos',
      quantity: Number(form.quantity) || 0,
      unitPrice: Number(form.unitPrice) || 0,
    });
    if (err) {
      setError(err);
      return;
    }
    setForm(empty);
    setOpen(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Materiales</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAdd('materiales')}
          onClick={() => { setError(''); setOpen(true); }}
        >
          + Nuevo material
        </button>
      </div>
      <p className="page-subtitle">Restan {remaining('materiales')} de 2 en esta demo</p>

      <div className="panel">
        {materiales.length === 0 ? (
          <div className="empty">Aún no hay materiales. Crea hasta 2 para la demo.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {materiales.map((m) => (
                  <tr key={m.id}>
                    <td>{m.sku}</td>
                    <td>{m.name}</td>
                    <td>{m.category}</td>
                    <td>{m.quantity}</td>
                    <td>{money(m.unitPrice)}</td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('materiales', m.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title="Nuevo material"
        onClose={() => setOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" form="material-form" className="btn btn-primary">Guardar</button>
          </>
        )}
      >
        <form id="material-form" onSubmit={submit} className="form-grid">
          <div className="form-field">
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Categoría</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Cantidad</label>
            <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Costo</label>
            <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
