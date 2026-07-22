import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import SystemParameters from '../components/ExpenseManagement/SystemParameters';
import ExpenseEntryForm from '../components/ExpenseManagement/ExpenseEntryForm';
import ExpenseHistory from '../components/ExpenseManagement/ExpenseHistory';
import ExpenseReports from '../components/ExpenseManagement/ExpenseReports';
import ExpenseOverview from '../components/ExpenseManagement/ExpenseOverview';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Tổng quan', en: 'Overview', key: 'overview' },
  { vi: 'Nhập chi phí', en: 'Input Expense', key: 'input' },
  { vi: 'Báo cáo', en: 'Reports', key: 'reports' },
];

export default function ExpenseManagement() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'input';
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
          <div className="grid grid-cols-12 gap-gutter">
            <section className="col-span-12 lg:col-span-4 space-y-6">
              <SystemParameters />
            </section>
            <section className="col-span-12 lg:col-span-8 space-y-6">
              <ExpenseEntryForm onSaved={handleSaved} />
              <ExpenseHistory refreshKey={refreshKey} onSaved={handleSaved} />
            </section>
          </div>
        );
      case 'overview':
        return <ExpenseOverview refreshKey={refreshKey} />;
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
