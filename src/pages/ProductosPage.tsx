import { type FormEvent, useState } from 'react';
import Modal from '../components/Modal';
import { money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

const empty = { sku: '', name: '', category: '', quantity: '1', unitPrice: '0' };

export default function ProductosPage() {
  const { productos, canAdd, remaining, addProducto, remove } = useDemo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Escribe el nombre del producto');
      return;
    }
    const err = addProducto({
      sku: form.sku.trim() || `SKU-${productos.length + 1}`,
      name: form.name.trim(),
      category: form.category.trim() || 'General',
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
        <h2>Productos</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAdd('productos')}
          onClick={() => { setError(''); setOpen(true); }}
        >
          + Nuevo ítem
        </button>
      </div>
      <p className="page-subtitle">Restan {remaining('productos')} de 2 en esta demo</p>

      <div className="panel">
        {productos.length === 0 ? (
          <div className="empty">Aún no hay productos. Crea hasta 2 para la demo.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.quantity}</td>
                    <td>{money(p.unitPrice)}</td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('productos', p.id)}>
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
        title="Nuevo producto"
        onClose={() => setOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" form="producto-form" className="btn btn-primary">Guardar</button>
          </>
        )}
      >
        <form id="producto-form" onSubmit={submit} className="form-grid">
          <div className="form-field">
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Opcional" />
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
            <label>Precio</label>
            <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
