import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getProjects,
  getAllInventoryItems,
  getInventoryItem,
  getExpenseById,
  getExpenseList,
  saveExpense,
  addExpenseLine,
  getCategoryBudgetTree,
  uploadExpenseLineAttachments,
  getExpenseAttachmentBlob,
} from '../../services/api';
import NumberInput from '../common/NumberInput';
import { getExpenseMeta, setExpenseMeta } from '../../utils/expenseMeta';
import { ATTACHMENT_ACCEPT, lineAttachments, validateAttachmentFile } from '../../utils/expenseAttachments';

let rowSeq = 0;

const VAT_PHAM = 'Vật phẩm';
const VAN_CHUYEN = 'Vận chuyển';
const AN_UONG = 'Ăn uống';
const OTHER_HANG_MUC = 'Hạng mục khác';
// Các hạng mục nhập TRỰC TIẾP thành tiền (KH/TT) — không cần đơn giá hay VAT
const AMOUNT_ONLY_HML = [VAN_CHUYEN, AN_UONG];
const AMOUNT_ONLY_SET = new Set(AMOUNT_ONLY_HML.map((s) => String(s).trim().toLowerCase()));

const normalizeHml = (raw) => {
  const s = String(raw || '');
  const lower = s.trim().toLowerCase();
  if (lower && lower === String(VAT_PHAM).trim().toLowerCase()) return VAT_PHAM;
  if (lower && lower === String(VAN_CHUYEN).trim().toLowerCase()) return VAN_CHUYEN;
  if (lower && lower === String(AN_UONG).trim().toLowerCase()) return AN_UONG;
  if (lower && lower === String(OTHER_HANG_MUC).trim().toLowerCase()) return OTHER_HANG_MUC;
  return s;
};

const isAmountOnlyHml = (hml) => AMOUNT_ONLY_SET.has(String(hml || '').trim().toLowerCase());

const preVatOf = (item) => {
  if (!item) return 0;
  if (item.unitPriceBeforeVat != null && item.unitPriceBeforeVat !== '') return Number(item.unitPriceBeforeVat) || 0;
  const vat = item.vatRate != null ? Number(item.vatRate) : 0;
  const after = Number(item.unitPriceAfterVat || item.unitPrice || 0);
  return vat > 0 ? Math.round(after / (1 + vat / 100)) : after;
};

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayStr = () => toDateStr(new Date());

const emptyRow = () => {
  rowSeq += 1;
  return {
    rowId: rowSeq,
    lineId: null,
    expenseDate: todayStr(),
    hangMucLon: '',
    categoryId: '',
    name: '',
    inventoryItemId: '',
    plannedQty: '',
    actualQty: '',
    unitPrice: 0,
    vatRate: '',
    plannedAmount: '',
    actualAmount: '',
    isCustom: false,
    note: '',
    ...emptyAttachment(),
  };
};

// Hồ sơ liên quan của dòng (nhiều file):
// - attachments: hồ sơ đã lưu ở BE [{ id, name }] — dòng mới của snapshot gắn lại qua attachmentIds
// - pendingFiles: file mới chọn / kéo thả, tải lên dòng mới sau khi tạo
function emptyAttachment() {
  return { attachments: [], pendingFiles: [] };
}

const attachmentCount = (r) => r.attachments.length + r.pendingFiles.length;

const lineTotalOf = (row, items) => {
  if (isAmountOnlyHml(row.hangMucLon)) return Number(row.actualAmount) || 0;
  const item = (items || []).find((x) => x.id === row.inventoryItemId);
  let unitPrice;
  if (row.hangMucLon === VAT_PHAM) {
    unitPrice = item ? preVatOf(item) : (Number(row.unitPrice) || 0);
  } else {
    unitPrice = row.isCustom || !row.inventoryItemId
      ? (Number(row.unitPrice) || 0)
      : item
        ? preVatOf(item)
        : (Number(row.unitPrice) || 0);
  }
  return unitPrice * (Number(row.actualQty) || 0);
};

// Ô ghi chú cao theo nội dung (kể cả dòng dài tự xuống dòng) để thấy hết các mã hóa đơn
function AutoGrowTextarea(props) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

