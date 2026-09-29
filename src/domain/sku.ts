import type { ItemType, Product } from '../types';

export const SKU_KIND_PRODUCT = 'prod';
export const SKU_KIND_MATERIAL = 'mat';

export function slugPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatItemSku(
  systemSlug: string,
  kind: typeof SKU_KIND_PRODUCT | typeof SKU_KIND_MATERIAL,
  sequence: number,
  itemName: string,
): string {
  const system = slugPart(systemSlug) || 'sistema';
  const name = slugPart(itemName) || 'item';
  const seq = sequence > 0 ? sequence : 1;
  return `stk-${system}-${kind}-${seq}-${name}`;
}

export function nextItemSequence(
  products: Product[],
  systemSlug: string,
  kind: typeof SKU_KIND_PRODUCT | typeof SKU_KIND_MATERIAL,
): number {
  const system = slugPart(systemSlug) || 'sistema';
  const prefix = `stk-${system}-${kind}-`;
  let max = 0;
  for (const product of products) {
    if (!product.sku.startsWith(prefix)) continue;
    const rest = product.sku.slice(prefix.length);
    const match = rest.match(/^(\d+)-/);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return max + 1;
}

export function previewSku(
  itemType: ItemType,
  systemSlug: string,
  itemName: string,
  products: Product[],
): string {
  const kind = itemType === 'material' ? SKU_KIND_MATERIAL : SKU_KIND_PRODUCT;
  const sequence = nextItemSequence(products, systemSlug, kind);
  if (!itemName.trim()) {
    const system = slugPart(systemSlug) || 'sistema';
    return `stk-${system}-${kind}-${sequence}-...`;
  }
  return formatItemSku(systemSlug, kind, sequence, itemName);
}
