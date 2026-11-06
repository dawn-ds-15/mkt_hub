import { useDashboard } from '@/shared/stores/DashboardContext';
import { X } from 'lucide-react';

export function Card({ className = '', children }) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-outline-variant/60">
      <div>
        <h2 className="font-headline-sm text-[15px] font-semibold text-on-surface">{title}</h2>
        {subtitle && <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  neutral: 'bg-surface-container text-on-surface-variant border-outline-variant/60',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warm: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
  brand: 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim',
};

export function Badge({ tone = 'neutral', children, dot = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-label-sm text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function KpiCard({ label, value, sub, trend, icon: Icon, tone = 'default', progress }) {
  const toneCls =
    tone === 'danger'
      ? 'bg-red-50/70 border-red-200'
      : tone === 'brand'
      ? 'bg-primary-fixed/40 border-primary-fixed-dim'
      : 'bg-surface-container-lowest border-outline-variant/60';
  return (
    <div className={`rounded-xl border p-3.5 shadow-sm ${toneCls}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-label-md text-[10px] uppercase tracking-wider font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-on-surface-variant'}`}>
          {label}
        </span>
        {Icon && <Icon className={`w-4 h-4 ${tone === 'danger' ? 'text-red-500' : 'text-outline'}`} />}
      </div>
      <div className={`mt-1.5 text-xl font-extrabold leading-tight tracking-tight ${tone === 'danger' ? 'text-red-700' : 'text-on-surface'}`}>
        {value}
      </div>
      {progress != null && (
        <div className="w-full h-1 rounded-full bg-surface-container-high overflow-hidden mt-2">
          <div className="h-full rounded-full bg-primary-container" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      {sub && <div className="mt-1 font-body-sm text-[11px] text-on-surface-variant">{sub}</div>}
      {trend && (
        <div className={`mt-1 font-label-sm text-[10px] font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-emerald-600'}`}>
          {trend}
        </div>
      )}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-outline-variant/60 bg-surface-container-low/50">{children}</div>;
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="h-8 min-w-[220px] px-3 rounded-lg bg-surface-container-low border border-transparent focus:border-secondary focus:bg-surface-container-lowest outline-none font-body-sm text-[12px] text-on-surface placeholder:text-outline"
    />
  );
}

const OPTION_LABELS = {"Trạng thái: Tất cả":"Status: All","Đang hoạt động":"Active","Có tín hiệu định danh":"Identity signal","Có khả năng trùng":"Possible duplicate","Chờ MKT xử lý":"Pending review","Không hoạt động":"Inactive","Đã định danh":"Identified","Loại user: Tất cả":"User type: All","User mới":"New user","User quay lại":"Returning user","Site: Tất cả domain":"Site: All domains","Mức điểm: Tất cả":"Score: All","Nhóm: Tất cả":"Group: All","Xung đột định danh":"Identity conflict","Thiếu dữ liệu":"Missing data","Nghi ngờ trùng":"Suspected duplicate","Chưa phân công":"Unassigned","Mapping công ty":"Company mapping","SĐT không hợp lệ":"Invalid phone","Chưa ghép hành trình":"Unmerged journey","Lỗi import":"Import error","Mới":"New","Đang xử lý":"Processing","Đã xử lý":"Done","Đã bỏ qua":"Skipped","Ngành nghề: Tất cả":"Industry: All","Khu vực: Tất cả":"Location: All","Funnel: Tất cả":"Funnel: All","Điểm: Tất cả":"Score: All","Owner: Tất cả":"Owner: All","Sales: Tất cả":"Sales: All","Chưa bàn giao":"Not handed over","Dự án: Tất cả":"Project: All"};

export function Select({ value, onChange, options, className = '' }) {
  const { locale } = useDashboard();
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-8 px-2 rounded-lg bg-surface-container-low border border-transparent focus:border-secondary outline-none font-body-sm text-[12px] text-on-surface cursor-pointer ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {locale === 'en' ? OPTION_LABELS[o.label] || o.label : o.label}
        </option>
      ))}
    </select>
  );
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const variants = {
    primary: 'bg-primary-container text-on-primary hover:bg-secondary',
    secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline-variant/60',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-on-surface-variant hover:bg-surface-container-high',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border border-outline-variant text-on-surface hover:bg-surface-container-low bg-transparent',
  };
  const sizes = { sm: 'h-7 px-2 text-[11px]', md: 'h-8 px-3 text-[12px]' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-outline-variant/60 bg-surface-container-lowest px-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-3 py-2.5 font-body-sm text-[12px] whitespace-nowrap transition-colors ${
            active === t.key
              ? 'text-primary-container font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${active === t.key ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>
              {t.count}
            </span>
          )}
          {active === t.key && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary-container" />}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
      <span className="material-symbols-outlined text-[40px] text-outline-variant mb-2">inbox</span>
      <p className="font-body-sm text-[12px]">{message}</p>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, width = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative w-full ${width} bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-2xl animate-slide-in max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-outline-variant/60">
          <div>
            <h3 className="font-headline-sm text-[15px] font-semibold text-on-surface">{title}</h3>
            {subtitle && <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-outline-variant/60 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 font-body-sm text-[10px] text-on-surface-variant">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-secondary focus:bg-surface-container-lowest outline-none font-body-sm text-[12px] text-on-surface placeholder:text-outline ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-secondary focus:bg-surface-container-lowest outline-none font-body-sm text-[12px] text-on-surface placeholder:text-outline resize-y ${className}`}
      {...props}
    />
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 font-body-sm text-[12px] text-on-surface cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 rounded border-outline-variant accent-primary-container" />
      {label}
    </label>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white shadow-xl font-body-sm text-[12px] animate-slide-in">
      <span className={`material-symbols-outlined text-[18px] ${toast.error ? 'text-red-400' : 'text-emerald-400'}`}>{toast.error ? 'error' : 'check_circle'}</span>
      {typeof toast === 'string' ? toast : toast.message}
    </div>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant text-left whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return <td className={`px-3 py-2.5 font-body-sm text-[12px] text-on-surface align-middle ${className}`}>{children}</td>;
}
