interface StatCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}

export function StatCard({ label, value, tone = 'neutral' }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
