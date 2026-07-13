import { useState } from 'react';
import Layout from '../components/Layout';
import PlanKPIsForm from '../components/LeadsKPIs/PlanKPIsForm';
import ActualsForm from '../components/LeadsKPIs/ActualsForm';
import LeadsKPIsFooter from '../components/LeadsKPIs/LeadsKPIsFooter';

const tabs = [
  { label: 'Xem & Phân tích', key: 'view' },
  { label: 'Nhập số liệu', key: 'input' },
  { label: 'So sánh kỳ', key: 'compare' },
];

export default function LeadsKPIs() {
  const [activeTab, setActiveTab] = useState('input');

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
          <div className="flex items-center justify-center h-64 text-on-surface-variant bg-white border border-border-light rounded-lg">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-4">analytics</span>
              <p className="text-headline-sm font-semibold">Xem & Phân tích</p>
              <p className="text-body-sm text-on-surface-variant mt-2">Đang phát triển...</p>
            </div>
          </div>
        );
      case 'compare':
        return (
          <div className="flex items-center justify-center h-64 text-on-surface-variant bg-white border border-border-light rounded-lg">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-4">compare_arrows</span>
              <p className="text-headline-sm font-semibold">So sánh kỳ</p>
              <p className="text-body-sm text-on-surface-variant mt-2">Đang phát triển...</p>
            </div>
          </div>
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
