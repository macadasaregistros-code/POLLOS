import type { PropsWithChildren } from 'react';

interface MobileCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function MobileCard({ title, subtitle, className = '', onClick, children }: MobileCardProps) {
  const Element = onClick ? 'button' : 'section';
  return (
    <Element className={`mobile-card ${onClick ? 'mobile-card--button' : ''} ${className}`} onClick={onClick}>
      {(title || subtitle) && (
        <header className="mobile-card__header">
          {title && <h2>{title}</h2>}
          {subtitle && <span>{subtitle}</span>}
        </header>
      )}
      {children}
    </Element>
  );
}
