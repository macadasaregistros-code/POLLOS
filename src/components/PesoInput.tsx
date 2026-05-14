interface PesoInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  disabled?: boolean;
}

export function PesoInput({ label, value, onChange, onSave, disabled = false }: PesoInputProps) {
  return (
    <div className="peso-input">
      <label>
        <span>{label}</span>
        <input
          inputMode="decimal"
          type="number"
          min="1"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSave();
          }}
          disabled={disabled}
          autoFocus
        />
      </label>
      <button type="button" onClick={onSave} disabled={disabled || Number(value) <= 0}>
        Guardar y siguiente
      </button>
    </div>
  );
}
