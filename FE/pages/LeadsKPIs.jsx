import { useState } from 'react';
import Layout from '../components/Layout';
import PlanKPIsForm from '../components/LeadsKPIs/PlanKPIsForm';
import ActualsForm from '../components/LeadsKPIs/ActualsForm';
import LeadsKPIsFooter from '../components/LeadsKPIs/LeadsKPIsFooter';
import ViewAnalytics from '../components/LeadsKPIs/ViewAnalytics';
import ComparePeriods from '../components/LeadsKPIs/ComparePeriods';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { label: 'Xem & Phân tích', key: 'view' },
  { label: 'Nhập số liệu', key: 'input' },
  { label: 'So sánh kỳ', key: 'compare' },
];

export default function LeadsKPIs() {
  const [activeTab, setActiveTab] = useState('input');
  const { year, periodType, periodValue } = useDashboard();

  const renderContent = () => {
    switch (activeTab) {
      case 'input':
        return (
          <>
            <div className="flex gap-6">
              <PlanKPIsForm />
              <ActualsForm />
            </div>
            <LeadsKPIsFooter />
          </>
        );
      case 'view':
        return (
          <ViewAnalytics
            year={year}
            periodType={periodType}
            periodValue={periodValue}
          />
        );
      case 'compare':
        return (
          <ComparePeriods year={year} />
        );
      default:
        return null;
    }
  };

  return (
    <Layout title="Leads & KPIs">
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
