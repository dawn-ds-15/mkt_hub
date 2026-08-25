import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpenseEntryForm from '../components/ExpenseManagement/ExpenseEntryForm';
import ExpenseHistory from '../components/ExpenseManagement/ExpenseHistory';
import ExpenseReports from '../components/ExpenseManagement/ExpenseReports';
import ExpenseOverview from '../components/ExpenseManagement/ExpenseOverview';
import ExpenseBudget from '../components/ExpenseManagement/ExpenseBudget';
import { useDashboard } from '../contexts/DashboardContext';

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

const allTabs = [
  { vi: 'Tổng quan', en: 'Overview', key: 'overview' },
  { vi: 'Ngân sách', en: 'Budget', key: 'budget' },
  { vi: 'Nhập chi phí', en: 'Input Expense', key: 'input' },
  { vi: 'Báo cáo', en: 'Reports', key: 'reports', managerOnly: true },
];

export default function ExpenseManagement() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'budget';
  const [refreshKey, setRefreshKey] = useState(0);
  const role = getUserRole();

  const tabs = allTabs.filter(tab => !tab.managerOnly || role === 'manager');

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  const renderContent = () => {
    if (activeTab === 'reports' && role !== 'manager') {
      return (
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-[64px] text-outline-variant">lock</span>
          <p className="font-headline-sm">{locale === 'vi' ? 'Bạn không có quyền xem báo cáo' : 'You do not have permission to view reports'}</p>
          <p className="text-body-md text-outline">{locale === 'vi' ? 'Chỉ quản lý mới có thể xem báo cáo chi phí.' : 'Only managers can view expense reports.'}</p>
        </div>
      );
    }
    switch (activeTab) {
      case 'input':
        return (
          <div className="space-y-6">
            <ExpenseEntryForm onSaved={handleSaved} />
            <ExpenseHistory refreshKey={refreshKey} onSaved={handleSaved} />
          </div>
        );
      case 'overview':
        return <ExpenseOverview refreshKey={refreshKey} />;
      case 'budget':
        return <ExpenseBudget refreshKey={refreshKey} onAddExpense={() => setActiveTab('input')} />;
      case 'reports':
        return <ExpenseReports refreshKey={refreshKey} />;
      default:
        return null;
    }
  };

  return (
    <Layout
      title={locale === 'vi' ? 'Quản lý Chi phí' : 'Expense Management'}
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
