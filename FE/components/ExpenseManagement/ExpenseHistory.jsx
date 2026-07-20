import { useEffect, useState } from 'react';
import { getExpenseList, deleteExpense, saveExpense, getProjects } from '../../services/api';

const DELETED_EXPENSE_KEY = 'mkt_hub_deleted_expenses';

function loadDeletedExpenseIds() {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_EXPENSE_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveDeletedExpenseIds(ids) {
  localStorage.setItem(DELETED_EXPENSE_KEY, JSON.stringify([...ids]));
}

function formatCurrency(val) {
  return (val ?? 0).toLocaleString('vi-VN');
}

export default function ExpenseHistory({ refreshKey }) {
  const [deletedExpenseIds] = useState(loadDeletedExpenseIds);
  const [expenses, setExpenses] = useState([]);
  const [editExp, setEditExp] = useState(null);
  const [editDirect, setEditDirect] = useState('');
  const [editOverhead, setEditOverhead] = useState('');
  const [editNote, setEditNote] = useState('');
  const [projects, setProjects] = useState([]);
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getExpenseList().then((res) => setExpenses((res.data || []).filter(e => !deletedExpenseIds.has(e.id))));
    getProjects().then((res) => setProjects(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, [refreshKey, deletedExpenseIds]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const openEdit = (exp) => {
    setEditExp(exp);
    setEditDirect(exp.directCost || '');
    setEditOverhead(exp.overhead || '');
    setEditNote(exp.note || '');
  };

  const handleEditSave = async () => {
    if (!editExp) return;
    const pid = editExp.projectId || editExp.project || projects[0]?.id;
    try {
      await saveExpense({
        projectId: pid,
        project: editExp.project,
        period: editExp.period,
        directCost: parseFloat(editDirect) || 0,
        overhead: parseFloat(editOverhead) || 0,
        total: (parseFloat(editDirect) || 0) + (parseFloat(editOverhead) || 0),
        directNote: editNote,
        overheadNote: editNote,
      });
      showToast('Cập nhật chi phí thành công');
    } catch {
      showToast('Lỗi khi cập nhật chi phí', 'error');
    }
    setEditExp(null);
    const res = await getExpenseList();
    setExpenses(res.data);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa khoản chi phí này?')) return;
    deletedExpenseIds.add(id);
    saveDeletedExpenseIds(deletedExpenseIds);
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      await deleteExpense(id);
      showToast('Đã xóa chi phí');
    } catch {
      showToast('Lỗi khi xóa chi phí', 'error');
    }
  };

  const displayExpenses = showAll ? expenses : expenses.slice(0, 5);

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden relative">
      <div className="px-4 py-2.5 border-b border-border-light flex justify-between items-center">
        <h3 className="font-title-md text-headline-sm text-on-surface">Lịch sử Chi Phí</h3>
        <span className="text-body-sm text-on-surface-variant">{expenses.length} bản ghi</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-subtle">
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">Kỳ</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">Dự án</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">Trực tiếp</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">Gián tiếp</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">Tổng</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-center uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {displayExpenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-primary/5 transition-colors">
                <td className="px-3 py-1.5 text-body-sm font-medium">{exp.period}</td>
                <td className="px-3 py-1.5 text-body-sm text-on-surface-variant max-w-[120px] truncate">{(exp.project?.name || exp.project) || '—'}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(exp.directCost)}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(exp.overhead)}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-bold text-on-surface">{formatCurrency(exp.total)}</td>
                <td className="px-3 py-1.5 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => openEdit(exp)} className="p-1 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded cursor-pointer" title="Sửa">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(exp.id)} className="p-1 text-on-surface-variant hover:text-danger transition-colors hover:bg-danger/10 rounded cursor-pointer" title="Xóa">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expenses.length > 5 && (
        <div className="px-3 py-2 border-t border-border-light bg-background-subtle flex justify-between items-center text-xs text-on-surface-variant">
          <p>Hiển thị {Math.min(5, expenses.length)} / {expenses.length} bản ghi</p>
          <button onClick={() => setShowAll(!showAll)} className="text-primary font-semibold hover:underline cursor-pointer">
            {showAll ? 'Thu gọn' : 'Xem tất cả'}
          </button>
        </div>
      )}
      {/* Full-table popup */}
      {showAll && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAll(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-5xl max-h-[85vh] pointer-events-auto mx-4 flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                <div>
                  <h3 className="text-base font-bold">Toàn bộ Chi phí</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{expenses.length} bản ghi</p>
                </div>
                <button onClick={() => setShowAll(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">Kỳ</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">Dự án</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">Trực tiếp</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">Gián tiếp</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">Tổng</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">Ghi chú</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-center uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-2 text-sm font-medium">{exp.period}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{(exp.project?.name || exp.project) || '—'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(exp.directCost)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(exp.overhead)}</td>
                        <td className="px-4 py-2 text-sm text-right font-bold">{formatCurrency(exp.total)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{exp.note || exp.directNote || exp.overheadNote || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => { setShowAll(false); setTimeout(() => openEdit(exp), 100); }} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Sửa">
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(exp.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Xóa">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
                <button onClick={() => setShowAll(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold hover:bg-gray-200">Đóng</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit modal */}
      {editExp && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditExp(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm pointer-events-auto mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Sửa chi phí</h3>
                <button onClick={() => setEditExp(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <p className="text-xs text-gray-500">{editExp.period} — {(editExp.project?.name || editExp.project)}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Chi phí trực tiếp</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={editDirect} onChange={(e) => setEditDirect(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Chi phí gián tiếp</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={editOverhead} onChange={(e) => setEditOverhead(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Ghi chú</label>
                  <textarea className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none h-16" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditExp(null)} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">Hủy</button>
                <button onClick={handleEditSave} className="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all">Lưu</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
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
