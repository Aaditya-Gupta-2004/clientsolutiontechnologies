export default function StatsCard({ icon: Icon, label, value, color = 'blue', subtitle }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {subtitle && <div className="stat-change">{subtitle}</div>}
      </div>
    </div>
  );
}
