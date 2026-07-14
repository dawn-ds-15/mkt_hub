import { useState } from 'react';
import Layout from '../components/Layout';
import SystemParameters from '../components/ExpenseManagement/SystemParameters';
import ExpenseEntryForm from '../components/ExpenseManagement/ExpenseEntryForm';
import ExpenseHistory from '../components/ExpenseManagement/ExpenseHistory';
import ExpenseReports from '../components/ExpenseManagement/ExpenseReports';
import ExpenseOverview from '../components/ExpenseManagement/ExpenseOverview';

const tabs = [
  { label: 'Tổng quan', key: 'overview' },
  { label: 'Nhập chi phí', key: 'input' },
  { label: 'Báo cáo', key: 'reports' },
];

export default function ExpenseManagement() {
  const [activeTab, setActiveTab] = useState('input');
  const [refreshKey, setRefreshKey] = useState(0);

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
              <ExpenseHistory refreshKey={refreshKey} />
            </section>
          </div>
        );
      case 'overview':
        return <ExpenseOverview />;
      case 'reports':
        return <ExpenseReports />;
      default:
        return null;
    }
  };

  return (
    <Layout title="Quản lý Chi phí">
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
    </Layout>
  );
}
