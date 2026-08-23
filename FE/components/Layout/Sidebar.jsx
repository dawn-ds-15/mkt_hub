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
        className={`fixed left-0 top-0 h-full w-sidebar-width bg-sidebar-bg flex flex-col p-4 overflow-y-auto z-50 transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 px-2 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg">hub</span>
          </div>
          <div>
            <h1 className="text-headline-md font-headline-md font-bold text-white">MKT Hub</h1>
            <p className="text-[10px] text-outline-variant font-medium tracking-wider uppercase">{t(locale, { vi: 'Vận hành Marketing', en: 'Marketing Operations' })}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
                ? 'sidebar-active flex items-center gap-3 px-3 py-2.5 transition-colors'
                : 'text-outline-variant hover:text-white flex items-center gap-3 px-3 py-2.5 transition-colors group'
              }
            >
              <span className="font-body-md text-body-md">{item[locale]}</span>
            </Link>
          ))}
        </nav>

      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="px-3 text-[10px] text-outline-variant font-bold uppercase mb-4 tracking-widest">{t(locale, { vi: 'Bộ lọc chung', en: 'Global Filters' })}</h3>
        <div className="space-y-3 px-3">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">{t(locale, { vi: 'Năm', en: 'Year' })}</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-slate-800 border-none rounded text-white text-xs py-1.5 focus:ring-1 focus:ring-primary"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="pt-6 border-t border-slate-700 space-y-1">
        <button
          onClick={toggleLocale}
          className="w-full text-left text-outline-variant hover:text-white flex items-center gap-3 px-3 py-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">language</span>
          <span className="font-body-md text-body-md">{locale === 'vi' ? 'English' : 'Tiếng Việt'}</span>
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('mkt_hub_token');
            localStorage.removeItem('mkt_hub_user');
            navigate('/login');
          }}
          className="w-full text-left text-outline-variant hover:text-white flex items-center gap-3 px-3 py-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="font-body-md text-body-md">{t(locale, { vi: 'Đăng xuất', en: 'Logout' })}</span>
        </button>
      </div>
      </aside>
    </>
  );
}
