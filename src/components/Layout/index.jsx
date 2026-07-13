import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children, title }) {
  return (
    <div className="min-h-screen bg-background-subtle">
      <Sidebar />
      <Topbar title={title} />
      <main className="ml-sidebar-width pt-topbar-height p-gutter min-h-screen">
        {children}
      </main>
    </div>
  );
}
