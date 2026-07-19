import { useEffect, useState } from 'react';
import { getExpenseSystemParams, saveExpenseSystemParam } from '../../services/api';

export default function SystemParameters() {
  const [params, setParams] = useState([]);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [churnRate, setChurnRate] = useState('');
  const [grossMargin, setGrossMargin] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getExpenseSystemParams().then((res) => setParams(res.data));
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = async () => {
    try {
      await saveExpenseSystemParam({
        period,
        churnRate: parseFloat(churnRate),
        grossMargin: parseFloat(grossMargin),
        note,
      });
      showToast('Cập nhật thông số thành công');
    } catch {
      showToast('Lỗi khi cập nhật thông số', 'error');
    }
    const res = await getExpenseSystemParams();
    setParams(res.data);
    setChurnRate('');
    setGrossMargin('');
    setNote('');
  };

  return (
    <section className="space-y-6">
      <div className="bg-surface-container-lowest border border-border-light rounded-xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary rounded-t-xl" />
        <div className="p-widget-padding">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Thông số Hệ thống</h2>
            <span className="material-symbols-outlined text-primary">settings_input_component</span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Kỳ áp dụng</label>
              <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Tỷ lệ rời bỏ (%)</label>
                <div className="relative">
                  <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="5.2" step="0.1" type="number" value={churnRate} onChange={(e) => setChurnRate(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">%</span>
                </div>
              </div>
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Biên lợi nhuận gộp (%)</label>
                <div className="relative">
                  <input className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="65.0" step="0.1" type="number" value={grossMargin} onChange={(e) => setGrossMargin(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Ghi chú</label>
              <textarea className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none h-20" placeholder="Lý do điều chỉnh thông số..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-bold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer" type="button" onClick={handleSave}>
              Cập nhật Thông số
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-background-subtle border-b border-border-light flex justify-between items-center">
          <span className="font-label-md text-on-surface">Lịch sử điều chỉnh</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background-subtle">
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">Kỳ</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">Rời bỏ (%)</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">Lợi nhuận gộp (%)</th>
                <th className="px-4 py-2 font-label-md text-on-surface-variant border-b border-border-light">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {params.map((p) => (
                <tr key={p.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-2 text-body-md">{p.period}</td>
                  <td className="px-4 py-2 text-body-md font-medium">{p.churnRate}%</td>
                  <td className="px-4 py-2 text-body-md font-medium">{p.grossMargin}%</td>
                  <td className="px-4 py-2 text-body-sm text-on-surface-variant">{p.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
