export const CREDIT_PERIOD_UNITS = ['dias', 'semanas', 'meses'] as const;
export type CreditPeriodUnit = (typeof CREDIT_PERIOD_UNITS)[number];

export function creditPeriodUnitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  const labels: Record<string, string> = {
    dias: 'Días',
    semanas: 'Semanas',
    meses: 'Meses',
  };
  return labels[unit] || unit;
}

export function creditPeriodSummary(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (!value || !unit) return '';
  const singular: Record<string, string> = {
    dias: 'día',
    semanas: 'semana',
    meses: 'mes',
  };
  const plural: Record<string, string> = {
    dias: 'días',
    semanas: 'semanas',
    meses: 'meses',
  };
  const label = value === 1 ? singular[unit] : plural[unit];
  return label ? `${value} ${label}` : `${value} ${unit}`;
}

export function applyCreditSurcharge(total: number, percent: number): number {
  if (!percent || percent <= 0) return Math.round(total * 100) / 100;
  return Math.round(total * (1 + percent / 100) * 100) / 100;
}
