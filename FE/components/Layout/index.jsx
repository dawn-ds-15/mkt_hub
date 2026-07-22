import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children, title, tabs, activeTab, onTabChange }) {
  return (
    <div className="min-h-screen bg-background-subtle">
      <Sidebar />
      <Topbar title={title} tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <main className="ml-sidebar-width pt-topbar-height p-gutter min-h-screen">
        {children}
      </main>
    </div>
  );
}
