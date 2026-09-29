/** Demo mode: no backend, no login, ephemeral in-memory data. */
export const DEMO_MODE = true;

export const DEMO_LIMIT = 2;

export const DEMO_ORG_ID = 'demo-org-1';
export const DEMO_USER_ID = 'demo-user-1';
export const DEMO_BRANCH_ID = 'demo-branch-1';
export const DEMO_APP_ID = 'demo-app-stockea';

function encodeJwtPart(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

export const DEMO_TOKEN = [
  encodeJwtPart({ alg: 'none', typ: 'JWT' }),
  encodeJwtPart({
    sub: DEMO_USER_ID,
    roles: ['admin', 'manager'],
    permissions: [
      'stockea:products:read',
      'stockea:products:write',
      'stockea:movements:read',
      'stockea:movements:write',
      'stockea:sales:read',
      'stockea:sales:write',
      'identity:users:write',
      'organization:write',
      'configuration:write',
    ],
  }),
  'demo',
].join('.');

export const DEMO_REFRESH = 'demo-refresh-token';

export function demoLimitMessage(kind: string): string {
  return `En la demo solo puedes crear ${DEMO_LIMIT} ${kind}. Los datos se pierden al cerrar la página.`;
}
