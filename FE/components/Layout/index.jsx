import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children, title, tabs, activeTab, onTabChange }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <Topbar title={title} tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} onMenuClick={() => setSidebarOpen(true)} />
      <main className="pt-topbar-height p-4 sm:p-gutter lg:ml-sidebar-width lg:pt-topbar-height min-h-screen">
        {children}
      </main>
    </div>
  );
}
