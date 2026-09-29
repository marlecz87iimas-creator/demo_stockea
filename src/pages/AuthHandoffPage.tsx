import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from '../api/auth';
import { listInstalledApps } from '../api/applications';
import { listOrganizations } from '../api/organizations';
import { canAccessInventory, isPlatformAdmin, parseJwtPermissions, parseJwtRoles, pickOrgId } from '../auth/access';
import { setOrgId, setRefreshToken, setToken } from '../auth/auth';
import StockeaLogo from '../components/StockeaLogo';
import type { InstalledApp, UserOrganization } from '../types';

async function resolveOrganizations(
  token: string,
  fromUser: UserOrganization[] | undefined,
): Promise<UserOrganization[]> {
  if (fromUser && fromUser.length > 0) {
    return fromUser.map((o) => ({ id: o.id, name: o.name, slug: o.slug, role: o.role ?? 'member' }));
  }
  if (!isPlatformAdmin(parseJwtRoles(token))) {
    return [];
  }
  const orgs = await listOrganizations(token);
  return orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, role: 'member' }));
}

export default function AuthHandoffPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const refresh = params.get('refresh');
    const org = params.get('org');

    if (!token || !refresh) {
      setError('Enlace de acceso inválido o expirado.');
      return;
    }

    setToken(token);
    setRefreshToken(refresh);
    if (org) setOrgId(org);

    (async () => {
      try {
        const user = await fetchCurrentUser(token);
        const organizations = await resolveOrganizations(token, user.organizations);
        const orgId = pickOrgId(organizations, org);
        if (orgId) setOrgId(orgId);

        let installedApps: InstalledApp[] = [];
        if (orgId) {
          try {
            installedApps = await listInstalledApps(token, orgId);
          } catch {
            installedApps = [];
          }
        }

        const permissions = parseJwtPermissions(token);
        if (!canAccessInventory(permissions, installedApps)) {
          setError('Tu cuenta no tiene acceso al inventario. Verifica que Costea esté instalado en tu organización.');
          return;
        }

        window.history.replaceState(null, '', '/dashboard');
        navigate('/dashboard', { replace: true });
        window.location.reload();
      } catch {
        setError('No se pudo validar la sesión. Intenta iniciar sesión manualmente.');
      }
    })();
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <StockeaLogo variant="login" />
          <p>Conectando desde Costea…</p>
        </div>
        {error ? (
          <div className="alert alert-error">{error}</div>
        ) : (
          <div className="empty">Preparando tu inventario…</div>
        )}
      </div>
    </div>
  );
}
