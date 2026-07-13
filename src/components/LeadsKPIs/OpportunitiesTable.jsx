import { useState, useEffect } from 'react';
import { getOpportunities, addOpportunity, convertToWon } from '../../services/api';

const emptyRow = {
  companyName: '',
  size: 'S',
  project: '',
  fees: '',
  expectedCloseDate: '',
};

export default function OpportunitiesTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const response = await getOpportunities();
      setRows(response.data);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setRows(prev => [...prev, { ...emptyRow, id: Date.now() }]);
  };

  const handleRowChange = (index, field, value) => {
    setRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleConvertToWon = async (index) => {
    const row = rows[index];
    if (!row.companyName) {
      alert('Vui lòng nhập tên công ty!');
      return;
    }
    try {
      await convertToWon(row.id);
      alert(`Đã chuyển "${row.companyName}" sang Won!`);
      loadOpportunities();
    } catch (error) {
      console.error('Error converting to won:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md font-semibold text-on-surface uppercase tracking-wider">
          Chi tiết Opportunities
        </h4>
        <button
          onClick={addRow}
          className="text-primary flex items-center gap-1 text-body-sm font-semibold hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Thêm dòng
        </button>
      </div>

      <div className="overflow-x-auto border border-border-light rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low border-b border-border-light">
            <tr>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Tên DN / Khách hàng</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Size</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Project</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fees ($)</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Dự kiến đóng</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {rows.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-surface-container-lowest transition-colors">
                <td className="p-3">
                  <input
                    className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none"
                    placeholder="Cty CP ABC..."
                    type="text"
                    value={row.companyName}
                    onChange={(e) => handleRowChange(index, 'companyName', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <select
                    className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none"
                    value={row.size}
                    onChange={(e) => handleRowChange(index, 'size', e.target.value)}
                  >
                    <option>S</option>
                    <option>M</option>
                    <option>L</option>
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none"
                    placeholder="Marketing Audit"
                    type="text"
                    value={row.project}
                    onChange={(e) => handleRowChange(index, 'project', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="w-full border-0 focus:ring-0 p-0 text-data-display outline-none"
                    placeholder="5,000"
                    type="number"
                    value={row.fees}
                    onChange={(e) => handleRowChange(index, 'fees', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none"
                    type="date"
                    value={row.expectedCloseDate}
                    onChange={(e) => handleRowChange(index, 'expectedCloseDate', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleConvertToWon(index)}
                    className="px-3 py-1 border border-primary text-primary rounded text-label-md font-semibold hover:bg-primary hover:text-white transition-all"
                  >
                    Chuyển Won
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
