import { useState, useEffect, useCallback, useRef } from 'react';
import { getOpportunities, addOpportunity, updateOpportunity, deleteOpportunity, convertOpportunityToWon, getProjects } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';

const feSize = { 'S': 'Enterprise', 'M': 'Medium', 'L': 'Enterprise' };
const beSize = { 'Enterprise': 'S', 'Medium': 'M' };

const emptyRow = {
  companyName: '',
  size: 'S',
  project: '',
  projectId: '',
  fees: '',
  expectedCloseDate: '',
};

function getTodayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

const noop = () => {};

const sizeOptions = [
  { value: 'S', label: 'S (Enterprise)' },
  { value: 'M', label: 'M (Medium)' },
  { value: 'L', label: 'L (Enterprise)' },
];

export default function OpportunitiesTable({ onConvertSuccess = noop }) {
  const addToast = useToast();
  const { locale } = useDashboard();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convertingIndex, setConvertingIndex] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());
  const saveTimers = useRef({});
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    getProjects().then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(noop);
  }, []);

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
    const prevRow = rows[index];
    const updatedRow = { ...prevRow, [field]: value };
    setRows(prev => {
      const copy = [...prev];
      copy[index] = updatedRow;
      return copy;
    });
    if (saveTimers.current[index]) clearTimeout(saveTimers.current[index]);
    saveTimers.current[index] = setTimeout(async () => {
      try {
        const isTempId = typeof updatedRow.id === 'number';
        if (isTempId) {
          if (!updatedRow.companyName) return;
          const res = await addOpportunity(updatedRow);
          setRows(prev => {
            const copy = [...prev];
            copy[index] = { ...updatedRow, id: res.data.id };
            return copy;
          });
        } else {
          await updateOpportunity(updatedRow.id, updatedRow);
        }
      } catch {}
    }, 500);
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
      addToast(locale === 'vi' ? 'Vui lòng nhập tên công ty!' : 'Please enter a company name!', 'error');
      return;
    }
    setModalSubmitting(true);
    try {
      let realId = row.id;
      const isTempId = typeof realId === 'number';
      if (isTempId) {
        const res = await addOpportunity(row);
        realId = res.data.id;
        setRows(prev => {
          const copy = [...prev];
          copy[modalIndex] = { ...row, id: realId };
          return copy;
        });
      }
      await convertOpportunityToWon(realId, signedDate);
      setRemovingIds(prev => new Set([...prev, realId]));
      setTimeout(() => {
        setRows(prev => prev.filter((_, i) => i !== modalIndex));
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(realId);
          return next;
        });
        if (onConvertSuccess) onConvertSuccess();
      }, 400);
      addToast(locale === 'vi' ? 'Chuyển đổi cơ hội thành Closed Deal thành công!' : 'Opportunity converted to Closed Deal successfully!', 'success');
      setShowModal(false);
      setModalIndex(null);
    } catch (error) {
      console.error('Error converting to won:', error);
      addToast(locale === 'vi' ? 'Có lỗi xảy ra khi chuyển đổi!' : 'An error occurred during conversion!', 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConvert = (index) => {
    openConvertModal(index);
  };

  const handleDeleteRow = async (index, row) => {
    const isTempId = typeof row.id === 'number';
    if (saveTimers.current[index]) clearTimeout(saveTimers.current[index]);
    if (isTempId) {
      setRows(prev => prev.filter((_, i) => i !== index));
      return;
    }
    try {
      await deleteOpportunity(row.id);
      setRemovingIds(prev => new Set([...prev, row.id]));
      setTimeout(() => {
        setRows(prev => prev.filter((_, i) => i !== index));
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }, 400);
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      addToast(locale === 'vi' ? 'Có lỗi khi xóa cơ hội!' : 'An error occurred while deleting!', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md font-semibold text-on-surface uppercase tracking-wider">
          {locale === 'vi' ? 'Chi tiết Opportunities' : 'Opportunities Detail'}
        </h4>
        <button
          onClick={addRow}
          className="text-primary flex items-center gap-1 text-body-sm font-semibold hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {locale === 'vi' ? 'Thêm dòng' : 'Add row'}
        </button>
      </div>

      <div className="overflow-x-auto border border-border-light rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low border-b border-border-light">
            <tr>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Tên DN / Khách hàng' : 'Company / Customer'}</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Size' : 'Size'}</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Project' : 'Project'}</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fees</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Dự kiến đóng' : 'Expected Close'}</th>
              <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
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
                      className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none bg-transparent"
                      value={row.size}
                      onChange={(e) => handleRowChange(index, 'size', e.target.value)}
                    >
                      {sizeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      className="w-full border-0 focus:ring-0 p-0 text-body-md outline-none bg-transparent"
                      value={row.projectId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const pName = projects.find(p => p.id === pid)?.name || '';
                        handleRowChange(index, 'projectId', pid);
                        handleRowChange(index, 'project', pName);
                      }}
                    >
                      <option value="">{locale === 'vi' ? 'Chọn dự án' : 'Select project'}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <NumberInput
                      className="w-full border-0 focus:ring-0 p-0 text-data-display outline-none"
                      placeholder="5,000"
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConvert(index)}
                        disabled={convertingIndex === index}
                        className="px-3 py-1.5 bg-success text-white rounded text-label-md font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                        {locale === 'vi' ? 'Chuyển thành Won' : 'Convert to Won'}
                      </button>
                      <button
                        onClick={() => handleDeleteRow(index, row)}
                        title={locale === 'vi' ? 'Xóa' : 'Delete'}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded transition-all flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
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
                {locale === 'vi' ? 'Xác nhận chuyển đổi' : 'Confirm Conversion'}
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
                    <span className="text-on-surface-variant">{locale === 'vi' ? 'Khách hàng:' : 'Customer:'}</span>
                    <span className="font-semibold text-on-surface">{rows[modalIndex].companyName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{locale === 'vi' ? 'Dự án:' : 'Project:'}</span>
                    <span className="font-semibold text-on-surface">{rows[modalIndex].project || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{locale === 'vi' ? 'Fees:' : 'Fees:'}</span>
                    <span className="font-semibold text-on-surface">{Number(rows[modalIndex].fees || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
                    {locale === 'vi' ? 'Ngày ký hợp đồng (signed_date)' : 'Signed Date'}
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
                    {locale === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmConvert}
                    disabled={modalSubmitting}
                    className="flex-1 px-4 py-3 bg-success text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {modalSubmitting ? (locale === 'vi' ? 'Đang xử lý...' : 'Processing...') : (locale === 'vi' ? 'Xác nhận Won' : 'Confirm Won')}
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
