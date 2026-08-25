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
import PerformanceDashboard from '../components/LeadsKPIs/PerformanceDashboard';
import { useDashboard } from '../contexts/DashboardContext';

const tabs = [
  { vi: 'Hiệu suất', en: 'Performance', key: 'performance' },
  { vi: 'Xem & Phân tích', en: 'View & Analytics', key: 'view' },
  { vi: 'Nhập số liệu', en: 'Input Data', key: 'input' },
  { vi: 'So sánh kỳ', en: 'Compare Periods', key: 'compare' },
];

export default function LeadsKPIs() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'performance';

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const { year, periodType, periodValue } = useDashboard();

  const renderContent = () => {
    switch (activeTab) {
      case 'performance':
        return <PerformanceDashboard onViewAll={() => setActiveTab('view')} />;
      case 'input':
        return (
          <>
            <PlanKPIsForm />
            <ActualsForm />
            <OpportunitiesTable />
            <ClosedDealsTable />
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
