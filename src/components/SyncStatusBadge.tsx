import { Cloud, CloudOff, RefreshCcw } from 'lucide-react';

interface SyncStatusBadgeProps {
  pendingCount: number;
  online: boolean;
  syncing?: boolean;
  onSync?: () => void;
}

export function SyncStatusBadge({ pendingCount, online, syncing = false, onSync }: SyncStatusBadgeProps) {
  return (
    <button className="sync-badge" type="button" onClick={onSync} disabled={!online || syncing}>
      {online ? <Cloud size={18} /> : <CloudOff size={18} />}
      <span>{pendingCount} pendientes</span>
      {syncing && <RefreshCcw className="spin" size={16} />}
    </button>
  );
}
