import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ProjectsPage from '../components/Projects';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';

const tabs = [
  { label: 'Danh sách Task', key: 'tasks' },
  { label: 'Kanban', key: 'kanban' },
  { label: 'Báo cáo Tuần', key: 'weekly' },
  { label: 'Dự án', key: 'projects' },
];

export default function ProjectsTasks() {
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
            Đang phát triển...
          </div>
        );
    }
  };

  return (
    <Layout title="Dự án & Task">
      <div className="space-y-6">
        <div className="flex items-center gap-8">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-body-md transition-opacity cursor-pointer pb-1 ${
                  activeTab === tab.key
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {renderContent()}
      </div>
    </Layout>
  );
}
