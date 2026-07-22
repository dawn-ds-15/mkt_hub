import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ProjectsPage from '../components/Projects';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Danh sách Task', en: 'Task List', key: 'tasks' },
  { vi: 'Kanban', en: 'Kanban', key: 'kanban' },
  { vi: 'Báo cáo Tuần', en: 'Weekly Report', key: 'weekly' },
  { vi: 'Dự án', en: 'Projects', key: 'projects' },
];

export default function ProjectsTasks() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tasks';
  const [projectsKey, setProjectsKey] = useState(0);

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
      case 'projects':
        return <ProjectsPage key={projectsKey} onProjectCreated={() => setProjectsKey(k => k + 1)} />;
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
      title={locale === 'vi' ? 'Dự án & Task' : 'Projects & Tasks'}
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
