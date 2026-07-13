import { useState } from 'react';
import Layout from '../components/Layout';
import { BackupReset, DropdownConfig, ExportData, ImportData, SlackSettings, TeamMembers } from '../components/DataManagement';

const tabs = [
  { label: 'Import Data', key: 'import' },
  { label: 'Export Data', key: 'export' },
  { label: 'Team Members', key: 'members' },
  { label: 'Dropdown Config', key: 'dropdown' },
  { label: 'Slack Settings', key: 'slack' },
  { label: 'Backup & Reset', key: 'backup' },
];

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState('import');

  const renderContent = () => {
    switch (activeTab) {
      case 'import':
        return <ImportData />;
      case 'export':
        return <ExportData />;
      case 'members':
        return <TeamMembers />;
      case 'slack':
        return <SlackSettings />;
      case 'dropdown':
        return <DropdownConfig />;
      case 'backup':
        return <BackupReset />;
      default:
        return (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-4">construction</span>
              <p className="text-headline-sm font-semibold">Đang phát triển...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout title="Data Management">
      <div className="space-y-6">
        {/* Sub-navigation */}
        <div className="border-b border-outline-variant">
          <nav className="flex items-center gap-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 text-sm font-title-md transition-all whitespace-nowrap border-b-2 ${
                  activeTab === tab.key
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant hover:text-primary border-transparent'
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
