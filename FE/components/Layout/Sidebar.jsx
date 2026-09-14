import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  TrendingUp,
  Wallet,
  Package,
  Database,
  Languages,
  LogOut,
  Boxes,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

const navItems = [
  { vi: 'Tổng quan', en: 'Dashboard', href: '/', icon: LayoutDashboard, count: null },
  { vi: 'Dự án', en: 'Projects', href: '/projects', icon: FolderKanban, count: null },
  { vi: 'Task', en: 'Tasks', href: '/tasks', icon: ListTodo, count: null },
  { vi: 'Leads & KPIs', en: 'Leads & KPIs', href: '/leads', icon: TrendingUp, count: null },
  { vi: 'Quản lý Chi phí', en: 'Expense Management', href: '/expense', icon: Wallet, count: null },
  { vi: 'Kho vật phẩm', en: 'Inventory', href: '/inventory', icon: Package, count: null },
  { vi: 'Quản lý Dữ liệu', en: 'Data Management', href: '/data', icon: Database, count: null },
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

  const isActive = (item) =>
    currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full w-sidebar-width bg-white border-r border-slate-200 flex flex-col p-2.5 overflow-y-auto z-50 transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 px-1.5 py-1 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
            <Boxes className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-slate-900 leading-tight truncate">MKT Hub</h1>
            <p className="text-[8px] text-slate-500 font-medium tracking-wider uppercase truncate">{t(locale, { vi: 'Vận hành Marketing', en: 'Marketing Ops' })}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[12px] ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="font-body-md whitespace-nowrap flex-1">{item[locale]}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
              </Link>
            );
          })}
        </nav>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="px-2 text-[8px] text-slate-500 font-bold uppercase mb-2 tracking-widest">{t(locale, { vi: 'Bộ lọc', en: 'Filters' })}</h3>
        <div className="space-y-2 px-2">
          <div className="space-y-0.5">
            <label className="text-[10px] text-slate-500">{t(locale, { vi: 'Năm', en: 'Year' })}</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded text-slate-800 text-[11px] py-1 px-2 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/30"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 space-y-0.5">
        <button
          onClick={toggleLocale}
          className="w-full text-left text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[12px]"
        >
          <Languages className="w-4 h-4 text-slate-400" />
          <span className="whitespace-nowrap">{locale === 'vi' ? 'English' : 'Tiếng Việt'}</span>
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('mkt_hub_token');
            localStorage.removeItem('mkt_hub_user');
            navigate('/login');
          }}
          className="w-full text-left text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[12px]"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span className="whitespace-nowrap">{t(locale, { vi: 'Đăng xuất', en: 'Logout' })}</span>
        </button>
      </div>
      </aside>
    </>
  );
}