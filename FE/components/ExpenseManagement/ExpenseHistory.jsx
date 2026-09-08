import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseList, deleteExpense, getProjects, createInventoryTransaction } from '../../services/api';
import { getExpenseMeta, removeExpenseMeta, parseExpenseNote, parseExpenseLines } from '../../utils/expenseMeta';

function formatCurrency(val) {
  return (val ?? 0).toLocaleString('vi-VN');
}

function dateOf(exp) {
  const raw = String(exp?.recognizedDate || exp?.expenseDate || '');
  const s = raw.slice(0, 10);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

const expTime = (exp) => {
  const n = Number(exp.number) || 0;
  const raw = exp.recognizedDate || exp.expenseDate || '';
  const ts = raw ? new Date(raw).getTime() : 0;
  return n * 10000000000 + ts;
};
const compareExpDesc = (a, b) => expTime(b) - expTime(a);

const lineKey = (ln) => String(ln.event || '').trim().toLowerCase() || String(ln.note || '').trim().toLowerCase();

// Gom bản ghi theo dự án: lấy bản ghi gần nhất + giữ bản ghi trước đó để so sánh
function buildProjectRows(list) {
  const map = {};
  for (const exp of list) {
    const pid = exp.projectId || exp.project?.id || '__none';
    if (!map[pid]) {
      map[pid] = [];
      map[pid].name = exp.project?.name || exp.project || '—';
    }
    map[pid].push(exp);
  }
  return Object.keys(map)
    .map((pid) => {
      const rows = [...map[pid]].sort(compareExpDesc);
      return { pid, projectName: map[pid].name, latest: rows[0], prev: rows[1] || null };
    })
    .sort((a, b) => compareExpDesc(a.latest, b.latest));
}

export default function ExpenseHistory({ refreshKey, onSaved, onEdit }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [viewContract, setViewContract] = useState(null);
  const [detailExp, setDetailExp] = useState(null);

  const metaOf = (exp) => getExpenseMeta(exp.id);
  // Đơn giá theo quy ước toàn app: TRƯỚC VAT (xem ExpenseReports "trước VAT", getCategoryBudgetActuals)
  const preVatPrice = (ln) => {
    if (ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== '') return Number(ln.unitPriceBeforeVat) || 0;
    const base = Number(ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? ln.unitPriceAfterVatSnapshot ?? 0);
    const vatRate = ln.vatRateSnapshot != null ? Number(ln.vatRateSnapshot) : (ln.vatRate != null ? Number(ln.vatRate) : 0);
    return vatRate > 0 ? Math.round(base / (1 + vatRate / 100)) : base;
  };
  // Kế hoạch: ưu tiên tính từ lines BE (plannedQuantity × đơn giá trước VAT); fallback meta/ghi chú cũ
  const plannedOf = (exp) => {
    const lines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
    if (lines) {
      return lines.reduce((s, ln) => s + (Number(ln.plannedQuantity) || 0) * preVatPrice(ln), 0);
    }
    const m = Number(metaOf(exp)?.planned);
    if (m) return m;
    const raw = String(exp.directNote || exp.note || '');
    if (!raw) return 0;
    return parseExpenseLines(raw).reduce((s, l) => s + l.planned, 0);
  };
  // Thực tế: ưu tiên tính từ lines BE (actualQuantity × đơn giá trước VAT); fallback directCost BE
  const actualOf = (exp) => {
    const lines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
    if (lines) {
      return lines.reduce((s, ln) => s + (Number(ln.actualQuantity) || Number(ln.actualQty) || 0) * preVatPrice(ln), 0);
    }
    return Number(exp.directCost) || 0;
  };
  const hasContract = (exp) => {
    const m = metaOf(exp);
    return !!(m && (m.contractDataUrl || m.contractFile));
  };
  // Tách các dòng chi phí của một bản ghi (BE lưu gộp theo Dự án + Kỳ)
  const linesOf = (exp) => {
    const beLines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
    // BE hiện là nguồn chính: hiển thị theo quy ước trước VAT, khớp cột Kế hoạch/Thực tế
    if (beLines) {
      return beLines.map((ln, i) => {
        const price = preVatPrice(ln);
        const qty = Number(ln.actualQuantity) || Number(ln.actualQty) || 0;
        return {
          no: i + 1,
          event: ln.name || ln.event || '',
          planned: (Number(ln.plannedQuantity) || Number(ln.plannedQty) || 0) * price,
          unitPrice: price,
          qty,
          amount: qty * price,
          note: ln.note || '',
          contractFile: ln.contractFile || '',
        };
      });
    }
    const meta = metaOf(exp) || {};
    const rawLines = Array.isArray(meta.lines) ? meta.lines : null;
    if (rawLines && rawLines.length > 0) {
      return rawLines.map((ln, i) => {
        const qty = Number(ln.actualQty) || Number(ln.qty) || 1;
        const unitPrice = Number(ln.actual) || Number(ln.unitPriceAfterVat) || 0;
        return {
          no: i + 1,
          event: ln.event || '',
          planned: Number(ln.planned) || 0,
          unitPrice: unitPrice,
          qty,
          amount: unitPrice * qty,
          note: ln.note || '',
          contractFile: ln.contractFile || '',
        };
      });
    }
    // Fallback: tách trực tiếp từ ghi chú trên BE — phân bổ thực tế theo trọng số kế hoạch
    const parsedLines = parseExpenseLines(exp.directNote || exp.note || '');
    if (parsedLines.length > 0) {
      const direct = Number(exp.directCost) || 0;
      const sumPlanned = parsedLines.reduce((s, l) => s + l.planned, 0);
      let allocated = 0;
      return parsedLines.map((ln, i) => {
        const isLast = i === parsedLines.length - 1;
        const w = sumPlanned > 0 ? ln.planned / sumPlanned : 1 / parsedLines.length;
        const amount = isLast ? Math.max(direct - allocated, 0) : Math.round(direct * w);
        if (!isLast) allocated += amount;
        const qty = Number(ln.actualQty) || ln.qty || 1;
        return {
          no: i + 1,
          event: ln.event,
          planned: ln.planned,
          unitPrice: qty > 1 ? Math.round(amount / qty) : amount,
          qty,
          amount,
          note: ln.note,
          contractFile: '',
        };
      });
    }
    const parsed = parseExpenseNote(exp.directNote || exp.note || '');
    const qty = Number(meta.qty) || Number(parsed.qty) || 1;
    const direct = Number(exp.directCost) || 0;
    return [{
      no: 1,
      event: meta.event || parsed.event || '',
      planned: plannedOf(exp) || Number(parsed.planned) || 0,
      unitPrice: Math.round(direct / qty),
      qty,
      amount: direct,
      note: meta.note != null && String(meta.note) !== '' ? String(meta.note) : (parsed.note || ''),
      contractFile: meta.contractFile || '',
    }];
  };
  const renderContractBtn = (exp) => (
    hasContract(exp) ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
          const m = metaOf(exp);
          setViewContract({ name: m.contractFile || '', dataUrl: m.contractDataUrl || null });
        }}
        className="p-1 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded cursor-pointer"
        title={t('Xem hợp đồng đính kèm', 'View attached contract')}
      >
        <span className="material-symbols-outlined text-[16px]">attach_file</span>
      </button>
    ) : null
  );

  useEffect(() => {
    getExpenseList().then((res) => setExpenses(res.data || [])).catch(e => console.error('[ExpenseHistory] getExpenseList:', e));
    getProjects().then((res) => setProjects(Array.isArray(res.data) ? res.data : [])).catch(e => console.error('[ExpenseHistory] getProjects:', e));
  }, [refreshKey]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const openDetail = (exp) => {
    setDetailExp(exp);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('Xóa khoản chi phí này?', 'Delete this expense entry?'))) return;
    const target = expenses.find(e => e.id === id);
    const prev = expenses;
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      if (target) {
        const lines = parseExpenseLines(String(target.directNote || target.note || ''));
        for (const ln of lines) {
          if (ln.inventoryItemId && Number(ln.actualQty) > 0) {
            try {
              await createInventoryTransaction({
                itemId: ln.inventoryItemId,
                projectId: target.projectId,
                type: 'in',
                quantity: Number(ln.actualQty),
                date: new Date().toISOString().slice(0, 10),
                note: `Hoàn kho từ xóa chi phí (${target.period || ''})`,
              });
            } catch (txErr) {
              console.error('[ExpenseHistory] reverse inventory failed:', txErr?.response?.data || txErr);
            }
          }
        }
      }
      await deleteExpense(id);
      removeExpenseMeta(id);
      showToast(t('Đã xóa chi phí', 'Expense deleted'));
      if (onSaved) onSaved();
    } catch {
      setExpenses(prev);
      showToast(t('Lỗi khi xóa chi phí', 'Error deleting expense'), 'error');
    }
  };

  const projectRows = buildProjectRows(expenses);
  const displayRows = showAll ? projectRows : projectRows.slice(0, 5);

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden relative">
      <div className="px-4 py-2.5 border-b border-border-light flex justify-between items-center">
        <h3 className="font-title-md text-headline-sm text-on-surface">{locale === 'vi' ? 'Lịch sử Chi Phí' : 'Expense History'}</h3>
        <span className="text-body-sm text-on-surface-variant">{projectRows.length} {locale === 'vi' ? 'dự án' : 'projects'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-subtle">
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Ngày phát sinh' : 'Expense date'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Kế hoạch', 'Planned')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Thực tế', 'Actual')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-center uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {displayRows.map((row) => (
              <tr
                key={row.pid}
                onClick={() => setDetailExp(row)}
                className="hover:bg-primary/5 transition-colors cursor-pointer"
                title={t('Bấm để xem chi tiết', 'Click to view details')}
              >
                <td className="px-3 py-1.5 text-body-sm font-medium">{dateOf(row.latest)}</td>
                <td className="px-3 py-1.5 text-body-sm text-on-surface-variant max-w-[120px] truncate">{row.projectName}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(plannedOf(row.latest))}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(actualOf(row.latest))}</td>
                <td className="px-3 py-1.5 text-center">
                  <div className="flex justify-center gap-1">
                    {renderContractBtn(row.latest)}
                    <button onClick={(e) => { e.stopPropagation(); openDetail(row); }} className="p-1 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded cursor-pointer" title={t('Xem chi tiết', 'View details')}>
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(row.latest); }} className="p-1 text-on-surface-variant hover:text-secondary transition-colors hover:bg-secondary/10 rounded cursor-pointer" title={t('Chỉnh sửa', 'Edit')}>
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(row.latest.id); }} className="p-1 text-on-surface-variant hover:text-danger transition-colors hover:bg-danger/10 rounded cursor-pointer" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {projectRows.length > 5 && (
        <div className="px-3 py-2 border-t border-border-light bg-background-subtle flex justify-between items-center text-xs text-on-surface-variant">
          <p>{locale === 'vi' ? 'Hiển thị' : 'Showing'} {Math.min(5, projectRows.length)} / {projectRows.length} {locale === 'vi' ? 'dự án' : 'projects'}</p>
          <button onClick={() => setShowAll(!showAll)} className="text-primary font-semibold hover:underline cursor-pointer">
            {showAll ? (locale === 'vi' ? 'Thu gọn' : 'Collapse') : (locale === 'vi' ? 'Xem tất cả' : 'View all')}
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
                  <h3 className="text-base font-bold">{locale === 'vi' ? 'Toàn bộ Chi phí' : 'All Expenses'}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{projectRows.length} {locale === 'vi' ? 'dự án' : 'projects'}</p>
                </div>
                <button onClick={() => setShowAll(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">{locale === 'vi' ? 'Ngày phát sinh' : 'Expense date'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{t('Kế hoạch', 'Planned')}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{t('Thực tế', 'Actual')}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{locale === 'vi' ? 'Ghi chú' : 'Note'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-center uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectRows.map((row) => (
                      <tr
                        key={row.pid}
                        onClick={() => setDetailExp(row)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                        title={t('Bấm để xem chi tiết', 'Click to view details')}
                      >
                        <td className="px-4 py-2 text-sm font-medium">{dateOf(row.latest)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{row.projectName}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(plannedOf(row.latest))}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(actualOf(row.latest))}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{getExpenseMeta(row.latest.id)?.event || row.latest.note || row.latest.directNote || row.latest.overheadNote || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-1">
                            {renderContractBtn(row.latest)}
                            <button onClick={(e) => { e.stopPropagation(); openDetail(row); }} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title={t('Xem chi tiết', 'View details')}>
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(row.latest); }} className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50" title={t('Chỉnh sửa', 'Edit')}>
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.latest.id); }} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
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
                <button onClick={() => setShowAll(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold hover:bg-gray-200">{locale === 'vi' ? 'Đóng' : 'Close'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail modal */}
      {detailExp && (() => {
        const latest = detailExp.latest;
        const prev = detailExp.prev;
        const lines = linesOf(latest);
        const recMeta = metaOf(latest) || {};
        const sumPlanned = lines.reduce((s, l) => s + l.planned, 0);
        const overhead = Number(latest.overhead) || 0;
        const directVal = actualOf(latest);
        const grandVal = directVal + overhead;

        const cmp = (() => {
          if (!prev) return null;
          const prevLines = linesOf(prev);
          const prevPlanned = prevLines.reduce((s, l) => s + l.planned, 0);
          const prevActual = prevLines.reduce((s, l) => s + l.amount, 0);
          const currentKeys = new Set(lines.map(lineKey).filter(Boolean));
          const kept = lines.map((ln) => {
            const pln = prevLines.find((l) => lineKey(l) === lineKey(ln)) || null;
            const changed = pln && (ln.planned !== pln.planned || ln.amount !== pln.amount || ln.qty !== pln.qty);
            return { ...ln, status: pln ? (changed ? 'changed' : 'same') : 'added', prev: pln };
          });
          const removed = prevLines.filter((l) => !currentKeys.has(lineKey(l)));
          return { prevPlanned, prevActual, rows: kept, removed };
        })();

        const diffSign = (cur, prevVal) => {
          const d = cur - prevVal;
          if (d === 0) return { cls: 'text-gray-500', s: '±0' };
          return { cls: d > 0 ? 'text-red-600' : 'text-green-600', s: `${d > 0 ? '+' : '−'}${formatCurrency(Math.abs(d))}` };
        };
        const statusBadge = (st) => {
          const map = {
            added: [t('Mới', 'New'), 'bg-green-100 text-green-700'],
            removed: [t('Đã xóa', 'Removed'), 'bg-red-100 text-red-700'],
            changed: [t('Thay đổi', 'Changed'), 'bg-amber-100 text-amber-700'],
            same: [t('Không đổi', 'Unchanged'), 'bg-gray-100 text-gray-500'],
          };
          const [label, cls] = map[st] || map.same;
          return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
        };

        return (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDetailExp(null)} />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-3xl pointer-events-auto mx-4 flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                  <div>
                    <h3 className="text-base font-bold">{t('Chi tiết chi phí', 'Expense Details')}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {dateOf(latest)} — {detailExp.projectName}
                      {prev && <span className="ml-1 text-amber-600">({t('so với', 'vs')} {dateOf(prev)})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDetailExp(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                  </div>
                </div>
                <div className="overflow-auto flex-1 px-6 py-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: t('Kế hoạch', 'Planned'), value: formatCurrency(sumPlanned), cls: 'text-secondary' },
                      { label: t('Thực tế', 'Actual'), value: formatCurrency(directVal), cls: 'text-warning' },
                      { label: t('Tổng cộng', 'Grand total'), value: formatCurrency(grandVal), cls: 'text-primary font-bold' },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
                        <p className={`text-sm font-semibold tabular-nums mt-0.5 ${s.cls}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {cmp && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-2">
                        {t('So với bản ghi trước', 'Compared to previous record')} — {dateOf(prev)}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: t('Kế hoạch', 'Planned'), d: diffSign(sumPlanned, cmp.prevPlanned) },
                          { label: t('Thực tế', 'Actual'), d: diffSign(directVal, cmp.prevActual) },
                          { label: t('Dòng mới', 'New lines'), d: { cls: 'text-green-600', s: `+${cmp.rows.filter((r) => r.status === 'added').length}` } },
                          { label: t('Dòng đã xóa', 'Removed lines'), d: { cls: 'text-red-600', s: `+${cmp.removed.length}` } },
                        ].map((s) => (
                          <div key={s.label} className="bg-white border border-amber-200 rounded-lg p-2.5">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-sm font-semibold tabular-nums mt-0.5 ${s.d.cls}`}>{s.d.s}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 border border-amber-200 rounded-lg overflow-auto">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                          <thead className="bg-amber-50">
                            <tr>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase w-8">#</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase">{t('Sự kiện', 'Event')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-right">{t('Kế hoạch (cũ → mới)', 'Planned (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-center">{t('SL (cũ → mới)', 'Qty (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-right">{t('Thành tiền (cũ → mới)', 'Amount (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-center">{t('Trạng thái', 'Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {[
                              ...cmp.rows,
                              ...cmp.removed.map((l) => ({ ...l, status: 'removed', prev: l })),
                            ].map((ln, i) => (
                              <tr key={`${ln.status}-${lineKey(ln)}-${i}`} className="align-top">
                                <td className="px-2 py-1.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                                <td className="px-2 py-1.5 text-sm font-medium text-gray-700 max-w-[150px] break-words">{ln.event || '—'}</td>
                                <td className="px-2 py-1.5 text-sm text-right tabular-nums text-secondary whitespace-nowrap">
                                  {ln.prev ? formatCurrency(ln.prev.planned) : '—'} → {ln.status === 'removed' ? '—' : formatCurrency(ln.planned)}
                                </td>
                                <td className="px-2 py-1.5 text-sm text-center tabular-nums text-gray-600 whitespace-nowrap">
                                  {ln.prev ? ln.prev.qty : '—'} → {ln.status === 'removed' ? '—' : ln.qty}
                                </td>
                                <td className="px-2 py-1.5 text-sm text-right tabular-nums font-semibold whitespace-nowrap">
                                  {ln.prev ? formatCurrency(ln.prev.amount) : '—'} → {ln.status === 'removed' ? '—' : formatCurrency(ln.amount)}
                                </td>
                                <td className="px-2 py-1.5 text-center">{statusBadge(ln.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {t('Các dòng chi phí', 'Expense lines')} ({lines.length})
                    </p>
                    <div className="border border-gray-200 rounded-lg overflow-auto">
                      <table className="w-full text-left border-collapse min-w-[680px]">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase w-8">#</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">{t('Sự kiện', 'Event')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Kế hoạch', 'Planned')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Đơn giá', 'Unit price')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center w-14">{t('SL', 'Qty')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Thành tiền', 'Amount')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center">{t('Hợp đồng', 'Contract')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">{t('Ghi chú', 'Note')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map((ln) => (
                            <tr key={ln.no} className="align-top">
                              <td className="px-2 py-2 text-xs text-gray-400 tabular-nums">{ln.no}</td>
                              <td className="px-2 py-2 text-sm font-medium text-gray-700 max-w-[140px] break-words">{ln.event || '—'}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums text-secondary whitespace-nowrap">{formatCurrency(ln.planned)}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums text-gray-600 whitespace-nowrap">{formatCurrency(ln.unitPrice)}</td>
                              <td className="px-2 py-2 text-sm text-center tabular-nums text-gray-600">{ln.qty}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums font-semibold text-on-surface whitespace-nowrap">{formatCurrency(ln.amount)}</td>
                              <td className="px-2 py-2 text-center">
                                {ln.contractFile ? (
                                  recMeta.contractDataUrl ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setViewContract({ name: ln.contractFile || recMeta.contractFile || '', dataUrl: recMeta.contractDataUrl }); }}
                                      className="inline-flex items-center gap-1 text-primary hover:text-blue-700 cursor-pointer"
                                      title={ln.contractFile}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">attach_file</span>
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-gray-400" title={ln.contractFile}>
                                      <span className="material-symbols-outlined text-[16px]">description</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-500 max-w-[160px] whitespace-pre-wrap break-words">{ln.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {(latest.overheadNote || latest.directNote || latest.note) && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Ghi chú bản ghi', 'Record note')}</p>
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                        {latest.overheadNote || latest.directNote || latest.note}
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
                  <button onClick={() => setDetailExp(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold hover:bg-gray-200 cursor-pointer">
                    {t('Đóng', 'Close')}
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Contract viewer modal */}
      {viewContract && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setViewContract(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl pointer-events-auto mx-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                <div>
                  <h3 className="text-base font-bold">{t('Hợp đồng đính kèm', 'Attached Contract')}</h3>
                  {viewContract.name && <p className="text-xs text-gray-500 mt-0.5 truncate">{viewContract.name}</p>}
                </div>
                <button onClick={() => setViewContract(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="p-6 overflow-auto flex-1">
                {viewContract.dataUrl ? (
                  <img src={viewContract.dataUrl} alt={viewContract.name || 'contract'} className="w-full max-h-[60vh] object-contain rounded-lg border border-gray-200 bg-gray-50" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                    <span className="material-symbols-outlined text-[40px]">description</span>
                    <p className="text-sm">{t('Chỉ có tên file (không có bản xem trước)', 'File name only (no preview available)')}</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
                <button onClick={() => setViewContract(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold hover:bg-gray-200">{t('Đóng', 'Close')}</button>
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
