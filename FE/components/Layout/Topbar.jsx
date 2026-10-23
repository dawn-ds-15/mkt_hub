import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon, UserRound, LogOut } from 'lucide-react';
import ProfileModal from './ProfileModal';
import NotificationBell from './NotificationBell';
import { useDashboard } from '../../contexts/DashboardContext';
import { subscribeTasks } from '../../services/taskPoller';
import { isTaskDueSoon } from '../../services/api';

function getInitials(name) {
  return (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export default function Topbar({ title = 'Tổng quan', onMenuClick }) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const { locale, theme, toggleTheme, periodType, periodValue, year } = useDashboard();

  let userName = { vi: 'Người dùng', en: 'User' }[locale];
  let userEmail = '';
  let userRole = { vi: 'Thành viên', en: 'Member' }[locale];
  try {
    const raw = localStorage.getItem('mkt_hub_user');
    if (raw) {
      const u = JSON.parse(raw);
      userName = u.name || u.email || { vi: 'Người dùng', en: 'User' }[locale];
      userEmail = u.email || '';
      userRole = u.role === 'manager' ? ({ vi: 'Quản lý', en: 'Manager' })[locale] : 'Specialist';
    }
  } catch {}

  const cycleText = useMemo(() => {
    const y = `${locale === 'vi' ? 'Năm' : 'Year'} ${year}`;
    switch (periodType) {
      case 'month':
        return `${locale === 'vi' ? 'Tháng' : 'Month'} ${periodValue} · ${y}`;
      case 'quarter':
        return `${locale === 'vi' ? 'Quý' : 'Quarter'} ${periodValue} · ${y}`;
      case 'year':
        return `${locale === 'vi' ? 'Cả năm' : 'Full year'} · ${y}`;
      default:
        return `${locale === 'vi' ? 'Tuần' : 'Week'} ${periodValue} · ${y}`;
    }
  }, [locale, periodType, periodValue, year]);

  const cycleShort = useMemo(() => {
    if (periodType === 'year') return `${locale === 'vi' ? 'Năm' : 'Year'} ${year}`;
    const label =
      locale === 'vi'
        ? { week: 'Tuần', month: 'Tháng', quarter: 'Quý' }[periodType]
        : { week: 'Week', month: 'Month', quarter: 'Q' }[periodType];
    return `${label} ${periodValue}/${year}`;
  }, [locale, periodType, periodValue, year]);

  const [overdueCount, setOverdueCount] = useState(0);
  const [dueSoonCount, setDueSoonCount] = useState(0);

  useEffect(() => {
    // Cùng điều kiện với bộ lọc ?due=... ở Danh sách Task để bấm vào ra đúng số task.
    const compute = (tasks) => {
      setOverdueCount(tasks.filter((t) => t.status === 'overdue').length);
      setDueSoonCount(tasks.filter((t) => isTaskDueSoon(t)).length);
    };
    return subscribeTasks(compute);
  }, []);

  const syncTime = useMemo(
    () => new Date().toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    [locale]
  );

  const handleLogout = () => {
    localStorage.removeItem('mkt_hub_token');
    localStorage.removeItem('mkt_hub_user');
    navigate('/login');
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 lg:left-sidebar-width h-topbar-height bg-white/95 backdrop-blur border-b border-slate-200 flex justify-between items-center px-4 sm:px-5 z-40 select-none shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title={locale === 'vi' ? 'Mở menu' : 'Open menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer shrink-0"
          title={locale === 'vi' ? 'Về trang chủ' : 'Go to dashboard'}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-brand-500/20">
            MK
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm tracking-tight text-slate-800">MKT Hub</span>
            <span className="text-[10px] text-slate-500 ml-1 tabular-nums">v1.0.0</span>
          </div>
        </button>

        <div className="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1 shrink-0" />

        <div className="hidden lg:flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-slate-700 truncate">{title}</span>
          <span className="text-slate-400 shrink-0">•</span>
          <span className="text-slate-500 tabular-nums text-[11px] shrink-0">{cycleText}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* PRD-01 status badges */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] tabular-nums">
          <button
            onClick={() => navigate('/tasks?tab=tasks&due=overdue')}
            className="cursor-pointer px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1 hover:bg-rose-100 transition-colors"
            title={locale === 'vi' ? `Xem task quá hạn (${overdueCount})` : `View overdue tasks (${overdueCount})`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>{overdueCount} {locale === 'vi' ? 'Quá hạn' : 'Overdue'}</span>
          </button>
          <button
            onClick={() => navigate('/tasks?tab=tasks&due=soon')}
            className="cursor-pointer px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold flex items-center gap-1 hover:bg-amber-100 transition-colors"
            title={locale === 'vi' ? `Xem task sắp hạn (${dueSoonCount})` : `View tasks due soon (${dueSoonCount})`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{dueSoonCount} {locale === 'vi' ? 'Sắp hạn' : 'Due soon'}</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="hidden sm:flex cursor-pointer px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold items-center gap-1 hover:bg-emerald-100 transition-colors"
            title={locale === 'vi' ? 'Chu kỳ báo cáo hiện tại' : 'Current reporting period'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{cycleShort}</span>
          </button>
        </div>

        {/* Sync status */}
        <div className="hidden 2xl:flex items-center gap-1 text-[11px] text-emerald-600 tabular-nums pl-1 shrink-0">
          <span>{locale === 'vi' ? 'Cập nhật lúc' : 'Updated at'} {syncTime}</span>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => navigate('/tasks')}
          className="hidden md:flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          title={locale === 'vi' ? 'Tìm kiếm công việc' : 'Search tasks'}
        >
          <Search className="w-3.5 h-3.5" />
          <kbd className="font-mono text-[10px] bg-white text-slate-600 border border-slate-200 px-1 rounded">⌘K</kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all text-xs font-medium cursor-pointer shadow-sm shrink-0"
          title={theme === 'dark'
            ? (locale === 'vi' ? 'Chuyển sang giao diện sáng' : 'Switch to light mode')
            : (locale === 'vi' ? 'Chuyển sang giao diện tối' : 'Switch to dark mode')}
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[11px] font-medium text-slate-200">{locale === 'vi' ? 'Tối' : 'Dark'}</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-slate-700">{locale === 'vi' ? 'Sáng' : 'Light'}</span>
            </>
          )}
        </button>

        <NotificationBell />
        <div className="h-8 w-[1px] bg-slate-200 shrink-0" />
        <div className="relative">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
            onClick={() => setOpen(!open)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-body-sm font-bold text-slate-800">{userName}</p>
              <p className="text-[10px] text-slate-500">{userRole}</p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-brand-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm shrink-0">
              {getInitials(userName)}
            </div>
          </div>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-900">{userName}</p>
                  <p className="text-xs text-slate-500">{userRole}</p>
              </div>
                <button
                  onClick={() => { setOpen(false); setShowProfile(true); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <UserRound className="w-4 h-4" />
                  {{ vi: 'Chỉnh sửa thông tin', en: 'Edit information' }[locale]}
                </button>
                <hr className="border-slate-100" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  {{ vi: 'Đăng xuất', en: 'Logout' }[locale]}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </header>
    {showProfile && (
      <ProfileModal
        onClose={() => setShowProfile(false)}
        userEmail={userEmail}
      />
    )}
    </>
  );
}