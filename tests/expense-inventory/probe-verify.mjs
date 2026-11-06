/**
 * Verification probes for BUG-2 (T10 race) and the FE double-return in
 * ExpenseHistory.handleDelete. Read-only against src; only creates/deletes
 * records whose name/note start with TEST_QA_.
 *
 * Usage:
 *   $env:ALLOW_ONRENDER='1'
 *   node tests/expense-inventory/probe-verify.mjs
 */
import { parseExpenseLines } from '../../src/features/expense/utils/expenseMeta.js';

const API_BASE = (process.env.API_BASE_URL || 'https://mkt-hub.onrender.com/api').replace(/\/$/, '');
if (API_BASE.includes('mkt-hub.onrender.com') && process.env.ALLOW_ONRENDER !== '1') {
  console.error('Refusing to run against mkt-hub.onrender.com without ALLOW_ONRENDER=1.');
  process.exit(2);
}
const MANAGER = { email: 'a.nguyen@company.com', password: 'demo123' };
const SPECIALIST = { email: 'test@company.com', password: 'demo123' };
const PREFIX = 'TEST_QA_';
const RUN = Date.now().toString(36).toUpperCase();
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, endpoint, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(attempt * 1500); continue; }
      return { status: res.status, data };
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(attempt * 1500);
    }
  }
}

async function login(account) {
  const res = await req('POST', '/auth/login', { body: account });
  if (res.status !== 200 || !res.data?.access_token) throw new Error(`login ${account.email}: ${res.status}`);
  return { token: res.data.access_token, user: res.data.user };
}

async function projectId(token) {
  const res = await req('GET', '/v1/projects', { token });
  const list = Array.isArray(res.data) ? res.data : res.data?.data;
  return list[0].id;
}

async function createItem(token, tag, stock = 100) {
  const name = `${PREFIX}${tag}_${RUN}`.replace(/[^A-Za-z0-9_]/g, '_');
  const res = await req('POST', '/v1/inventory/items', {
    token,
    body: {
      code: `TQA-${tag}-${RUN}`.replace(/[^A-Za-z0-9-]/g, '-').toUpperCase(),
      name,
      category: 'gift',
      unit: 'pcs',
      batchCode: `TQA-B-${tag}-${RUN}`.replace(/[^A-Za-z0-9-]/g, '-').toUpperCase(),
      receivedDate: TODAY,
      quantityIn: stock,
      unitPriceBeforeVat: 10000,
      vatRate: 8,
      unitPriceAfterVat: 10800,
      supplier: 'TEST_QA',
      note: `${PREFIX}probe`,
    },
  });
  const item = res.data?.data ?? res.data;
  if (!item?.id) throw new Error(`createItem ${tag}: ${res.status} ${JSON.stringify(res.data)}`);
  return item;
}

async function stock(token, itemId) {
  const res = await req('GET', `/v1/inventory/items/${itemId}`, { token });
  const d = res.data?.data ?? res.data;
  if (Array.isArray(d?.batches)) return d.batches.reduce((s, b) => s + (Number(b.currentStock) || 0), 0);
  return Number(d?.currentStock ?? d?.totalStock ?? 0);
}

async function createExpense(token, pid, directNotes = '') {
  const d = new Date();
  const res = await req('POST', '/v1/expenses', {
    token,
    body: {
      projectId: pid,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      recognizedDate: TODAY,
      expenseDate: TODAY,
      directCost: 0,
      directNotes,
    },
  });
  const id = res.data?.data?.id ?? res.data?.id;
  if (!id) throw new Error(`createExpense: ${res.status} ${JSON.stringify(res.data)}`);
  return id;
}

function lineBody(item, actualQty) {
  return {
    name: item.name,
    hangMucLon: 'Vật phẩm',
    categoryId: null,
    expenseDate: TODAY,
    inventoryItemId: item.id,
    isCustom: false,
    plannedQuantity: 0,
    actualQuantity: actualQty,
    vatRate: 8,
    unitPriceBeforeVat: 10000,
    unitPriceAfterVat: 10800,
    actualUnitPrice: 10000,
    note: `${PREFIX}probe line`,
  };
}

async function addLine(token, expenseId, item, qty) {
  return req('POST', `/v1/expenses/${expenseId}/lines`, { token, body: lineBody(item, qty) });
}

async function removeExpense(token, id) {
  try { await req('DELETE', `/v1/expenses/${id}`, { token }); } catch { /* ignore */ }
}
async function removeItem(token, id) {
  try { await req('DELETE', `/v1/inventory/items/${id}`, { token }); } catch { /* ignore */ }
}

