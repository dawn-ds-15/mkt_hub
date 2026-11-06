/**
 * Probe FE-side workarounds for BUG-1: which create/patch payload keeps stock
 * unchanged when plannedQuantity > 0 and actualQuantity = 0.
 *
 * Only creates/deletes TEST_QA_ records.
 *
 * Usage:
 *   $env:ALLOW_ONRENDER='1'
 *   node tests/expense-inventory/probe-fe-workarounds.mjs
 */
const API_BASE = (process.env.API_BASE_URL || 'https://mkt-hub.onrender.com/api').replace(/\/$/, '');
if (API_BASE.includes('mkt-hub.onrender.com') && process.env.ALLOW_ONRENDER !== '1') {
  console.error('Refusing to run against mkt-hub.onrender.com without ALLOW_ONRENDER=1.');
  process.exit(2);
}
const MANAGER = { email: 'a.nguyen@company.com', password: 'demo123' };
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

async function createExpense(token, pid) {
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
      directNotes: '',
    },
  });
  const id = res.data?.data?.id ?? res.data?.id;
  if (!id) throw new Error(`createExpense: ${res.status} ${JSON.stringify(res.data)}`);
  return id;
}

function baseLine(item) {
  return {
    name: item.name,
    hangMucLon: 'Vật phẩm',
    categoryId: null,
    expenseDate: TODAY,
    inventoryItemId: item.id,
    isCustom: false,
    vatRate: 8,
    unitPriceBeforeVat: 10000,
    unitPriceAfterVat: 10800,
    actualUnitPrice: 10000,
    note: `${PREFIX}probe line`,
  };
}

async function addLine(token, expenseId, body) {
  return req('POST', `/v1/expenses/${expenseId}/lines`, { token, body });
}

async function patchLine(token, lineId, body) {
  return req('PATCH', `/v1/expenses/lines/${lineId}`, { token, body });
}

async function txList(token, itemId) {
  const res = await req('GET', `/v1/inventory/transactions?itemId=${itemId}`, { token });
  const list = res.data?.data ?? res.data;
  const arr = Array.isArray(list) ? list : (Array.isArray(list?.items) ? list.items : []);
  return arr.map((t) => ({ type: t.type, qty: t.quantity, note: t.note }));
}

async function runVariant(label, token, pid, item, buildBody, onCreate) {
  let expense = null;
  try {
    expense = await createExpense(token, pid);
    const before = await stock(token, item.id);
    const create = await addLine(token, expense, buildBody(item));
    const afterCreate = await stock(token, item.id);
    let patch = null;
    let afterPatch = null;
    if (onCreate) {
      patch = await onCreate(create, item);
      afterPatch = await stock(token, item.id);
    }
    return {
      label,
      createStatus: create.status,
      created: create.data?.data ?? create.data,
      before,
      afterCreate,
      patch: patch ? { status: patch.status, body: patch.body, data: patch.data } : null,
      afterPatch,
      transactions: await txList(token, item.id),
    };
  } finally {
    if (expense) {
      try { await req('DELETE', `/v1/expenses/${expense}`, { token }); } catch { /* ignore */ }
    }
  }
}

const manager = await login(MANAGER);
const pid = await projectId(manager.token);
console.log(`Target: ${API_BASE}\nProject: ${pid}\nRun: ${RUN}`);

const variants = [];
const cases = [
  {
    label: 'baseline planned=25 actual=0',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: 0 }),
  },
  {
    label: 'actual omitted, planned=25',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25 }),
  },
  {
    label: 'actual=null, planned=25',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: null }),
  },
  {
    label: 'planned=0 actual=0, then PATCH plannedQuantity=25',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 0, actualQuantity: 0 }),
    afterCreate: async (create) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { plannedQuantity: 25 });
    },
    patchBody: { plannedQuantity: 25 },
  },
  {
    label: 'planned=25 actual=0, then PATCH actualQuantity=0',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: 0 }),
    afterCreate: async (create) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { actualQuantity: 0 });
    },
    patchBody: { actualQuantity: 0 },
  },
  {
    label: 'planned=25 actual=0, then PATCH plannedQuantity=0',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: 0 }),
    afterCreate: async (create) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { plannedQuantity: 0 });
    },
    patchBody: { plannedQuantity: 0 },
  },
  {
    label: 'planned=25 actual=0 skipStockCheck=true',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: 0, skipStockCheck: true }),
  },
  {
    label: 'planned=25 actual=0 isCustom=true + inventoryItemId',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 25, actualQuantity: 0, isCustom: true }),
  },
  {
    label: 'create custom planned=25 actual=0, then PATCH inventoryItemId',
    body: (item) => ({ ...baseLine(item), inventoryItemId: null, plannedQuantity: 25, actualQuantity: 0, isCustom: true }),
    afterCreate: async (create, item) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { inventoryItemId: item.id, isCustom: false });
    },
    patchBody: { inventoryItemId: '<item>', isCustom: false },
  },
  {
    label: 'planned=0 actual=0, then PATCH plannedAmount=270000',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 0, actualQuantity: 0 }),
    afterCreate: async (create) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { plannedAmount: 270000 });
    },
    patchBody: { plannedAmount: 270000 },
  },
  {
    label: 'planned=0 actual=0, then PATCH plannedQuantity=0 + plannedAmount=270000',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 0, actualQuantity: 0 }),
    afterCreate: async (create) => {
      const id = create.data?.data?.id ?? create.data?.id;
      return patchLine(manager.token, id, { plannedQuantity: 0, plannedAmount: 270000 });
    },
    patchBody: { plannedQuantity: 0, plannedAmount: 270000 },
  },
  {
    label: 'FE WORKAROUND one-shot: plannedQuantity=0 actual=0 plannedAmount=270000',
    body: (item) => ({ ...baseLine(item), plannedQuantity: 0, actualQuantity: 0, plannedAmount: 270000 }),
  },
];

for (let i = 0; i < cases.length; i += 1) {
  const c = cases[i];
  const item = await createItem(manager.token, `FE_WA_${i}`);
  try {
    const result = await runVariant(c.label, manager.token, pid, item, c.body, c.afterCreate);
    variants.push({ ...result, patchBody: c.patchBody || null });
    console.log(JSON.stringify(variants[variants.length - 1]));
  } catch (err) {
    variants.push({ label: c.label, error: String(err.message || err) });
    console.log(JSON.stringify(variants[variants.length - 1]));
  } finally {
    try { await req('DELETE', `/v1/inventory/items/${item.id}`, { token: manager.token }); } catch { /* ignore */ }
  }
}

console.log('\nSUMMARY');
for (const v of variants) {
  if (v.error) { console.log(`${v.label}: ERROR ${v.error}`); continue; }
  console.log(`${v.label}: create=${v.createStatus} stock ${v.before}->${v.afterCreate}${v.patch ? `; patch=${v.patch.status} (${JSON.stringify(v.patchBody)}) stock->${v.afterPatch}` : ''}; tx=${JSON.stringify(v.transactions)}`);
}
