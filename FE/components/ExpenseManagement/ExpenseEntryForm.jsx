import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getProjects, saveExpense, updateExpense, deleteExpense, getExpenseList } from '../../services/api';
import NumberInput from '../common/NumberInput';
import FileUploadModal from '../common/FileUploadModal';
import { setExpenseMeta, getExpenseMeta, removeExpenseMeta, parseExpenseNote } from '../../utils/expenseMeta';

let rowSeq = 0;
const emptyRow = () => {
  rowSeq += 1;
  return { id: rowSeq, expenseId: null, event: '', planned: '', actual: '', qty: '1', contractFile: '', contractDataUrl: null, note: '' };
};

const lineTotalOf = (r) => (parseFloat(r.actual) || 0) * (parseInt(r.qty, 10) || 1);

export default function ExpenseEntryForm({ onSaved }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [dataFile, setDataFile] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadModal, setUploadModal] = useState(null);
  const [uploadRowId, setUploadRowId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    });
  }, []);

  // BUG-C01: load đúng dữ liệu đã lưu của tổ hợp Dự án + Kỳ đang chọn
  useEffect(() => {
    if (!projectId || !period) return undefined;
    let cancelled = false;
    getExpenseList(projectId)
      .then((res) => {
        if (cancelled) return;
        const list = (Array.isArray(res.data) ? res.data : []).filter(
          (x) => String(x.period || '') === String(period)
        );
        const mapped = [];
        list.forEach((e) => {
          const meta = getExpenseMeta(e.id) || {};
          const lines = Array.isArray(meta.lines) && meta.lines.length > 1
            ? meta.lines
            : [{
              event: meta.event || '',
              planned: meta.planned != null && meta.planned !== '' ? String(meta.planned) : '',
              actual: Number(e.directCost) ? String(Number(e.directCost)) : '',
              qty: meta.qty != null && meta.qty !== '' ? String(meta.qty) : '1',
              note: meta.note != null && meta.note !== '' ? String(meta.note) : '',
              contractFile: meta.contractFile || '',
              contractDataUrl: meta.contractDataUrl || null,
            }];
          if (!meta.event && !Array.isArray(meta.lines)) {
            const parsed = parseExpenseNote(e.directNote || e.note || '');
            lines[0].event = parsed.event;
            lines[0].planned = parsed.planned;
            lines[0].note = parsed.note;
            if (parsed.qty) lines[0].qty = parsed.qty;
          }
          lines.forEach((ln) => {
            mapped.push({
              ...emptyRow(),
              expenseId: e.id,
              event: ln.event || '',
              planned: ln.planned != null && ln.planned !== '' ? String(ln.planned) : '',
              actual: ln.actual != null && ln.actual !== '' ? String(ln.actual) : '',
              qty: ln.qty != null && String(ln.qty) !== '' ? String(parseInt(ln.qty, 10) || 1) : '1',
              contractFile: ln.contractFile || '',
              contractDataUrl: ln.contractDataUrl || null,
              note: ln.note || '',
            });
          });
        });
        setRows(mapped.length > 0 ? mapped : [emptyRow()]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, period, reloadKey]);

  const formatCurrency = (val) => (val ?? 0).toLocaleString('vi-VN');

  const totalPlanned = rows.reduce((s, r) => s + (parseFloat(r.planned) || 0), 0);
  const totalActual = rows.reduce((s, r) => s + lineTotalOf(r), 0);
  const grandTotal = totalPlanned + totalActual;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = async (id) => {
    if (rows.length <= 1) return;
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (target.expenseId) {
      const ok = window.confirm(
        t('Dòng này đã lưu trên hệ thống. Xóa bản ghi chi phí này?', 'This line is saved on the server. Delete this expense record?')
      );
      if (!ok) return;
      try {
        await deleteExpense(target.expenseId);
        removeExpenseMeta(target.expenseId);
      } catch {
        showToast(t('Lỗi khi xóa bản ghi đã lưu', 'Error deleting saved record'), 'error');
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const resetForm = () => {
    setRows([emptyRow()]);
    setDataFile('');
  };

  const buildNote = (r) => {
    const parts = [];
    if (r.event.trim()) parts.push(`${t('Sự kiện', 'Event')}: ${r.event.trim()}`);
    if (parseFloat(r.planned)) parts.push(`${t('Kế hoạch', 'Planned')}: ${formatCurrency(parseFloat(r.planned))}`);
    const q = parseInt(r.qty, 10) || 1;
    if (q > 1) parts.push(`${t('Số lượng', 'Qty')}: ${q}`);
    if (r.note.trim()) parts.push(r.note.trim());
    return parts.join(' | ');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) {
      showToast(t('Vui lòng chọn dự án', 'Please select a project'), 'error');
      return;
    }
    const validRows = rows.filter((r) => r.event.trim() || parseFloat(r.planned) || parseFloat(r.actual));
    if (validRows.length === 0) {
      showToast(t('Nhập ít nhất một dòng chi phí', 'Enter at least one expense line'), 'error');
      return;
    }
    setSaving(true);
    try {
      // BE hiện upsert theo (Dự án + Kỳ) — gộp các dòng thành MỘT bản ghi để không mất dữ liệu (BUG-C02)
      // Thành tiền mỗi dòng = Đơn giá × Số lượng (BUG-C03)
      const totalActual = validRows.reduce((s, r) => s + lineTotalOf(r), 0);
      const aggNote = validRows
        .map((r, i) => `${validRows.length > 1 ? `${i + 1}. ` : ''}${buildNote(r)}`.trim())
        .filter(Boolean)
        .join(' ; ');
      const payload = { projectId, period, directCost: totalActual, overhead: 0, directNote: aggNote };

      // BUG-C02: BE chưa upsert đúng — POST vào kỳ đã có bản ghi trả 500 (đã xác minh 22/8/26).
      // Luôn tra cứu bảnghi tồn tại theo (Dự án + Kỳ) trước: có thì PATCH, không mới POST.
      let savedId = rows.find((r) => r.expenseId)?.expenseId || null;
      let existedBefore = Boolean(savedId);
      if (!savedId) {
        try {
          const check = await getExpenseList(projectId);
          const match = (Array.isArray(check.data) ? check.data : []).find(
            (x) => String(x.period || '') === String(period)
          );
          if (match?.id) {
            savedId = match.id;
            existedBefore = true;
          }
        } catch {
          // Không tra cứu được thì cứ thử POST tạo mới
        }
      }
      if (savedId) {
        await updateExpense(savedId, payload);
      } else {
        const res = await saveExpense(payload);
        savedId = res?.data?.id || null;
      }

      if (savedId) {
        setExpenseMeta(savedId, validRows.length === 1
          ? {
            event: validRows[0].event.trim(),
            planned: parseFloat(validRows[0].planned) || 0,
            qty: parseInt(validRows[0].qty, 10) || 1,
            contractFile: validRows[0].contractFile || '',
            contractDataUrl: validRows[0].contractDataUrl || null,
          }
          : {
            event: validRows.map((r) => r.event.trim()).filter(Boolean).join(', '),
            planned: validRows.reduce((s, r) => s + (parseFloat(r.planned) || 0), 0),
            contractFile: '',
            contractDataUrl: null,
            lines: validRows.map((r) => ({
              event: r.event.trim(),
              planned: parseFloat(r.planned) || 0,
              actual: parseFloat(r.actual) || 0,
              qty: parseInt(r.qty, 10) || 1,
              note: r.note.trim(),
              contractFile: r.contractFile || '',
            })),
          });
      }

      showToast(
        existedBefore
          ? t(`Đã cập nhật chi phí kỳ ${period}`, `Updated expense for period ${period}`)
          : validRows.length > 1
            ? t(`Đã lưu ${validRows.length} dòng (gộp thành một khoản theo kỳ ${period})`, `Saved ${validRows.length} line(s) combined into one record for ${period}`)
            : t('Đã lưu chi phí thành công', 'Expense saved successfully')
      );
      resetForm();
      setReloadKey((v) => v + 1);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[ExpenseEntryForm] Lưu chi phí thất bại:', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
      });
      const detail = err?.response?.status
        ? ` (HTTP ${err.response.status})`
        : '';
      showToast(t(`Lỗi khi lưu chi phí. Kiểm tra kết nối và thử lại.${detail}`, `Error saving expense. Check connection and try again.${detail}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-border-light rounded-md px-3 py-2 text-body-sm bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary rounded-t-xl" />
      <form onSubmit={handleSubmit}>
        <div className="p-widget-padding">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border-light">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('Nhập chi phí dự án', 'Enter Project Expense')}</h2>
            <div className="flex items-center gap-3">
              <label className="font-label-md text-on-surface-variant whitespace-nowrap">{t('Chọn dự án:', 'Select project:')}</label>
              <select
                className="bg-background-subtle border border-border-light rounded-lg px-4 py-1.5 text-body-md font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none min-w-[200px]"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6 md:w-1/3">
            <label className="block font-label-md text-on-surface-variant mb-1">{t('Kỳ phát sinh', 'Occurrence Period')}</label>
            <input
              className={`${inputCls} text-body-md`}
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
            <p className="text-xs text-on-surface-variant italic mt-1">
              {t('Đổi Dự án/Kỳ sẽ tải lại dữ liệu đã lưu của tổ hợp này. Hiện mỗi Dự án + Kỳ lưu thành một khoản tổng hợp.', 'Changing Project/Period reloads its saved data. Currently each Project + Period is stored as one combined record.')}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-light shadow-sm mb-6">
            <table className="w-full min-w-[980px] table-fixed divide-y divide-border-light">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[76px]" />
                <col className="w-[15%]" />
                <col className="w-auto" />
                <col className="w-[52px]" />
              </colgroup>
              <thead className="bg-background-subtle">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Sự kiện', 'Event')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Chi phí kế hoạch', 'Planned Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá', 'Unit Price')}</th>
                  <th className="px-2 py-3 text-center font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('SL', 'Qty')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hợp đồng', 'Contract')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Notes')}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light bg-surface-container-lowest">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-4 pl-4 pr-3">
                      <input className={inputCls} placeholder={t('Tên sự kiện...', 'Event name...')} value={row.event} onChange={(e) => updateRow(row.id, 'event', e.target.value)} />
                    </td>
                    <td className="px-3 py-4">
                      <NumberInput className={`${inputCls} text-right`} placeholder="0" value={row.planned} onChange={(e) => updateRow(row.id, 'planned', e.target.value)} />
                    </td>
                    <td className="px-3 py-4">
                      <NumberInput className={`${inputCls} text-right`} placeholder="0" value={row.actual} onChange={(e) => updateRow(row.id, 'actual', e.target.value)} />
                    </td>
                    <td className="px-1.5 py-4">
                      <NumberInput
                        className={`${inputCls} px-2 text-right`}
                        placeholder="1"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, 'qty', e.target.value === '' ? '' : String(parseInt(e.target.value, 10) || 1))}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => setUploadRowId(row.id)}
                        className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 border border-border-light rounded-md font-label-md text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                        title={row.contractFile || t('Đính kèm', 'Attach')}
                      >
                        <span className={`material-symbols-outlined text-body-lg ${row.contractFile ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {row.contractFile ? 'check_circle' : 'attach_file'}
                        </span>
                        <span className="truncate max-w-[90px]">{row.contractFile || t('Đính kèm', 'Attach')}</span>
                      </button>
                    </td>
                    <td className="px-3 py-4">
                      <textarea className={`${inputCls} h-16 resize-none`} placeholder={t('Nhập ghi chú...', 'Enter notes...')} rows={2} value={row.note} onChange={(e) => updateRow(row.id, 'note', e.target.value)} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        className="p-1.5 rounded-md text-on-surface-variant hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title={t('Xóa dòng', 'Remove row')}
                      >
                        <span className="material-symbols-outlined text-body-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-light bg-surface-container-lowest">
                  <td colSpan={7} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-label-md text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-body-lg">add</span>
                      {t('Thêm dòng', 'Add Row')}
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setUploadModal('excel')}
              className="flex items-center gap-3 p-4 rounded-lg border border-border-light bg-background-subtle hover:border-primary/60 hover:bg-primary/5 transition-colors text-left cursor-pointer w-full"
            >
              <span className="material-symbols-outlined text-[28px] text-primary">upload_file</span>
              <div className="flex-1 min-w-0">
                <p className="font-label-md text-on-surface">{t('File số liệu (Excel)', 'Data File (Excel)')}</p>
                <p className="text-xs text-on-surface-variant truncate">{dataFile || t('Kéo thả hoặc bấm để tải lên', 'Drag & drop or click to upload')}</p>
              </div>
              {dataFile && <span className="material-symbols-outlined text-primary">check_circle</span>}
            </button>
          </div>

          <div className="bg-background-subtle border border-border-light rounded-lg p-4 flex justify-between items-center mb-6">
            <div>
              <p className="font-label-md text-on-surface-variant">{t('Tổng chi phí dự kiến', 'Total Estimated Cost')}</p>
              <p className="text-xs text-secondary mt-1">{t('Kế hoạch + Σ(Đơn giá × SL)', 'Planned + Σ(Unit Price × Qty)')}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] leading-none font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</span>
              <span className="font-semibold text-primary text-body-lg">VNĐ</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 border border-border-light rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {t('Hủy bỏ', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-10 py-2.5 bg-primary text-on-primary rounded-lg font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-body-md">{saving ? 'hourglass_top' : 'save'}</span>
              {saving ? t('Đang lưu...', 'Saving...') : t('Lưu chi phí', 'Save Expense')}
            </button>
          </div>
        </div>
      </form>

      {uploadModal && (
        <FileUploadModal
          type={uploadModal}
          onClose={() => setUploadModal(null)}
          onConfirm={(fileName) => {
            setDataFile(fileName);
            setUploadModal(null);
          }}
        />
      )}

      {uploadRowId !== null && !uploadModal && (
        <FileUploadModal
          type="image"
          onClose={() => setUploadRowId(null)}
          onConfirm={(fileName, fileMeta) => {
            updateRow(uploadRowId, 'contractFile', fileName);
            updateRow(uploadRowId, 'contractDataUrl', fileMeta?.dataUrl || null);
            setUploadRowId(null);
          }}
        />
      )}

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
