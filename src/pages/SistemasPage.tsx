import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { installApp, listCatalog, listInstalledApps } from '../api/applications';
import { createOrganization, listOrganizations, updateOrganization } from '../api/organizations';
import { useAuth } from '../auth/AuthContext';
import { hasStockeaPermission } from '../auth/access';
import Modal from '../components/Modal';
import {
  defaultManejaMateriales,
  isTipoSistemaInventario,
  tipoSistemaLabel,
  TIPOS_CON_MATERIALES,
  TIPOS_SISTEMA,
  type TipoSistemaInventario,
} from '../domain/sistemaTypes';
import {
  fromDatetimeLocalValue,
  getMaintenancePhase,
  toDatetimeLocalValue,
} from '../domain/maintenance';
import type { Organization } from '../types';

interface SistemaRow extends Organization {
  stockeaInstalled: boolean;
}

type SistemaFormState = {
  name: string;
  slug: string;
  tipo: TipoSistemaInventario | '';
  municipio: string;
  estado: string;
  direccion: string;
  manejaMateriales: boolean;
  ivaHabilitado: boolean;
  activo: boolean;
  mantenimientoActivo: boolean;
  mantenimientoInicio: string;
  mantenimientoFin: string;
};

const emptyForm: SistemaFormState = {
  name: '',
  slug: '',
  tipo: '',
  municipio: '',
  estado: '',
  direccion: '',
  manejaMateriales: false,
  ivaHabilitado: false,
  activo: true,
  mantenimientoActivo: false,
  mantenimientoInicio: '',
  mantenimientoFin: '',
};

