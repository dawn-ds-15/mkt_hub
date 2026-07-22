import { useState, useEffect } from 'react';
import { getActuals, saveActuals } from '../../services/api';
import OpportunitiesTable from './OpportunitiesTable';
import ClosedDealsTable from './ClosedDealsTable';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export default function ActualsForm() {
  const addToast = useToast();
  const { locale } = useDashboard();
  const getCurrentWeek = () => {
    const now = new Date();
    const week = getISOWeek(now);
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [formData, setFormData] = useState({
    rawLeads: '',
    mqlActual: '',
    sqlActual: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActuals();
  }, [selectedWeek]);

  const loadActuals = async () => {
    setLoading(true);
    try {
      const response = await getActuals(selectedWeek);
      const data = response.data;
      setFormData({
        rawLeads: data.rawLeads || '',
        mqlActual: data.mqlActual || '',
        sqlActual: data.sqlActual || '',
      });
    } catch (error) {
      console.error('Error loading actuals:', error);
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
      await saveActuals({ ...formData, week: selectedWeek });
      addToast(locale === 'vi' ? 'Đã lưu Actual Data thành công!' : 'Actual Data saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving actuals:', error);
      addToast(locale === 'vi' ? 'Có lỗi xảy ra khi lưu!' : 'An error occurred while saving!', 'error');
    }
  };

  return (
    <section className="flex-1 bg-white border border-border-light p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">edit_note</span>
          {locale === 'vi' ? 'Form Nhập Actual' : 'Actual Entry Form'}
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Chọn kỳ:' : 'Select period:'}
          </label>
          <input
            className="border-border-light rounded text-body-sm px-2 py-1 focus:ring-primary focus:border-primary outline-none"
            type="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Raw Leads Actual' : 'Raw Leads Actual'}
          </label>
          <input
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            type="number"
            name="rawLeads"
            value={formData.rawLeads}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'MQL' : 'MQL'}
          </label>
          <input
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            type="number"
            name="mqlActual"
            value={formData.mqlActual}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-1">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'SQL' : 'SQL'}
          </label>
          <input
            className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0"
            type="number"
            name="sqlActual"
            value={formData.sqlActual}
            onChange={handleChange}
          />
        </div>
      </div>

      <OpportunitiesTable onConvertSuccess={() => loadActuals()} />
      <ClosedDealsTable />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">publish</span>
          {loading ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? 'Lưu Actual Data' : 'Save Actual Data')}
        </button>
      </div>
    </section>
  );
}
