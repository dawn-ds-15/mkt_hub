import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getExpenseList, getProjects, deleteExpense } from '../../services/api';
import { parseExpenseLines } from '../../utils/expenseMeta';

const CURRENT_YEAR = String(new Date().getFullYear());
const CURRENT_MONTH = String(new Date().getMonth() + 1).padStart(2, '0');
const CURRENT_QUARTER = Math.ceil((new Date().getMonth() + 1) / 3);

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatPeriod(p) {
  if (!p) return '—';
  const m = String(p).match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[2]}/${m[1]}`;
  return String(p);
}

function matchesPeriod(p, periodKey) {
  if (!p) return false;
  if (periodKey === 'year') return String(p).includes(CURRENT_YEAR);
  if (periodKey === 'month') return String(p) === `${CURRENT_YEAR}-${CURRENT_MONTH}`;
  if (periodKey === 'quarter') {
    const m = parseInt(String(p).split('-')[1], 10);
    return String(p).startsWith(CURRENT_YEAR) && !Number.isNaN(m) && Math.ceil(m / 3) === CURRENT_QUARTER;
  }
  return true;
}

// BUG-C03: đọc số lượng sự kiện lưu trong ghi chú ("Số lượng: N" / "SL: N" / "Qty: N")
function parseQtyFromNote(note) {
  const m = String(note || '').match(/(?:SL|Số lượng|Qty)\s*:\s*([\d.,]+)/i);
  if (!m) return 1;
  const v = parseInt(m[1].replace(/[.,]/g, ''), 10);
  return v > 0 ? v : 1;
}

export default function ExpenseBudget({ refreshKey, onAddExpense }) {
  const { locale } = useDashboard();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [periodKey, setPeriodKey] = useState('year');
  const [activeTable, setActiveTable] = useState('actual');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const addToast = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getProjects().then((res) => (Array.isArray(res.data) ? res.data : [])).catch(() => []),
      getExpenseList().then((res) => (Array.isArray(res.data) ? res.data : [])).catch(() => []),
    ]).then(([pj, ex]) => {
      if (!cancelled) {
        setProjects(pj);
        setExpenses(ex);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Kế hoạch và Thực tế là 2 góc nhìn của cùng bản ghi chi phí → xóa ở tab nào cũng xóa bản ghi
  const handleDeleteRows = async (ids) => {
    if (!ids.length || deleting) return;
    const msg = locale === 'vi'
      ? `Xác nhận xóa ${ids.length} khoản chi phí? (Cả kế hoạch và thực tế của kỳ đó)`
      : `Delete ${ids.length} expense record(s)? (Both plan and actual)`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteExpense(id)));
      addToast(locale === 'vi' ? `Đã xóa ${ids.length} khoản chi phí` : `Deleted ${ids.length} expense record(s)`);
      const ex = await getExpenseList();
      setExpenses(Array.isArray(ex.data) ? ex.data : []);
      setSelectedIds([]);
    } catch (e) {
      console.error('[ExpenseBudget] handleDeleteRows:', e);
      addToast(locale === 'vi' ? 'Thao tác thất bại.' : 'Action failed.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Kế hoạch = Σ cột "Kế hoạch" các dòng đã nhập, đọc từ ghi chú lưu trên BE
  const plannedOfRec = (e) => {
    const raw = String(e.directNote || e.note || '');
    if (!raw) return 0;
    return parseExpenseLines(raw).reduce((s, l) => s + l.planned, 0);
  };
  const eventsOfRec = (e) => (
    parseExpenseLines(String(e.directNote || e.note || '')).map((l) => l.event).filter(Boolean).join(', ')
  );

  const expenseFiltered = useMemo(() => (
    expenses.filter((e) => (projectFilter === 'all' || String(e.projectId) === projectFilter) && matchesPeriod(e.period, periodKey))
  ), [expenses, projectFilter, periodKey]);

  const planRows = useMemo(() => (
    expenseFiltered.map((e) => {
      const planned = plannedOfRec(e);
      return {
        id: e.id,
        name: e.project || '—',
        price: planned,
        qty: 1,
        total: planned,
        vendor: eventsOfRec(e) || '—',
        period: e.period,
      };
    })
  ), [expenseFiltered]);

  const actualRows = useMemo(() => (
    expenseFiltered.map((e) => {
      const total = Number(e.total) || 0;
      const qty = parseQtyFromNote(e.directNote || e.note);
      return {
        id: e.id,
        name: e.project || '—',
        price: qty > 1 ? Math.round(total / qty) : total,
        qty,
        total,
        vendor: e.note || '—',
        period: e.period,
      };
    })
  ), [expenseFiltered]);

  const rows = activeTable === 'plan' ? planRows : actualRows;

  // Thông số tổng hợp tính từ ĐÚNG dữ liệu đang lọc hiển thị trong bảng
  const totalBudget = planRows.reduce((s, r) => s + r.total, 0);
  const totalActual = actualRows.reduce((s, r) => s + r.total, 0);
  const remaining = totalBudget - totalActual;
  const usagePct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : null;

  const budgetCards = [
    { label: locale === 'vi' ? 'Tổng ngân sách' : 'Total budget', value: formatCurrency(totalBudget), cls: 'text-on-surface', bg: 'bg-surface' },
    { label: locale === 'vi' ? 'Thực tế đã chi' : 'Actual spent', value: formatCurrency(totalActual), cls: 'text-warning', bg: 'bg-surface' },
    { label: locale === 'vi' ? 'Ngân sách còn lại' : 'Remaining budget', value: formatCurrency(remaining), cls: remaining < 0 ? 'text-danger' : 'text-success', bg: remaining < 0 ? 'bg-error-container' : 'bg-surface-container-low' },
    { label: locale === 'vi' ? '% đã sử dụng' : 'Usage', value: usagePct == null ? '—' : `${usagePct}%`, cls: usagePct == null || usagePct > 100 ? (usagePct == null ? 'text-on-surface-variant' : 'text-danger') : 'text-primary', bg: 'bg-surface' },
  ];

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : rows.map((r) => r.id));
  };
  const toggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const periodOptions = [
    { key: 'year', label: locale === 'vi' ? 'Năm nay' : 'This year' },
    { key: 'quarter', label: locale === 'vi' ? 'Quý này' : 'This quarter' },
    { key: 'month', label: locale === 'vi' ? 'Tháng này' : 'This month' },
  ];

  const selectCls =
    'bg-surface border border-border-light text-[14px] leading-[20px] font-body-sm rounded px-3 py-1.5 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none text-on-surface';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] leading-[16px] font-medium text-on-surface-variant">
              {locale === 'vi' ? 'Dự án' : 'Project'}
            </label>
            <select className={`${selectCls} w-48`} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">{locale === 'vi' ? 'Tất cả dự án' : 'All projects'}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] leading-[16px] font-medium text-on-surface-variant">
              {locale === 'vi' ? 'Kỳ báo cáo' : 'Report period'}
            </label>
            <select className={`${selectCls} w-32`} value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
              {periodOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-2 text-secondary bg-secondary-fixed hover:bg-secondary-fixed-dim px-4 py-2 rounded-lg text-[14px] leading-[20px] font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            {locale === 'vi' ? 'Kho vật phẩm' : 'Inventory'}
          </button>
          <button
            onClick={onAddExpense}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {locale === 'vi' ? 'Thêm chi phí' : 'Add expense'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] text-outline-variant animate-spin">sync</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {budgetCards.map((card) => (
              <div key={card.label} className={`${card.bg} border border-border-light rounded-xl p-4`}>
                <p className="text-[12px] leading-[16px] font-medium text-on-surface-variant mb-1 uppercase tracking-wider">{card.label}</p>
                <p className={`font-data-mono text-[24px] leading-[32px] font-semibold tabular-nums ${card.cls}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-surface border border-border-light rounded-xl overflow-hidden">
            <div className="flex justify-between items-center border-b border-border-light bg-background-subtle">
              <div className="flex">
                <button
                  onClick={() => { setActiveTable('plan'); setSelectedIds([]); }}
                  className={`px-6 py-3 text-[14px] leading-[20px] font-medium border-b-2 transition-colors ${
                    activeTable === 'plan'
                      ? 'text-primary border-primary bg-surface'
                      : 'text-on-surface-variant hover:text-on-surface border-transparent'
                  }`}
                >
                  {locale === 'vi' ? 'Chi phí kế hoạch' : 'Planned costs'}
                </button>
                <button
                  onClick={() => { setActiveTable('actual'); setSelectedIds([]); }}
                  className={`px-6 py-3 text-[14px] leading-[20px] font-medium border-b-2 transition-colors ${
                    activeTable === 'actual'
                      ? 'text-primary border-primary bg-surface'
                      : 'text-on-surface-variant hover:text-on-surface border-transparent'
                  }`}
                >
                  {locale === 'vi' ? 'Chi phí thực tế' : 'Actual costs'}
                </button>
              </div>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => handleDeleteRows(selectedIds)}
                  disabled={deleting}
                  className="mr-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-on-error text-[13px] leading-[18px] font-semibold hover:brightness-110 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">{deleting ? 'sync' : 'delete'}</span>
                  {deleting
                    ? (locale === 'vi' ? 'Đang xóa...' : 'Deleting...')
                    : (locale === 'vi' ? `Xóa (${selectedIds.length})` : `Delete (${selectedIds.length})`)}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-light bg-surface">
                    <th className="py-3 px-4 w-[48px]">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                        checked={allSelected}
                        onChange={toggleAll}
                        title={locale === 'vi' ? 'Chọn tất cả' : 'Select all'}
                      />
                    </th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Hạng mục' : 'Item'}</th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Đơn giá' : 'Unit price'}</th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Số lượng' : 'Qty'}</th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Thành tiền' : 'Amount'}</th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Nhà cung cấp' : 'Vendor'}</th>
                    <th className="py-3 px-4 text-[12px] leading-[16px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Ngày phát sinh' : 'Date'}</th>
                    <th className="py-3 px-4 w-[56px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[14px] leading-[20px] text-on-surface-variant">
                        {locale === 'vi' ? 'Chưa có dữ liệu chi phí' : 'No expense data yet'}
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                      <td className="py-2.5 px-4 text-[14px] leading-[20px] text-on-surface font-medium">{row.name}</td>
                      <td className="py-2.5 px-4 font-data-mono text-[14px] leading-[20px] text-on-surface-variant text-right tabular-nums">{formatCurrency(row.price)}</td>
                      <td className="py-2.5 px-4 font-data-mono text-[14px] leading-[20px] text-on-surface-variant text-right tabular-nums">{row.qty}</td>
                      <td className="py-2.5 px-4 font-data-mono text-[14px] leading-[20px] text-on-surface font-semibold text-right tabular-nums">{formatCurrency(row.total)}</td>
                      <td className="py-2.5 px-4 text-[14px] leading-[20px] text-on-surface-variant max-w-[220px] truncate" title={row.vendor}>{row.vendor}</td>
                      <td className="py-2.5 px-4 font-data-mono text-[14px] leading-[20px] text-on-surface-variant tabular-nums">{formatPeriod(row.period)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRows([row.id])}
                          disabled={deleting}
                          title={locale === 'vi' ? 'Xóa khoản chi phí' : 'Delete expense record'}
                          className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-danger hover:bg-error-container transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
