import type { PropsWithChildren } from 'react';

interface MobileCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function MobileCard({ title, subtitle, className = '', onClick, children }: MobileCardProps) {
  const content = (
    <>
      {(title || subtitle) && (
        <header className="mobile-card__header">
          {title && <h2>{title}</h2>}
          {subtitle && <span>{subtitle}</span>}
        </header>
      )}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`mobile-card mobile-card--button ${className}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <section className={`mobile-card ${className}`}>
      {content}
    </section>
  );
}
