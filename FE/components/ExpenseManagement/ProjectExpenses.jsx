import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseList } from '../../services/api';
import { parseExpenseNote } from '../../utils/expenseMeta';

function formatCurrency(n) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

function formatDate(v) {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(v);
}

function expenseDateOf(exp) {
  if (exp.recognizedDate || exp.expenseDate) return exp.recognizedDate || exp.expenseDate;
  const lines = Array.isArray(exp.lines) ? exp.lines : [];
  for (const ln of lines) {
    if (ln.expenseDate || ln.recognizedDate) return ln.expenseDate || ln.recognizedDate;
  }
  return '';
}

function expenseLabel(exp) {
  const note = String(exp.note || exp.directNote || '').trim();
  if (note) {
    const parsed = parseExpenseNote(note);
    if (parsed.event) return parsed.event;
    return note.split('\n')[0];
  }
  return '';
}

export default function ProjectExpenses({ projectId }) {
  const { locale } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExpenseList(projectId)
      .then((res) => { if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const totalDirect = rows.reduce((s, r) => s + Number(r.directCost || 0), 0);
  const totalOverhead = rows.reduce((s, r) => s + Number(r.overhead || 0), 0);
  const total = rows.reduce((s, r) => s + (Number(r.total) || 0) + (Number(r.total) ? 0 : (Number(r.directCost || 0) + Number(r.overhead || 0))), 0);

  const thCls = 'px-4 py-2.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right';

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-32 text-on-surface-variant">
          <span className="material-symbols-outlined text-[32px] text-outline-variant animate-spin">sync</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-on-surface-variant italic">
          {locale === 'vi' ? 'Chưa có chi phí phát sinh cho dự án này.' : 'No incurred expenses for this project yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-border-light">
                <th className="px-4 py-2.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Kỳ' : 'Period'}</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Ngày phát sinh' : 'Expense Date'}</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Nội dung chi phí' : 'Expense Detail'}</th>
                <th className={thCls}>{locale === 'vi' ? 'Thực tế' : 'Actual'}</th>
                <th className={thCls}>{locale === 'vi' ? 'Phí khác' : 'Overhead'}</th>
                <th className={thCls}>{locale === 'vi' ? 'Tổng cộng' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {rows.map((exp) => {
                const direct = Number(exp.directCost || 0);
                const overhead = Number(exp.overhead || 0);
                const rowTotal = Number(exp.total || 0) || (direct + overhead);
                return (
                  <tr key={exp.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-4 py-2 text-[12px] font-medium text-on-surface whitespace-nowrap">{exp.period || '—'}</td>
                    <td className="px-4 py-2 text-[12px] text-on-surface whitespace-nowrap">{formatDate(expenseDateOf(exp))}</td>
                    <td className="px-4 py-2 text-[12px] text-on-surface-variant truncate max-w-[320px]" title={exp.note || ''}>{expenseLabel(exp) || '—'}</td>
                    <td className="px-4 py-2 text-right font-data-mono text-[12px] text-on-surface">{formatCurrency(direct)}</td>
                    <td className="px-4 py-2 text-right font-data-mono text-[12px] text-on-surface">{overhead ? formatCurrency(overhead) : '—'}</td>
                    <td className="px-4 py-2 text-right font-data-mono text-[12px] font-semibold text-on-surface">{formatCurrency(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border-light bg-surface-container-low">
                <td className="px-4 py-2.5 font-bold text-on-surface text-[13px]">{locale === 'vi' ? 'Tổng cộng' : 'Total'}</td>
                <td className="px-4 py-2.5" colSpan={2} />
                <td className="px-4 py-2.5 text-right font-bold font-data-mono text-on-surface text-[13px]">{formatCurrency(totalDirect)}</td>
                <td className="px-4 py-2.5 text-right font-bold font-data-mono text-on-surface text-[13px]">{totalOverhead ? formatCurrency(totalOverhead) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-bold font-data-mono text-on-surface text-[13px]">{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}