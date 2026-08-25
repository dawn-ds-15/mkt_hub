import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getProjects, saveExpense, updateExpense, deleteExpense, getExpenseList, getInventoryItems, addExpenseLine, uploadProjectDocuments, deleteProjectDocument, DOC_CATEGORY } from '../../services/api';
import NumberInput from '../common/NumberInput';
import FileUploadModal from '../common/FileUploadModal';
import { setExpenseMeta, getExpenseMeta, removeExpenseMeta, parseExpenseLines } from '../../utils/expenseMeta';

let rowSeq = 0;

const EXPENSE_CATEGORIES = [
  { key: 'posm', vi: 'POSM', en: 'POSM' },
  { key: 'gift', vi: 'Quà tặng', en: 'Gift' },
  { key: 'print', vi: 'Ấn phẩm in', en: 'Printed materials' },
  { key: '__other__', vi: 'Khác', en: 'Other' },
];

const emptyRow = () => {
  rowSeq += 1;
  return { id: rowSeq, expenseId: null, event: '', expenseCategory: '', planned: '', actual: '', inventoryItemId: '', plannedQty: '', actualQty: '', unitPriceBeforeVat: 0, vatRate: 0, unitPriceAfterVat: 0, unit: '', isOther: false, otherName: '', otherUnit: '', contractFile: '', contractDataUrl: null, contractDocId: null, note: '' };
};

const lineTotalOf = (r, items) => {
  if (r.isOther || r.expenseCategory === '__other__') {
    return (Number(r.unitPriceAfterVat) || 0) * (Number(r.actualQty) || 0);
  }
  const item = items?.find(i => i.id === r.inventoryItemId);
  const price = item ? Number(item.unitPriceAfterVat || item.unitPrice || 0) : 0;
  return price * (Number(r.actualQty) || 0);
};

