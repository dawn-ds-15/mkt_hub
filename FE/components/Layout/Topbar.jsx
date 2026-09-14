import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, UserRound, LogOut } from 'lucide-react';
import ProfileModal from './ProfileModal';
import NotificationBell from './NotificationBell';
import { useDashboard } from '../../contexts/DashboardContext';

function getInitials(name) {
  return (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export default function Topbar({ title = 'Tổng quan', tabs, activeTab, onTabChange, onMenuClick }) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const { locale, theme, toggleTheme } = useDashboard();

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

  const handleLogout = () => {
    localStorage.removeItem('mkt_hub_token');
    localStorage.removeItem('mkt_hub_user');
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-sidebar-width h-topbar-height bg-white/95 backdrop-blur border-b border-slate-200 flex justify-between items-center px-4 sm:px-5 z-40 select-none">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title={locale === 'vi' ? 'Mở menu' : 'Open menu'}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-1 h-5 bg-brand-600 rounded-full hidden sm:block" />
        <h2 className="font-headline-sm text-headline-sm text-slate-800 font-bold tracking-tight truncate">{title}</h2>
        {tabs && tabs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1 ml-8 pl-8 border-l border-slate-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange && onTabChange(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all text-xs font-medium cursor-pointer"
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
        <div className="h-8 w-[1px] bg-slate-200" />
        <div className="relative">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
            onClick={() => setOpen(!open)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-body-sm font-bold text-slate-800">{userName}</p>
              <p className="text-[10px] text-slate-500">{userRole}</p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-brand-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm">
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
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-3 transition-colors"
                >
                  <UserRound className="w-4 h-4" />
                  {{ vi: 'Chỉnh sửa thông tin', en: 'Edit information' }[locale]}
                </button>
                <hr className="border-slate-100" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {{ vi: 'Đăng xuất', en: 'Logout' }[locale]}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          userEmail={userEmail}
        />
      )}
    </header>
  );
}