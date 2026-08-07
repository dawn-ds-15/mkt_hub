import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Danh sách Task', en: 'Task List', key: 'tasks' },
  { vi: 'Kanban', en: 'Kanban', key: 'kanban' },
  { vi: 'Báo cáo Tuần', en: 'Weekly Report', key: 'weekly' },
];

export default function Tasks() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tasks';

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        return <TaskList />;
      case 'kanban':
        return <KanbanBoard />;
      case 'weekly':
        return <WeeklyReport />;
      default:
        return (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            {locale === 'vi' ? 'Đang phát triển...' : 'In development...'}
          </div>
        );
    }
  };

  return (
    <Layout
      title={locale === 'vi' ? 'Task' : 'Tasks'}
      tabs={tabs.map(t => ({ label: t[locale] || t.vi, key: t.key }))}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </Layout>
  );
}
