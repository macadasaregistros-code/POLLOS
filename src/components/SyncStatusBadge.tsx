import { Cloud, CloudOff, RefreshCcw } from 'lucide-react';

interface SyncStatusBadgeProps {
  pendingCount: number;
  failedCount: number;
  online: boolean;
  syncing?: boolean;
  onSync?: () => void;
}

export function SyncStatusBadge({ pendingCount, failedCount, online, syncing = false, onSync }: SyncStatusBadgeProps) {
  const localCount = pendingCount + failedCount;
  const label = !online && localCount > 0
    ? `${localCount} guardado(s) en este dispositivo`
    : !online
      ? 'Sin conexion'
    : syncing
      ? 'Enviando...'
      : failedCount > 0
        ? `${failedCount} con error de envio`
        : pendingCount > 0
          ? `${pendingCount} por enviar`
          : 'Todo enviado';

  return (
    <button className="sync-badge" type="button" onClick={onSync} disabled={!online || syncing} aria-label={label} title={label}>
      {online ? <Cloud size={18} /> : <CloudOff size={18} />}
      <span className="sync-badge__label">{label}</span>
      {syncing && <RefreshCcw className="spin" size={16} />}
    </button>
  );
}
