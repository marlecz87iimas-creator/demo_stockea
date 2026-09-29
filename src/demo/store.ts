import type { InstalledApp } from '../api/applications';
import type { OrgConfiguration } from '../api/configuration';
import type {
  Branch,
  CreateMovementInput,
  CreateProductInput,
  CreateSaleInput,
  CreateSaleLineInput,
  InventorySummary,
  OrgMember,
  Organization,
  PaginatedResult,
  PaySaleInput,
  Product,
  Sale,
  SaleLine,
  StockMovement,
  UpdateMemberInput,
  UpdateOrganizationInput,
  UpdateProductInput,
  User,
} from '../types';
import {
  DEMO_APP_ID,
  DEMO_BRANCH_ID,
  DEMO_LIMIT,
  DEMO_ORG_ID,
  DEMO_USER_ID,
  demoLimitMessage,
} from './config';

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function paginate<T>(items: T[], page = 1, limit = 50): PaginatedResult<T> {
  const p = Math.max(1, page);
  const l = Math.max(1, Math.min(200, limit));
  const start = (p - 1) * l;
  const slice = items.slice(start, start + l);
  return {
    items: slice,
    total: items.length,
    page: p,
    limit: l,
    total_pages: Math.max(1, Math.ceil(items.length / l)),
  };
}

export interface DemoStore {
  organizations: Organization[];
  branches: Branch[];
  products: Product[];
  movements: StockMovement[];
  sales: Sale[];
  members: OrgMember[];
  config: Record<string, OrgConfiguration>;
  installed: InstalledApp[];
  saleSeq: number;
}

function seedStore(): DemoStore {
  const created = nowIso();
  const org: Organization = {
    id: DEMO_ORG_ID,
    name: 'Demo Stockea',
    slug: 'demo-stockea',
    status: 'active',
    created_at: created,
    stockea: {
      tipo: 'REFACCIONARIA',
      maneja_materiales: true,
      iva_habilitado: true,
      municipio: 'Demo',
      estado: 'Demo',
      direccion: 'Calle Demo 1',
      matriz_branch_code: 'MAT',
    },
    maintenance: null,
  };
  const branch: Branch = {
    id: DEMO_BRANCH_ID,
    organization_id: DEMO_ORG_ID,
    name: 'Matriz',
    slug: 'matriz',
    code: 'MAT',
    status: 'active',
    created_at: created,
    updated_at: created,
  };
  const member: OrgMember = {
    id: 'demo-member-1',
    organization_id: DEMO_ORG_ID,
    organization_name: org.name,
    user_id: DEMO_USER_ID,
    email: 'demo@stockea.local',
    username: 'demo',
    first_name: 'Usuario',
    last_name: 'Demo',
    status: 'active',
    role_slug: 'manager',
    joined_at: created,
  };
  return {
    organizations: [org],
    branches: [branch],
    products: [],
    movements: [],
    sales: [],
    members: [member],
    config: {
      [DEMO_ORG_ID]: {
        organization_id: DEMO_ORG_ID,
        language: 'es',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        theme: 'light',
        tax_rate: '16',
        logo_url: undefined,
        updated_at: created,
      },
    },
    installed: [{
      organization_id: DEMO_ORG_ID,
      application_id: DEMO_APP_ID,
      name: 'Stockea',
      slug: 'stockea',
      description: 'Inventario y ventas',
      status: 'active',
      application_status: 'active',
      installed_at: created,
    }],
    saleSeq: 0,
  };
}

let store: DemoStore = seedStore();

export function resetDemoStore(): void {
  store = seedStore();
}

export function getDemoStore(): DemoStore {
  return store;
}

export function getDemoUser(): User {
  return {
    id: DEMO_USER_ID,
    email: 'demo@stockea.local',
    username: 'demo',
    first_name: 'Usuario',
    last_name: 'Demo',
    status: 'active',
    roles: ['admin', 'manager'],
    organizations: store.organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: 'manager',
    })),
    created_at: store.organizations[0]?.created_at ?? nowIso(),
  };
}

function assertLimit(kind: string, count: number): void {
  if (count >= DEMO_LIMIT) {
    throw new Error(demoLimitMessage(kind));
  }
}

function findOrg(orgId: string): Organization {
  const org = store.organizations.find((o) => o.id === orgId);
  if (!org) throw new Error('Organización no encontrada');
  return org;
}

