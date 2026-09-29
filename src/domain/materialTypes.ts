/** Medidas habituales para materiales de flores eternas. */
export const MATERIAL_UNITS = ['cm', 'mts', 'pza'] as const;

export type MaterialUnit = (typeof MATERIAL_UNITS)[number];

/** Colores habituales para materiales. */
export const MATERIAL_COLORS = [
  'Blanco',
  'Negro',
  'Rojo',
  'Rosa',
  'Amarillo',
  'Naranja',
  'Morado',
  'Azul',
  'Verde',
  'Dorado',
  'Plateado',
  'Cristal',
  'Natural',
  'Multicolor',
  'Otro',
] as const;

export type MaterialColor = (typeof MATERIAL_COLORS)[number];

/** Tipos / variantes de material (además del tipo principal). */
export const MATERIAL_VARIANT_TYPES = [
  'Preservada',
  'Seca',
  'Artificial',
  'Natural',
  'Sintética',
  'Otro',
] as const;

export type MaterialVariantType = (typeof MATERIAL_VARIANT_TYPES)[number];

export interface MaterialExtraFields {
  supplier: string;
  color: string;
  tipo: string;
  ancho: string;
}

const MATERIAL_META_PREFIX = 'stockea-material:';

export function isKnownMaterialColor(value: string): boolean {
  return MATERIAL_COLORS.includes(value as MaterialColor);
}

export function isKnownMaterialVariantType(value: string): boolean {
  return MATERIAL_VARIANT_TYPES.includes(value as MaterialVariantType);
}

/** Serializa proveedor, color, tipo y ancho en description (sin migración de API). */
export function encodeMaterialDescription(fields: MaterialExtraFields): string {
  const supplier = fields.supplier.trim();
  const color = fields.color.trim();
  const tipo = fields.tipo.trim();
  const ancho = fields.ancho.trim();
  if (!color && !tipo && !ancho) return supplier;
  return `${MATERIAL_META_PREFIX}${JSON.stringify({ supplier, color, tipo, ancho })}`;
}

export function decodeMaterialDescription(raw?: string | null): MaterialExtraFields {
  const text = raw?.trim() ?? '';
  if (!text.startsWith(MATERIAL_META_PREFIX)) {
    return { supplier: text, color: '', tipo: '', ancho: '' };
  }
  try {
    const parsed = JSON.parse(text.slice(MATERIAL_META_PREFIX.length)) as Partial<MaterialExtraFields>;
    return {
      supplier: parsed.supplier?.trim() ?? '',
      color: parsed.color?.trim() ?? '',
      tipo: parsed.tipo?.trim() ?? '',
      ancho: parsed.ancho?.trim() ?? '',
    };
  } catch {
    return { supplier: text, color: '', tipo: '', ancho: '' };
  }
}

export function formatMaterialWidth(ancho: string): string {
  if (!ancho) return '—';
  const n = Number(ancho);
  if (Number.isNaN(n)) return ancho;
  return `${n} cm`;
}

/** Ancho de cinta/tela; siempre en cm, independiente de la medida del inventario. */
export const MATERIAL_WIDTH_UNIT = 'cm';

/** Precio unitario = precio total de compra / cantidad (solo cantidad, no ancho). */
export function materialUnitCost(totalPurchase: number, quantity: number): number {
  if (!Number.isFinite(totalPurchase) || !Number.isFinite(quantity) || quantity <= 0) return 0;
  return totalPurchase / quantity;
}

export function materialTotalPurchase(unitCost: number, quantity: number): number {
  if (!Number.isFinite(unitCost) || !Number.isFinite(quantity)) return 0;
  return unitCost * quantity;
}

export function materialUnitCostLabel(unit: string): string {
  if (unit === 'pza') return 'Precio por pieza';
  if (unit === 'mts') return 'Precio por metro';
  return 'Precio por cm';
}

/** Tipos principales de material para arreglos de flores eternas. */
export const FLORES_ETERNAS_MATERIAL_TYPES = [
  'Flores preservadas',
  'Follaje',
  'Cinta / listón',
  'Tela',
  'Hilo',
  'Pegamento / silicon',
  'Espuma floral (oasis)',
  'Varilla / alambre',
  'Base / florero',
  'Musgo',
  'Otro',
] as const;

export type FloresEternasMaterialType = (typeof FLORES_ETERNAS_MATERIAL_TYPES)[number];

export function isKnownMaterialType(value: string): boolean {
  return FLORES_ETERNAS_MATERIAL_TYPES.includes(value as FloresEternasMaterialType);
}

export function normalizeMaterialUnit(unit?: string): MaterialUnit {
  if (unit === 'mts' || unit === 'pza') return unit;
  return 'cm';
}
