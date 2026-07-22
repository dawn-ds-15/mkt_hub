import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { BackupReset, DropdownConfig, ExportData, ImportData, SlackSettings, TeamMembers } from '../components/DataManagement';
import { useDashboard } from '../contexts/DashboardContext';

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

const allTabs = [
  { vi: 'Import', en: 'Import', key: 'import', roles: ['specialist', 'manager'] },
  { vi: 'Export', en: 'Export', key: 'export', roles: ['manager'] },
  { vi: 'Thành viên', en: 'Members', key: 'members', roles: ['manager'] },
  { vi: 'Cấu hình Dropdown', en: 'Dropdown Config', key: 'dropdown', roles: ['manager'] },
  { vi: 'Cấu hình Slack', en: 'Slack Config', key: 'slack', roles: ['manager'] },
  { vi: 'Sao lưu & Đặt lại', en: 'Backup & Reset', key: 'backup', roles: ['specialist', 'manager'] },
];

export default function DataManagementPage() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = getUserRole();
  const tabs = useMemo(() => {
    const filtered = allTabs.filter(t => t.roles.includes(role));
    return filtered.map(t => ({ label: t[locale] || t.vi, key: t.key }));
  }, [role, locale]);
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
              <p className="text-headline-sm font-semibold">{locale === 'vi' ? 'Đang phát triển...' : 'In development...'}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout
      title={locale === 'vi' ? 'Quản lý Dữ liệu' : 'Data Management'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </Layout>
  );
}