function findProduct(orgId: string, productId: string): Product {
  const product = store.products.find((p) => p.id === productId && p.organization_id === orgId);
  if (!product) throw new Error('Producto no encontrado');
  return product;
}

function branchMeta(branchId?: string) {
  if (!branchId) return {};
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) return {};
  return {
    branch_id: branch.id,
    branch_name: branch.name,
    branch_code: branch.code,
  };
}

function productCount(orgId: string, itemType: 'product' | 'material'): number {
  return store.products.filter((p) => p.organization_id === orgId && p.item_type === itemType).length;
}

function summaryFor(orgId: string): InventorySummary {
  const products = store.products.filter((p) => p.organization_id === orgId && p.item_type === 'product');
  const active = products.filter((p) => p.status === 'active');
  return {
    organization_id: orgId,
    total_products: products.length,
    active_products: active.length,
    low_stock_products: active.filter((p) => p.low_stock).length,
    total_quantity: active.reduce((s, p) => s + p.quantity, 0),
    inventory_value: active.reduce((s, p) => s + p.quantity * p.unit_cost, 0),
  };
}

function filterProducts(
  orgId: string,
  params: URLSearchParams,
): Product[] {
  let items = store.products.filter((p) => p.organization_id === orgId);
  const itemType = params.get('item_type');
  if (itemType) items = items.filter((p) => p.item_type === itemType);
  const search = params.get('search')?.toLowerCase();
  if (search) {
    items = items.filter((p) =>
      p.name.toLowerCase().includes(search)
      || p.sku.toLowerCase().includes(search)
      || p.category.toLowerCase().includes(search));
  }
  const category = params.get('category');
  if (category) items = items.filter((p) => p.category === category);
  const status = params.get('status');
  if (status) items = items.filter((p) => p.status === status);
  const branchId = params.get('branch_id');
  if (branchId) items = items.filter((p) => p.branch_id === branchId);
  if (params.get('low_stock') === 'true') items = items.filter((p) => p.low_stock);
  return items;
}

function createProductRecord(orgId: string, input: CreateProductInput): Product {
  const itemType = input.item_type === 'material' ? 'material' : 'product';
  assertLimit(itemType === 'material' ? 'materiales' : 'productos', productCount(orgId, itemType));
  const created = nowIso();
  const qty = input.quantity ?? 0;
  const minQty = input.min_quantity ?? 0;
  const branch = branchMeta(input.branch_id);
  const org = findOrg(orgId);
  const seq = store.products.filter((p) => p.organization_id === orgId && p.item_type === itemType).length + 1;
  const sku = input.sku?.trim()
    || `stk-${org.slug}-${itemType === 'material' ? 'mat' : 'prod'}-${seq}-${(input.name || 'item').toLowerCase().replace(/\s+/g, '-')}`;
  const product: Product = {
    id: uid('prod'),
    organization_id: orgId,
    sku,
    name: input.name,
    description: input.description ?? '',
    category: input.category ?? '',
    unit: input.unit ?? 'pza',
    item_type: itemType,
    quantity: qty,
    min_quantity: minQty,
    unit_cost: input.unit_cost ?? 0,
    unit_price: input.unit_price ?? 0,
    status: 'active',
    low_stock: qty <= minQty,
    created_at: created,
    updated_at: created,
    ...branch,
  };
  store.products.unshift(product);

  if (input.initial_purchase && itemType === 'material') {
    const purchase = input.initial_purchase;
    const movement: StockMovement = {
      id: uid('mov'),
      organization_id: orgId,
      product_id: product.id,
      movement_type: 'in',
      quantity: qty || 1,
      balance_after: product.quantity,
      note: 'Compra inicial',
      purchased_at: purchase.purchased_at || created,
      supplier: purchase.supplier,
      total_purchase: purchase.total_purchase,
      purchase_unit_cost: qty > 0 ? purchase.total_purchase / qty : purchase.total_purchase,
      created_at: created,
    };
    store.movements.unshift(movement);
  } else if (qty > 0) {
    store.movements.unshift({
      id: uid('mov'),
      organization_id: orgId,
      product_id: product.id,
      movement_type: 'in',
      quantity: qty,
      balance_after: qty,
      note: 'Stock inicial',
      created_at: created,
    });
  }

  return product;
}

