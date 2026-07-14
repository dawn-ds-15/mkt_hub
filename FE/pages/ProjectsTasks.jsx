import { useState } from 'react';
import Layout from '../components/Layout';
import ProjectsPage from '../components/Projects';
import KanbanBoard from '../components/Projects/KanbanBoard';
import TaskList from '../components/Projects/TaskList';
import WeeklyReport from '../components/Projects/WeeklyReport';
import CreateProjectForm from '../components/Projects/CreateProjectForm';

const tabs = [
  { label: 'Danh sách Task', key: 'tasks' },
  { label: 'Kanban', key: 'kanban' },
  { label: 'Báo cáo Tuần', key: 'weekly' },
  { label: 'Dự án', key: 'projects' },
];

export default function ProjectsTasks() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative max-w-lg w-full mx-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-100 z-10"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <CreateProjectForm onSuccess={() => setShowCreateModal(false)} onClose={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}

      <button
        onClick={() => { setActiveTab('projects'); setShowCreateModal(true); }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </Layout>
  );
}
