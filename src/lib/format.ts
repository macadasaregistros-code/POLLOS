export function fmtNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function fmtKg(value: number, digits = 1): string {
  return `${fmtNumber(value, digits)} kg`;
}

export function fmtPercent(value: number, digits = 1): string {
  return `${fmtNumber(value * 100, digits)}%`;
}

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
