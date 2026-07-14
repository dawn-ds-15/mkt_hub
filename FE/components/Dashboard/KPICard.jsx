const trendIcons = {
  up: 'trending_up',
  flat: 'trending_flat',
  down: 'trending_down',
};

const trendColors = {
  up: 'text-success',
  flat: 'text-warning',
  down: 'text-danger',
};

export default function KPICard({ label, value, trend, percentage, suffix, barColor, barWidth }) {
  return (
    <div className="bg-white p-4 rounded-lg card-shadow flex flex-col justify-between relative overflow-hidden border border-border-light h-32">
      <div>
        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</p>
        <h3 className="text-data-display font-data-display text-primary mt-1">{value}</h3>
      </div>
      <div className="flex justify-between items-end">
        {trend ? (
          <div className={`flex items-center gap-1 ${trendColors[trend]}`}>
            <span className="material-symbols-outlined text-sm">{trendIcons[trend]}</span>
            <span className="text-data-subtext">{percentage}% {suffix}</span>
          </div>
        ) : (
          <div className={`flex items-center gap-1 ${suffix === 'Healthy' ? 'text-success font-bold' : 'text-on-surface-variant'}`}>
            <span className="text-data-subtext">{suffix}</span>
          </div>
        )}
      </div>
      {barWidth && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-container">
          <div className={`h-full ${barColor}`} style={{ width: barWidth }} />
        </div>
      )}
    </div>
  );
}