// Bản ghi cũ lưu actual = ĐƠN GIÁ kèm "SL: N" → quy đổi thành thành tiền; bản ghi mới đã là tổng
const lineActualToTotal = (l) => {
  if (l.actual == null || l.actual === '') return '';
  const q = parseInt(l.qty, 10) || 1;
  return String((parseFloat(l.actual) || 0) * q);
};

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
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadRowId, setUploadRowId] = useState(null);
  const [toast, setToast] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    });
    getInventoryItems().then((res) => {
      setInventoryItems(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
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
          const parsed = parseExpenseLines(String(e.directNote || e.note || ''));

          let lines;
          if (Array.isArray(meta.lines) && meta.lines.length > 0) {
            // Meta máy này có đủ (kể cả file hợp đồng); "Thực tế" quy đổi thành thành tiền (fix_ui_cn bỏ SL),
            // phần thiếu bù từ note (cũng đã quy đổi theo SL của bản ghi cũ)
            lines = meta.lines.map((ln, i) => ({
              event: ln.event || parsed[i]?.event || '',
              planned: ln.planned != null && ln.planned !== '' ? String(ln.planned) : (parsed[i]?.planned ? String(parsed[i].planned) : ''),
              actual: lineActualToTotal(ln) || lineActualToTotal(parsed[i] || {}),
              note: ln.note != null && ln.note !== '' ? String(ln.note) : (parsed[i]?.note || ''),
              contractFile: ln.contractFile || '',
              contractDataUrl: ln.contractDataUrl || null,
              contractDocId: ln.contractDocId || null,
            }));
          } else if (parsed.length > 0) {
            // BUG-C06: không có meta (máy khác) — khôi phục TỪNG DÒNG từ ghi chú BE
            lines = parsed.map((ln) => ({
              event: ln.event || '',
              planned: ln.planned ? String(ln.planned) : '',
              actual: lineActualToTotal(ln),
              note: ln.note || '',
              contractFile: '',
              contractDataUrl: null,
              contractDocId: null,
            }));
            // Bản ghi cũ lưu trước khi note có "Thực tế": dòng đơn lấy thẳng tổng tiền
            if (lines.length === 1 && !lines[0].actual && Number(e.directCost)) {
              lines[0].actual = String(Number(e.directCost));
            }
            // Ghi chú chỉ có 1 dòng thì bù thêm thông tin meta của máy này (nếu có)
            if (parsed.length <= 1) {
              const metaActTotal = (meta.actual != null && meta.actual !== '')
                ? lineActualToTotal({ actual: String(meta.actual), qty: String(meta.qty == null ? 1 : meta.qty) })
                : '';
              lines[0] = {
                ...lines[0],
                event: meta.event || lines[0].event,
                planned: (meta.planned != null && meta.planned !== '') ? String(meta.planned) : lines[0].planned,
                actual: metaActTotal || lines[0].actual,
                contractFile: meta.contractFile || lines[0].contractFile,
                contractDataUrl: meta.contractDataUrl || lines[0].contractDataUrl,
                contractDocId: meta.contractDocId || lines[0].contractDocId || null,
              };
            }
          } else {
            lines = [{
              event: meta.event || '',
              planned: meta.planned != null && meta.planned !== '' ? String(meta.planned) : '',
              actual: Number(e.directCost) ? String(Number(e.directCost)) : '',
              note: meta.note != null && meta.note !== '' ? String(meta.note) : '',
              contractFile: meta.contractFile || '',
              contractDataUrl: meta.contractDataUrl || null,
              contractDocId: meta.contractDocId || null,
            }];
          }

          lines.forEach((ln) => {
            mapped.push({
              ...emptyRow(),
              expenseId: e.id,
              event: ln.event || '',
              planned: ln.planned != null && ln.planned !== '' ? String(ln.planned) : '',
              actual: ln.actual != null && ln.actual !== '' ? String(ln.actual) : '',
              contractFile: ln.contractFile || '',
              contractDataUrl: ln.contractDataUrl || null,
              contractDocId: ln.contractDocId || null,
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

  const calcRowPlanned = (r) => {
    if (r.isOther || r.expenseCategory === '__other__') {
      return (Number(r.unitPriceAfterVat) || 0) * (Number(r.plannedQty) || 0);
    }
    const item = inventoryItems.find(i => i.id === r.inventoryItemId);
    if (!item) return parseFloat(r.planned) || 0;
    const price = Number(item.unitPriceAfterVat || item.unitPrice || 0);
    return price * (Number(r.plannedQty) || 0);
  };
  const totalPlanned = rows.reduce((s, r) => s + calcRowPlanned(r), 0);
  const totalActual = rows.reduce((s, r) => s + lineTotalOf(r, inventoryItems), 0);
  const grandTotal = totalPlanned + totalActual;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateRow = (id, field, value) => {
    if (typeof field === 'object') {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...field } : r)));
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    }
  };

  // BUG-C07/Mục5: file hợp đồng lưu trên BE (documents của dự án, category hợp đồng) thay vì
  // chỉ nằm trong localStorage — xem chéo máy được ngay khi BE trả url (Mục 1). Ảnh đã nén ở modal.
  const handleAttachConfirm = async (rowId, fileName, fileMeta) => {
    updateRow(rowId, 'contractFile', fileName);
    updateRow(rowId, 'contractDocId', null);
    updateRow(rowId, 'contractDataUrl', fileMeta?.dataUrl || null);

    if (fileMeta?.file && projectId) {
      try {
        const target = rows.find((r) => r.id === rowId);
        const docName = `[Chi phí ${period}] ${target?.event?.trim() || fileName}`.slice(0, 180);
        const renamed = new File([fileMeta.file], docName, { type: fileMeta.file.type });
        const res = await uploadProjectDocuments(projectId, [renamed], DOC_CATEGORY.HOPDONG);
        const docId = res.data?.[0]?.id || null;
        if (docId) {
          updateRow(rowId, 'contractDocId', docId);
          showToast(t('Đã tải hợp đồng lên server', 'Contract uploaded to server'));
        } else {
          showToast(t('Không nhận được ID file từ server — hợp đồng tạm giữ trên máy này', 'No file ID from server — contract kept on this device'), 'error');
        }
      } catch {
        showToast(t('Không tải được hợp đồng lên server — tạm giữ trên máy này', 'Could not upload contract — kept on this device'), 'error');
      }
    } else if (!projectId) {
      showToast(t('Chưa chọn dự án nên hợp đồng chỉ lưu tạm trên máy này', 'No project selected — contract kept on this device only'), 'error');
    }
    setUploadRowId(null);
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  // BUG-C04: một bản ghi BE chứa TẤT CẢ các dòng của (Dự án + Kỳ). Chỉ gọi deleteExpense khi
  // đây là dòng CUỐI CÙNG tham chiếu bản ghi đó; nếu không chỉ bỏ dòng ở local rồi để nút Lưu
  // PATCH lại note tổng hợp — tránh mất cả kỳ và lỗi PATCH vào bản ghi đã bị xóa (404).
  const removeRow = async (id) => {
    if (rows.length <= 1) return;
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (target.expenseId) {
      const isLastRef = !rows.some((r) => r.id !== id && r.expenseId === target.expenseId);
      if (isLastRef) {
        const ok = window.confirm(
          t('Đây là dòng cuối cùng của bản ghi đã lưu trên hệ thống. Xóa bản ghi chi phí này?', 'This is the last line of a record saved on the server. Delete this expense record?')
        );
        if (!ok) return;
        try {
          await deleteExpense(target.expenseId);
          removeExpenseMeta(target.expenseId);
        } catch {
          showToast(t('Lỗi khi xóa bản ghi đã lưu', 'Error deleting saved record'), 'error');
          return;
        }
      } else {
        showToast(
          t('Đã bỏ dòng khỏi bảng. Bấm "Lưu chi phí" để cập nhật thay đổi lên hệ thống.', 'Line removed from the table. Click "Save Expense" to update the change on the server.')
        );
      }
    }
    if (target.contractDocId) {
      deleteProjectDocument(target.contractDocId).catch(() => {});
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const resetForm = () => {
    setRows([emptyRow()]);
  };

  // Hủy form: dọn file hợp đồng đã upload của các dòng CHƯA lưu trên hệ thống để không sinh rác
  const handleCancel = () => {
    rows.filter((r) => r.contractDocId && !r.expenseId).forEach((r) => {
      deleteProjectDocument(r.contractDocId).catch(() => {});
    });
    resetForm();
  };

  const buildNote = (r) => {
    const parts = [];
    if (r.event.trim()) parts.push(`${t('Sự kiện', 'Event')}: ${r.event.trim()}`);
    if (parseFloat(r.planned)) parts.push(`${t('Kế hoạch', 'Planned')}: ${formatCurrency(parseFloat(r.planned))}`);
    // BUG-C06: ghi "Thực tế" (THÀNH TIỀN dòng, fix_ui_cn bỏ SL) vào note trên BE — nếu không,
    // sang máy/browser khác (không có localStorage meta) sẽ chỉ còn tổng tiền mà mất chi tiết từng dòng.
    if (parseFloat(r.actual)) parts.push(`${t('Thực tế', 'Actual')}: ${formatCurrency(parseFloat(r.actual))}`);
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
      // fix_ui_cn: "Chi phí thực tế" mỗi dòng là THÀNH TIỀN (không nhân SL nữa)
      const totalActual = validRows.reduce((s, r) => s + lineTotalOf(r, inventoryItems), 0);
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
        const inventoryRows = validRows.filter((r) => r.inventoryItemId);
        for (const r of inventoryRows) {
          try {
            await addExpenseLine(savedId, {
              inventoryItemId: r.inventoryItemId,
              plannedQuantity: Number(r.plannedQty) || 0,
              actualQuantity: Number(r.actualQty) || 0,
            });
          } catch (lineErr) {
            console.error('[ExpenseEntryForm] addExpenseLine failed:', lineErr);
            const lineMsg = lineErr?.response?.data?.message || lineErr?.message;
            if (lineMsg && (lineMsg.includes('vượt') || lineMsg.includes('overflow') || lineMsg.includes('409'))) {
              showToast(lineMsg, 'error');
            } else {
              showToast(t('Lỗi tạo dòng vật phẩm kho — kiểm tra lại dữ liệu', 'Error creating inventory line — check data'), 'error');
            }
          }
        }
      }

      let metaWrite = null;
      if (savedId) {
        metaWrite = setExpenseMeta(savedId, validRows.length === 1
          ? {
            event: validRows[0].event.trim(),
            planned: parseFloat(validRows[0].planned) || 0,
            actual: parseFloat(validRows[0].actual) || 0,
            contractFile: validRows[0].contractFile || '',
            contractDataUrl: validRows[0].contractDataUrl || null,
            contractDocId: validRows[0].contractDocId || null,
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
              note: r.note.trim(),
              contractFile: r.contractFile || '',
              contractDocId: r.contractDocId || null,
            })),
          });
        // BUG-C07: hết quota localStorage → báo rõ thay vì drop ảnh im lặng
        if (metaWrite?.droppedDataUrls) {
          showToast(t('Bộ nhớ máy đầy — bản xem trước ảnh bị bỏ bớt. File hợp đồng vẫn an toàn trên server.', 'Device storage full — local previews dropped. Contract files remain safe on the server.'));
        } else if (metaWrite && !metaWrite.ok) {
          showToast(t('Không lưu được dữ liệu phụ của chi phí trên máy này.', 'Could not save expense auxiliary data on this device.'), 'error');
        }
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
            <table className="w-full min-w-[900px] table-fixed divide-y divide-border-light">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-auto" />
                <col className="w-[48px]" />
              </colgroup>
              <thead className="bg-background-subtle">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Danh mục', 'Category')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Vật phẩm', 'Item')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá (sau VAT)', 'Unit Price (post-VAT)')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('SL KH / SL Thực', 'Plan Qty / Actual Qty')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền KH', 'Planned Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền TT', 'Actual Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Notes')}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light bg-surface-container-lowest">
                {rows.map((row) => {
                  const isOther = row.isOther || row.expenseCategory === '__other__';
                  const filteredItems = isOther ? [] : (row.expenseCategory
                    ? inventoryItems.filter(i => i.category === row.expenseCategory)
                    : inventoryItems);
                  const selectedItem = inventoryItems.find(i => i.id === row.inventoryItemId);
                  const unitPrice = isOther
                    ? (Number(row.unitPriceAfterVat) || 0)
                    : (selectedItem ? Number(selectedItem.unitPriceAfterVat || selectedItem.unitPrice || 0) : 0);
                  const planAmount = unitPrice * (Number(row.plannedQty) || 0);
                  const actAmount = unitPrice * (Number(row.actualQty) || 0);
                  const isOverStock = selectedItem && (
                    (Number(row.plannedQty) > 0 && Number(row.plannedQty) > Number(selectedItem.currentStock || selectedItem.quantity || 0)) ||
                    (Number(row.actualQty) > 0 && Number(row.actualQty) > Number(selectedItem.currentStock || selectedItem.quantity || 0))
                  );
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="py-3 pl-4 pr-3">
                        <select className={`${inputCls} text-[12px]`} value={row.expenseCategory} onChange={(e) => {
                          const cat = e.target.value;
                          const isOtherCat = cat === '__other__';
                          updateRow(row.id, { expenseCategory: cat, isOther: isOtherCat, inventoryItemId: '', unitPriceAfterVat: isOtherCat ? 0 : undefined, otherName: isOtherCat ? '' : undefined, otherUnit: isOtherCat ? '' : undefined });
                        }}>
                          <option value="">{t('— Chọn —', '— Select —')}</option>
                          {EXPENSE_CATEGORIES.map(c => (
                            <option key={c.key} value={c.key}>{t(c.vi, c.en)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        {isOther ? (
                          <input className={inputCls} placeholder={t('Tên vật phẩm...', 'Item name...')} value={row.otherName || ''} onChange={(e) => updateRow(row.id, 'otherName', e.target.value)} />
                        ) : (
                          <>
                            <select className={`${inputCls} text-[12px]`} value={row.inventoryItemId} onChange={(e) => {
                              const item = inventoryItems.find(i => i.id === e.target.value);
                              updateRow(row.id, { inventoryItemId: e.target.value, unitPriceBeforeVat: item ? Number(item.unitPriceBeforeVat || 0) : 0, vatRate: item ? Number(item.vatRate || 0) : 0, unitPriceAfterVat: item ? Number(item.unitPriceAfterVat || item.unitPrice || 0) : 0 });
                            }}>
                              <option value="">{t('— Chọn —', '— Select —')}</option>
                              {filteredItems.map((item) => (
                                <option key={item.id} value={item.id}>{item.name} ({item.unit || ''})</option>
                              ))}
                            </select>
                            {row.expenseCategory && filteredItems.length === 0 && (
                              <p className="text-[10px] text-on-surface-variant italic mt-0.5">{t('Không có vật phẩm trong danh mục này', 'No items in this category')}</p>
                            )}
                          </>
                        )}
                        {isOverStock && (
                          <p className="text-[10px] text-danger mt-0.5">{t('Vượt tồn kho!', 'Exceeds stock!')}</p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isOther ? (
                          <NumberInput className={`${inputCls} text-right`} placeholder="0" value={row.unitPriceAfterVat || ''} onChange={(e) => updateRow(row.id, 'unitPriceAfterVat', e.target.value)} />
                        ) : (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={unitPrice ? unitPrice.toLocaleString('vi-VN') : '—'} />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1">
                          <NumberInput className={`${inputCls} text-right w-1/2`} placeholder={t('KH', 'Plan')} value={row.plannedQty} onChange={(e) => updateRow(row.id, 'plannedQty', e.target.value)} />
                          <NumberInput className={`${inputCls} text-right w-1/2`} placeholder={t('Thực', 'Actual')} value={row.actualQty} onChange={(e) => updateRow(row.id, 'actualQty', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={planAmount ? planAmount.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={actAmount ? actAmount.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3">
                        <textarea className={`${inputCls} h-16 resize-none`} placeholder={t('Nhập ghi chú...', 'Enter notes...')} rows={2} value={row.note} onChange={(e) => updateRow(row.id, 'note', e.target.value)} />
                      </td>
                      <td className="px-3 py-3 text-center">
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
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary bg-primary/10 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-on-surface">{t('Tổng cộng', 'Total')}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(totalPlanned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(totalActual)}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="border-t border-border-light bg-surface-container-lowest">
                  <td colSpan={8} className="px-4 py-3">
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

          <div className="bg-background-subtle border border-border-light rounded-lg p-4 flex justify-between items-center mb-6">
            <div className="space-y-1">
              <p className="font-label-md text-on-surface-variant">{t('Tổng cộng', 'Grand Total')}</p>
              <div className="flex gap-6 text-xs text-on-surface-variant">
                <span>{t('Kế hoạch:', 'Planned:')} <span className="font-bold text-secondary">{formatCurrency(totalPlanned)} VNĐ</span></span>
                <span>{t('Thực tế:', 'Actual:')} <span className="font-bold text-primary">{formatCurrency(totalActual)} VNĐ</span></span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] leading-none font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</span>
              <span className="font-semibold text-primary text-body-lg">VNĐ</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={handleCancel}
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

      {uploadRowId !== null && (
        <FileUploadModal
          type="image"
          onClose={() => setUploadRowId(null)}
          onConfirm={(fileName, fileMeta) => handleAttachConfirm(uploadRowId, fileName, fileMeta)}
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
