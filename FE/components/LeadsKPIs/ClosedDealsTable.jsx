import { useState, useEffect } from 'react';
import { getClosedDeals } from '../../services/api';

export default function ClosedDealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClosedDeals();
  }, []);

  const loadClosedDeals = async () => {
    setLoading(true);
    try {
      const response = await getClosedDeals();
      setDeals(response.data);
    } catch (error) {
      console.error('Error loading closed deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('en-US');
  };

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md font-semibold text-on-surface uppercase tracking-wider">
          Chi tiết Closed Deal
        </h4>
      </div>

      <div className="overflow-x-auto border border-border-light rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low border-b border-border-light">
            <tr>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Khách hàng</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Hợp đồng</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Final Fees ($)</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Ngày ký</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-surface-container-lowest transition-colors">
                <td className="p-3 text-body-md font-medium">{deal.customer}</td>
                <td className="p-3 text-body-md">{deal.contract}</td>
                <td className="p-3 text-data-display">{formatCurrency(deal.finalFees)}</td>
                <td className="p-3 text-body-md">{formatDate(deal.signedDate)}</td>
                <td className="p-3">
                  <span className="text-success font-semibold flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    Hoàn tất
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
