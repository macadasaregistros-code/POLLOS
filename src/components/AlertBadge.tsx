import type { ReactNode } from 'react';
import type { Alerta } from '../types/entities';

interface AlertBadgeProps {
  nivel: Alerta['Nivel'];
  children: ReactNode;
}

export function AlertBadge({ nivel, children }: AlertBadgeProps) {
  return <span className={`alert-badge alert-badge--${nivel.toLowerCase()}`}>{children}</span>;
}
