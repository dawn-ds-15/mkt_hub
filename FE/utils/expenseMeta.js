const KEY = 'mkt_expense_meta';
const MAX_DATAURL_LENGTH = 1_500_000;

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

// Trả về { ok, droppedDataUrls? } để caller cảnh báo thay vì drop ảnh im lặng (BUG-C07)
function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    return { ok: true };
  } catch {
    // quota exceeded — retry without heavy dataUrls
    try {
      const light = {};
      Object.entries(map).forEach(([id, m]) => {
        light[id] = { ...m, contractDataUrl: null };
      });
      localStorage.setItem(KEY, JSON.stringify(light));
      return { ok: true, droppedDataUrls: true };
    } catch {
      return { ok: false };
    }
  }
}

export function getExpenseMeta(id, periodKey) {
  if (id == null && periodKey == null) return null;
  const map = readAll();
  if (id != null && map[String(id)]) return map[String(id)];
  if (periodKey != null && map[String(periodKey)]) return map[String(periodKey)];
  return null;
}

export function setExpenseMeta(id, meta, periodKey) {
  if (id == null && periodKey == null) return { ok: false };
  const map = readAll();
  const next = { ...meta };
  if (next.contractDataUrl && String(next.contractDataUrl).length > MAX_DATAURL_LENGTH) {
    next.contractDataUrl = null;
  }
  if (id != null) {
    const key = String(id);
    map[key] = { ...(map[key] || {}), ...next };
  }
  if (periodKey != null) {
    const pKey = String(periodKey);
    map[pKey] = { ...(map[pKey] || {}), ...next };
  }
  return writeAll(map);
}

export function removeExpenseMeta(id, periodKey) {
  const map = readAll();
  if (id != null) delete map[String(id)];
  if (periodKey != null) delete map[String(periodKey)];
  writeAll(map);
}

export function composeExpenseNote({ event, planned, note, qty }) {
  const parts = [];
  const ev = (event || '').trim();
  if (ev) parts.push(`Sự kiện: ${ev}`);
  const pl = Number(planned) || 0;
  if (pl) parts.push(`Kế hoạch: ${pl.toLocaleString('vi-VN')}`);
  const q = parseInt(qty, 10) || 1;
  if (q > 1) parts.push(`Số lượng: ${q}`);
  const nt = (note || '').trim();
  if (nt) parts.push(nt);
  return parts.join(' | ');
}

export function parseExpenseNote(raw) {
  const note = typeof raw === 'string' ? raw : '';
  if (!note) return { event: '', planned: '', note: '', qty: '' };
  let event = '';
  let planned = '';
  let qty = '';
  const rest = [];
  note.split('|').map((s) => s.trim()).forEach((part) => {
    if (!part) return;
    let m = part.match(/^(?:Sự kiện|Event)\s*:\s*(.+)$/i);
    if (m) {
      event = m[1].trim();
      return;
    }
    m = part.match(/^(?:Kế hoạch|Planned)\s*:\s*([\d.,]+)$/i);
    if (m) {
      planned = parseFloat(m[1].replace(/\./g, '').replace(/,/g, '.')) || '';
      return;
    }
    m = part.match(/^(?:SL|Số lượng|Qty)\s*:\s*([\d.,]+)$/i);
    if (m) {
      qty = parseInt(m[1].replace(/[.,]/g, ''), 10) || '';
      return;
    }
    rest.push(part);
  });
  return { event, planned: planned ? String(planned) : '', note: rest.join(' | '), qty: qty ? String(qty) : '' };
}

function toNum(str) {
  const v = parseFloat(String(str ?? '').replace(/\./g, '').replace(/,/g, '.'));
  return Number.isFinite(v) ? v : 0;
}

export function parseExpenseLines(raw) {
  const note = typeof raw === 'string' ? raw : '';
  if (!note.trim()) return [];
  const out = [];
  note.split(';').map((s) => s.trim().replace(/^\d+\.\s*/, '')).forEach((seg) => {
    if (!seg) return;
    let event = '';
    let planned = 0;
    let actual = 0;
    let qty = 1;
    let expenseCategory = '';
    let inventoryItemId = '';
    let plannedQty = '';
    let actualQty = '';
    let unitPriceAfterVat = 0;
    let isOther = false;
    let otherName = '';
    const rest = [];

    seg.split('|').map((p) => p.trim()).forEach((part) => {
      if (!part) return;
      let m = part.match(/^(?:Danh mục|Category)\s*:\s*(.+)$/i);
      if (m) { expenseCategory = m[1].trim(); return; }

      m = part.match(/^(?:ItemID|InventoryItemID)\s*:\s*(.+)$/i);
      if (m) { inventoryItemId = m[1].trim(); return; }

      m = part.match(/^(?:Khác|IsOther)\s*:\s*(.+)$/i);
      if (m) { isOther = true; return; }

      m = part.match(/^(?:Tên|ItemName|OtherName|Vật phẩm|Item)\s*:\s*(.+)$/i);
      if (m) { otherName = m[1].trim(); return; }

      m = part.match(/^(?:Đơn giá|UnitPrice)\s*:\s*([\d.,]+)$/i);
      if (m) { unitPriceAfterVat = toNum(m[1]); return; }

      m = part.match(/^(?:SL KH|PlanQty)\s*:\s*([\d.,]+)$/i);
      if (m) { plannedQty = m[1].trim(); return; }

      m = part.match(/^(?:SL Thực|ActualQty)\s*:\s*([\d.,]+)$/i);
      if (m) { actualQty = m[1].trim(); return; }

      m = part.match(/^(?:Sự kiện|Event)\s*:\s*(.+)$/i);
      if (m) { event = m[1].trim(); return; }

      m = part.match(/^(?:Kế hoạch|Planned)\s*:\s*([\d.,]+)$/i);
      if (m) { planned = toNum(m[1]); return; }

      m = part.match(/^(?:Thực tế|Actual)\s*:\s*([\d.,]+)$/i);
      if (m) { actual = toNum(m[1]); return; }

      m = part.match(/^(?:SL|Số lượng|Qty)\s*:\s*([\d.,]+)$/i);
      if (m) { qty = parseInt(m[1].replace(/[.,]/g, ''), 10) || 1; return; }

      rest.push(part);
    });

    if (event || planned || actual || expenseCategory || inventoryItemId || plannedQty || actualQty || otherName || rest.length) {
      out.push({
        event,
        planned,
        actual,
        qty,
        expenseCategory,
        inventoryItemId,
        plannedQty,
        actualQty,
        unitPriceAfterVat,
        isOther,
        otherName,
        note: rest.join(' | ')
      });
    }
  });
  return out;
}