async function probeT10(role, account, pid, managerToken) {
  const auth = await login(account);
  const runs = [];
  for (let i = 1; i <= 5; i += 1) {
    let item = null;
    let expense = null;
    try {
      item = await createItem(managerToken, `T10_${role}_${i}`);
      const before = await stock(auth.token, item.id);
      expense = await createExpense(auth.token, pid);
      const body = lineBody(item, 10);
      const [a, b] = await Promise.all([
        req('POST', `/v1/expenses/${expense}/lines`, { token: auth.token, body }),
        req('POST', `/v1/expenses/${expense}/lines`, { token: auth.token, body }),
      ]);
      const after = await stock(auth.token, item.id);
      const detail = await req('GET', `/v1/expenses/${expense}`, { token: auth.token });
      const lines = detail.data?.data?.lines ?? detail.data?.lines ?? [];
      runs.push({
        run: i,
        statuses: [a.status, b.status],
        before,
        after,
        deducted: before - after,
        lineCount: lines.length,
        lineQty: lines.map((l) => l.actualQuantity),
      });
    } catch (err) {
      runs.push({ run: i, error: String(err.message || err) });
    } finally {
      if (expense) await removeExpense(auth.token, expense);
      if (item) await removeItem(managerToken, item.id);
    }
  }
  return runs;
}

async function probeDelete(pid, managerToken, mode = 'old') {
  const item = await createItem(managerToken, `DEL_${mode}`);
  const before = await stock(managerToken, item.id);
  const legacyNote = `ItemID: ${item.id} | SL Thực: 10 | Ghi chú: legacy`;
  const parsed = parseExpenseLines(legacyNote);
  const expense = await createExpense(managerToken, pid, legacyNote);
  const line = await addLine(managerToken, expense, item, 10);
  const afterLine = await stock(managerToken, item.id);
  const detail = await req('GET', `/v1/expenses/${expense}`, { token: managerToken });
  const beLines = detail.data?.data?.lines ?? detail.data?.lines ?? [];
  const hasBeLines = Array.isArray(beLines) && beLines.length > 0;

  // old = current FE (always reverse legacy note) → reproduces double-return.
  // new = fixed FE (reverse legacy note only when the expense has no BE lines).
  const reversed = [];
  if (mode === 'old' || !hasBeLines) {
    for (const ln of parsed) {
      if (ln.inventoryItemId && Number(ln.actualQty) > 0) {
        const tx = await req('POST', '/v1/inventory/transactions', {
          token: managerToken,
          body: {
            itemId: ln.inventoryItemId,
            projectId: pid,
            type: 'in',
            quantity: Number(ln.actualQty),
            date: TODAY,
            note: `Hoàn kho từ xóa chi phí (${RUN})`,
          },
        });
        reversed.push({ status: tx.status, qty: Number(ln.actualQty) });
      }
    }
  }
  const afterFeReverse = await stock(managerToken, item.id);
  const del = await req('DELETE', `/v1/expenses/${expense}`, { token: managerToken });
  const afterBeDelete = await stock(managerToken, item.id);

  await removeItem(managerToken, item.id);
  return {
    mode,
    itemId: item.id,
    expenseId: expense,
    legacyNote,
    parsedLines: parsed,
    lineStatus: line.status,
    beLineCount: beLines.length,
    beLineQty: beLines.map((l) => l.actualQuantity),
    before,
    afterLine,
    feReverse: reversed,
    afterFeReverse,
    deleteStatus: del.status,
    afterBeDelete,
    expected: before,
    doubleReturned: afterBeDelete !== before,
  };
}

async function main() {
  console.log(`Target: ${API_BASE}`);
  const manager = await login(MANAGER);
  const pid = await projectId(manager.token);
  console.log(`Project: ${pid}`);

  const t10 = {};
  for (const [role, account] of [['manager', MANAGER], ['specialist', SPECIALIST]]) {
    t10[role] = await probeT10(role, account, pid, manager.token);
    console.log(`T10 ${role}: ${JSON.stringify(t10[role])}`);
  }

  const del = {};
  for (const mode of ['old', 'new']) {
    try {
      del[mode] = await probeDelete(pid, manager.token, mode);
    } catch (err) {
      del[mode] = { error: String(err.message || err) };
    }
    console.log(`DELETE ${mode}: ${JSON.stringify(del[mode])}`);
  }

  const out = { ranAt: new Date().toISOString(), apiBase: API_BASE, run: RUN, t10, deleteDoubleReturn: del };
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(dir, 'probe-verify.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${path.join(dir, 'probe-verify.json')}`);
}

await main();
