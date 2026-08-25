import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { locale } = useDashboard();

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
    <header className="fixed top-0 left-0 right-0 lg:left-sidebar-width h-topbar-height bg-[#CCD3E2] flex justify-between items-center px-4 sm:px-container-margin z-40 shadow-md border-b border-gray-300">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-gray-700 hover:bg-white/50 transition-colors"
          title={locale === 'vi' ? 'Mở menu' : 'Open menu'}
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="w-1 h-6 bg-primary rounded-full hidden sm:block" />
        <h2 className="font-headline-sm text-headline-sm text-gray-800 font-bold tracking-wide truncate">{title}</h2>
        {tabs && tabs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1 ml-8 pl-8 border-l border-gray-400/30 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange && onTabChange(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-gray-600 hover:text-primary hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
        <NotificationBell />
        <div className="h-8 w-[1px] bg-gray-400" />
        <div className="relative">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
            onClick={() => setOpen(!open)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-body-sm font-bold text-gray-800">{userName}</p>
              <p className="text-[10px] text-gray-600">{userRole}</p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/15 text-primary rounded-full flex items-center justify-center font-bold">
              {getInitials(userName)}
            </div>
          </div>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">{userRole}</p>
                </div>
                <button
                  onClick={() => { setOpen(false); setShowProfile(true); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  {{ vi: 'Chỉnh sửa thông tin', en: 'Edit information' }[locale]}
                </button>
                <hr className="border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
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
