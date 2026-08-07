import { useState, useEffect } from 'react';
import { getPlanKPIs, savePlanKPIs } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';

const years = [2024, 2025, 2026];

export default function PlanKPIsForm() {
  const addToast = useToast();
  const { locale } = useDashboard();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [formData, setFormData] = useState({
    targetLeads: '',
    mqlTarget: '',
    sqlTarget: '',
    opportunityCount: '',
    closedDealCount: '',
    pipelineValue: '',
    wonValue: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlanKPIs();
  }, [selectedYear]);

  const loadPlanKPIs = async () => {
    setLoading(true);
    try {
      const response = await getPlanKPIs(selectedYear);
      const data = response.data;
      setFormData({
        targetLeads: data.targetLeads || '',
        mqlTarget: data.mqlTarget || '',
        sqlTarget: data.sqlTarget || '',
        opportunityCount: data.opportunityCount || '',
        closedDealCount: data.closedDealCount || '',
        pipelineValue: data.pipelineValue || '',
        wonValue: data.wonValue || '',
      });
    } catch (error) {
      console.error('Error loading plan KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      await savePlanKPIs({ ...formData, year: selectedYear });
      addToast(locale === 'vi' ? 'Đã lưu Kế hoạch KPIs thành công!' : 'KPI Plan saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving plan KPIs:', error);
      addToast(locale === 'vi' ? 'Có lỗi xảy ra khi lưu!' : 'An error occurred while saving!', 'error');
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    return Number(value).toLocaleString('en-US');
  };

  return (
    <section className="w-[400px] flex-shrink-0 bg-white border border-border-light p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">target</span>
          {locale === 'vi' ? 'Kế hoạch KPIs' : 'KPI Plan'}
        </h3>
        <select
          className="bg-surface-container-low text-body-sm border border-border-light rounded px-2 py-1 focus:ring-primary focus:border-primary"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
            {years.map(year => (
            <option key={year} value={year}>{locale === 'vi' ? `Năm ${year}` : `Year ${year}`}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Mục tiêu Raw Leads' : 'Raw Leads Target'}
          </label>
          <NumberInput
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            name="targetLeads"
            value={formData.targetLeads}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Mục tiêu MQL' : 'MQL Target'}
          </label>
            <NumberInput
              className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="0"
              name="mqlTarget"
              value={formData.mqlTarget}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-1">
            <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
              {locale === 'vi' ? 'Mục tiêu SQL' : 'SQL Target'}
            </label>
            <NumberInput
              className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="0"
              name="sqlTarget"
              value={formData.sqlTarget}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Số lượng Cơ hội (OPP)' : 'Opportunities (OPP)'}
          </label>
          <NumberInput
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            name="opportunityCount"
            value={formData.opportunityCount}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Số lượng Closed Deal' : 'Closed Deal Count'}
          </label>
          <NumberInput
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            name="closedDealCount"
            value={formData.closedDealCount}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Giá trị Pipeline' : 'Pipeline Value'}
          </label>
          <NumberInput
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            name="pipelineValue"
            value={formData.pipelineValue}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Giá trị Won' : 'Won Value'}
          </label>
          <NumberInput
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            name="wonValue"
            value={formData.wonValue}
            onChange={handleChange}
          />
        </div>

        <div className="bg-surface-container-low p-3 rounded-lg border border-dashed border-outline-variant">
          <p className="text-label-md font-semibold text-primary mb-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {locale === 'vi' ? 'Cơ chế Rollover' : 'Rollover Mechanism'}
          </p>
          <p className="text-body-sm text-on-surface-variant italic">
            {locale === 'vi' ? 'Số liệu kế hoạch sẽ được phân bổ đều theo tháng. Nếu tháng trước không đạt, phần dư có thể được thiết lập Rollover sang tháng kế tiếp.' : 'Plan figures are distributed evenly across months. If the previous month falls short, the surplus can be carried over to the next month.'}
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 shadow-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined">save</span>
          {loading ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? 'Lưu Kế hoạch KPIs' : 'Save KPI Plan')}
        </button>
      </div>
    </section>
  );
}
