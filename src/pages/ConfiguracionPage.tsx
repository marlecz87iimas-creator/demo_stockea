import { useCallback, useEffect, useRef, useState } from 'react';
import { setOrgConfigValue, getOrgConfiguration, updateOrgConfiguration } from '../api/configuration';
import { uploadFile } from '../api/files';
import { useAuth } from '../auth/AuthContext';
import SucursalesPanel from '../components/SucursalesPanel';
import { fileToLogoDataUrl, isDisplayableLogoUrl } from '../utils/logoImage';

const ACCEPTED = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

export default function ConfiguracionPage() {
  const { session, refreshAccess } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const orgName = session?.organizations.find((o) => o.id === session.orgId)?.name;

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    setLoading(true);
    setError('');
    try {
      const cfg = await getOrgConfiguration(session.token, session.orgId);
      const url = cfg.logo_url && isDisplayableLogoUrl(cfg.logo_url) ? cfg.logo_url : null;
      setLogoUrl(url);
      setPreview(url);
      setPendingFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la configuración');
      setLogoUrl(session.logoUrl);
      setPreview(session.logoUrl);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { cargar(); }, [cargar]);

  const onPick = async (file: File | null) => {
    setError('');
    setSuccess('');
    if (!file) {
      setPendingFile(null);
      setPreview(logoUrl);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen (PNG, JPG o WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar 5 MB.');
      return;
    }
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setPendingFile(file);
      setPreview(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen');
    }
  };

  const guardar = async () => {
    if (!session?.token || !session.orgId || !preview) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (pendingFile) {
        try {
          await uploadFile(session.token, pendingFile, session.orgId);
        } catch {
          /* el logo usable se guarda en configuración; el archivo es respaldo opcional */
        }
      }
      try {
        await setOrgConfigValue(session.token, session.orgId, 'LOGO_URL', preview);
      } catch (first) {
        try {
          await updateOrgConfiguration(session.token, session.orgId, { logo_url: preview });
        } catch {
          throw first;
        }
      }
      setLogoUrl(preview);
      setPendingFile(null);
      await refreshAccess();
      setSuccess('Logo de la empresa guardado. Se usará en el encabezado y en las notas de venta.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar el logo';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const quitar = async () => {
    if (!session?.token || !session.orgId) return;
    if (!confirm('¿Quitar el logo de la empresa?')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await setOrgConfigValue(session.token, session.orgId, 'LOGO_URL', '');
      setLogoUrl(null);
      setPreview(null);
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await refreshAccess();
      setSuccess('Logo eliminado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar el logo');
    } finally {
      setSaving(false);
    }
  };

  if (!session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Configuración del sistema</h2></div>
        <div className="alert alert-error">Selecciona una organización para configurar el sistema.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Configuración del sistema</h2>
          <p className="page-subtitle">
            {session?.isPlatformAdmin ? 'Logo y sucursales' : 'Logo de la empresa'}
            {orgName ? ` · ${orgName}` : ''}
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="panel config-logo-panel">
        <h3 className="form-section-label">Logo de la empresa</h3>
        <p className="config-logo-help">
          Esta imagen se muestra en el encabezado del sistema y en las notas (tickets) de venta.
        </p>

        {loading ? (
          <div className="empty">Cargando…</div>
        ) : (
          <>
            <div className="config-logo-preview">
              {preview ? (
                <img src={preview} alt="Logo de la empresa" className="config-logo-img" />
              ) : (
                <div className="config-logo-placeholder">Sin logo</div>
              )}
            </div>

            <div className="form-field" style={{ maxWidth: 420, marginTop: '1rem' }}>
              <label htmlFor="logo-file">Subir imagen</label>
              <input
                id="logo-file"
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="config-logo-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !preview || (!pendingFile && preview === logoUrl)}
                onClick={guardar}
              >
                {saving ? 'Guardando…' : 'Guardar logo'}
              </button>
              {(logoUrl || preview) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={quitar}
                >
                  Quitar logo
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {session?.isPlatformAdmin && session.token && session.orgId && (
        <SucursalesPanel token={session.token} orgId={session.orgId} />
      )}
    </div>
  );
}
