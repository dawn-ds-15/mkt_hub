import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseSystemParams, saveExpenseSystemParam } from '../../services/api';

export default function SystemParameters() {
  const { locale } = useDashboard();
  const [params, setParams] = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [churnRate, setChurnRate] = useState('');
  const [grossMargin, setGrossMargin] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchParams = useCallback(async () => {
    try {
      const res = await getExpenseSystemParams();
      setParams(res.data);
      setRawRecords(res.raw || []);
    } catch {
      showToast(locale === 'vi' ? 'Không thể tải thông số hệ thống' : 'Unable to load system parameters', 'error');
    } finally {
      setFetching(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchParams();
  }, [fetchParams]);

  const handleSave = async () => {
    const churn = parseFloat(churnRate);
    const gross = parseFloat(grossMargin);
    if (isNaN(churn) || churn < 0) {
      showToast(locale === 'vi' ? 'Vui lòng nhập tỷ lệ rời bỏ hợp lệ' : 'Please enter a valid churn rate', 'error');
      return;
    }
    if (isNaN(gross) || gross < 0) {
      showToast(locale === 'vi' ? 'Vui lòng nhập biên lợi nhuận gộp hợp lệ' : 'Please enter a valid gross margin', 'error');
      return;
    }
    setLoading(true);
    try {
      await saveExpenseSystemParam({ period, churnRate: churn, grossMargin: gross, note });
      showToast(locale === 'vi' ? 'Cập nhật thông số thành công' : 'Parameters updated successfully');
      await fetchParams();
      setChurnRate('');
      setGrossMargin('');
      setNote('');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || '';
      if (status === 403) {
        showToast(locale === 'vi' ? 'Bạn không có quyền cập nhật thông số hệ thống' : 'You do not have permission to update system parameters', 'error');
      } else {
        showToast(`${locale === 'vi' ? 'Lỗi khi cập nhật thông số' : 'Error updating parameters'}${msg ? ': ' + msg : ''}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-surface-container-lowest border border-border-light rounded-xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary rounded-t-xl" />
        <div className="p-widget-padding">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{locale === 'vi' ? 'Thông số Hệ thống' : 'System Parameters'}</h2>
            <span className="material-symbols-outlined text-primary">settings_input_component</span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">{locale === 'vi' ? 'Kỳ áp dụng' : 'Applicable Period'}</label>
              <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">{locale === 'vi' ? 'Tỷ lệ rời bỏ (%)' : 'Churn Rate (%)'}</label>
                <div className="relative">
                  <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="5.2" step="0.1" type="number" value={churnRate} onChange={(e) => setChurnRate(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">%</span>
                </div>
              </div>
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">{locale === 'vi' ? 'Biên lợi nhuận gộp (%)' : 'Gross Margin (%)'}</label>
                <div className="relative">
                  <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="65.0" step="0.1" type="number" value={grossMargin} onChange={(e) => setGrossMargin(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">{locale === 'vi' ? 'Ghi chú' : 'Note'}</label>
              <textarea className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none h-20" placeholder={locale === 'vi' ? 'Lý do điều chỉnh thông số...' : 'Reason for adjustment...'} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button
              className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-bold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? 'Cập nhật Thông số' : 'Update Parameters')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-background-subtle border-b border-border-light flex justify-between items-center">
          <span className="font-label-md text-on-surface">{locale === 'vi' ? 'Lịch sử điều chỉnh' : 'Adjustment History'}</span>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all">
            <span className="material-symbols-outlined text-sm">history</span>
            {locale === 'vi' ? 'Xem lịch sử' : 'View History'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background-subtle">
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">{locale === 'vi' ? 'Kỳ' : 'Period'}</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">{locale === 'vi' ? 'Rời bỏ (%)' : 'Churn (%)'}</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">{locale === 'vi' ? 'Lợi nhuận gộp (%)' : 'Gross Margin (%)'}</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">{locale === 'vi' ? 'Ghi chú' : 'Note'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {fetching ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-body-md text-on-surface-variant">
                    {locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}
                  </td>
                </tr>
              ) : params.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-body-md text-on-surface-variant">
                    {locale === 'vi' ? 'Chưa có thông số nào' : 'No parameters yet'}
                  </td>
                </tr>
              ) : (
                params.map((p) => (
                  <tr key={p.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-2 text-body-md">{p.period}</td>
                    <td className="px-4 py-2 text-body-md font-medium">{p.churnRate}%</td>
                    <td className="px-4 py-2 text-body-md font-medium">{p.grossMargin}%</td>
                    <td className="px-4 py-2 text-body-sm text-on-surface-variant">{p.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showHistory && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowHistory(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
              <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                {locale === 'vi' ? 'Lịch sử điều chỉnh chi tiết' : 'Detailed Adjustment History'}
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background-subtle">
                    <th className="px-3 py-2 font-label-md text-on-surface-variant border-b border-border-light text-xs">{locale === 'vi' ? 'Thời gian' : 'Time'}</th>
                    <th className="px-3 py-2 font-label-md text-on-surface-variant border-b border-border-light text-xs">{locale === 'vi' ? 'Kỳ' : 'Period'}</th>
                    <th className="px-3 py-2 font-label-md text-on-surface-variant border-b border-border-light text-xs">{locale === 'vi' ? 'Thông số' : 'Parameter'}</th>
                    <th className="px-3 py-2 font-label-md text-on-surface-variant border-b border-border-light text-xs">{locale === 'vi' ? 'Giá trị' : 'Value'}</th>
                    <th className="px-3 py-2 font-label-md text-on-surface-variant border-b border-border-light text-xs">{locale === 'vi' ? 'Ghi chú' : 'Note'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {rawRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-body-md text-on-surface-variant">
                        {locale === 'vi' ? 'Chưa có lịch sử' : 'No history yet'}
                      </td>
                    </tr>
                  ) : (
                    rawRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-3 py-2 text-body-xs text-on-surface-variant whitespace-nowrap">
                          {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="px-3 py-2 text-body-sm font-medium">{r.period}</td>
                        <td className="px-3 py-2 text-body-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.key === 'churn_rate' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                            {r.key === 'churn_rate' ? (locale === 'vi' ? 'Tỷ lệ rời bỏ' : 'Churn Rate') : (locale === 'vi' ? 'Biên lợi nhuận gộp' : 'Gross Margin')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-body-sm font-bold">{r.value}%</td>
                        <td className="px-3 py-2 text-body-xs text-on-surface-variant">{r.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </section>
  );
}
