import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import Layout from '../components/Layout';
import ProjectListTable from '../components/Projects/ProjectListTable';
import ProjectGroupOverview from '../components/Projects/ProjectGroupOverview';
import { useDashboard } from '../contexts/DashboardContext';

export default function ProjectsModule() {
  const { locale } = useDashboard();
  const vi = locale === 'vi';
  const [view, setView] = useState('overview');
  const [listTypeFilter, setListTypeFilter] = useState('All');

  const tabs = [
    { key: 'overview', icon: LayoutGrid, label: vi ? 'Tổng quan' : 'Overview' },
    { key: 'list', icon: List, label: vi ? 'Danh sách' : 'List' },
  ];

  return (
    <Layout title={vi ? 'Dự án' : 'Projects'}>
      <div className="space-y-6">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-border-light">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs leading-[18px] font-semibold transition-colors cursor-pointer ${
                view === t.key
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {view === 'overview' ? (
          <ProjectGroupOverview
            onOpenFullList={(type) => { setListTypeFilter(type); setView('list'); }}
          />
        ) : (
          <ProjectListTable key={listTypeFilter} initialTypeFilter={listTypeFilter} />
        )}
      </div>
    </Layout>
  );
}
