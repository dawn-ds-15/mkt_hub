import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { BackupReset, DropdownConfig, ExportData, ImportData, SlackSettings, TeamMembers } from '../components/DataManagement';

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

const allTabs = [
  { label: 'Import', key: 'import', roles: ['specialist', 'manager'] },
  { label: 'Export', key: 'export', roles: ['manager'] },
  { label: 'Thành viên', key: 'members', roles: ['manager'] },
  { label: 'Cấu hình Dropdown', key: 'dropdown', roles: ['manager'] },
  { label: 'Cấu hình Slack', key: 'slack', roles: ['manager'] },
  { label: 'Sao lưu & Đặt lại', key: 'backup', roles: ['manager'] },
];

export default function DataManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = getUserRole();
  const tabs = useMemo(() => allTabs.filter(t => t.roles.includes(role)), [role]);
  const activeTab = searchParams.get('tab') || tabs[0]?.key || 'import';

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

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
    <Layout title="Quản lý Dữ liệu">
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
