import { useEffect, useState } from 'react';
import { getProjects, saveExpense } from '../../services/api';

export default function ExpenseEntryForm({ onSaved }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [directCost, setDirectCost] = useState('');
  const [overhead, setOverhead] = useState('');
  const [directNote, setDirectNote] = useState('');
  const [overheadNote, setOverheadNote] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    });
  }, []);

  const total = (parseFloat(directCost) || 0) + (parseFloat(overhead) || 0);

  const formatCurrency = (val) => {
    return (val ?? 0).toLocaleString('vi-VN');
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await saveExpense({
        projectId,
        project: projects.find(p => p.id === projectId)?.name || projectId,
        period,
        directCost: parseFloat(directCost) || 0,
        overhead: parseFloat(overhead) || 0,
        total,
        directNote,
        overheadNote,
      });
      if (res && res.data) {
        showToast('Đã lưu chi phí thành công');
      } else {
        showToast('Lưu chi phí thành công (dữ liệu đã lưu local)', 'success');
      }
    } catch {
      showToast('Lỗi khi lưu chi phí. Kiểm tra kết nối và thử lại.', 'error');
    }
    setDirectCost('');
    setOverhead('');
    setDirectNote('');
    setOverheadNote('');
    if (onSaved) onSaved();
  };

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary rounded-t-xl" />
      <div className="p-widget-padding">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Nhập chi phí dự án</h2>
          <div className="flex items-center gap-3">
            <label className="font-label-md text-on-surface-variant">Chọn dự án:</label>
            <select className="border border-border-light rounded-lg px-4 py-1.5 text-body-md bg-background-subtle font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none min-w-[200px]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="block font-label-md text-on-surface-variant mb-1">Kỳ phát sinh</label>
            <input className="w-full border border-border-light rounded-lg px-3 py-2 text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Chi phí trực tiếp (VNĐ)</label>
              <div className="relative">
                <input className="w-full border border-border-light rounded-lg pl-3 pr-14 py-2.5 text-body-md font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="0" type="number" value={directCost} onChange={(e) => setDirectCost(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">VNĐ</span>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Ghi chú trực tiếp</label>
              <textarea className="w-full border border-border-light rounded-lg px-3 py-2 text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none h-20" placeholder="Chi phí nhân sự, tool, license..." value={directNote} onChange={(e) => setDirectNote(e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Chi phí gián tiếp (VNĐ)</label>
              <div className="relative">
                <input className="w-full border border-border-light rounded-lg pl-3 pr-14 py-2.5 text-body-md font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="0" type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">VNĐ</span>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-on-surface-variant mb-1">Ghi chú gián tiếp</label>
              <textarea className="w-full border border-border-light rounded-lg px-3 py-2 text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none h-20" placeholder="Chi phí vận hành chung, văn phòng..." value={overheadNote} onChange={(e) => setOverheadNote(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2 bg-background-subtle p-4 rounded-lg flex items-center justify-between border border-border-light">
            <div>
              <p className="font-label-md text-on-surface-variant">Tổng chi phí dự kiến</p>
              <p className="text-xs text-secondary">Tự động tính toán (Trực tiếp + Gián tiếp)</p>
            </div>
            <div className="text-right">
              <span className="text-[24px] font-bold text-primary">{formatCurrency(total)}</span>
              <span className="font-bold text-primary ml-1 text-body-md">VNĐ</span>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-3">
            <button className="px-6 py-2.5 border border-border-light rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" type="reset" onClick={() => { setDirectCost(''); setOverhead(''); setDirectNote(''); setOverheadNote(''); }}>
              Hủy bỏ
            </button>
            <button className="px-10 py-2.5 bg-primary text-on-primary rounded-lg font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer" type="submit">
              <span className="material-symbols-outlined text-body-md">save</span>
              Lưu chi phí
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
