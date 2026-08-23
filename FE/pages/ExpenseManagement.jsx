import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpenseEntryForm from '../components/ExpenseManagement/ExpenseEntryForm';
import ExpenseHistory from '../components/ExpenseManagement/ExpenseHistory';
import ExpenseReports from '../components/ExpenseManagement/ExpenseReports';
import ExpenseOverview from '../components/ExpenseManagement/ExpenseOverview';
import ExpenseBudget from '../components/ExpenseManagement/ExpenseBudget';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Tổng quan', en: 'Overview', key: 'overview' },
  { vi: 'Ngân sách', en: 'Budget', key: 'budget' },
  { vi: 'Nhập chi phí', en: 'Input Expense', key: 'input' },
  { vi: 'Báo cáo', en: 'Reports', key: 'reports' },
];

export default function ExpenseManagement() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'budget';
  const [refreshKey, setRefreshKey] = useState(0);

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  const renderContent = () => {
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
