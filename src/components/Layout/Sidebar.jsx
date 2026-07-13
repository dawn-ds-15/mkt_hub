import { useLocation } from 'react-router-dom';

const navItems = [
  { label: 'Tổng quan', href: '/' },
  { label: 'Dự án & Task', href: '/projects' },
  { label: 'Leads & KPIs', href: '/leads' },
  { label: 'Quản lý Chi phí', href: '/expense' },
  { label: 'Quản lý Dữ liệu', href: '/data' },
];

const bottomLinks = [
  { label: 'Cài đặt', href: '/settings' },
  { label: 'Trợ giúp', href: '/help' },
];

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  return (
    <aside className="fixed left-0 top-0 h-full w-sidebar-width bg-sidebar-bg flex flex-col p-4 overflow-y-auto z-50">
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-lg">hub</span>
        </div>
        <div>
          <h1 className="text-headline-md font-headline-md font-bold text-white">MKT Hub</h1>
          <p className="text-[10px] text-outline-variant font-medium tracking-wider uppercase">Vận hành Marketing</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
              ? 'sidebar-active flex items-center gap-3 px-3 py-2.5 transition-colors'
              : 'text-outline-variant hover:text-white flex items-center gap-3 px-3 py-2.5 transition-colors group'
            }
          >
            <span className="font-body-md text-body-md">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="px-3 text-[10px] text-outline-variant font-bold uppercase mb-4 tracking-widest">Global Filters</h3>
        <div className="space-y-3 px-3">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Năm</label>
            <select className="w-full bg-slate-800 border-none rounded text-white text-xs py-1.5 focus:ring-1 focus:ring-primary">
              <option>2024</option>
              <option>2023</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Dự án</label>
            <select className="w-full bg-slate-800 border-none rounded text-white text-xs py-1.5 focus:ring-1 focus:ring-primary">
              <option>Tất cả</option>
              <option>Chiến dịch Tết</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-700 space-y-1">
        {bottomLinks.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="text-outline-variant hover:text-white flex items-center gap-3 px-3 py-2 transition-colors"
          >
            <span className="font-body-md text-body-md">{item.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
