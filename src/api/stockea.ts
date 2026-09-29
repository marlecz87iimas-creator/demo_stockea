import type { CreateMovementInput, CreateProductInput, CreateSaleInput, InventorySummary, MovementResult, PaginatedResult, Product, Sale, StockMovement, UpdateProductInput, PaySaleInput } from '../types';
import { API_PATHS } from './config';
import { apiRequest } from './client';

function base(orgId: string) {
  return API_PATHS.stockea(orgId);
}

export async function getSummary(token: string, orgId: string): Promise<InventorySummary> {
  return apiRequest<InventorySummary>(`${base(orgId)}/summary`, { token });
}

export async function listProducts(
  token: string,
  orgId: string,
  params?: { search?: string; category?: string; low_stock?: boolean; status?: string; item_type?: string; branch_id?: string; page?: number; limit?: number },
): Promise<PaginatedResult<Product>> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.category) qs.set('category', params.category);
  if (params?.low_stock) qs.set('low_stock', 'true');
  if (params?.status) qs.set('status', params.status);
  if (params?.item_type) qs.set('item_type', params.item_type);
  if (params?.branch_id) qs.set('branch_id', params.branch_id);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiRequest<PaginatedResult<Product>>(`${base(orgId)}/products${query ? `?${query}` : ''}`, { token });
}

export async function getProduct(token: string, orgId: string, productId: string): Promise<Product> {
  return apiRequest<Product>(`${base(orgId)}/products/${productId}`, { token });
}

export async function createProduct(
  token: string,
  orgId: string,
  input: CreateProductInput,
): Promise<Product> {
  return apiRequest<Product>(`${base(orgId)}/products`, { method: 'POST', token, body: input });
}

export async function updateProduct(
  token: string,
  orgId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<Product> {
  return apiRequest<Product>(`${base(orgId)}/products/${productId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function deleteProduct(token: string, orgId: string, productId: string): Promise<void> {
  await apiRequest(`${base(orgId)}/products/${productId}`, { method: 'DELETE', token });
}

export async function createMovement(
  token: string,
  orgId: string,
  productId: string,
  input: CreateMovementInput,
): Promise<MovementResult> {
  return apiRequest<MovementResult>(`${base(orgId)}/products/${productId}/movements`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function deleteMovement(token: string, orgId: string, movementId: string): Promise<void> {
  await apiRequest(`${base(orgId)}/movements/${movementId}`, { method: 'DELETE', token });
}

export async function listMovements(
  token: string,
  orgId: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResult<StockMovement>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiRequest<PaginatedResult<StockMovement>>(`${base(orgId)}/movements${query ? `?${query}` : ''}`, { token });
}

export async function listProductMovements(
  token: string,
  orgId: string,
  productId: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResult<StockMovement>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiRequest<PaginatedResult<StockMovement>>(
    `${base(orgId)}/products/${productId}/movements${query ? `?${query}` : ''}`,
    { token },
  );
}

export async function listSales(
  token: string,
  orgId: string,
  params?: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    credit_due_from?: string;
    credit_due_to?: string;
  },
): Promise<PaginatedResult<Sale>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.credit_due_from) qs.set('credit_due_from', params.credit_due_from);
  if (params?.credit_due_to) qs.set('credit_due_to', params.credit_due_to);
  const query = qs.toString();
  return apiRequest<PaginatedResult<Sale>>(`${base(orgId)}/sales${query ? `?${query}` : ''}`, { token });
}

export async function createSale(
  token: string,
  orgId: string,
  input: CreateSaleInput,
): Promise<Sale> {
  return apiRequest<Sale>(`${base(orgId)}/sales`, { method: 'POST', token, body: input });
}

export async function paySale(
  token: string,
  orgId: string,
  saleId: string,
  input: PaySaleInput,
): Promise<Sale> {
  return apiRequest<Sale>(`${base(orgId)}/sales/${saleId}/pay`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function getSale(token: string, orgId: string, saleId: string): Promise<Sale> {
  return apiRequest<Sale>(`${base(orgId)}/sales/${saleId}`, { token });
}

export async function deleteSale(token: string, orgId: string, saleId: string): Promise<void> {
  await apiRequest(`${base(orgId)}/sales/${saleId}`, { method: 'DELETE', token });
}
