import { Cloud, CloudOff, RefreshCcw } from 'lucide-react';

interface SyncStatusBadgeProps {
  pendingCount: number;
  online: boolean;
  syncing?: boolean;
  onSync?: () => void;
}

export function SyncStatusBadge({ pendingCount, online, syncing = false, onSync }: SyncStatusBadgeProps) {
  const label = online ? `${pendingCount} pendientes por sincronizar` : 'Sin conexión';

  return (
    <button className="sync-badge" type="button" onClick={onSync} disabled={!online || syncing} aria-label={label} title={label}>
      {online ? <Cloud size={18} /> : <CloudOff size={18} />}
      <span className="sync-badge__label">{pendingCount} pendientes</span>
      {syncing && <RefreshCcw className="spin" size={16} />}
    </button>
  );
}
