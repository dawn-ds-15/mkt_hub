import { useState, useEffect } from 'react';
import { getActuals, saveActuals } from '../../services/api';
import OpportunitiesTable from './OpportunitiesTable';
import ClosedDealsTable from './ClosedDealsTable';

export default function ActualsForm() {
  const [selectedWeek, setSelectedWeek] = useState('2024-W20');
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
      alert('Đã lưu Actual Data thành công!');
    } catch (error) {
      console.error('Error saving actuals:', error);
      alert('Có lỗi xảy ra khi lưu!');
    }
  };

  return (
    <section className="flex-1 bg-white border border-border-light p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">edit_note</span>
          Form Nhập Actual
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            Chọn kỳ:
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
            Raw Leads
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
            MQL Actual
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
            SQL Actual
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

      <OpportunitiesTable />
      <ClosedDealsTable />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">publish</span>
          {loading ? 'Đang lưu...' : 'Lưu Actual Data'}
        </button>
      </div>
    </section>
  );
}
