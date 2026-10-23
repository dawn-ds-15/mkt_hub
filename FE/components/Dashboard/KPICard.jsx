import { TrendingUp, TrendingDown, Minus, TrendingUp as UpBadgeIcon, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

const trendSymbols = { up: <TrendingUp className="w-3 h-3" />, flat: <Minus className="w-3 h-3" />, down: <TrendingDown className="w-3 h-3" /> };
const trendColors = { up: 'text-success', flat: 'text-warning', down: 'text-danger' };
const accentBorders = {
  blue: 'bg-[#2563EB]',
  yellow: 'bg-[#F59E0B]',
  orange: 'bg-[#F97316]',
  green: 'bg-[#10B981]',
  purple: 'bg-[#8B5CF6]',
};

const badgeIcons = {
  trending_up: <UpBadgeIcon className="w-3 h-3" />,
  schedule: <Clock className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  error: <AlertTriangle className="w-3 h-3" />,
  check_circle: <CheckCircle2 className="w-3 h-3" />,
};

export default function KPICard({ label, value, accent, trend, percentage, suffix, badge, planValue, planLabel, barColor, barWidth }) {
  const accentClass = accentBorders[accent] || 'bg-primary';
  return (
    <div className={`bg-white rounded-xl border border-border-light p-2.5 relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accentClass}`} />
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 truncate">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${accentClass} mr-1.5 align-middle`} />
        {label}
      </div>
      <div className="text-xl font-extrabold text-gray-900 tracking-tight mb-0.5 leading-tight">{value}</div>
      <div className={`flex items-center gap-1 text-[10px] ${trend ? trendColors[trend] : 'text-gray-400'}`}>
        {badge ? (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bgColor} ${badge.textColor}`}>
            {badgeIcons[badge.icon] || <UpBadgeIcon className="w-3 h-3" />}
            {badge.label}
          </span>
        ) : trend ? (
          <>
            <span className="inline-flex items-center">{trendSymbols[trend]}</span> {percentage}% {suffix}
          </>
        ) : null}
      </div>
      {planValue != null && (
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{planLabel}: {planValue}</div>
      )}
      {barWidth && (
        <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: barWidth }} />
        </div>
      )}
    </div>
  );
}