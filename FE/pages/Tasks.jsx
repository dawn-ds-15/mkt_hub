import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';
import TaskTimeline from '../components/Projects/TaskTimeline';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Danh sách Task', en: 'Task List', key: 'tasks' },
  { vi: 'Kanban', en: 'Kanban', key: 'kanban' },
  { vi: 'Timeline', en: 'Timeline', key: 'timeline' },
  { vi: 'Báo cáo Tuần', en: 'Weekly Report', key: 'weekly' },
];

export default function Tasks() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tasks';

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  // Đã mở task theo ?taskId=... -> bỏ param khỏi URL để đóng modal rồi F5 không bật lại.
  const clearFocusTask = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('taskId');
      return next;
    }, { replace: true });
  };

  // ?due=overdue|soon từ badge Topbar: TaskList áp bộ lọc xong thì bỏ param để bấm lại badge vẫn kích hoạt.
  const clearDueFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('due');
      return next;
    }, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        return (
          <TaskList
            projectId={searchParams.get('projectId') || ''}
            focusTaskId={searchParams.get('taskId') || ''}
            onFocusHandled={clearFocusTask}
            dueFilter={searchParams.get('due') || ''}
            onDueFilterHandled={clearDueFilter}
          />
        );
      case 'kanban':
        return <KanbanBoard />;
      case 'timeline':
        return <TaskTimeline />;
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
