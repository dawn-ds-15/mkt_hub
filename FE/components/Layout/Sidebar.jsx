import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useDashboard } from '../../contexts/DashboardContext';

const navItems = [
  { vi: 'Tổng quan', en: 'Dashboard', href: '/' },
  { vi: 'Dự án', en: 'Projects', href: '/projects' },
  { vi: 'Task', en: 'Tasks', href: '/tasks' },
  { vi: 'Leads & KPIs', en: 'Leads & KPIs', href: '/leads' },
  { vi: 'Quản lý Chi phí', en: 'Expense Management', href: '/expense' },
  { vi: 'Kho vật phẩm', en: 'Inventory', href: '/inventory' },
  { vi: 'Quản lý Dữ liệu', en: 'Data Management', href: '/data' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function t(locale, strings) {
  return strings[locale] || strings.vi;
}

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { year, setYear, locale, toggleLocale } = useDashboard();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full w-sidebar-width bg-sidebar-bg flex flex-col p-2.5 overflow-y-auto z-50 transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 px-1.5 flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[14px]">hub</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-white leading-tight truncate">MKT Hub</h1>
            <p className="text-[8px] text-outline-variant font-medium tracking-wider uppercase truncate">{t(locale, { vi: 'Vận hành Marketing', en: 'Marketing Ops' })}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
                ? 'sidebar-active flex items-center gap-2 px-2 py-2 transition-colors'
                : 'text-outline-variant hover:text-white flex items-center gap-2 px-2 py-2 transition-colors group text-[12px]'
              }
            >
              <span className="font-body-md whitespace-nowrap">{item[locale]}</span>
            </Link>
          ))}
        </nav>

      <div className="mt-5 border-t border-slate-700 pt-4">
        <h3 className="px-2 text-[8px] text-outline-variant font-bold uppercase mb-2 tracking-widest">{t(locale, { vi: 'Bộ lọc', en: 'Filters' })}</h3>
        <div className="space-y-2 px-2">
          <div className="space-y-0.5">
            <label className="text-[10px] text-slate-400">{t(locale, { vi: 'Năm', en: 'Year' })}</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-slate-800 border-none rounded text-white text-[11px] py-1 focus:ring-1 focus:ring-primary"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="pt-4 border-t border-slate-700 space-y-0.5">
        <button
          onClick={toggleLocale}
          className="w-full text-left text-outline-variant hover:text-white flex items-center gap-2 px-2 py-1.5 transition-colors text-[12px]"
        >
          <span className="material-symbols-outlined text-[15px]">language</span>
          <span className="whitespace-nowrap">{locale === 'vi' ? 'English' : 'Tiếng Việt'}</span>
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('mkt_hub_token');
            localStorage.removeItem('mkt_hub_user');
            navigate('/login');
          }}
          className="w-full text-left text-outline-variant hover:text-white flex items-center gap-2 px-2 py-1.5 transition-colors text-[12px]"
        >
          <span className="material-symbols-outlined text-[15px]">logout</span>
          <span className="whitespace-nowrap">{t(locale, { vi: 'Đăng xuất', en: 'Logout' })}</span>
        </button>
      </div>
      </aside>
    </>
  );
}
