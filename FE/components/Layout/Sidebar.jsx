import { useState, useEffect } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { usePermissionMatrix, effectiveLevel, moduleKeyOfPath, currentUser } from '../../utils/permissions';

const navItems = [
  { vi: 'Tổng quan', en: 'Dashboard', href: '/', icon: LayoutDashboard, count: null },
  { vi: 'Dự án', en: 'Projects', href: '/projects', icon: FolderKanban, count: null },
  { vi: 'Task', en: 'Tasks', href: '/tasks', icon: ListTodo, count: null },
  { vi: 'Leads & KPIs', en: 'Leads & KPIs', href: '/leads', icon: TrendingUp, count: null },
  { vi: 'Quản lý Chi phí', en: 'Expense Management', href: '/expense', icon: Wallet, count: null },
  { vi: 'Kho vật phẩm', en: 'Inventory', href: '/inventory', icon: Package, count: null },
  { vi: 'Quản lý Dữ liệu', en: 'Data Management', href: '/data', icon: Database, count: null },
];

const moduleTabs = {
  '/tasks': [
    { key: 'tasks', vi: 'Danh sách Task', en: 'Task List', roles: ['manager', 'specialist'] },
    { key: 'kanban', vi: 'Kanban', en: 'Kanban', roles: ['manager', 'specialist'] },
    { key: 'timeline', vi: 'Timeline', en: 'Timeline', roles: ['manager', 'specialist'] },
    { key: 'weekly', vi: 'Báo cáo Tuần', en: 'Weekly Report', roles: ['manager', 'specialist'] },
  ],
  '/leads': [
    { key: 'view', vi: 'Xem & Phân tích', en: 'View & Analytics', roles: ['manager', 'specialist'] },
    { key: 'input', vi: 'Nhập số liệu', en: 'Input Data', roles: ['manager', 'specialist'] },
    { key: 'compare', vi: 'So sánh kỳ', en: 'Compare Periods', roles: ['manager', 'specialist'] },
  ],
  '/expense': [
    { key: 'overview', vi: 'Tổng quan', en: 'Overview', roles: ['manager', 'specialist'] },
    { key: 'budget', vi: 'Ngân sách', en: 'Budget', roles: ['manager', 'specialist'] },
    { key: 'input', vi: 'Nhập chi phí', en: 'Input Expense', roles: ['manager', 'specialist'] },
  ],
  '/data': [
    { key: 'members', vi: 'Thành viên', en: 'Members', roles: ['manager'] },
    { key: 'permissions', vi: 'Phân quyền', en: 'Permissions', roles: ['manager'] },
    { key: 'dropdown', vi: 'Cấu hình Dropdown', en: 'Dropdown Config', roles: ['manager'] },
    { key: 'slack', vi: 'Cấu hình Slack', en: 'Slack Config', roles: ['manager'] },
    { key: 'backup', vi: 'Sao lưu & Đặt lại', en: 'Backup & Reset', roles: ['manager'] },
  ],
};

const moduleDefaultTab = {
  '/tasks': 'tasks',
  '/leads': 'view',
  '/expense': 'budget',
  '/data': 'members',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function t(locale, strings) {
  return strings[locale] || strings.vi;
}

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const currentTab = new URLSearchParams(location.search).get('tab');
  const { year, setYear, locale, toggleLocale } = useDashboard();
  const role = getUserRole();
  const [expanded, setExpanded] = useState(null);
  const permState = usePermissionMatrix();
  const me = currentUser();
  const visibleNavItems = navItems.filter((item) => effectiveLevel(permState?.matrix || {}, me, moduleKeyOfPath(item.href)) !== 'none');

  const isActive = (item) =>
    currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));

  const activeItem = visibleNavItems.find(isActive);
  const activeHref = activeItem ? activeItem.href : null;

  useEffect(() => {
    setExpanded(activeHref ? activeHref : null);
  }, [activeHref, currentPath]);

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
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const subs = (moduleTabs[item.href] || []).filter((tb) => tb.roles.includes(role));
            const isOpen = expanded === item.href;
            const defaultTab = moduleDefaultTab[item.href];
            const tabKey = (active && (currentTab || defaultTab)) || '';
            return (
              <div key={item.href} className="space-y-0.5">
                <Link
                  to={item.href}
                  onClick={() => {
                    if (subs.length > 0) setExpanded(isOpen ? null : item.href);
                    onClose();
                  }}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[12px] ${
                    active
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="font-body-md whitespace-nowrap flex-1">{item[locale]}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                  {subs.length > 0 && (
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </Link>
                {isOpen && subs.length > 0 && (
                  <div className="ml-4 pl-2 border-l border-slate-200 space-y-0.5 py-0.5">
                    {subs.map((tb) => {
                      const tabActive = tabKey === tb.key;
                      return (
                        <Link
                          key={tb.key}
                          to={`${item.href}?tab=${tb.key}`}
                          onClick={onClose}
                          className={`group flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-md transition-colors text-[11px] ${
                            tabActive
                              ? 'bg-brand-50 text-brand-700 font-semibold'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="whitespace-nowrap truncate flex-1">{tb[locale]}</span>
                          {tabActive && <span className="w-1 h-1 rounded-full bg-brand-600 shrink-0" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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