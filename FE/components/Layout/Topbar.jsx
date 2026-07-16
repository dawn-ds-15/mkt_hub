import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function getInitials(name) {
  return (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export default function Topbar({ title = 'Tổng quan' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  let userName = 'Người dùng';
  let userRole = 'Thành viên';
  try {
    const raw = localStorage.getItem('mkt_hub_user');
    if (raw) {
      const u = JSON.parse(raw);
      userName = u.name || u.email || 'Người dùng';
      userRole = u.role === 'manager' ? 'Quản lý' : 'Specialist';
    }
  } catch {}

  const handleLogout = () => {
    localStorage.removeItem('mkt_hub_token');
    localStorage.removeItem('mkt_hub_user');
    navigate('/login');
  };

  return (
    <header className="fixed top-0 right-0 h-topbar-height bg-surface border-b border-border-light flex justify-between items-center px-container-margin w-[calc(100%-260px)] ml-auto z-40">
      <div className="flex items-center gap-4">
        <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{title}</h2>

      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">history</span>
          </button>
        </div>
        <div className="h-8 w-[1px] bg-border-light" />
        <div className="relative">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setOpen(!open)}
          >
            <div className="text-right">
              <p className="text-body-sm font-bold text-on-surface">{userName}</p>
              <p className="text-[10px] text-on-surface-variant">{userRole}</p>
            </div>
            <div className="w-10 h-10 bg-primary-container text-white rounded-full flex items-center justify-center font-bold">
              {getInitials(userName)}
            </div>
          </div>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border-light rounded-lg shadow-xl z-20 py-1">
                <button
                  onClick={() => { setOpen(false); navigate('/settings'); }}
                  className="w-full px-4 py-2.5 text-left text-body-md text-on-surface hover:bg-surface-container-low flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  Cài đặt
                </button>
                <hr className="border-border-light" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-body-md text-danger hover:bg-red-50 flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
