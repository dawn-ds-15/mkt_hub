import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PlanKPIsForm from '../components/LeadsKPIs/PlanKPIsForm';
import ActualsForm from '../components/LeadsKPIs/ActualsForm';
import OpportunitiesTable from '../components/LeadsKPIs/OpportunitiesTable';
import ClosedDealsTable from '../components/LeadsKPIs/ClosedDealsTable';
import LeadsKPIsFooter from '../components/LeadsKPIs/LeadsKPIsFooter';
import ViewAnalytics from '../components/LeadsKPIs/ViewAnalytics';
import ComparePeriods from '../components/LeadsKPIs/ComparePeriods';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Xem & Phân tích', en: 'View & Analytics', key: 'view' },
  { vi: 'Nhập số liệu', en: 'Input Data', key: 'input' },
  { vi: 'So sánh kỳ', en: 'Compare Periods', key: 'compare' },
];

export default function LeadsKPIs() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [closedDealsRefreshKey, setClosedDealsRefreshKey] = useState(0);
  const activeTab = searchParams.get('tab') || 'view';

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const { year, periodType, periodValue } = useDashboard();

  const renderContent = () => {
    switch (activeTab) {
      case 'input':
        return (
          <div className="flex flex-col gap-lg flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
              <div className="lg:col-span-4">
                <PlanKPIsForm />
              </div>
              <div className="lg:col-span-8">
                <ActualsForm />
              </div>
            </div>
            <div className="flex flex-col gap-lg">
              <OpportunitiesTable onConvertSuccess={() => setClosedDealsRefreshKey(k => k + 1)} />
              <ClosedDealsTable refreshKey={closedDealsRefreshKey} />
              <LeadsKPIsFooter />
            </div>
          </div>
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
    <Layout
      title="Leads & KPIs"
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