function AttachmentChip({ name, pending, onOpen, onRemove, t }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1 min-w-0 text-[12px] text-primary hover:underline cursor-pointer"
        title={name}
      >
        <span className="material-symbols-outlined text-[16px] shrink-0">description</span>
        <span className="truncate">{name || t('Hồ sơ', 'File')}</span>
      </button>
      {pending && (
        <span className="shrink-0 text-[10px] text-warning" title={t('Sẽ tải lên khi lưu', 'Uploads on save')}>•</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-0.5 rounded text-on-surface-variant hover:text-danger cursor-pointer"
        title={t('Gỡ hồ sơ khỏi dòng', 'Remove file from line')}
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

const dirtySnapshot = (rows) => rows.map((r) => ({
  lineId: r.lineId,
  expenseDate: r.expenseDate,
  hangMucLon: r.hangMucLon,
  categoryId: r.categoryId,
  name: r.name,
  inventoryItemId: r.inventoryItemId,
  plannedQty: r.plannedQty,
  actualQty: r.actualQty,
  unitPrice: r.unitPrice,
  vatRate: r.vatRate,
  plannedAmount: r.plannedAmount,
  actualAmount: r.actualAmount,
  isCustom: r.isCustom,
  note: r.note,
  attachments: r.attachments.map((a) => a.id),
  pendingFiles: r.pendingFiles.map((f) => `${f.name}:${f.size}`),
}));

const mapLineToRow = (ln, lineDates = {}) => {
  const isVatPhamLine = Boolean(ln.inventoryItemId || ln.isVatPham);
  const vat = ln.vatRateSnapshot != null ? Number(ln.vatRateSnapshot) : (ln.vatRate != null ? Number(ln.vatRate) : 0);
  const base = ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== ''
    ? Number(ln.unitPriceBeforeVat)
    : Number(ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? ln.unitPriceAfterVatSnapshot ?? 0);
  const price = ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== ''
    ? base
    : (vat > 0 ? Math.round(base / (1 + vat / 100)) : base);
  const rawHml = ln.hangMucLon || (isVatPhamLine ? VAT_PHAM : '');
  const hml = normalizeHml(rawHml);
  const amountOnly = isAmountOnlyHml(hml);
  return {
    rowId: ++rowSeq,
    lineId: ln.id,
    expenseDate: lineDates[ln.id] || ln.expenseDate || ln.recognizedDate || '',
    hangMucLon: hml,
    categoryId: ln.categoryId || '',
    name: ln.name || '',
    inventoryItemId: ln.inventoryItemId || '',
    plannedQty: amountOnly ? '' : (ln.plannedQuantity != null ? String(ln.plannedQuantity) : ''),
    actualQty: amountOnly ? '' : (ln.actualQuantity != null ? String(ln.actualQuantity) : ''),
    unitPrice: price,
    vatRate: amountOnly ? '0' : (vat != null && ln.vatRate != null ? (ln.vatRateSnapshot != null ? String(ln.vatRateSnapshot) : String(ln.vatRate)) : (vat ? String(vat) : '')),
    plannedAmount: amountOnly ? (ln.plannedAmount != null ? String(ln.plannedAmount) : '') : '',
    actualAmount: amountOnly ? (ln.actualAmount ?? ln.totalAmount ?? ln.amount ?? '') : '',
    isCustom: Boolean(ln.isCustom) || !ln.inventoryItemId,
    note: ln.note || '',
    attachments: lineAttachments(ln),
    pendingFiles: [],
  };
};

async function loadProjectLines(projectId) {
  try {
    const res = await getExpenseList(projectId);
    const list = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
    if (list.length === 0) return [];
    const sorted = [...list].sort((a, b) => {
      const ta = a.createdAt || a.updatedAt || a.recognizedDate || '';
      const tb = b.createdAt || b.updatedAt || b.recognizedDate || '';
      return String(tb).localeCompare(String(ta));
    });
    // Mỗi lần lưu tạo một bản ghi snapshot MỚI chứa TOÀN BỘ dòng đang nhập.
    // Chỉ nạp dòng từ bản ghi MỚI NHẤT (có dòng) để tránh trùng lặp giữa các snapshot cũ.
    const latest = sorted.find((exp) => {
      const lines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
      return lines != null;
    });
    if (!latest) return [];
    let lines = Array.isArray(latest.lines) && latest.lines.length > 0 ? latest.lines : null;
    if (!lines || lines.length === 0) {
      try {
        const detail = await getExpenseById(latest.id);
        lines = Array.isArray(detail.data?.lines) ? detail.data.lines : [];
      } catch { lines = []; }
    }
    const latestMeta = getExpenseMeta(latest.id) || {};
    const lineDates = latestMeta.lineDates || {};
    const seen = new Set();
    const out = [];
    for (const ln of (lines || [])) {
      if (!ln) continue;
      const key = [
        String(ln.name || '').trim().toLowerCase(),
        String(ln.hangMucLon || '').trim().toLowerCase(),
        ln.inventoryItemId || '',
        ln.plannedQuantity ?? ln.plannedQty ?? '',
        ln.actualQuantity ?? ln.actualQty ?? '',
        ln.vatRateSnapshot ?? ln.vatRate ?? '',
        ln.unitPriceBeforeVat ?? ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? '',
        String(ln.note || '').trim().toLowerCase(),
        lineAttachments(ln).map((a) => a.id).join(','),
      ].join('~');
      if (seen.has(key)) continue;
      seen.add(key);
      const row = mapLineToRow(ln, lineDates);
      row.lineId = null;
      if (!String(row.expenseDate || '').slice(0, 10)) row.expenseDate = todayStr();
      out.push(row);
    }
    return out;
  } catch {
    return [];
  }
}

export default function ExpenseEntryForm({ onSaved, projectId, onProjectChange }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  getUserRole();

  const [projects, setProjects] = useState([]);
  const [hangMucOptions, setHangMucOptions] = useState([]);
  const [categoryIdMap, setCategoryIdMap] = useState({});
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [categoryNameById, setCategoryNameById] = useState({});
  const [dragRowId, setDragRowId] = useState(null);
  const snapRef = useRef(null);

  // Ngày nhập = ngày ấn nút Lưu; mỗi lần lưu sẽ tạo một bản ghi chi phí mới
  const recordDate = todayStr();
  const period = (() => {
    const [y, m] = String(recordDate || '').split('-').map(Number);
    return { year: y || new Date().getFullYear(), month: m || new Date().getMonth() + 1 };
  })();

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0 && !projectId && onProjectChange) {
        onProjectChange(list[0].id);
      }
    });
    getAllInventoryItems().then((res) => {
      setInventoryItems(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getCategoryBudgetTree(period.year, projectId || undefined)
      .then((res) => {
        const cats = Array.isArray(res.data?.categories) ? res.data.categories : [];
        const names = Array.from(new Set(cats.map((c) => c?.name).filter(Boolean)));
        const lowerVp = String(VAT_PHAM).trim().toLowerCase();
        const lowerVc = String(VAN_CHUYEN).trim().toLowerCase();
        const lowerAu = String(AN_UONG).trim().toLowerCase();
        const lowerOther = String(OTHER_HANG_MUC).trim().toLowerCase();
        const lowerSpecials = new Set([lowerVp, lowerVc, lowerAu, lowerOther]);
        const vpCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerVp);
        const vcCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerVc);
        const auCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerAu);
        const otherCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerOther);
        // Vận chuyển / Ăn uống không còn là hạng mục mặc định: chỉ hiện nếu cây ngân sách còn nhóm đó
        const options = [
          VAT_PHAM,
          ...(vcCat ? [VAN_CHUYEN] : []),
          ...(auCat ? [AN_UONG] : []),
          ...names.filter((n) => !lowerSpecials.has(String(n).trim().toLowerCase())),
          OTHER_HANG_MUC,
        ];
        setHangMucOptions(options);
        const map = {};
        cats.forEach((c) => { if (c.name) map[c.name] = c.id; });
        if (vpCat) map[VAT_PHAM] = vpCat.id;
        if (vcCat) map[VAN_CHUYEN] = vcCat.id;
        if (auCat) map[AN_UONG] = auCat.id;
        if (otherCat) map[OTHER_HANG_MUC] = otherCat.id;
        setCategoryIdMap(map);
        const nameById = {};
        cats.forEach((c) => { if (c.id && c.name) nameById[c.id] = c.name; });
        setCategoryNameById(nameById);
      })
      .catch(() => {
        setHangMucOptions([VAT_PHAM, OTHER_HANG_MUC]);
        setCategoryIdMap({});
        setCategoryNameById({});
      });
  }, [period.year, projectId]);

  const markDirty = (nextRows) => {
    if (!snapRef.current) {
      setDirty(false);
      return;
    }
    const snap = JSON.stringify(snapRef.current);
    const cur = JSON.stringify(dirtySnapshot(nextRows));
    setDirty(snap !== cur);
  };

  // Khi chọn dự án: nạp TẤT CẢ dòng chi phí của dự án vào bảng nhập. Các dòng này chỉ là bản gốc;
  // khi bấm "Lưu chi phí" sẽ tạo bản ghi mới chứa các dòng này — các bản ghi cũ không bị thay đổi.
  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    const run = async () => {
      const mapped = await loadProjectLines(projectId);
      if (cancelled) return;
      setRows(mapped.length > 0 ? mapped : [emptyRow()]);
      snapRef.current = null;
      setDirty(false);
    };
    run();
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  // Đồng bộ dòng với cây ngân sách năm hiện tại:
  // - dòng thiếu hangMucLon → khôi phục tên hạng mục từ categoryId để dropdown hiển thị đúng
  // - categoryId không còn trong cây (nhóm cũ đã bị xoá / tạo lại) nhưng tên hạng mục vẫn khớp một nhóm
  //   → gắn lại categoryId mới, để lần lưu sau BE cộng dòng vào đúng nhóm ở tab Ngân sách
  useEffect(() => {
    if (!categoryNameById || Object.keys(categoryNameById).length === 0) return undefined;
    let changed = false;
    const next = rows.map((r) => {
      if (!r.hangMucLon && r.categoryId && categoryNameById[r.categoryId]) {
        changed = true;
        return { ...r, hangMucLon: normalizeHml(categoryNameById[r.categoryId]) };
      }
      if (r.hangMucLon && r.categoryId && !categoryNameById[r.categoryId] && categoryIdMap[r.hangMucLon]) {
        changed = true;
        return { ...r, categoryId: categoryIdMap[r.hangMucLon] };
      }
      return r;
    });
    if (changed) setRows(next);
    return undefined;
  }, [categoryNameById, categoryIdMap, rows]);

  // Dòng "Vật phẩm" đã lưu nhưng dropdown chi tiết không khớp option nào:
  // - có inventoryItemId nhưng item không nằm trong danh sách kho đã tải → tải riêng item đó
  // - không có inventoryItemId (BE không trả) nhưng có tên → liên kết lại theo tên vật phẩm
  const fetchedItemIdsRef = useRef(new Set());
  useEffect(() => {
    const missingIds = Array.from(new Set(rows
      .filter((r) => r.hangMucLon === VAT_PHAM && r.inventoryItemId)
      .map((r) => r.inventoryItemId)
      .filter((id) => !fetchedItemIdsRef.current.has(id) && !inventoryItems.some((i) => i.id === id))));
    if (missingIds.length > 0) {
      missingIds.forEach((id) => fetchedItemIdsRef.current.add(id));
      Promise.all(missingIds.map((id) => getInventoryItem(id).then((res) => res.data).catch(() => null)))
        .then((found) => {
          const valid = found.filter((it) => it && it.id);
          if (valid.length === 0) return;
          setInventoryItems((prev) => [...prev, ...valid.filter((it) => !prev.some((p) => p.id === it.id))]);
        });
    }
    if (inventoryItems.length === 0) return undefined;
    const norm = (s) => String(s || '').trim().toLowerCase();
    const matchOf = (r) => (r.hangMucLon === VAT_PHAM && !r.inventoryItemId && norm(r.name)
      ? inventoryItems.find((i) => norm(i.name) === norm(r.name))
      : null);
    if (!rows.some(matchOf)) return undefined;
    setRows((prev) => prev.map((r) => {
      const item = matchOf(r);
      return item ? { ...r, inventoryItemId: item.id, isCustom: false } : r;
    }));
    return undefined;
  }, [rows, inventoryItems]);

  const fmtCurrency = (n) => (Number(n) || 0).toLocaleString('vi-VN');

  const calcRowPlanned = (r) => {
    if (isAmountOnlyHml(r.hangMucLon)) return Number(r.plannedAmount) || 0;
    if (r.isCustom || !r.inventoryItemId) return (Number(r.unitPrice) || 0) * (Number(r.plannedQty) || 0);
    const item = inventoryItems.find((i) => i.id === r.inventoryItemId);
    return item ? preVatOf(item) * (Number(r.plannedQty) || 0) : 0;
  };
  const totalPlanned = rows.reduce((s, r) => s + calcRowPlanned(r), 0);
  const totalActual = rows.reduce((s, r) => s + lineTotalOf(r, inventoryItems), 0);
  const totalAfterVat = rows.reduce((s, r) => s + Math.round(lineTotalOf(r, inventoryItems) * (1 + (Number(r.vatRate) || 0) / 100)), 0);
  const itemNames = Array.from(new Set(inventoryItems.map((i) => i.name))).filter(Boolean);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => {
      const next = typeof field === 'object'
        ? prev.map((r) => (r.rowId === id ? { ...r, ...field } : r))
        : prev.map((r) => (r.rowId === id ? { ...r, [field]: value } : r));
      markDirty(next);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, emptyRow()];
      markDirty(next);
      return next;
    });
  };

  const removeRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Nhận nhiều file (chọn hoặc kéo thả); bỏ file sai định dạng / quá 10MB / trùng tên đang chờ
  const addAttachments = (rowId, fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const rejected = [];
    const accepted = [];
    for (const f of files) {
      const err = validateAttachmentFile(f);
      if (err) { rejected.push(`${f.name} (${err === 'size' ? t('quá 10MB', 'over 10MB') : t('sai định dạng', 'unsupported type')})`); continue; }
      if (row.pendingFiles.some((p) => p.name === f.name && p.size === f.size) || accepted.some((p) => p.name === f.name && p.size === f.size)) continue;
      accepted.push(f);
    }
    if (accepted.length > 0) updateRow(rowId, { pendingFiles: [...row.pendingFiles, ...accepted] });
    if (rejected.length > 0) {
      showToast(t(`Không thêm: ${rejected.join(', ')}. Nhận PDF, ảnh, Excel, Word tối đa 10MB.`, `Skipped: ${rejected.join(', ')}. PDF, image, Excel, Word up to 10MB.`), 'error');
    }
  };

  // Gỡ khỏi dòng = không gắn lại vào snapshot mới (snapshot cũ vẫn giữ file)
  const removeSavedAttachment = (row, id) => updateRow(row.rowId, { attachments: row.attachments.filter((a) => a.id !== id) });
  const removePendingFile = (row, file) => updateRow(row.rowId, { pendingFiles: row.pendingFiles.filter((f) => f !== file) });

  // Mở tab trước khi await để trình duyệt không chặn popup
  const openBlobInTab = async (load) => {
    const win = window.open('', '_blank');
    try {
      const blob = await load();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch {
      if (win) win.close();
      showToast(t('Không mở được hồ sơ', 'Could not open the file'), 'error');
    }
  };

  const resetForm = () => {
    setRows([emptyRow()]);
    snapRef.current = null;
    setDirty(false);
  };

  const hasContent = (r) => Boolean(
    (r.name && r.name.trim()) ||
    (Number(r.actualQty) > 0) ||
    (Number(r.plannedQty) > 0) ||
    (isAmountOnlyHml(r.hangMucLon) && (Number(r.plannedAmount) > 0 || Number(r.actualAmount) > 0))
  );

  const isVatPham = (r) => r.hangMucLon === VAT_PHAM;

  const stockOfRow = (r) => {
    const item = inventoryItems.find((i) => i.id === r.inventoryItemId);
    return item ? Number(item.currentStock ?? item.quantity ?? 0) : null;
  };

  const isOverStockRow = (r) => {
    if (isAmountOnlyHml(r.hangMucLon) || !isVatPham(r)) return false;
    const stock = stockOfRow(r);
    if (stock == null) return false;
    return Number(r.actualQty) > stock;
  };

  const overStockRowsNow = rows.filter((r) => hasContent(r) && isOverStockRow(r));

  // Dòng mới của snapshot gắn lại hồ sơ đã lưu của dòng cũ (không copy file)
  const buildLinePayload = (r) => {
    const payload = buildLineFields(r);
    if (r.attachments.length > 0) payload.attachmentIds = r.attachments.map((a) => a.id);
    return payload;
  };

  const buildLineFields = (r) => {
    const isVp = isVatPham(r);
    const amountOnly = isAmountOnlyHml(r.hangMucLon);
    if (amountOnly) {
      return {
        name: (r.name || '').trim(),
        hangMucLon: r.hangMucLon || null,
        categoryId: r.categoryId || null,
        expenseDate: r.expenseDate || null,
        inventoryItemId: null,
        isCustom: true,
        plannedQuantity: 0,
        actualQuantity: 0,
        vatRate: 0,
        unitPriceBeforeVat: 0,
        unitPriceAfterVat: 0,
        actualUnitPrice: 0,
        plannedAmount: Number(r.plannedAmount) || 0,
        actualAmount: Number(r.actualAmount) || 0,
        note: r.note || '',
      };
    }
    const item = inventoryItems.find((it) => it.id === r.inventoryItemId);
    const isCustomLine = !isVp || !item;
    const vatRate = (r.vatRate !== '' && r.vatRate != null)
      ? Number(r.vatRate)
      : (item && item.vatRate != null ? Number(item.vatRate) : undefined);
    const unitPrice = isVp && item
      ? preVatOf(item)
      : (Number(r.unitPrice) || 0);
    const afterVat = vatRate != null && vatRate > 0
      ? Math.round(unitPrice * (1 + vatRate / 100))
      : unitPrice;
    return {
      name: isVp && item ? (item.name || '').trim() : (r.name || '').trim(),
      hangMucLon: r.hangMucLon || null,
      categoryId: r.categoryId || null,
      expenseDate: r.expenseDate || null,
      inventoryItemId: (isVp && r.inventoryItemId) || null,
      isCustom: isCustomLine,
      plannedQuantity: Number(r.plannedQty) || 0,
      actualQuantity: Number(r.actualQty) || 0,
      vatRate,
      unitPriceBeforeVat: unitPrice,
      unitPriceAfterVat: afterVat,
      actualUnitPrice: unitPrice,
      note: r.note || '',
    };
  };

  const validateRows = () => {
    for (const r of rows) {
      if (!hasContent(r)) continue;
      if (!r.expenseDate) return t('Mỗi dòng chi phí phải chọn ngày phát sinh', 'Each expense line must have an expense date');
      if (!r.hangMucLon) return t('Mỗi dòng chi phí phải chọn Hạng mục lớn', 'Each expense line must have a large category');
      if (isAmountOnlyHml(r.hangMucLon)) {
        const planVal = Number(r.plannedAmount);
        const actVal = Number(r.actualAmount);
        if (r.plannedAmount !== '' && r.plannedAmount != null && (Number.isNaN(planVal) || planVal < 0)) return t('Thành tiền kế hoạch không được âm', 'Planned amount cannot be negative');
        if (r.actualAmount !== '' && r.actualAmount != null && (Number.isNaN(actVal) || actVal < 0)) return t('Thành tiền thực tế không được âm', 'Actual amount cannot be negative');
        continue;
      }
      if (r.vatRate !== '' && r.vatRate != null) {
        const vat = Number(r.vatRate);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) return t('VAT phải nằm trong khoảng 0-100 (%)', 'VAT must be between 0-100 (%)');
      }
      if (isVatPham(r) && !r.inventoryItemId) return t('Hạng mục "Vật phẩm" phải chọn 1 vật phẩm từ kho', '"Vật phẩm" category requires picking an inventory item');
      const planned = Number(r.plannedQty);
      const actual = Number(r.actualQty);
      const price = Number(r.unitPrice);
      if (r.plannedQty !== '' && r.plannedQty != null && (Number.isNaN(planned) || planned < 0)) return t('Số lượng kế hoạch không được âm', 'Planned quantity cannot be negative');
      if (r.actualQty !== '' && r.actualQty != null && (Number.isNaN(actual) || actual < 0)) return t('Số lượng thực tế không được âm', 'Actual quantity cannot be negative');
      if (!isVatPham(r) && r.unitPrice !== '' && r.unitPrice != null && r.unitPrice !== 0 && (Number.isNaN(price) || price < 0)) return t('Đơn giá không được âm', 'Unit price cannot be negative');
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) {
      showToast(t('Vui lòng chọn dự án', 'Please select a project'), 'error');
      return;
    }
    const validRows = rows.filter(hasContent);
    if (validRows.length === 0) {
      showToast(t('Nhập ít nhất một dòng chi phí', 'Enter at least one expense line'), 'error');
      return;
    }
    const errMsg = validateRows();
    if (errMsg) {
      showToast(errMsg, 'error');
      return;
    }
    // Dòng Vật phẩm vượt tồn kho: cảnh báo và không cho lưu cho đến khi xử lý
    const overStockRows = validRows.filter(isOverStockRow);
    if (overStockRows.length > 0) {
      const names = overStockRows.map((r) => r.name || VAT_PHAM).join(', ');
      showToast(
        t(
          `Không thể lưu: ${overStockRows.length} dòng Vật phẩm vượt tồn kho hiện tại (${names}). Hãy giảm số lượng thực tế hoặc xoá các dòng này trước khi lưu.`,
          `Cannot save: ${overStockRows.length} item line(s) exceed current stock (${names}). Reduce actual quantity or remove these lines before saving.`
        ),
        'warning'
      );
      return;
    }
    setSaving(true);
    try {
      // Mỗi lần lưu tạo một bản ghi chi phí MỚI (ngày nhập = hôm nay); không sửa bản ghi cũ
      const res = await saveExpense({
        projectId,
        period: `${period.year}-${String(period.month).padStart(2, '0')}`,
        recognizedDate: recordDate,
        expenseDate: recordDate,
        directCost: 0,
        directNote: '',
      });
      const recId = res?.data?.id || null;
      if (!recId) throw new Error('Failed to create expense record');
      const savedLineDates = {};
      const failedUploads = [];
      for (const r of validRows) {
        const payload = buildLinePayload(r);
        try {
          const lineRes = await addExpenseLine(recId, payload);
          const newLineId = lineRes?.data?.id || null;
          if (String(r.expenseDate || '').slice(0, 10)) {
            savedLineDates[newLineId || r.rowId] = String(r.expenseDate).slice(0, 10);
          }
          // File mới → tải thẳng lên dòng vừa tạo (nhiều file / request)
          if (newLineId && r.pendingFiles.length > 0) {
            try {
              await uploadExpenseLineAttachments(newLineId, r.pendingFiles);
            } catch (err) {
              console.error('[ExpenseEntryForm] upload attachments failed:', err);
              failedUploads.push(...r.pendingFiles.map((f) => f.name));
            }
          }
        } catch (err) {
          console.error('[ExpenseEntryForm] addExpenseLine failed:', err);
          showToast(t('Lỗi thêm dòng chi phí', 'Error adding expense line'), 'error');
        }
      }
      // Lưu ngày phát sinh theo từng dòng vào meta (BE xác nhận lưu được nhưng FE giữ hậu thuẫn khi BE trả thiếu)
      if (recId) setExpenseMeta(recId, { lineDates: savedLineDates });
      if (failedUploads.length > 0) {
        showToast(t(
          `Đã lưu chi phí nhưng chưa tải lên được hồ sơ: ${failedUploads.join(', ')}`,
          `Expense saved but failed to upload: ${failedUploads.join(', ')}`
        ), 'warning');
      } else {
        showToast(t('Đã lưu chi phí thành công', 'Expense saved successfully'));
      }
      snapRef.current = null;
      setDirty(false);
      setReloadKey((k) => k + 1);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[ExpenseEntryForm] save error:', err);
      const http = err?.response?.status ? ` (HTTP ${err.response.status})` : '';
      showToast(t(`Lỗi khi lưu chi phí${http}`, `Error saving expense${http}`), 'error');
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
                onChange={(e) => onProjectChange && onProjectChange(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {overStockRowsNow.length > 0 && (
            <div role="alert" className="flex items-start gap-2 mb-3 px-4 py-3 rounded-lg border border-danger/40 bg-danger/5 text-danger">
              <span className="material-symbols-outlined text-body-lg shrink-0">warning</span>
              <div className="text-body-sm">
                <p className="font-semibold">
                  {t(
                    `${overStockRowsNow.length} dòng Vật phẩm vượt tồn kho — chưa thể lưu`,
                    `${overStockRowsNow.length} item line(s) exceed stock — cannot save yet`
                  )}
                </p>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {overStockRowsNow.map((r) => (
                    <li key={r.rowId}>
                      {r.name || VAT_PHAM}: {t('SL thực', 'actual')} {Number(r.actualQty).toLocaleString('vi-VN')} / {t('tồn', 'stock')} {stockOfRow(r).toLocaleString('vi-VN')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border-light shadow-sm mb-6">
            <table className="w-full min-w-[1440px] table-fixed divide-y divide-border-light">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[48px]" />
              </colgroup>
              <thead className="bg-background-subtle">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ngày phát sinh', 'Expense Date')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hạng mục lớn', 'Large Category')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Chi tiết', 'Detail')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Note')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hồ sơ liên quan', 'Documents')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá', 'Unit Price')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('VAT (%)', 'VAT (%)')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('SL KH / SL Thực', 'Plan Qty / Actual Qty')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền KH', 'Planned Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền TT', 'Actual Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Tổng Cộng', 'Total')}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light bg-surface-container-lowest">
                {rows.map((row) => {
                  const isVp = row.hangMucLon === VAT_PHAM;
                  const amountOnly = isAmountOnlyHml(row.hangMucLon);
                  const customLine = (!isVp && (row.isCustom || !row.inventoryItemId)) || (isVp && !row.inventoryItemId);
                  const selectedItem = inventoryItems.find((i) => i.id === row.inventoryItemId);
                  const unitPrice = amountOnly ? 0 : (customLine
                    ? (Number(row.unitPrice) || 0)
                    : selectedItem
                      ? preVatOf(selectedItem)
                      : (Number(row.unitPrice) || 0));
                  const planAmount = amountOnly
                    ? (Number(row.plannedAmount) || 0)
                    : unitPrice * (Number(row.plannedQty) || 0);
                  const actAmount = amountOnly
                    ? (Number(row.actualAmount) || 0)
                    : unitPrice * (Number(row.actualQty) || 0);
                  const totalLineAfterVat = Math.round(actAmount * (1 + (Number(row.vatRate) || 0) / 100));
                  const overStock = isOverStockRow(row);
                  return (
                    <tr key={row.rowId} className={`align-top ${overStock ? 'bg-danger/5' : ''}`}>
                      <td className="py-3 pl-4 pr-3">
                        <input
                          className={`${inputCls} text-[12px] text-right`}
                          type="date"
                          value={row.expenseDate || ''}
                          onChange={(e) => updateRow(row.rowId, 'expenseDate', e.target.value)}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          className={`${inputCls} text-[12px]`}
                          value={row.hangMucLon || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const wasVp = row.hangMucLon === VAT_PHAM;
                            const wasAmt = isAmountOnlyHml(row.hangMucLon);
                            const isAmtNow = isAmountOnlyHml(v);
                            const catId = categoryIdMap[v] || '';
                            updateRow(row.rowId, {
                              hangMucLon: v,
                              categoryId: catId,
                              ...(v === VAT_PHAM
                                ? { inventoryItemId: row.inventoryItemId || '', isCustom: Boolean(row.inventoryItemId) }
                                : wasVp
                                  ? { inventoryItemId: '', isCustom: true }
                                  : {}),
                              ...(isAmtNow && !wasAmt
                                ? { plannedQty: '', actualQty: '', unitPrice: 0, vatRate: '0', plannedAmount: row.plannedAmount || '', actualAmount: row.actualAmount || '' }
                                : !isAmtNow && wasAmt
                                  ? { plannedAmount: '', actualAmount: '', unitPrice: 0, vatRate: '' }
                                  : {}),
                            });
                          }}
                        >
                          <option value="">{t('-- Chọn hạng mục lớn --', '-- Select large category --')}</option>
                          {hangMucOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          {row.hangMucLon && !hangMucOptions.includes(row.hangMucLon) && (
                            <option value={row.hangMucLon}>{row.hangMucLon}</option>
                          )}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        {isVp ? (
                          <select
                            className={`${inputCls} text-[12px]`}
                            value={row.inventoryItemId || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const item = inventoryItems.find((u) => u.id === v);
                              updateRow(row.rowId, {
                                inventoryItemId: v,
                                name: item ? item.name : row.name,
                                isCustom: !item,
                                ...(item
                                  ? { unitPrice: preVatOf(item), vatRate: item.vatRate != null ? item.vatRate : row.vatRate }
                                  : {}),
                              });
                            }}
                          >
                            <option value="">
                              {!row.inventoryItemId && row.name
                                ? row.name
                                : t('-- Chọn vật phẩm từ kho --', '-- Pick an inventory item --')}
                            </option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                            {!selectedItem && row.inventoryItemId ? (
                              <option value={row.inventoryItemId}>{row.name || row.inventoryItemId}</option>
                            ) : null}
                          </select>
                        ) : (
                          <input
                            className={`${inputCls} text-[12px]`}
                            list={amountOnly ? undefined : 'mkt-cat-options'}
                            placeholder={amountOnly
                              ? t('Nhập mô tả chi phí...', 'Enter expense description...')
                              : t('Nhập chi tiết...', 'Enter detail...')}
                            value={row.name || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (amountOnly) { updateRow(row.rowId, { name: v }); return; }
                              const item = inventoryItems.find((u) => u.name === v);
                              if (item) {
                                updateRow(row.rowId, {
                                  name: v,
                                  inventoryItemId: item.id,
                                  isCustom: false,
                                  unitPrice: preVatOf(item),
                                  vatRate: item.vatRate != null ? item.vatRate : row.vatRate,
                                });
                              } else {
                                updateRow(row.rowId, { name: v, inventoryItemId: '', isCustom: true });
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {/* Ghi chú nhiều dòng: mỗi mã hóa đơn một dòng (Enter để xuống dòng) */}
                        <AutoGrowTextarea
                          className={`${inputCls} resize-none min-h-[38px] leading-5 overflow-hidden`}
                          placeholder={t('Nhập ghi chú...', 'Enter note...')}
                          value={row.note || ''}
                          onChange={(e) => updateRow(row.rowId, 'note', e.target.value)}
                        />
                      </td>
                      <td
                        className="py-3 px-3"
                        onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragRowId(row.rowId); } }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragRowId(null); }}
                        onDrop={(e) => { e.preventDefault(); setDragRowId(null); addAttachments(row.rowId, e.dataTransfer?.files); }}
                      >
                        <div className={`flex flex-col gap-1 min-w-0 rounded-md ${dragRowId === row.rowId ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''}`}>
                          {row.attachments.map((a) => (
                            <AttachmentChip
                              key={a.id}
                              name={a.name}
                              onOpen={() => openBlobInTab(() => getExpenseAttachmentBlob(a.id))}
                              onRemove={() => removeSavedAttachment(row, a.id)}
                              t={t}
                            />
                          ))}
                          {row.pendingFiles.map((f) => (
                            <AttachmentChip
                              key={`${f.name}:${f.size}`}
                              name={f.name}
                              pending
                              onOpen={() => window.open(URL.createObjectURL(f), '_blank', 'noopener')}
                              onRemove={() => removePendingFile(row, f)}
                              t={t}
                            />
                          ))}
                          {(
                            <label
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border-light text-[12px] text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer"
                              title={t('Chọn hoặc kéo thả nhiều file vào ô này (PDF, ảnh, Excel, Word ≤ 10MB)', 'Pick or drop files here (PDF, image, Excel, Word ≤ 10MB)')}
                            >
                              <span className="material-symbols-outlined text-[16px] shrink-0">{dragRowId === row.rowId ? 'file_download' : 'attach_file'}</span>
                              <span className="flex flex-col leading-tight">
                                <span>{dragRowId === row.rowId ? t('Thả file vào đây', 'Drop files here') : attachmentCount(row) > 0 ? t('Thêm file', 'Add file') : t('Đính kèm', 'Attach')}</span>
                                {dragRowId !== row.rowId && <span className="text-[10px] text-outline">{t('hoặc kéo thả', 'or drop')}</span>}
                              </span>
                              <input
                                type="file"
                                multiple
                                accept={ATTACHMENT_ACCEPT}
                                className="hidden"
                                onChange={(e) => { addAttachments(row.rowId, e.target.files); e.target.value = ''; }}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {amountOnly ? (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low text-on-surface-variant cursor-not-allowed text-[11px]`} value="—" />
                        ) : customLine ? (
                          <NumberInput
                            className={`${inputCls} text-right`}
                            placeholder="0"
                            value={row.unitPrice || ''}
                            onChange={(e) => updateRow(row.rowId, 'unitPrice', e.target.value)}
                          />
                        ) : (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={unitPrice ? unitPrice.toLocaleString('vi-VN') : '—'} />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {amountOnly ? (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low text-on-surface-variant cursor-not-allowed text-[11px]`} value="—" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <NumberInput
                              className={`${inputCls} text-right`}
                              placeholder="0"
                              value={row.vatRate}
                              onChange={(e) => updateRow(row.rowId, 'vatRate', e.target.value)}
                            />
                            <span className="text-[12px] text-on-surface-variant">%</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {amountOnly ? (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low text-on-surface-variant cursor-not-allowed text-[11px]`} value="—" />
                        ) : (
                          <div className="flex gap-1">
                            <NumberInput
                              className={`${inputCls} text-right w-1/2`}
                              placeholder={t('KH', 'Plan')}
                              value={row.plannedQty}
                              onChange={(e) => updateRow(row.rowId, 'plannedQty', e.target.value)}
                            />
                            <NumberInput
                              className={`${inputCls} text-right w-1/2 ${overStock ? '!border-danger ring-1 ring-danger text-danger' : ''}`}
                              placeholder={t('Thực', 'Actual')}
                              value={row.actualQty}
                              onChange={(e) => updateRow(row.rowId, 'actualQty', e.target.value)}
                            />
                          </div>
                        )}
                        {overStock && (
                          <p className="flex items-center gap-0.5 text-[10px] font-medium text-danger mt-1">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            {t('Vượt tồn kho', 'Exceeds stock')} ({t('tồn', 'stock')}: {stockOfRow(row).toLocaleString('vi-VN')})
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {amountOnly ? (
                          <NumberInput
                            className={`${inputCls} text-right`}
                            placeholder="0"
                            value={row.plannedAmount || ''}
                            onChange={(e) => updateRow(row.rowId, 'plannedAmount', e.target.value)}
                          />
                        ) : (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={planAmount ? planAmount.toLocaleString('vi-VN') : '—'} />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {amountOnly ? (
                          <NumberInput
                            className={`${inputCls} text-right`}
                            placeholder="0"
                            value={row.actualAmount || ''}
                            onChange={(e) => updateRow(row.rowId, 'actualAmount', e.target.value)}
                          />
                        ) : (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={actAmount ? actAmount.toLocaleString('vi-VN') : '—'} />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={totalLineAfterVat ? totalLineAfterVat.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          className="p-1.5 rounded-md text-on-surface-variant hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
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
                  <td colSpan={8} className="px-4 py-3 text-on-surface">{t('Tổng cộng', 'Total')}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{fmtCurrency(totalPlanned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{fmtCurrency(totalActual)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{fmtCurrency(totalAfterVat)}</td>
                  <td></td>
                </tr>
                <tr className="border-t border-border-light bg-surface-container-lowest">
                  <td colSpan={12} className="px-4 py-3">
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
            <datalist id="mkt-cat-options">
              {itemNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
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

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}