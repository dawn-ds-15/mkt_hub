const KEY = 'mkt_expense_meta';
const MAX_DATAURL_LENGTH = 1_500_000;

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // quota exceeded — retry without heavy dataUrls
    try {
      const light = {};
      Object.entries(map).forEach(([id, m]) => {
        light[id] = { ...m, contractDataUrl: null };
      });
      localStorage.setItem(KEY, JSON.stringify(light));
    } catch {
      /* ignore */
    }
  }
}

export function getExpenseMeta(id) {
  if (id == null) return null;
  return readAll()[String(id)] || null;
}

export function setExpenseMeta(id, meta) {
  if (id == null) return;
  const map = readAll();
  const key = String(id);
  const next = { ...(map[key] || {}), ...meta };
  if (next.contractDataUrl && String(next.contractDataUrl).length > MAX_DATAURL_LENGTH) {
    next.contractDataUrl = null;
  }
  map[key] = next;
  writeAll(map);
}

export function removeExpenseMeta(id) {
  if (id == null) return;
  const map = readAll();
  delete map[String(id)];
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

// Tách TẤT CẢ các dòng chi phí từ ghi chú BE (định dạng do buildNote tạo:
// "Sự kiện: X | Kế hoạch: Y | SL: Z | ghi chú", nhiều dòng nối bằng " ; ", có thể đánh số "1. ")
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
    let qty = 1;
    const rest = [];
    seg.split('|').map((p) => p.trim()).forEach((part) => {
      if (!part) return;
      let m = part.match(/^(?:Sự kiện|Event)\s*:\s*(.+)$/i);
      if (m) { event = m[1].trim(); return; }
      m = part.match(/^(?:Kế hoạch|Planned)\s*:\s*([\d.,]+)$/i);
      if (m) { planned = toNum(m[1]); return; }
      m = part.match(/^(?:SL|Số lượng|Qty)\s*:\s*([\d.,]+)$/i);
      if (m) { qty = parseInt(m[1].replace(/[.,]/g, ''), 10) || 1; return; }
      rest.push(part);
    });
    if (event || planned || rest.length) {
      out.push({ event, planned, qty, note: rest.join(' | ') });
    }
  });
  return out;
}
