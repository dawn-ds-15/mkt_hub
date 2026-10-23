import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { BackupReset, ChecklistTemplatesConfig, DropdownConfig, PermissionMatrix, SlackSettings, TeamMembers } from '../components/DataManagement';
import { useDashboard } from '../contexts/DashboardContext';

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

// Import / Export đã chuyển vào từng module (feedback 26/09 T07): import task ở Danh sách task, won deal ở
// Nhập số liệu, lịch sử KPI ở So sánh kỳ; xuất PDF ở Báo cáo tuần, Excel ở Tổng quan, toàn bộ dữ liệu ở Sao lưu.
const allTabs = [
  { vi: 'Thành viên', en: 'Members', key: 'members', roles: ['manager'] },
  { vi: 'Phân quyền', en: 'Permissions', key: 'permissions', roles: ['manager'] },
  { vi: 'Mẫu checklist', en: 'Checklist Templates', key: 'templates', roles: ['manager'] },
  { vi: 'Cấu hình Dropdown', en: 'Dropdown Config', key: 'dropdown', roles: ['manager'] },
  { vi: 'Cấu hình Slack', en: 'Slack Config', key: 'slack', roles: ['manager'] },
  { vi: 'Sao lưu & Đặt lại', en: 'Backup & Reset', key: 'backup', roles: ['manager'] },
];

export default function DataManagementPage() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = getUserRole();
  const tabs = useMemo(() => {
    const filtered = allTabs.filter(t => t.roles.includes(role));
    return filtered.map(t => ({ label: t[locale] || t.vi, key: t.key }));
  }, [role, locale]);
  const rawTab = searchParams.get('tab');
  const activeTab = tabs.some((tb) => tb.key === rawTab) ? rawTab : (tabs[0]?.key || '');

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'permissions':
        return <PermissionMatrix />;
      case 'members':
        return <TeamMembers />;
      case 'templates':
        return <ChecklistTemplatesConfig />;
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
