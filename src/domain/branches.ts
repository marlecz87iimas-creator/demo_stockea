import type { Branch, Product } from '../types';

export function branchLabel(branch: Pick<Branch, 'name' | 'code'>): string {
  return branch.code ? `${branch.name} (${branch.code})` : branch.name;
}

export function productBranchLabel(product: Pick<Product, 'branch_name' | 'branch_code'>): string {
  if (product.branch_name) {
    return product.branch_code ? `${product.branch_name} (${product.branch_code})` : product.branch_name;
  }
  if (product.branch_code) return product.branch_code;
  return 'Sin sucursal';
}

export function branchSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function pickDefaultBranchId(branches: Branch[]): string {
  const matriz = branches.find((b) => b.slug === 'matriz' && b.status === 'active');
  if (matriz) return matriz.id;
  const active = branches.find((b) => b.status === 'active');
  return active?.id ?? branches[0]?.id ?? '';
}
