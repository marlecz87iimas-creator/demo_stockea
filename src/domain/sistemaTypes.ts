export const TIPOS_SISTEMA = [
  'REFACCIONARIA',
  'FRUTERIA',
  'MERCERIA',
  'PINATAS',
  'PASTELERIA',
  'DENTISTA',
  'COMERCIALIZADORA',
  'OTROS',
] as const;

export type TipoSistemaInventario = (typeof TIPOS_SISTEMA)[number];

export function isTipoSistemaInventario(value: string): value is TipoSistemaInventario {
  return (TIPOS_SISTEMA as readonly string[]).includes(value);
}

export const TIPOS_CON_MATERIALES: TipoSistemaInventario[] = ['MERCERIA', 'PINATAS', 'OTROS'];

export function tipoSistemaLabel(tipo: string): string {
  const labels: Record<string, string> = {
    REFACCIONARIA: 'Refaccionaria',
    FRUTERIA: 'Frutería',
    MERCERIA: 'Mercería',
    PINATAS: 'Piñatas',
    PASTELERIA: 'Pastelería',
    DENTISTA: 'Dentista',
    COMERCIALIZADORA: 'Comercializadora',
    OTROS: 'Otros',
  };
  return labels[tipo] || tipo;
}

export function defaultManejaMateriales(tipo: TipoSistemaInventario): boolean {
  return tipo === 'MERCERIA' || tipo === 'PINATAS';
}
