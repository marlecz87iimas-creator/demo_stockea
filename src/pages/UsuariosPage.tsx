import { type FormEvent, useState } from 'react';
import Modal from '../components/Modal';
import { useDemo } from '../demo/DataContext';

const empty = { name: '', email: '', role: 'Vendedor' };

export default function UsuariosPage() {
  const { usuarios, canAdd, remaining, addUsuario, remove } = useDemo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios');
      return;
    }
    const err = addUsuario({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    });
    if (err) { setError(err); return; }
    setForm(empty);
    setOpen(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Usuarios</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAdd('usuarios')}
          onClick={() => { setError(''); setOpen(true); }}
        >
          + Usuario
        </button>
      </div>
      <p className="page-subtitle">Restan {remaining('usuarios')} de 2 en esta demo</p>

      <div className="panel">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th /></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {usuarios.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('usuarios', u.id)}>
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
        open={open}
        title="Nuevo usuario"
        onClose={() => setOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" form="usuario-form" className="btn btn-primary">Guardar</button>
          </>
        )}
      >
        <form id="usuario-form" onSubmit={submit} className="form-grid">
          <div className="form-field">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Correo</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-field full">
            <label>Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="Vendedor">Vendedor</option>
              <option value="Cajero">Cajero</option>
              <option value="Supervisor">Supervisor</option>
            </select>
          </div>
          {error && <div className="alert alert-error full">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