function applyMovement(orgId: string, productId: string, input: CreateMovementInput): { movement: StockMovement; product: Product } {
  const product = findProduct(orgId, productId);
  let nextQty = product.quantity;
  if (input.movement_type === 'in') nextQty += input.quantity;
  else if (input.movement_type === 'out') nextQty -= input.quantity;
  else nextQty = input.quantity;
  if (nextQty < 0) throw new Error('Stock insuficiente');

  if (input.branch_id) {
    Object.assign(product, branchMeta(input.branch_id));
  }

  product.quantity = nextQty;
  product.low_stock = product.quantity <= product.min_quantity;
  product.updated_at = nowIso();

  if (input.total_purchase != null && input.movement_type === 'in' && input.quantity > 0) {
    product.unit_cost = input.total_purchase / input.quantity;
  }

  const movement: StockMovement = {
    id: uid('mov'),
    organization_id: orgId,
    product_id: product.id,
    movement_type: input.movement_type,
    quantity: input.quantity,
    balance_after: product.quantity,
    note: input.note ?? '',
    purchased_at: input.purchased_at,
    supplier: input.supplier,
    total_purchase: input.total_purchase,
    purchase_unit_cost: input.total_purchase != null && input.quantity > 0
      ? input.total_purchase / input.quantity
      : undefined,
    created_at: nowIso(),
  };
  store.movements.unshift(movement);
  return { movement, product: { ...product } };
}

function buildSaleLines(saleId: string, lines: CreateSaleLineInput[]): SaleLine[] {
  const created = nowIso();
  return lines.map((line) => {
    const product = store.products.find((p) => p.id === line.product_id);
    if (!product) throw new Error('Producto no encontrado en la venta');
    if (product.quantity < line.quantity) {
      throw new Error(`Stock insuficiente para ${product.name}`);
    }
    return {
      id: uid('line'),
      sale_id: saleId,
      product_id: product.id,
      sku: product.sku,
      product_name: product.name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: line.quantity * line.unit_price,
      created_at: created,
    };
  });
}

function deductStock(lines: SaleLine[]): void {
  for (const line of lines) {
    const product = store.products.find((p) => p.id === line.product_id);
    if (!product) continue;
    product.quantity -= line.quantity;
    product.low_stock = product.quantity <= product.min_quantity;
    product.updated_at = nowIso();
    store.movements.unshift({
      id: uid('mov'),
      organization_id: product.organization_id,
      product_id: product.id,
      movement_type: 'out',
      quantity: line.quantity,
      balance_after: product.quantity,
      note: `Venta`,
      created_at: nowIso(),
    });
  }
}

function restoreStock(lines: SaleLine[]): void {
  for (const line of lines) {
    const product = store.products.find((p) => p.id === line.product_id);
    if (!product) continue;
    product.quantity += line.quantity;
    product.low_stock = product.quantity <= product.min_quantity;
    product.updated_at = nowIso();
  }
}

function createSaleRecord(orgId: string, input: CreateSaleInput): Sale {
  assertLimit('ventas', store.sales.filter((s) => s.organization_id === orgId).length);
  const org = findOrg(orgId);
  const saleId = uid('sale');
  const lines = buildSaleLines(saleId, input.lines);
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const ivaEnabled = !!org.stockea?.iva_habilitado;
  let tax = ivaEnabled ? subtotal * 0.16 : 0;
  let total = subtotal + tax;

  if (input.is_credit && (input.credit_surcharge_percent ?? 0) > 0) {
    const surcharge = total * ((input.credit_surcharge_percent ?? 0) / 100);
    total += surcharge;
  }
  if (input.payment_type === 'TARJETA' && (input.card_commission_percent ?? 0) > 0) {
    total += total * ((input.card_commission_percent ?? 0) / 100);
  }

  const created = nowIso();
  store.saleSeq += 1;
  const folio = `D-${String(store.saleSeq).padStart(4, '0')}`;
  const branch = branchMeta(input.branch_id);

  let creditDueAt: string | undefined;
  if (input.is_credit && input.credit_period_value) {
    const due = new Date(created);
    const unit = input.credit_period_unit || 'days';
    if (unit === 'months') due.setMonth(due.getMonth() + input.credit_period_value);
    else if (unit === 'weeks') due.setDate(due.getDate() + input.credit_period_value * 7);
    else due.setDate(due.getDate() + input.credit_period_value);
    creditDueAt = due.toISOString();
  }

  const amountReceived = input.amount_received ?? (input.is_credit ? 0 : total);
  const sale: Sale = {
    id: saleId,
    organization_id: orgId,
    folio,
    seller_id: DEMO_USER_ID,
    seller_email: 'demo@stockea.local',
    seller_name: 'Usuario Demo',
    seller_role: 'manager',
    org_name: org.name,
    payment_type: input.payment_type,
    subtotal,
    tax,
    total,
    amount_received: amountReceived,
    change: Math.max(0, amountReceived - total),
    notes: input.notes,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    iva_enabled: ivaEnabled,
    is_credit: !!input.is_credit,
    credit_period_value: input.credit_period_value,
    credit_period_unit: input.credit_period_unit,
    credit_surcharge_percent: input.credit_surcharge_percent,
    credit_due_at: creditDueAt,
    card_commission_percent: input.card_commission_percent,
    status: input.is_credit ? 'credit_pending' : 'completed',
    lines,
    created_at: created,
    ...branch,
  };

  deductStock(lines);
  store.sales.unshift(sale);
  return sale;
}

