import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpenseEntryForm from '../components/ExpenseManagement/ExpenseEntryForm';
import ExpenseHistory from '../components/ExpenseManagement/ExpenseHistory';
import ExpenseReports from '../components/ExpenseManagement/ExpenseReports';
import ExpenseOverview from '../components/ExpenseManagement/ExpenseOverview';
import ExpenseBudget from '../components/ExpenseManagement/ExpenseBudget';
import CategoryBudgetEntry from '../components/ExpenseManagement/CategoryBudgetEntry';
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
];

const tabKeys = allTabs.map((t) => t.key);

export default function ExpenseManagement() {
  const { locale } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = tabKeys.includes(rawTab) ? rawTab : 'budget';
  const [refreshKey, setRefreshKey] = useState(0);
  const [inputView, setInputView] = useState('project');
  const selectedProjectId = searchParams.get('projectId') || '';
  const dirtyRef = useRef(false);
  const role = getUserRole();

  const tabs = allTabs.filter(tab => !tab.managerOnly || role === 'manager');

  const confirmDiscard = () => window.confirm(locale === 'vi'
    ? 'Bạn có thay đổi ngân sách chưa lưu. Bỏ thay đổi và chuyển tab?'
    : 'You have unsaved budget changes. Discard changes and switch tab?');

  const setActiveTab = (key) => {
    if (key !== activeTab && dirtyRef.current && !confirmDiscard()) return;
    dirtyRef.current = false;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      return next;
    }, { replace: true });
  };

  const handleProjectChange = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('projectId', id); else next.delete('projectId');
      return next;
    }, { replace: true });
  };

  const setInputViewSafe = (view) => {
    if (view !== inputView && dirtyRef.current && !confirmDiscard()) return;
    dirtyRef.current = false;
    setInputView(view);
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'input':
        return (
          <div className="space-y-6">
            <div className="flex border-b border-outline-variant">
              <button
                onClick={() => setInputViewSafe('project')}
                className={`px-6 py-3 text-[14px] leading-[20px] font-medium transition-colors ${
                  inputView === 'project' ? 'text-primary border-b-2 border-primary bg-surface-container-lowest' : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {locale === 'vi' ? 'Nhập chi phí dự án' : 'Project Expense Entry'}
              </button>
              <button
                onClick={() => setInputViewSafe('category')}
                className={`px-6 py-3 text-[14px] leading-[20px] font-medium transition-colors ${
                  inputView === 'category' ? 'text-primary border-b-2 border-primary bg-surface-container-lowest' : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {locale === 'vi' ? 'Nhập chi phí tổng hạng mục' : 'Category Budget Entry'}
              </button>
            </div>
            {inputView === 'project' ? (
                <>
                  <ExpenseEntryForm
                    onSaved={handleSaved}
                    projectId={selectedProjectId}
                    onProjectChange={handleProjectChange}
                  />
                  <ExpenseHistory
                    refreshKey={refreshKey}
                    onSaved={handleSaved}
                    projectId={selectedProjectId}
                    onProjectChange={handleProjectChange}
                  />
                </>
              ) : (
              <CategoryBudgetEntry
                refreshKey={refreshKey}
                onSaved={handleSaved}
                onDirtyChange={(d) => { dirtyRef.current = d; }}
              />
            )}
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-8">
            <ExpenseOverview refreshKey={refreshKey} />
            {role === 'manager' && (
              <div className="border-t border-border-light pt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">{locale === 'vi' ? 'Báo cáo Chi phí' : 'Expense Reports'}</h2>
                </div>
                <ExpenseReports refreshKey={refreshKey} />
              </div>
            )}
          </div>
        );
      case 'budget':
        return <ExpenseBudget refreshKey={refreshKey} onSaved={handleSaved} onAddExpense={() => setActiveTab('input')} />;
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
