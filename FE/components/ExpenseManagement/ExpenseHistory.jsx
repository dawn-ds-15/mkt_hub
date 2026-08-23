import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseList, deleteExpense, getProjects } from '../../services/api';
import { getExpenseMeta, removeExpenseMeta, parseExpenseNote, parseExpenseLines } from '../../utils/expenseMeta';

function formatCurrency(val) {
  return (val ?? 0).toLocaleString('vi-VN');
}

export default function ExpenseHistory({ refreshKey, onSaved }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [viewContract, setViewContract] = useState(null);
  const [detailExp, setDetailExp] = useState(null);

  const metaOf = (exp) => getExpenseMeta(exp.id);
  // Ưu tiên meta máy này; thiếu thì tính từ ghi chú lưu trên BE (đọc được ở mọi máy)
  const plannedOf = (exp) => {
    const m = Number(metaOf(exp)?.planned);
    if (m) return m;
    const raw = String(exp.directNote || exp.note || '');
    if (!raw) return 0;
    return parseExpenseLines(raw).reduce((s, l) => s + l.planned, 0);
  };
  const totalOf = (exp) => {
    const m = metaOf(exp);
    return m ? plannedOf(exp) + (Number(exp.directCost) || 0) : (Number(exp.total) || 0);
  };
  const hasContract = (exp) => {
    const m = metaOf(exp);
    return !!(m && (m.contractDataUrl || m.contractFile));
  };
  // Tách các dòng chi phí của một bản ghi (BE lưu gộp theo Dự án + Kỳ)
  const linesOf = (exp) => {
    const meta = metaOf(exp) || {};
    const rawLines = Array.isArray(meta.lines) ? meta.lines : null;
    if (rawLines && rawLines.length > 0) {
      return rawLines.map((ln, i) => ({
        no: i + 1,
        event: ln.event || '',
        planned: Number(ln.planned) || 0,
        unitPrice: Number(ln.actual) || 0,
        qty: Number(ln.qty) || 1,
        amount: (Number(ln.actual) || 0) * (Number(ln.qty) || 1),
        note: ln.note || '',
        contractFile: ln.contractFile || '',
      }));
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
        return {
          no: i + 1,
          event: ln.event,
          planned: ln.planned,
          unitPrice: ln.qty > 1 ? Math.round(amount / ln.qty) : amount,
          qty: ln.qty,
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
    const prev = expenses;
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      await deleteExpense(id);
      removeExpenseMeta(id);
      showToast(t('Đã xóa chi phí', 'Expense deleted'));
      if (onSaved) onSaved();
    } catch {
      setExpenses(prev);
      showToast(t('Lỗi khi xóa chi phí', 'Error deleting expense'), 'error');
    }
  };

  const displayExpenses = showAll ? expenses : expenses.slice(0, 5);

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden relative">
      <div className="px-4 py-2.5 border-b border-border-light flex justify-between items-center">
        <h3 className="font-title-md text-headline-sm text-on-surface">{locale === 'vi' ? 'Lịch sử Chi Phí' : 'Expense History'}</h3>
        <span className="text-body-sm text-on-surface-variant">{expenses.length} {locale === 'vi' ? 'bản ghi' : 'records'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-subtle">
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Kỳ' : 'Period'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light uppercase tracking-wider">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Kế hoạch', 'Planned')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Thực tế', 'Actual')}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{locale === 'vi' ? 'Tổng' : 'Total'}</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-border-light text-center uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {displayExpenses.map((exp) => (
              <tr
                key={exp.id}
                onClick={() => setDetailExp(exp)}
                className="hover:bg-primary/5 transition-colors cursor-pointer"
                title={t('Bấm để xem chi tiết', 'Click to view details')}
              >
                <td className="px-3 py-1.5 text-body-sm font-medium">{exp.period}</td>
                <td className="px-3 py-1.5 text-body-sm text-on-surface-variant max-w-[120px] truncate">{(exp.project?.name || exp.project) || '—'}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(plannedOf(exp))}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-medium">{formatCurrency(exp.directCost)}</td>
                <td className="px-3 py-1.5 text-body-sm text-right font-bold text-on-surface">{formatCurrency(totalOf(exp))}</td>
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
      {expenses.length > 5 && (
        <div className="px-3 py-2 border-t border-border-light bg-background-subtle flex justify-between items-center text-xs text-on-surface-variant">
          <p>{locale === 'vi' ? 'Hiển thị' : 'Showing'} {Math.min(5, expenses.length)} / {expenses.length} {locale === 'vi' ? 'bản ghi' : 'records'}</p>
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
                  <p className="text-xs text-gray-500 mt-0.5">{expenses.length} {locale === 'vi' ? 'bản ghi' : 'records'}</p>
                </div>
                <button onClick={() => setShowAll(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">{locale === 'vi' ? 'Kỳ' : 'Period'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b uppercase tracking-wider">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{t('Kế hoạch', 'Planned')}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{t('Thực tế', 'Actual')}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{locale === 'vi' ? 'Tổng' : 'Total'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-right uppercase tracking-wider">{locale === 'vi' ? 'Ghi chú' : 'Note'}</th>
                      <th className="px-4 py-2 text-[11px] font-semibold text-gray-500 border-b text-center uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        onClick={() => setDetailExp(exp)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                        title={t('Bấm để xem chi tiết', 'Click to view details')}
                      >
                        <td className="px-4 py-2 text-sm font-medium">{exp.period}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{(exp.project?.name || exp.project) || '—'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(plannedOf(exp))}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(exp.directCost)}</td>
                        <td className="px-4 py-2 text-sm text-right font-bold">{formatCurrency(totalOf(exp))}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{getExpenseMeta(exp.id)?.event || exp.note || exp.directNote || exp.overheadNote || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-1">
                            {renderContractBtn(exp)}
                            <button onClick={(e) => { e.stopPropagation(); openDetail(exp); }} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title={t('Xem chi tiết', 'View details')}>
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
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
        const lines = linesOf(detailExp);
        const recMeta = metaOf(detailExp) || {};
        const sumPlanned = lines.reduce((s, l) => s + l.planned, 0);
        const overhead = Number(detailExp.overhead) || 0;
        const directVal = Number(detailExp.directCost) || 0;
        const grandVal = directVal + overhead;
        return (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDetailExp(null)} />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-3xl pointer-events-auto mx-4 flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                  <div>
                    <h3 className="text-base font-bold">{t('Chi tiết chi phí', 'Expense Details')}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {detailExp.period} — {(detailExp.project?.name || detailExp.project) || '—'}
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
                      { label: t('Phí khác', 'Other fees'), value: formatCurrency(overhead), cls: 'text-gray-500' },
                      { label: t('Tổng cộng', 'Grand total'), value: formatCurrency(grandVal), cls: 'text-primary font-bold' },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
                        <p className={`text-sm font-semibold tabular-nums mt-0.5 ${s.cls}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

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

                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Hợp đồng đính kèm', 'Attached Contract')}</p>
                    {recMeta.contractDataUrl ? (
                      <img
                        src={recMeta.contractDataUrl}
                        alt={recMeta.contractFile || 'contract'}
                        className="w-full max-h-40 object-contain rounded-lg border border-gray-200 bg-gray-50 cursor-zoom-in"
                        onClick={(e) => { e.stopPropagation(); setViewContract({ name: recMeta.contractFile || '', dataUrl: recMeta.contractDataUrl }); }}
                      />
                    ) : recMeta.contractFile ? (
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-primary text-body-lg">description</span>
                        <span className="text-xs text-on-surface truncate flex-1">{recMeta.contractFile}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">{t('Chưa có hợp đồng đính kèm', 'No contract attached')}</p>
                    )}
                  </div>

                  {(detailExp.overheadNote || detailExp.directNote || detailExp.note) && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Ghi chú bản ghi', 'Record note')}</p>
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                        {detailExp.overheadNote || detailExp.directNote || detailExp.note}
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