function statusBadge(status: string) {
  switch (status) {
    case 'active': return 'badge-ok';
    case 'pending': return 'badge-warn';
    case 'suspended': return 'badge-critico';
    default: return 'badge-muted';
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function orgToForm(org: SistemaRow): SistemaFormState {
  const tipo = org.stockea?.tipo && isTipoSistemaInventario(org.stockea.tipo)
    ? org.stockea.tipo
    : '';
  const phase = getMaintenancePhase(org.maintenance);
  const hasMaintenance = phase === 'upcoming' || phase === 'active';
  return {
    name: org.name,
    slug: org.slug,
    tipo,
    municipio: org.stockea?.municipio ?? '',
    estado: org.stockea?.estado ?? '',
    direccion: org.stockea?.direccion ?? '',
    manejaMateriales: org.stockea?.maneja_materiales ?? false,
    ivaHabilitado: org.stockea?.iva_habilitado ?? false,
    activo: org.status === 'active',
    mantenimientoActivo: hasMaintenance,
    mantenimientoInicio: toDatetimeLocalValue(org.maintenance?.starts_at),
    mantenimientoFin: toDatetimeLocalValue(org.maintenance?.ends_at),
  };
}

function buildStockeaPayload(form: SistemaFormState, tipo: TipoSistemaInventario) {
  const soportaMateriales = TIPOS_CON_MATERIALES.includes(tipo);
  return {
    tipo,
    municipio: form.municipio.trim(),
    estado: form.estado.trim(),
    direccion: form.direccion.trim() || undefined,
    maneja_materiales: soportaMateriales ? form.manejaMateriales : false,
    iva_habilitado: form.ivaHabilitado,
  };
}

export default function SistemasPage() {
  const { session, cambiarOrganizacion, refreshOrganizations } = useAuth();
  const navigate = useNavigate();
  const [sistemas, setSistemas] = useState<SistemaRow[]>([]);
  const [stockeaAppId, setStockeaAppId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<SistemaRow | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const [orgs, catalog] = await Promise.all([
        listOrganizations(session.token),
        listCatalog(session.token),
      ]);
      const stockea = catalog.find((app) => app.slug === 'stockea');
      setStockeaAppId(stockea?.id ?? null);

      const rows = await Promise.all(
        orgs.map(async (org) => {
          const installed = await listInstalledApps(session.token, org.id);
          return {
            ...org,
            stockeaInstalled: installed.some((app) => app.slug === 'stockea'),
          };
        }),
      );
      setSistemas(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar sistemas');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingOrg(null);
    setFormOpen(true);
  };

  const openEdit = (org: SistemaRow) => {
    setEditingOrg(org);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingOrg(null);
  };

  const handleInstall = async (org: SistemaRow) => {
    if (!session || !stockeaAppId) return;
    setBusyOrgId(org.id);
    setError('');
    try {
      await installApp(session.token, stockeaAppId, org.id);
      setSuccess(`Stockea instalado en ${org.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al instalar Stockea');
    } finally {
      setBusyOrgId(null);
    }
  };

  const handleEnter = async (org: SistemaRow) => {
    setError('');
    try {
      await cambiarOrganizacion(org.id);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al entrar al sistema');
    }
  };

  const canEnter = (org: SistemaRow) =>
    org.stockeaInstalled || (session ? hasStockeaPermission(session.permissions) : false);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Sistemas de inventario</h2>
          <p className="page-subtitle">
            Crea organizaciones por giro de negocio, instala Stockea y entra al inventario de cada una
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Nuevo sistema
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success" onAnimationEnd={() => setSuccess('')}>
          {success}
        </div>
      )}

      <div className="panel">
        <div className="data-table-wrap">
          {loading ? (
            <div className="empty">Cargando sistemas...</div>
          ) : sistemas.length === 0 ? (
            <div className="empty">No hay sistemas registrados. Crea el primero.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Sucursal matriz</th>
                  <th>Estado</th>
                  <th>Mantenimiento</th>
                  <th>Stockea</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sistemas.map((org) => (
                  <tr key={org.id}>
                    <td><strong>{org.name}</strong></td>
                    <td>
                      {org.stockea?.tipo ? (
                        <>
                          <span className="badge badge-ok">{tipoSistemaLabel(org.stockea.tipo)}</span>
                          {org.stockea.maneja_materiales && (
                            <span className="badge badge-bajo" style={{ marginLeft: 4 }}>Materiales</span>
                          )}
                          {org.stockea.iva_habilitado && (
                            <span className="badge badge-bajo" style={{ marginLeft: 4 }}>IVA</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {org.stockea?.matriz_branch_code ? (
                        <>
                          <code>{org.stockea.matriz_branch_code}</code>
                          {org.stockea.municipio ? ` — ${org.stockea.municipio}` : ''}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(org.status)}`}>{org.status}</span>
                    </td>
                    <td>
                      {(() => {
                        const phase = getMaintenancePhase(org.maintenance);
                        if (phase === 'active') return <span className="badge badge-critico">Activo</span>;
                        if (phase === 'upcoming') return <span className="badge badge-warn">Programado</span>;
                        return <span className="text-muted">—</span>;
                      })()}
                    </td>
                    <td>
                      {org.stockeaInstalled ? (
                        <span className="badge badge-ok">Instalado</span>
                      ) : (
                        <span className="badge badge-bajo">Pendiente</span>
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(org)}
                        >
                          Editar
                        </button>
                        {!org.stockeaInstalled && stockeaAppId && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busyOrgId === org.id}
                            onClick={() => handleInstall(org)}
                          >
                            {busyOrgId === org.id ? 'Instalando...' : 'Instalar Stockea'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!canEnter(org)}
                          onClick={() => handleEnter(org)}
                        >
                          Entrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SistemaFormModal
        open={formOpen}
        org={editingOrg}
        stockeaAppId={stockeaAppId}
        onClose={closeForm}
        onSaved={async (message, orgId) => {
          closeForm();
          setSuccess(message);
          await refreshOrganizations();
          await cambiarOrganizacion(orgId);
          await load();
        }}
      />
    </>
  );
}

function SistemaFormModal({
  open,
  org,
  stockeaAppId,
  onClose,
  onSaved,
}: {
  open: boolean;
  org: SistemaRow | null;
  stockeaAppId: string | null;
  onClose: () => void;
  onSaved: (message: string, orgId: string) => Promise<void>;
}) {
  const { session } = useAuth();
  const isEdit = org != null;
  const [form, setForm] = useState<SistemaFormState>(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setError('');
      return;
    }
    setForm(org ? orgToForm(org) : emptyForm);
    setError('');
  }, [open, org]);

  const handleNameChange = (value: string) => {
    setForm((prev) => {
      const nextSlug = !isEdit && (!prev.slug || prev.slug === slugify(prev.name))
        ? slugify(value)
        : prev.slug;
      return { ...prev, name: value, slug: nextSlug };
    });
  };

  const handleTipoChange = (tipo: TipoSistemaInventario) => {
    setForm((prev) => ({
      ...prev,
      tipo,
      manejaMateriales: defaultManejaMateriales(tipo),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!isTipoSistemaInventario(form.tipo)) {
      setError('Selecciona el tipo de sistema');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const tipo = form.tipo;
      const stockea = buildStockeaPayload(form, tipo);

      if (isEdit && org) {
        if (form.mantenimientoActivo) {
          if (!form.mantenimientoInicio || !form.mantenimientoFin) {
            setError('Indica inicio y fin del mantenimiento');
            setLoading(false);
            return;
          }
          if (new Date(form.mantenimientoFin) <= new Date(form.mantenimientoInicio)) {
            setError('La hora de fin debe ser posterior al inicio');
            setLoading(false);
            return;
          }
        }
        await updateOrganization(session.token, org.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          status: form.activo ? 'active' : 'inactive',
          stockea,
          maintenance: form.mantenimientoActivo
            ? {
              starts_at: fromDatetimeLocalValue(form.mantenimientoInicio),
              ends_at: fromDatetimeLocalValue(form.mantenimientoFin),
            }
            : { clear: true },
        });
        await onSaved('Sistema actualizado', org.id);
      } else {
        const created = await createOrganization(session.token, {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          stockea,
        });
        if (stockeaAppId) {
          await installApp(session.token, stockeaAppId, created.id);
        }
        await onSaved('Sistema creado', created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${isEdit ? 'actualizar' : 'crear'} sistema`);
    } finally {
      setLoading(false);
    }
  };

  const soportaMateriales = isTipoSistemaInventario(form.tipo)
    && TIPOS_CON_MATERIALES.includes(form.tipo);

  return (
    <Modal
      open={open}
      title={isEdit ? 'Editar sistema de inventario' : 'Nuevo sistema de inventario'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="sistema-form" className="btn btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear sistema'}
          </button>
        </>
      }
    >
      <form id="sistema-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <p className="form-section-label">Datos del negocio</p>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="sistema-name">Nombre</label>
            <input
              id="sistema-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej. Mi negocio"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="sistema-tipo">Tipo de sistema</label>
            <select
              id="sistema-tipo"
              value={form.tipo}
              onChange={(e) => {
                const value = e.target.value;
                if (isTipoSistemaInventario(value)) {
                  handleTipoChange(value);
                } else {
                  setForm((prev) => ({ ...prev, tipo: '', manejaMateriales: false }));
                }
              }}
              required
            >
              <option value="">Seleccionar tipo...</option>
              {TIPOS_SISTEMA.map((t) => (
                <option key={t} value={t}>{tipoSistemaLabel(t)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="sistema-municipio">Municipio</label>
            <input
              id="sistema-municipio"
              value={form.municipio}
              onChange={(e) => setForm({ ...form, municipio: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sistema-estado">Estado</label>
            <input
              id="sistema-estado"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <label htmlFor="sistema-direccion">Dirección</label>
            <input
              id="sistema-direccion"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
          {soportaMateriales && (
            <div className="form-field full">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={form.manejaMateriales}
                  onChange={(e) => setForm({ ...form, manejaMateriales: e.target.checked })}
                />
                Llevar control de productos y materiales
              </label>
              <span className="form-hint">
                {form.manejaMateriales
                  ? 'El inventario manejará dos tipos de ítem: productos y materiales.'
                  : 'Solo se controlarán productos.'}
              </span>
            </div>
          )}
          <div className="form-field full">
            <label className="check-line">
              <input
                type="checkbox"
                checked={form.ivaHabilitado}
                onChange={(e) => setForm({ ...form, ivaHabilitado: e.target.checked })}
              />
              Cobrar IVA (16%) en las ventas
            </label>
            <span className="form-hint">
              Si se activa, la nota de venta desglosa el IVA y el total con impuesto.
            </span>
          </div>
          {isEdit && (
            <div className="form-field full">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                Sistema activo
              </label>
            </div>
          )}
          {isEdit && (
            <>
              <p className="form-section-label full">Mantenimiento</p>
              <div className="form-field full">
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={form.mantenimientoActivo}
                    onChange={(e) => setForm({
                      ...form,
                      mantenimientoActivo: e.target.checked,
                      mantenimientoInicio: e.target.checked ? form.mantenimientoInicio : '',
                      mantenimientoFin: e.target.checked ? form.mantenimientoFin : '',
                    })}
                  />
                  Programar ventana de mantenimiento
                </label>
                <span className="form-hint">
                  Durante el mantenimiento se muestra un aviso en rojo y se bloquean ventas, movimientos y cambios de inventario.
                </span>
              </div>
              {form.mantenimientoActivo && (
                <>
                  <div className="form-field">
                    <label htmlFor="mantenimiento-inicio">Inicia</label>
                    <input
                      id="mantenimiento-inicio"
                      type="datetime-local"
                      value={form.mantenimientoInicio}
                      onChange={(e) => setForm({ ...form, mantenimientoInicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="mantenimiento-fin">Termina</label>
                    <input
                      id="mantenimiento-fin"
                      type="datetime-local"
                      value={form.mantenimientoFin}
                      onChange={(e) => setForm({ ...form, mantenimientoFin: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
            </>
          )}
          {isEdit && org?.stockea?.matriz_branch_code && (
            <div className="form-field full">
              <label>Sucursal matriz</label>
              <span className="form-hint">
                <code>{org.stockea.matriz_branch_code}</code> (no editable)
              </span>
            </div>
          )}
          <div className="form-field full">
            <label htmlFor="sistema-slug">Identificador (slug)</label>
            <input
              id="sistema-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="mi-negocio"
              required
            />
          </div>
        </div>

        {!isEdit && (
          <p className="form-hint">
            Se creará la organización en Hildra con sucursal matriz, se guardará el tipo de sistema y se instalará Stockea automáticamente.
          </p>
        )}
      </form>
    </Modal>
  );
}
