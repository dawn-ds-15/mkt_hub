import { useEffect, useState } from 'react';
import { getExpenseList } from '../../services/api';

const statusConfig = {
  approved: { label: 'Đã duyệt', class: 'bg-success/10 text-success' },
  pending: { label: 'Chờ duyệt', class: 'bg-warning/10 text-warning' },
};

function formatCurrency(val) {
  return val.toLocaleString('vi-VN');
}

export default function ExpenseHistory({ refreshKey }) {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    getExpenseList('Project Alpha - SEO').then((res) => setExpenses(res.data));
  }, [refreshKey]);

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light flex justify-between items-center">
        <h3 className="font-title-lg text-headline-sm text-on-surface">Lịch sử Chi Phí - Project Alpha</h3>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-success rounded-full" /> Đã duyệt
          </span>
          <span className="flex items-center gap-1 ml-3">
            <span className="w-3 h-3 bg-warning rounded-full" /> Chờ duyệt
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-subtle">
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light">Kỳ</th>
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light text-right">Direct Cost</th>
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light text-right">Overhead</th>
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light text-right">Tổng</th>
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light text-center">Trạng thái</th>
              <th className="px-6 py-3 font-label-md text-on-surface-variant border-b border-border-light text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {expenses.map((exp) => {
              const status = statusConfig[exp.status] || statusConfig.pending;
              return (
                <tr key={exp.id} className="hover:bg-primary/5 group transition-colors">
                  <td className="px-6 py-4 text-body-md font-medium">{exp.period}</td>
                  <td className="px-6 py-4 text-body-md text-right font-medium">{formatCurrency(exp.directCost)}</td>
                  <td className="px-6 py-4 text-body-md text-right font-medium">{formatCurrency(exp.overhead)}</td>
                  <td className="px-6 py-4 text-body-md text-right font-bold text-on-surface">{formatCurrency(exp.total)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${status.class}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button className="p-1.5 text-on-surface-variant hover:text-danger transition-colors hover:bg-danger/10 rounded cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-border-light bg-background-subtle flex justify-between items-center text-xs text-on-surface-variant">
        <p>Hiển thị {expenses.length} kết quả gần nhất</p>
        <button className="text-primary font-bold hover:underline cursor-pointer">Xem tất cả lịch sử</button>
      </div>
    </div>
  );
}
