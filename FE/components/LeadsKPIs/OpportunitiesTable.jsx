import { useState, useEffect, useCallback } from 'react';
import { getOpportunities, addOpportunity, convertOpportunityToWon } from '../../services/api';

const emptyRow = {
  companyName: '',
  size: 'S',
  project: '',
  fees: '',
  expectedCloseDate: '',
};

function getTodayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export default function OpportunitiesTable({ onConvertSuccess }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convertingIndex, setConvertingIndex] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());

  const [showModal, setShowModal] = useState(false);
  const [modalIndex, setModalIndex] = useState(null);
  const [signedDate, setSignedDate] = useState(getTodayISO());
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getOpportunities();
      setRows(response.data);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

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

  const openConvertModal = (index) => {
    setModalIndex(index);
    setSignedDate(getTodayISO());
    setShowModal(true);
  };

  const handleConfirmConvert = async () => {
    if (modalIndex == null) return;
    const row = rows[modalIndex];
    if (!row.companyName) {
      alert('Vui lòng nhập tên công ty!');
      return;
    }
    setModalSubmitting(true);
    try {
      await convertOpportunityToWon(row.id, signedDate);
      setRemovingIds(prev => new Set([...prev, row.id]));
      setTimeout(() => {
        setRows(prev => prev.filter((_, i) => i !== modalIndex));
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        if (onConvertSuccess) onConvertSuccess();
      }, 400);
      setShowModal(false);
      setModalIndex(null);
    } catch (error) {
      console.error('Error converting to won:', error);
      alert('Có lỗi xảy ra khi chuyển đổi!');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConvert = (index) => {
    openConvertModal(index);
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
            {rows.map((row, index) => {
              const isRemoving = removingIds.has(row.id);
              return (
                <tr
                  key={row.id || index}
                  className={`hover:bg-surface-container-lowest transition-all duration-300 ${
                    isRemoving ? 'opacity-0 -translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'
                  }`}
                >
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
                      onClick={() => handleConvert(index)}
                      disabled={convertingIndex === index}
                      className="px-3 py-1.5 bg-success text-white rounded text-label-md font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      Chuyển thành Won
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-success">how_to_reg</span>
                Xác nhận chuyển đổi
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {modalIndex != null && rows[modalIndex] && (
              <div className="space-y-4">
                <div className="bg-surface-container-low rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Khách hàng:</span>
                    <span className="font-semibold text-on-surface">{rows[modalIndex].companyName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Dự án:</span>
                    <span className="font-semibold text-on-surface">{rows[modalIndex].project || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Fees:</span>
                    <span className="font-semibold text-on-surface">${Number(rows[modalIndex].fees || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
                    Ngày ký hợp đồng (signed_date)
                  </label>
                  <input
                    type="date"
                    value={signedDate}
                    onChange={(e) => setSignedDate(e.target.value)}
                    className="w-full border border-border-light rounded-lg px-4 py-3 text-body-md bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 border border-border-light text-on-surface-variant font-semibold rounded-lg hover:bg-surface-container-low transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmConvert}
                    disabled={modalSubmitting}
                    className="flex-1 px-4 py-3 bg-success text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {modalSubmitting ? 'Đang xử lý...' : 'Xác nhận Won'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
