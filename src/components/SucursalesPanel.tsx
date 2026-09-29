import { useCallback, useEffect, useState } from 'react';
import { createBranch, listBranches, updateBranch } from '../api/organizations';
import { branchSlug } from '../domain/branches';
import type { Branch } from '../types';
import { fileToLogoDataUrl, isDisplayableLogoUrl } from '../utils/logoImage';
import Modal from './Modal';
import { notifyBranchesChanged } from './WorkingBranch';

const emptyForm = { name: '', slug: '', code: '', imageUrl: '' };
const ACCEPTED = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

function branchError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'No se pudo guardar la sucursal';
  const lower = message.toLowerCase();
  if (lower.includes('slug already exists')) {
    return 'Ya existe una sucursal con ese identificador';
  }
  if (lower.includes('name and slug')) {
    return 'Ingresa el nombre de la sucursal';
  }
  if (lower.includes('invalid branch image') || lower.includes('demasiado grande')) {
    return 'La imagen no es válida o es demasiado grande';
  }
  return message;
}

export default function SucursalesPanel({ token, orgId }: { token: string; orgId: string }) {
  const [sucursales, setSucursales] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const branches = await listBranches(token, orgId);
      setSucursales(branches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las sucursales');
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => { cargar().catch(console.error); }, [cargar]);

  const abrir = () => {
    setEditing(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setError('');
    setModalOpen(true);
  };

  const editar = (branch: Branch) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      slug: branch.slug,
      code: branch.code ?? '',
      imageUrl: branch.image_url ?? '',
    });
    setSlugTouched(true);
    setError('');
    setModalOpen(true);
  };

  const cambiarNombre = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : branchSlug(name),
    }));
  };

  const guardar = async () => {
    setError('');
    const name = form.name.trim();
    const slug = branchSlug(form.slug || form.name);
    if (!name || !slug) {
      setError('Ingresa el nombre de la sucursal');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        slug,
        code: form.code.trim() || undefined,
        image_url: form.imageUrl,
      };
      if (editing) {
        await updateBranch(token, orgId, editing.id, payload);
        setSuccess(`Sucursal ${name} actualizada`);
      } else {
        await createBranch(token, orgId, payload);
        setSuccess(`Sucursal ${name} creada`);
      }
      setModalOpen(false);
      setEditing(null);
      await cargar();
      notifyBranchesChanged();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(branchError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: '1.25rem' }}>
      <div className="page-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h3 className="form-section-label" style={{ margin: 0 }}>Sucursales</h3>
          <p className="config-logo-help">
            Crea y edita las sucursales de este sistema. Puedes cargar la imagen de entrada en las que todavía no tienen.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={abrir}>
          + Nueva sucursal
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {!modalOpen && error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando sucursales…</div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Código</th>
                <th>Identificador</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sucursales.length === 0 ? (
                <tr><td colSpan={6} className="empty">Sin sucursales</td></tr>
              ) : sucursales.map((b) => (
                <tr key={b.id}>
                  <td>
                    {isDisplayableLogoUrl(b.image_url) ? (
                      <img src={b.image_url} alt="" className="branch-thumb" />
                    ) : (
                      <span className="page-subtitle">Sin imagen</span>
                    )}
                  </td>
                  <td>{b.name}</td>
                  <td>{b.code || '—'}</td>
                  <td><code>{b.slug}</code></td>
                  <td>
                    <span className={`badge ${b.status === 'active' ? 'badge-ok' : 'badge-muted'}`}>
                      {b.status === 'active' ? 'Activa' : b.status}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => editar(b)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar sucursal' : 'Nueva sucursal'}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditing(null); }} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" form="sucursal-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sucursal'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <form
          id="sucursal-form"
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <div className="form-field full">
            <label htmlFor="sucursal-nombre">Nombre *</label>
            <input
              id="sucursal-nombre"
              value={form.name}
              onChange={(e) => cambiarNombre(e.target.value)}
              placeholder="Ej. Centro, Norte, Plaza"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="sucursal-codigo">Código</label>
            <input
              id="sucursal-codigo"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Opcional"
              maxLength={50}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sucursal-slug">Identificador *</label>
            <input
              id="sucursal-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: e.target.value });
              }}
              required
            />
            <span className="form-hint">Se genera a partir del nombre. Debe ser único en el sistema.</span>
          </div>
          <div className="form-field full">
            <label htmlFor="sucursal-imagen">Imagen de entrada</label>
            {isDisplayableLogoUrl(form.imageUrl) && (
              <img src={form.imageUrl} alt="Imagen de la sucursal" className="branch-image-preview" />
            )}
            <input
              id="sucursal-imagen"
              key={editing?.id ?? 'nueva'}
              type="file"
              accept={ACCEPTED}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void fileToLogoDataUrl(file)
                  .then((imageUrl) => setForm((prev) => ({ ...prev, imageUrl })))
                  .catch((err) => setError(branchError(err)));
              }}
            />
            <span className="form-hint">
              {editing && !isDisplayableLogoUrl(form.imageUrl)
                ? 'Esta sucursal no tiene imagen. Elige un archivo para usarla al entrar.'
                : 'Se muestra en el sistema cuando alguien trabaja desde esta sucursal.'}
            </span>
            {form.imageUrl && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
              >
                Quitar imagen
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
