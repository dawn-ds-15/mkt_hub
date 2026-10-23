import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseList, deleteExpense, getProjects, createInventoryTransaction, getExpenseHistory, getExpenseAttachmentBlob } from '../../services/api';
import { getExpenseMeta, removeExpenseMeta, parseExpenseNote, parseExpenseLines } from '../../utils/expenseMeta';
import { lineAttachments } from '../../utils/expenseAttachments';

function formatCurrency(val) {
  return (val ?? 0).toLocaleString('vi-VN');
}

// Ngày nhập = ngày ấn nút Lưu ở bảng nhập chi phí. FE gửi recognizedDate/expenseDate = ngày Lưu;
// ưu tiên createdAt (thời điểm BE tạo bản ghi), fallback ngày bản ghi.
function recordDate(exp) {
  const c = String(exp?.createdAt || '').slice(0, 10);
  if (c) return c;
  return String(exp?.recognizedDate || exp?.expenseDate || '').slice(0, 10);
}

function dateOf(exp) {
  const s = recordDate(exp);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

const expTime = (exp) => {
  const n = Number(exp.number) || 0;
  const raw = exp.createdAt || exp.recognizedDate || exp.expenseDate || '';
  const ts = raw ? new Date(raw).getTime() : 0;
  return n * 10000000000 + ts;
};
const compareExpDesc = (a, b) => expTime(b) - expTime(a);

// Khóa so khớp giữa 2 phiên bản. KHÔNG dùng ghi chú làm khóa: sửa ghi chú sẽ
// làm đổi khóa khiến cùng một dòng bị hiểu là "đã xoá" + "thêm mới".
const lineKey = (ln) => String(ln.event || '').trim().toLowerCase() || `#${ln.no ?? ''}`;

const formatDate = (d) => {
  const raw = String(d || '');
  const s = raw.slice(0, 10);
  if (!s) return '—';
  const [y, m, day] = s.split('-');
  return day && m && y ? `${day}/${m}/${y}` : s;
};

// Từ 1 phiên bản trong GET /v1/expenses/:id/history → object giống bản ghi expense để tái dùng linesOf/actualOf
function expenseFromVersion(v) {
  const snap = v?.snapshot || v || {};
  return {
    id: v?.expenseId || snap?.id || v?.id || '',
    projectId: snap?.projectId,
    recognizedDate: v?.expenseDate || snap?.recognizedDate || snap?.expenseDate || '',
    expenseDate: v?.expenseDate || snap?.expenseDate || snap?.recognizedDate || '',
    directCost: Number(snap?.directCost) || 0,
    directNote: snap?.directNotes || '',
    overheadNote: snap?.overheadNotes || '',
    note: snap?.directNotes || snap?.overheadNotes || '',
    lines: Array.isArray(snap?.lines) ? snap.lines : [],
  };
}



export default function ExpenseHistory({ refreshKey, onSaved, projectId, onProjectChange }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toast, setToast] = useState(null);
  const [viewContract, setViewContract] = useState(null);
  const [detailExp, setDetailExp] = useState(null);
  const [verHistory, setVerHistory] = useState([]);

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
  const vatRateOf = (ln) => {
    if (ln.vatRateSnapshot != null && ln.vatRateSnapshot !== '') return Number(ln.vatRateSnapshot) || 0;
    if (ln.vatRate != null && ln.vatRate !== '') return Number(ln.vatRate) || 0;
    return 0;
  };
  // Tổng sau VAT từng dòng / từng bản ghi (khớp cột Tổng Cộng ở bảng nhập); không có line → bằng Thực tế
  const lineAfterVat = (ln) => {
    const qty = Number(ln.actualQuantity) || Number(ln.actualQty) || 0;
    return Math.round(qty * preVatPrice(ln) * (1 + vatRateOf(ln) / 100));
  };
  const afterVatOf = (exp) => {
    const lines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
    if (lines) return lines.reduce((s, ln) => s + lineAfterVat(ln), 0);
    return actualOf(exp);
  };
  const hasContract = (exp) => {
    const m = metaOf(exp);
    return !!(m && (m.contractDataUrl || m.contractFile));
  };
  const openLineAttachment = async (att) => {
    // Mở tab trước khi await để trình duyệt không chặn popup
    const win = window.open('', '_blank');
    try {
      const blob = await getExpenseAttachmentBlob(att.id);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch {
      if (win) win.close();
      window.alert(t('Không mở được hồ sơ', 'Could not open the file'));
    }
  };

  // Tách các dòng chi phí của một bản ghi (BE lưu gộp theo Dự án + Kỳ)
  const linesOf = (exp) => {
    const beLines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
    // BE hiện là nguồn chính: hiển thị theo quy ước trước VAT, khớp cột Kế hoạch/Thực tế
    if (beLines) {
      const lDates = (metaOf(exp)?.lineDates) || {};
      return beLines.map((ln, i) => {
        const price = preVatPrice(ln);
        const qty = Number(ln.actualQuantity) || Number(ln.actualQty) || 0;
        const vat = vatRateOf(ln);
        return {
          no: i + 1,
          event: ln.name || ln.event || '',
          date: ln.expenseDate || ln.recognizedDate || lDates[ln.id] || exp.recognizedDate || exp.expenseDate || '',
          planned: (Number(ln.plannedQuantity) || Number(ln.plannedQty) || 0) * price,
          unitPrice: price,
          qty,
          amount: qty * price,
          vatRate: vat,
          totalAfterVat: Math.round(qty * price * (1 + vat / 100)),
          note: ln.note || '',
          contractFile: ln.contractFile || '',
          attachments: lineAttachments(ln),
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
          date: ln.expenseDate || exp.recognizedDate || '',
          planned: Number(ln.planned) || 0,
          unitPrice: unitPrice,
          qty,
          amount: unitPrice * qty,
          vatRate: 0,
          totalAfterVat: unitPrice * qty,
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
          date: exp.recognizedDate || '',
          planned: ln.planned,
          unitPrice: qty > 1 ? Math.round(amount / qty) : amount,
          qty,
          amount,
          vatRate: 0,
          totalAfterVat: amount,
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
      date: exp.recognizedDate || '',
      planned: plannedOf(exp) || Number(parsed.planned) || 0,
      unitPrice: Math.round(direct / qty),
      qty,
      amount: direct,
      vatRate: 0,
      totalAfterVat: direct,
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
    setDetailExp({ latest: exp, projectName: exp.project?.name || exp.project || '—' });
    setVerHistory([]);
    if (exp.id) {
      getExpenseHistory(exp.id)
        .then((vers) => setVerHistory(Array.isArray(vers) ? vers : []))
        .catch(() => setVerHistory([]));
    }
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

  const filteredExpenses = projectId
    ? expenses.filter((e) => e.projectId === projectId)
    : expenses;
  const sortedExpenses = [...filteredExpenses].sort(compareExpDesc);
  const displayExpenses = sortedExpenses;

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden relative">
      <div className="px-4 py-2.5 border-b border-border-light flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-title-md text-headline-sm text-on-surface">{locale === 'vi' ? 'Lịch sử Chi Phí' : 'Expense History'}</h3>
        <div className="flex items-center gap-3">
          <label className="text-body-sm text-on-surface-variant whitespace-nowrap">
            {locale === 'vi' ? 'Lọc theo dự án:' : 'Filter by project:'}
          </label>
          <select
            className="bg-background-subtle border border-border-light rounded-lg px-3 py-1 text-body-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={projectId || ''}
            onChange={(e) => onProjectChange && onProjectChange(e.target.value)}
          >
            <option value="">{locale === 'vi' ? 'Tất cả dự án' : 'All Projects'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="text-body-sm text-on-surface-variant">{filteredExpenses.length} {locale === 'vi' ? 'bản ghi' : 'records'}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-subtle">
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Ngày nhập' : 'Entry date'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Kế hoạch', 'Planned')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Thực tế', 'Actual')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Tổng cộng', 'Total')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-center uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {displayExpenses.map((exp) => (
              <tr
                key={exp.id}
                onClick={() => openDetail(exp)}
                className="hover:bg-primary/5 transition-colors cursor-pointer"
                title={t('Bấm để xem chi tiết', 'Click to view details')}
              >
                <td className="px-3 py-1.5 text-body-sm font-medium">{dateOf(exp)}</td>
                <td className="px-3 py-1.5 text-body-sm text-on-surface-variant max-w-[180px] truncate">{(exp.project?.name || exp.project) || '—'}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(plannedOf(exp))}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(actualOf(exp))}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-semibold text-primary">{formatCurrency(afterVatOf(exp))}</td>
                <td className="px-3 py-1.5 text-center">
                  <div className="flex justify-center gap-1">
                    {renderContractBtn(exp)}
                    <button onClick={(e) => { e.stopPropagation(); openDetail(exp); }} className="p-1 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded cursor-pointer" title={t('Xem chi tiết', 'View details')}>
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }} className="p-1 text-on-surface-variant hover:text-danger transition-colors hover:bg-danger/10 rounded cursor-pointer" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detailExp && (() => {
        const latest = detailExp.latest;
        const lines = linesOf(latest);
        const sumPlanned = lines.reduce((s, l) => s + l.planned, 0);
        const sumAfterVat = lines.reduce((s, l) => s + (l.totalAfterVat >= 0 ? l.totalAfterVat : l.amount), 0);
        const directVal = actualOf(latest);

        // Nguồn so sánh: phiên bản liền trước của CHÍNH bản ghi này từ BE audit (GET history)
        const histBase = verHistory.length >= 2 ? expenseFromVersion(verHistory[verHistory.length - 2]) : null;
        const cmpBase = histBase;
        const cmp = (() => {
          if (!cmpBase) return null;
          const baseLines = linesOf(cmpBase);
          const prevPlanned = baseLines.reduce((s, l) => s + l.planned, 0);
          const prevActual = baseLines.reduce((s, l) => s + l.amount, 0);
          const currentKeys = new Set(lines.map(lineKey).filter(Boolean));
          const kept = lines.map((ln) => {
            const pln = baseLines.find((l) => lineKey(l) === lineKey(ln)) || null;
            const noteChanged = String(ln.note || '').trim() !== String(pln?.note || '').trim();
            const changed = pln && (ln.planned !== pln.planned || ln.amount !== pln.amount || ln.qty !== pln.qty || ln.date !== pln.date || noteChanged);
            return { ...ln, status: pln ? (changed ? 'changed' : 'same') : 'added', prev: pln };
          });
          const removed = baseLines.filter((l) => !currentKeys.has(lineKey(l)));
          return { prevPlanned, prevActual, rows: kept, removed, baseDate: cmpBase.recognizedDate || cmpBase.expenseDate || '' };
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
                      {cmpBase && <span className="ml-1 text-amber-600">({t('so với', 'vs')} {formatDate(cmp?.baseDate)})</span>}
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
                      { label: t('Tổng cộng', 'Total'), value: formatCurrency(sumAfterVat), cls: 'text-primary font-bold' },
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
                        {t('So với lần nhập gần nhất', 'Compared to the most recent entry')} — {formatDate(cmp.baseDate)}
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
                        <table className="w-full text-left border-collapse min-w-[880px]">
                          <thead className="bg-amber-50">
                            <tr>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase w-8">#</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase">{t('Sự kiện', 'Event')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-right">{t('Ngày (cũ → mới)', 'Date (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-right">{t('Kế hoạch (cũ → mới)', 'Planned (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-center">{t('SL (cũ → mới)', 'Qty (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase text-right">{t('Thành tiền (cũ → mới)', 'Amount (old → new)')}</th>
                              <th className="px-2 py-1.5 text-[10px] font-semibold text-amber-700 uppercase">{t('Ghi chú (cũ → mới)', 'Note (old → new)')}</th>
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
                                <td className="px-2 py-1.5 text-sm text-right tabular-nums text-gray-600 whitespace-nowrap">
                                  {ln.prev ? formatDate(ln.prev.date) : '—'} → {ln.status === 'removed' ? '—' : formatDate(ln.date)}
                                </td>
                                <td className="px-2 py-1.5 text-sm text-right tabular-nums text-secondary whitespace-nowrap">
                                  {ln.prev ? formatCurrency(ln.prev.planned) : '—'} → {ln.status === 'removed' ? '—' : formatCurrency(ln.planned)}
                                </td>
                                <td className="px-2 py-1.5 text-sm text-center tabular-nums text-gray-600 whitespace-nowrap">
                                  {ln.prev ? ln.prev.qty : '—'} → {ln.status === 'removed' ? '—' : ln.qty}
                                </td>
                                <td className="px-2 py-1.5 text-sm text-right tabular-nums font-semibold whitespace-nowrap">
                                  {ln.prev ? formatCurrency(ln.prev.amount) : '—'} → {ln.status === 'removed' ? '—' : formatCurrency(ln.amount)}
                                </td>
                                <td className="px-2 py-1.5 text-xs max-w-[200px] whitespace-pre-wrap break-words">
                                  {(() => {
                                    const before = String(ln.prev?.note || '').trim();
                                    const after = ln.status === 'removed' ? '' : String(ln.note || '').trim();
                                    if (!before && !after) return <span className="text-gray-400">—</span>;
                                    if (before === after) return <span className="text-gray-500">{after}</span>;
                                    return (
                                      <span className="text-gray-600">
                                        <span className="line-through text-gray-400">{before || '—'}</span>
                                        {' → '}
                                        <span className="font-semibold text-amber-700">{after || '—'}</span>
                                      </span>
                                    );
                                  })()}
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
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Ngày phát sinh', 'Date')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Kế hoạch', 'Planned')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Đơn giá', 'Unit price')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center w-14">{t('SL', 'Qty')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Thành tiền', 'Amount')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">{t('Tổng cộng', 'Total (after VAT)')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">{t('Ghi chú', 'Note')}</th>
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">{t('Hồ sơ', 'Documents')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map((ln) => (
                            <tr key={ln.no} className="align-top">
                              <td className="px-2 py-2 text-xs text-gray-400 tabular-nums">{ln.no}</td>
                              <td className="px-2 py-2 text-sm font-medium text-gray-700 max-w-[140px] break-words">{ln.event || '—'}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums text-gray-500 whitespace-nowrap">{formatDate(ln.date)}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums text-secondary whitespace-nowrap">{formatCurrency(ln.planned)}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums text-gray-600 whitespace-nowrap">{formatCurrency(ln.unitPrice)}</td>
                              <td className="px-2 py-2 text-sm text-center tabular-nums text-gray-600">{ln.qty}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums font-semibold text-on-surface whitespace-nowrap">{formatCurrency(ln.amount)}</td>
                              <td className="px-2 py-2 text-sm text-right tabular-nums font-semibold text-primary whitespace-nowrap">{formatCurrency(ln.totalAfterVat)}</td>
                              <td className="px-2 py-2 text-xs text-gray-500 max-w-[160px] whitespace-pre-wrap break-words">{ln.note || '—'}</td>
                              <td className="px-2 py-2 text-xs max-w-[140px]">
                                {ln.attachments?.length > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    {ln.attachments.map((att) => (
                                      <button
                                        key={att.id}
                                        type="button"
                                        onClick={() => openLineAttachment(att)}
                                        className="inline-flex items-center gap-1 max-w-full text-primary hover:underline"
                                        title={att.name}
                                      >
                                        <span className="material-symbols-outlined text-[14px] shrink-0">description</span>
                                        <span className="truncate">{att.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
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
