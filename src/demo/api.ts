import { demoActions } from './store';

function parsePath(path: string): { pathname: string; search: URLSearchParams } {
  const [pathname, query = ''] = path.split('?');
  return { pathname, search: new URLSearchParams(query) };
}

function match(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(':')) params[expected.slice(1)] = actual;
    else if (expected !== actual) return null;
  }
  return params;
}

export async function handleDemoRequest<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { pathname, search } = parsePath(path);
  const data = route(pathname, search, method.toUpperCase(), body);
  return data as T;
}

export async function handleDemoUpload<T>(form: FormData): Promise<T> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('Archivo requerido');
  const organizationId = form.get('organization_id');
  return demoActions.uploadFile(
    file,
    typeof organizationId === 'string' ? organizationId : undefined,
  ) as T;
}

function route(
  pathname: string,
  search: URLSearchParams,
  method: string,
  body: unknown,
): unknown {
  // Auth
  if (pathname === '/identity/auth/login' && method === 'POST') {
    return { access_token: 'demo', refresh_token: 'demo' };
  }
  if (pathname === '/identity/auth/refresh' && method === 'POST') {
    return { access_token: 'demo', refresh_token: 'demo' };
  }
  if (pathname === '/identity/auth/logout' && method === 'POST') {
    return null;
  }
  if (pathname === '/identity/auth/me' && method === 'GET') {
    return demoActions.me();
  }

  // Applications
  {
    const p = match(pathname, '/applications/organizations/:orgId/installed');
    if (p && method === 'GET') return demoActions.listInstalled(p.orgId);
  }
  if (pathname === '/applications/catalog' && method === 'GET') {
    return { applications: [{ id: 'demo-app-stockea', name: 'Stockea', slug: 'stockea', status: 'active' }] };
  }
  {
    const p = match(pathname, '/applications/:appId/install');
    if (p && method === 'POST') return null;
  }

  // Configuration
  {
    const p = match(pathname, '/configurations/organizations/:orgId');
    if (p && method === 'GET') return demoActions.getConfig(p.orgId);
    if (p && method === 'PUT') return demoActions.updateConfig(p.orgId, (body ?? {}) as { logo_url?: string | null });
  }
  {
    const p = match(pathname, '/configurations/organizations/:orgId/:key');
    if (p && method === 'PUT') {
      const value = (body as { value?: string } | null)?.value ?? '';
      demoActions.setConfigValue(p.orgId, decodeURIComponent(p.key), value);
      return null;
    }
  }

  // Organizations
  if (pathname === '/organizations' && method === 'GET') return demoActions.listOrganizations();
  if (pathname === '/organizations' && method === 'POST') {
    return demoActions.createOrganization((body ?? {}) as Parameters<typeof demoActions.createOrganization>[0]);
  }
  if (pathname === '/organizations/members' && method === 'GET') return demoActions.listMembers();
  {
    const p = match(pathname, '/organizations/:orgId');
    if (p && method === 'GET') return demoActions.getOrganization(p.orgId);
    if (p && method === 'PATCH') {
      return demoActions.updateOrganization(p.orgId, (body ?? {}) as Parameters<typeof demoActions.updateOrganization>[1]);
    }
  }
  {
    const p = match(pathname, '/organizations/:orgId/members');
    if (p && method === 'GET') return demoActions.listMembers(p.orgId);
  }
  {
    const p = match(pathname, '/organizations/:orgId/members/provision');
    if (p && method === 'POST') {
      return demoActions.provisionMember(p.orgId, (body ?? {}) as Parameters<typeof demoActions.provisionMember>[1]);
    }
  }
  {
    const p = match(pathname, '/organizations/:orgId/members/:userId');
    if (p && method === 'PATCH') {
      return demoActions.updateMember(p.orgId, p.userId, (body ?? {}) as Parameters<typeof demoActions.updateMember>[2]);
    }
    if (p && method === 'DELETE') {
      demoActions.removeMember(p.orgId, p.userId);
      return null;
    }
  }
  {
    const p = match(pathname, '/organizations/:orgId/branches');
    if (p && method === 'GET') return demoActions.listBranches(p.orgId);
    if (p && method === 'POST') {
      return demoActions.createBranch(p.orgId, (body ?? {}) as Parameters<typeof demoActions.createBranch>[1]);
    }
  }
  {
    const p = match(pathname, '/organizations/:orgId/branches/:branchId');
    if (p && method === 'PATCH') {
      return demoActions.updateBranch(
        p.orgId,
        p.branchId,
        (body ?? {}) as Parameters<typeof demoActions.updateBranch>[2],
      );
    }
  }

  // Stockea
  {
    const p = match(pathname, '/stockea/organizations/:orgId/summary');
    if (p && method === 'GET') return demoActions.summary(p.orgId);
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/products');
    if (p && method === 'GET') return demoActions.listProducts(p.orgId, search);
    if (p && method === 'POST') {
      return demoActions.createProduct(p.orgId, (body ?? {}) as Parameters<typeof demoActions.createProduct>[1]);
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/products/:productId');
    if (p && method === 'GET') return demoActions.getProduct(p.orgId, p.productId);
    if (p && method === 'PUT') {
      return demoActions.updateProduct(
        p.orgId,
        p.productId,
        (body ?? {}) as Parameters<typeof demoActions.updateProduct>[2],
      );
    }
    if (p && method === 'DELETE') {
      demoActions.deleteProduct(p.orgId, p.productId);
      return null;
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/products/:productId/movements');
    if (p && method === 'GET') return demoActions.listProductMovements(p.orgId, p.productId, search);
    if (p && method === 'POST') {
      return demoActions.createMovement(
        p.orgId,
        p.productId,
        (body ?? {}) as Parameters<typeof demoActions.createMovement>[2],
      );
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/movements');
    if (p && method === 'GET') return demoActions.listMovements(p.orgId, search);
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/movements/:movementId');
    if (p && method === 'DELETE') {
      demoActions.deleteMovement(p.orgId, p.movementId);
      return null;
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/sales');
    if (p && method === 'GET') return demoActions.listSales(p.orgId, search);
    if (p && method === 'POST') {
      return demoActions.createSale(p.orgId, (body ?? {}) as Parameters<typeof demoActions.createSale>[1]);
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/sales/:saleId');
    if (p && method === 'GET') return demoActions.getSale(p.orgId, p.saleId);
    if (p && method === 'DELETE') {
      demoActions.deleteSale(p.orgId, p.saleId);
      return null;
    }
  }
  {
    const p = match(pathname, '/stockea/organizations/:orgId/sales/:saleId/pay');
    if (p && method === 'POST') {
      return demoActions.paySale(p.orgId, p.saleId, (body ?? {}) as Parameters<typeof demoActions.paySale>[2]);
    }
  }

  throw new Error(`Ruta demo no implementada: ${method} ${pathname}`);
}
