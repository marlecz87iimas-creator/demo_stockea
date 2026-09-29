export type ItemType = 'product' | 'material';

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  status: string;
  roles?: string[];
  organizations?: UserOrganization[];
  created_at: string;
}

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  stockea?: StockeaSystemConfig;
  maintenance?: MaintenanceWindow | null;
}

export interface MaintenanceWindow {
  starts_at: string;
  ends_at: string;
}

export interface StockeaSystemConfig {
  tipo: string;
  maneja_materiales: boolean;
  iva_habilitado: boolean;
  municipio?: string;
  estado?: string;
  direccion?: string;
  matriz_branch_code?: string;
}

export interface CreateOrganizationStockeaInput {
  tipo: string;
  maneja_materiales?: boolean;
  iva_habilitado?: boolean;
  municipio?: string;
  estado?: string;
  direccion?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  status?: string;
  stockea?: CreateOrganizationStockeaInput;
  maintenance?: {
    starts_at?: string;
    ends_at?: string;
    clear?: boolean;
  };
}

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  item_type: ItemType;
  quantity: number;
  min_quantity: number;
  unit_cost: number;
  unit_price: number;
  status: 'active' | 'inactive';
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  balance_after: number;
  note: string;
  purchased_at?: string;
  supplier?: string;
  total_purchase?: number;
  purchase_unit_cost?: number;
  created_at: string;
}

export interface InventorySummary {
  organization_id: string;
  total_products: number;
  active_products: number;
  low_stock_products: number;
  total_quantity: number;
  inventory_value: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CreateProductInput {
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  item_type?: ItemType;
  quantity?: number;
  min_quantity?: number;
  unit_cost?: number;
  unit_price?: number;
  branch_id?: string;
  initial_purchase?: MaterialPurchaseInput;
}

export interface MaterialPurchaseInput {
  purchased_at?: string;
  supplier: string;
  total_purchase: number;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  min_quantity?: number;
  unit_cost?: number;
  unit_price?: number;
  status?: 'active' | 'inactive';
  branch_id?: string;
}

export interface CreateMovementInput {
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  note?: string;
  purchased_at?: string;
  supplier?: string;
  total_purchase?: number;
  branch_id?: string;
}

export interface MovementResult {
  movement: StockMovement;
  product: Product;
}

export type TipoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO';

export interface SaleLine {
  id: string;
  sale_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  folio: string;
  seller_id?: string;
  seller_email?: string;
  seller_name?: string;
  seller_role?: string;
  org_name?: string;
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  payment_type: TipoPago;
  subtotal: number;
  tax: number;
  total: number;
  amount_received?: number;
  change: number;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  iva_enabled: boolean;
  is_credit?: boolean;
  credit_period_value?: number;
  credit_period_unit?: string;
  credit_surcharge_percent?: number;
  credit_due_at?: string;
  credit_paid_at?: string;
  card_commission_percent?: number;
  status: string;
  lines: SaleLine[];
  created_at: string;
}

export interface CreateSaleLineInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateSaleInput {
  payment_type: TipoPago;
  amount_received?: number;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  branch_id?: string;
  is_credit?: boolean;
  credit_period_value?: number;
  credit_period_unit?: string;
  credit_surcharge_percent?: number;
  card_commission_percent?: number;
  lines: CreateSaleLineInput[];
}

export interface PaySaleInput {
  payment_type: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  amount_received?: number;
  card_commission_percent?: number;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  code?: string;
  image_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InstalledApp {
  organization_id: string;
  application_id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  application_status: string;
  installed_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  organization_name?: string;
  user_id: string;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  status: string;
  role_slug?: string;
  joined_at: string;
  created_by?: string;
}

export interface ProvisionMemberInput {
  email: string;
  username?: string;
  password: string;
  first_name: string;
  last_name: string;
  role_slug?: string;
}

export interface UpdateMemberInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  password?: string;
  status?: string;
  role_slug?: string;
}

export type AlertLevel = 'OK' | 'BAJO' | 'CRITICO';

export interface ReportInventorySummary {
  total_productos: number;
  total_unidades: number;
  alertas_criticas: number;
  alertas_bajas: number;
}

export interface ReportSalesSummary {
  total_ventas: number;
  monto_total: number;
  ventas_hoy: number;
}

export interface ReportCategoryRow {
  categoria: string;
  productos: number;
  unidades: number;
  alertas: number;
}

export interface ReportAlertRow {
  product_id: string;
  sku: string;
  producto_nombre: string;
  cantidad_actual: number;
  stock_minimo: number;
  cantidad_sugerida: number;
  nivel: AlertLevel;
}

export interface ReportMovementRow {
  id: string;
  fecha: string;
  tipo: string;
  sku: string;
  producto_nombre: string;
  cantidad: number;
}

export interface Reporte {
  inventario: ReportInventorySummary;
  ventas: ReportSalesSummary;
  por_categoria: ReportCategoryRow[];
  alertas: ReportAlertRow[];
  movimientos_recientes: ReportMovementRow[];
}

import type { StockeaProfile } from '../domain/stockeaRoles';

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: User;
  orgId: string | null;
  organizations: UserOrganization[];
  permissions: string[];
  roles: string[];
  stockeaProfile: StockeaProfile;
  canAccessPath: (path: string) => boolean;
  installedApps: InstalledApp[];
  canAccessInventory: boolean;
  isPlatformAdmin: boolean;
  canManageOrganizations: boolean;
  canManageOrgUsers: boolean;
  canManageSystemConfig: boolean;
  systemTipo: string | null;
  logoUrl: string | null;
  maintenance: MaintenanceWindow | null;
}
