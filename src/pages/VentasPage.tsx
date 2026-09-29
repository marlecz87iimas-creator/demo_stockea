import { type FormEvent, useState } from 'react';
import Modal from '../components/Modal';
import { formatDate, money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

const empty = { customer: '', total: '', payment: 'EFECTIVO' };

export default function VentasPage() {
  const { ventas, canAdd, remaining, addVenta, remove } = useDemo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const total = Number(form.total);
    if (!form.customer.trim()) {
      setError('Escribe el cliente');
      return;
    }
    if (!total || total <= 0) {
      setError('Indica un total válido');
      return;
    }
    const err = addVenta({
      customer: form.customer.trim(),
      total,
      payment: form.payment,
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
        <h2>Ventas</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAdd('ventas')}
          onClick={() => { setError(''); setOpen(true); }}
        >
          + Nueva venta
        </button>
      </div>
      <p className="page-subtitle">Restan {remaining('ventas')} de 2 en esta demo</p>

      <div className="panel">
        {ventas.length === 0 ? (
          <div className="empty">Aún no hay ventas. Registra hasta 2 para la demo.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{v.folio}</td>
                    <td>{v.customer}</td>
                    <td>{v.payment}</td>
                    <td>{money(v.total)}</td>
                    <td><small>{formatDate(v.createdAt)}</small></td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('ventas', v.id)}>
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
        title="Nueva venta"
        onClose={() => setOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" form="venta-form" className="btn btn-primary">Registrar</button>
          </>
        )}
      >
        <form id="venta-form" onSubmit={submit} className="form-grid">
          <div className="form-field full">
            <label>Cliente</label>
            <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Total</label>
            <input type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Tipo de pago</label>
            <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
