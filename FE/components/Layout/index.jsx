import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useDashboard } from '../../contexts/DashboardContext';
import { moduleKeyOfPath, useModuleLevel } from '../../utils/permissions';

export default function Layout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { locale } = useDashboard();
  const { pathname } = useLocation();
  const moduleKey = moduleKeyOfPath(pathname);
  const level = useModuleLevel(moduleKey || 'dashboard');

  useEffect(() => {
    const lockScroll = () => {
      document.body.style.overflow = window.innerWidth < 1024 && sidebarOpen ? 'hidden' : '';
    };
    lockScroll();
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="min-h-screen bg-background-subtle">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} />
      <main className="pt-topbar-height p-4 sm:p-gutter lg:ml-sidebar-width lg:pt-topbar-height min-h-screen">
        {/* Ma trận quyền (Quản lý dữ liệu → Phân quyền): "Không truy cập" chặn trang, "Chỉ xem" báo chế độ xem */}
        {moduleKey && level === 'none' ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3 text-on-surface-variant text-center">
            <span className="material-symbols-outlined text-[56px] text-outline-variant">lock</span>
            <p className="font-headline-sm">{locale === 'vi' ? 'Tài khoản của bạn không có quyền truy cập module này.' : 'Your account has no access to this module.'}</p>
            <p className="text-body-sm">{locale === 'vi' ? 'Liên hệ quản lý để được cấp quyền.' : 'Ask a manager for access.'}</p>
            <Link to="/" className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold">{locale === 'vi' ? 'Về trang tổng quan' : 'Go to dashboard'}</Link>
          </div>
        ) : (
          <>
            {moduleKey && level === 'view' && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5 text-[12px] text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-primary">visibility</span>
                {locale === 'vi' ? 'Bạn đang ở chế độ chỉ xem với module này — các thay đổi sẽ không được lưu.' : 'You have view-only access to this module — changes will not be saved.'}
              </div>
            )}
            {children}
          </>
        )}
      </main>
    </div>
  );
}
