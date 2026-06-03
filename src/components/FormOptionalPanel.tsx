import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface FormOptionalPanelProps {
  label: string;
  actionLabel?: string;
  value?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function FormOptionalPanel({ label, actionLabel = 'Agregar', value, children, icon, className = '' }: FormOptionalPanelProps) {
  const [open, setOpen] = useState(Boolean(value));

  useEffect(() => {
    if (value) setOpen(true);
  }, [value]);

  return (
    <div className={`form-optional-panel field--full ${open ? 'is-open' : ''} ${className}`}>
      <button className="form-optional-panel__toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="form-optional-panel__label">
          {icon && <span className="form-optional-panel__icon">{icon}</span>}
          <strong>{label}</strong>
        </span>
        <small>{open ? 'Ocultar' : actionLabel}</small>
      </button>
      {open && <div className="form-optional-panel__body">{children}</div>}
    </div>
  );
}
