import { useState } from 'react';
import Layout from '../components/Layout';
import ProjectsPage from '../components/Projects';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';

const tabs = [
  { label: 'Tasks List', key: 'tasks' },
  { label: 'Kanban', key: 'kanban' },
  { label: 'Weekly Report', key: 'weekly' },
  { label: 'Projects', key: 'projects' },
];

export default function ProjectsTasks() {
  const [activeTab, setActiveTab] = useState('tasks');

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        return <TaskList />;
      case 'kanban':
        return <KanbanBoard />;
      case 'weekly':
        return <WeeklyReport />;
      case 'projects':
        return <ProjectsPage />;
      default:
        return (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            Đang phát triển...
          </div>
        );
    }
  };

  return (
    <Layout title="Projects & Tasks">
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

      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </Layout>
  );
}
