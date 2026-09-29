import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllMembers, listMembers, provisionMember, removeMember, updateMember } from '../api/organizations';
import { useAuth } from '../auth/AuthContext';
import { canCreatePrincipalUsers } from '../auth/access';
import { memberDisplayName, rolLabel } from '../auth/auth';
import { STOCKEA_STAFF_ROLES, isStockeaStaffRole } from '../domain/stockeaRoles';
import Modal from '../components/Modal';
import type { OrgMember } from '../types';

const emptyForm = {
  email: '',
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  rol: 'vendedor',
  activo: true,
};

function usernameFromEmail(email: string): string {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function statusBadge(status: string) {
  switch (status) {
    case 'active': return 'badge-ok';
    case 'pending': return 'badge-warn';
    case 'suspended': return 'badge-critico';
    default: return 'badge-muted';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'active': return 'Activo';
    case 'suspended': return 'Suspendido';
    case 'pending': return 'Pendiente';
    case 'inactive': return 'Inactivo';
    default: return status;
  }
}

export default function UsuariosPage() {
  const { session } = useAuth();
  const [miembros, setMiembros] = useState<OrgMember[]>([]);
  const [filtro, setFiltro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const esAdminPlataforma = session?.isPlatformAdmin ?? false;
  const puedeCrearPrincipales = session ? canCreatePrincipalUsers(session.permissions) : false;
  const rolesCreables = useMemo(
    () => (puedeCrearPrincipales
      ? ['manager', ...STOCKEA_STAFF_ROLES]
      : [...STOCKEA_STAFF_ROLES]),
    [puedeCrearPrincipales],
  );

  const cargar = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      if (esAdminPlataforma) {
        setMiembros(await listAllMembers(session.token));
      } else if (session.orgId) {
        setMiembros(await listMembers(session.token, session.orgId));
      } else {
        setMiembros([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [session, esAdminPlataforma]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirModal = () => {
    setForm({ ...emptyForm, rol: rolesCreables[0] || 'user' });
    setEditId(null);
    setEditOrgId(null);
    setError('');
    setModalOpen(true);
  };

  const abrirEditar = (m: OrgMember) => {
    setForm({
      email: m.email,
      username: m.username || '',
      password: '',
      first_name: m.first_name,
      last_name: m.last_name,
      rol: m.role_slug || 'vendedor',
      activo: m.status === 'active',
    });
    setEditId(m.user_id);
    setEditOrgId(m.organization_id);
    setError('');
    setModalOpen(true);
  };

  const puedeEditar = (m: OrgMember) => {
    const role = m.role_slug || 'user';
    if (role === 'admin') return false;
    if (esAdminPlataforma) {
      if (role === 'manager') return puedeCrearPrincipales;
      return isStockeaStaffRole(role) || role === 'user';
    }
    if (m.created_by !== session?.user.id) return false;
    if (role === 'manager') return false;
    return isStockeaStaffRole(role) || role === 'user';
  };

  const filtrados = miembros.filter((m) => {
    const q = filtro.toLowerCase();
    if (!q) return true;
    const nombre = memberDisplayName(m).toLowerCase();
    const sistema = (m.organization_name || '').toLowerCase();
    return nombre.includes(q)
      || m.email.toLowerCase().includes(q)
      || (m.username || '').toLowerCase().includes(q)
      || sistema.includes(q);
  });

  const orgIdParaCrear = session?.orgId ?? null;

  const guardar = async () => {
    if (!session?.token) return;
    const orgId = editId != null ? editOrgId : orgIdParaCrear;
    if (!orgId) {
      setError('Selecciona una organización para crear usuarios.');
      return;
    }
    setError('');
    try {
      if (editId != null) {
        const body: Parameters<typeof updateMember>[3] = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          status: form.activo ? 'active' : 'suspended',
        };
        if (form.password.trim()) body.password = form.password;
        if (form.rol && isStockeaStaffRole(form.rol)) body.role_slug = form.rol;
        await updateMember(session.token, orgId, editId, body);
      } else {
        await provisionMember(session.token, orgId, {
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role_slug: form.rol,
        });
      }
      setModalOpen(false);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const quitar = async (m: OrgMember) => {
    if (!session?.token) return;
    if (!confirm(`¿Quitar a ${memberDisplayName(m)} de la organización?`)) return;
    try {
      await removeMember(session.token, m.organization_id, m.user_id);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar usuario');
    }
  };

  const crearLabel = puedeCrearPrincipales ? 'Crear usuario principal' : 'Crear usuario';
  const editarLabel = 'Editar usuario';
  const tituloModal = editId != null ? editarLabel : crearLabel;

  if (!esAdminPlataforma && !session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Usuarios</h2></div>
        <div className="alert alert-error">Selecciona una organización para administrar usuarios.</div>
      </div>
    );
  }

  const subtitulo = esAdminPlataforma
    ? 'Todos los usuarios de todos los sistemas'
    : `Cuentas de acceso para ${session?.organizations.find((o) => o.id === session.orgId)?.name}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Usuarios</h2>
          <p className="page-subtitle">{subtitulo}</p>
        </div>
        {orgIdParaCrear && (
          <button type="button" className="btn btn-primary" onClick={abrirModal}>+ {tituloModal}</button>
        )}
      </div>

      {!esAdminPlataforma && (
        <div className="alert" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid var(--primary)', color: 'var(--text)' }}>
          Solo ves los usuarios que tú has creado. Puedes administrar vendedores, cajeros y supervisores de tu negocio.
        </div>
      )}

      {error && !modalOpen && <div className="alert alert-error">{error}</div>}

      <div className="panel">
        <div className="filter-bar">
          <input
            placeholder="Buscar por nombre, usuario, email o sistema..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div className="data-table-wrap">
          {loading ? (
            <div className="empty">Cargando usuarios...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {esAdminPlataforma && <th>Sistema</th>}
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Desde</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={esAdminPlataforma ? 8 : 7} className="empty">No hay usuarios</td></tr>
                ) : filtrados.map((m) => (
                  <tr key={`${m.organization_id}-${m.user_id}`}>
                    {esAdminPlataforma && <td>{m.organization_name || '—'}</td>}
                    <td>{memberDisplayName(m)}</td>
                    <td>{m.username || '—'}</td>
                    <td>{m.email}</td>
                    <td>
                      <span className="badge badge-ok">{rolLabel(m.role_slug || 'user')}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(m.status)}`}>{statusLabel(m.status)}</span>
                    </td>
                    <td><small>{new Date(m.joined_at).toLocaleDateString('es-MX')}</small></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {puedeEditar(m) && (
                        <>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirEditar(m)}>Editar</button>
                          {' '}
                          {m.user_id !== session?.user.id && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => quitar(m)}>Quitar</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={tituloModal}
        onClose={() => setModalOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardar}>
              {editId != null ? 'Guardar cambios' : 'Crear'}
            </button>
          </>
        )}
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                const email = e.target.value;
                const next = { ...form, email };
                if (editId == null && (!form.username || form.username === usernameFromEmail(form.email))) {
                  next.username = usernameFromEmail(email);
                }
                setForm(next);
              }}
            />
          </div>
          <div className="form-field">
            <label>Usuario (login)</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              placeholder="Nombre para entrar a Stockea"
              minLength={2}
              maxLength={50}
            />
          </div>
          <div className="form-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={form.password}
              placeholder={editId != null ? 'Dejar en blanco para no cambiar' : ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {editId == null ? (
            <div className="form-field">
              <label>Rol</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {rolesCreables.map((r) => (
                  <option key={r} value={r}>{rolLabel(r)}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-field">
              <label>Rol</label>
              {isStockeaStaffRole(form.rol) || form.rol === 'manager' ? (
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {(form.rol === 'manager' && puedeCrearPrincipales ? ['manager'] : rolesCreables).map((r) => (
                    <option key={r} value={r}>{rolLabel(r)}</option>
                  ))}
                </select>
              ) : (
                <input value={rolLabel(form.rol)} disabled />
              )}
            </div>
          )}
          <div className="form-field">
            <label>Nombre</label>
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Apellido</label>
            <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          {editId != null && (
            <div className="form-field">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                Usuario activo
              </label>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