export const demoActions = {
  me: () => getDemoUser(),

  listOrganizations: () => ({ organizations: [...store.organizations] }),

  createOrganization: (input: {
    name: string;
    slug?: string;
    stockea?: Organization['stockea'];
  }) => {
    assertLimit('sistemas', store.organizations.length);
    const created = nowIso();
    const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-');
    const org: Organization = {
      id: uid('org'),
      name: input.name,
      slug,
      status: 'active',
      created_at: created,
      stockea: input.stockea ? {
        tipo: input.stockea.tipo,
        maneja_materiales: !!input.stockea.maneja_materiales,
        iva_habilitado: !!input.stockea.iva_habilitado,
        municipio: input.stockea.municipio,
        estado: input.stockea.estado,
        direccion: input.stockea.direccion,
      } : undefined,
    };
    store.organizations.push(org);
    store.config[org.id] = {
      organization_id: org.id,
      language: 'es',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      theme: 'light',
      tax_rate: '16',
      updated_at: created,
    };
    store.installed.push({
      organization_id: org.id,
      application_id: DEMO_APP_ID,
      name: 'Stockea',
      slug: 'stockea',
      status: 'active',
      application_status: 'active',
      installed_at: created,
    });
    const branch: Branch = {
      id: uid('branch'),
      organization_id: org.id,
      name: 'Matriz',
      slug: 'matriz',
      code: 'MAT',
      status: 'active',
      created_at: created,
      updated_at: created,
    };
    store.branches.push(branch);
    store.members.push({
      id: uid('member'),
      organization_id: org.id,
      organization_name: org.name,
      user_id: DEMO_USER_ID,
      email: 'demo@stockea.local',
      username: 'demo',
      first_name: 'Usuario',
      last_name: 'Demo',
      status: 'active',
      role_slug: 'manager',
      joined_at: created,
    });
    return org;
  },

  getOrganization: (orgId: string) => findOrg(orgId),

  updateOrganization: (orgId: string, input: UpdateOrganizationInput) => {
    const org = findOrg(orgId);
    if (input.name) org.name = input.name;
    if (input.slug) org.slug = input.slug;
    if (input.status) org.status = input.status;
    if (input.stockea) {
      org.stockea = {
        tipo: input.stockea.tipo,
        maneja_materiales: !!input.stockea.maneja_materiales,
        iva_habilitado: !!input.stockea.iva_habilitado,
        municipio: input.stockea.municipio,
        estado: input.stockea.estado,
        direccion: input.stockea.direccion,
        matriz_branch_code: org.stockea?.matriz_branch_code,
      };
    }
    if (input.maintenance) {
      if (input.maintenance.clear) org.maintenance = null;
      else if (input.maintenance.starts_at && input.maintenance.ends_at) {
        org.maintenance = {
          starts_at: input.maintenance.starts_at,
          ends_at: input.maintenance.ends_at,
        };
      }
    }
    return org;
  },

  listBranches: (orgId: string) => ({
    branches: store.branches.filter((b) => b.organization_id === orgId),
  }),

  createBranch: (orgId: string, input: { name: string; slug: string; code?: string; image_url?: string }) => {
    assertLimit('sucursales', store.branches.filter((b) => b.organization_id === orgId).length);
    const created = nowIso();
    const branch: Branch = {
      id: uid('branch'),
      organization_id: orgId,
      name: input.name,
      slug: input.slug,
      code: input.code,
      image_url: input.image_url,
      status: 'active',
      created_at: created,
      updated_at: created,
    };
    store.branches.push(branch);
    return branch;
  },

  updateBranch: (
    orgId: string,
    branchId: string,
    input: { name: string; slug: string; code?: string; image_url?: string },
  ) => {
    const branch = store.branches.find((b) => b.id === branchId && b.organization_id === orgId);
    if (!branch) throw new Error('Sucursal no encontrada');
    branch.name = input.name;
    branch.slug = input.slug;
    branch.code = input.code;
    branch.image_url = input.image_url;
    branch.updated_at = nowIso();
    return branch;
  },

  listMembers: (orgId?: string) => {
    const members = orgId
      ? store.members.filter((m) => m.organization_id === orgId)
      : store.members;
    return { members };
  },

  provisionMember: (orgId: string, input: {
    email: string;
    username?: string;
    password: string;
    first_name: string;
    last_name: string;
    role_slug?: string;
  }) => {
    const orgMembers = store.members.filter((m) => m.organization_id === orgId && m.user_id !== DEMO_USER_ID);
    assertLimit('usuarios', orgMembers.length);
    const org = findOrg(orgId);
    const created = nowIso();
    const member: OrgMember = {
      id: uid('member'),
      organization_id: orgId,
      organization_name: org.name,
      user_id: uid('user'),
      email: input.email,
      username: input.username,
      first_name: input.first_name,
      last_name: input.last_name,
      status: 'active',
      role_slug: input.role_slug || 'vendedor',
      joined_at: created,
      created_by: DEMO_USER_ID,
    };
    store.members.push(member);
    return member;
  },

  updateMember: (orgId: string, userId: string, input: UpdateMemberInput) => {
    const member = store.members.find((m) => m.organization_id === orgId && m.user_id === userId);
    if (!member) throw new Error('Usuario no encontrado');
    if (input.first_name != null) member.first_name = input.first_name;
    if (input.last_name != null) member.last_name = input.last_name;
    if (input.email != null) member.email = input.email;
    if (input.username != null) member.username = input.username;
    if (input.status != null) member.status = input.status;
    if (input.role_slug != null) member.role_slug = input.role_slug;
    return member;
  },

  removeMember: (orgId: string, userId: string) => {
    if (userId === DEMO_USER_ID) throw new Error('No puedes eliminar el usuario demo');
    store.members = store.members.filter((m) => !(m.organization_id === orgId && m.user_id === userId));
  },

  listInstalled: (orgId: string) => store.installed.filter((a) => a.organization_id === orgId),

  getConfig: (orgId: string) => {
    findOrg(orgId);
    return store.config[orgId] ?? {
      organization_id: orgId,
      language: 'es',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      theme: 'light',
      updated_at: nowIso(),
    };
  },

  updateConfig: (orgId: string, input: { logo_url?: string | null }) => {
    const cfg = demoActions.getConfig(orgId);
    if (input.logo_url === null) delete cfg.logo_url;
    else if (input.logo_url !== undefined) cfg.logo_url = input.logo_url;
    cfg.updated_at = nowIso();
    store.config[orgId] = cfg;
    return cfg;
  },

  setConfigValue: (orgId: string, key: string, value: string) => {
    const cfg = demoActions.getConfig(orgId) as OrgConfiguration & Record<string, string | undefined>;
    cfg[key] = value;
    cfg.updated_at = nowIso();
    store.config[orgId] = cfg;
  },

  summary: (orgId: string) => summaryFor(orgId),

  listProducts: (orgId: string, params: URLSearchParams) => {
    const items = filterProducts(orgId, params);
    return paginate(items, Number(params.get('page') || 1), Number(params.get('limit') || 50));
  },

  getProduct: (orgId: string, productId: string) => findProduct(orgId, productId),

  createProduct: (orgId: string, input: CreateProductInput) => createProductRecord(orgId, input),

  updateProduct: (orgId: string, productId: string, input: UpdateProductInput) => {
    const product = findProduct(orgId, productId);
    if (input.sku != null) product.sku = input.sku;
    if (input.name != null) product.name = input.name;
    if (input.description != null) product.description = input.description;
    if (input.category != null) product.category = input.category;
    if (input.unit != null) product.unit = input.unit;
    if (input.min_quantity != null) product.min_quantity = input.min_quantity;
    if (input.unit_cost != null) product.unit_cost = input.unit_cost;
    if (input.unit_price != null) product.unit_price = input.unit_price;
    if (input.status != null) product.status = input.status;
    if (input.branch_id != null) Object.assign(product, branchMeta(input.branch_id));
    product.low_stock = product.quantity <= product.min_quantity;
    product.updated_at = nowIso();
    return product;
  },

  deleteProduct: (orgId: string, productId: string) => {
    store.products = store.products.filter((p) => !(p.id === productId && p.organization_id === orgId));
    store.movements = store.movements.filter((m) => m.product_id !== productId);
  },

  createMovement: (orgId: string, productId: string, input: CreateMovementInput) =>
    applyMovement(orgId, productId, input),

  deleteMovement: (orgId: string, movementId: string) => {
    const movement = store.movements.find((m) => m.id === movementId && m.organization_id === orgId);
    if (!movement) return;
    const product = store.products.find((p) => p.id === movement.product_id);
    if (product) {
      if (movement.movement_type === 'in') product.quantity -= movement.quantity;
      else if (movement.movement_type === 'out') product.quantity += movement.quantity;
      product.low_stock = product.quantity <= product.min_quantity;
      product.updated_at = nowIso();
    }
    store.movements = store.movements.filter((m) => m.id !== movementId);
  },

  listMovements: (orgId: string, params: URLSearchParams) => {
    const items = store.movements.filter((m) => m.organization_id === orgId);
    return paginate(items, Number(params.get('page') || 1), Number(params.get('limit') || 50));
  },

  listProductMovements: (orgId: string, productId: string, params: URLSearchParams) => {
    const items = store.movements.filter((m) => m.organization_id === orgId && m.product_id === productId);
    return paginate(items, Number(params.get('page') || 1), Number(params.get('limit') || 50));
  },

  listSales: (orgId: string, params: URLSearchParams) => {
    let items = store.sales.filter((s) => s.organization_id === orgId);
    const from = params.get('from');
    const to = params.get('to');
    if (from) items = items.filter((s) => s.created_at >= from);
    if (to) items = items.filter((s) => s.created_at <= to);
    const creditFrom = params.get('credit_due_from');
    const creditTo = params.get('credit_due_to');
    if (creditFrom) items = items.filter((s) => (s.credit_due_at || '') >= creditFrom);
    if (creditTo) items = items.filter((s) => (s.credit_due_at || '') <= creditTo);
    return paginate(items, Number(params.get('page') || 1), Number(params.get('limit') || 50));
  },

  createSale: (orgId: string, input: CreateSaleInput) => createSaleRecord(orgId, input),

  getSale: (orgId: string, saleId: string) => {
    const sale = store.sales.find((s) => s.id === saleId && s.organization_id === orgId);
    if (!sale) throw new Error('Venta no encontrada');
    return sale;
  },

  paySale: (orgId: string, saleId: string, input: PaySaleInput) => {
    const sale = demoActions.getSale(orgId, saleId);
    sale.payment_type = input.payment_type;
    sale.amount_received = input.amount_received ?? sale.total;
    sale.change = Math.max(0, (sale.amount_received ?? 0) - sale.total);
    sale.card_commission_percent = input.card_commission_percent;
    sale.is_credit = false;
    sale.credit_paid_at = nowIso();
    sale.status = 'completed';
    return sale;
  },

  deleteSale: (orgId: string, saleId: string) => {
    const sale = store.sales.find((s) => s.id === saleId && s.organization_id === orgId);
    if (!sale) return;
    restoreStock(sale.lines);
    store.sales = store.sales.filter((s) => s.id !== saleId);
  },

  uploadFile: (file: File, organizationId?: string) => ({
    id: uid('file'),
    organization_id: organizationId,
    name: file.name,
    content_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    url: URL.createObjectURL(file),
    created_at: nowIso(),
  }),
};
