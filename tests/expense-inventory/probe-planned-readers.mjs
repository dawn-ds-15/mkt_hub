/**
 * Audit probe: do BE aggregates used by budget/overview/project detail still
 * count a line saved with plannedQuantity = 0 + plannedAmount (BUG-1 workaround)?
 *
 * Usage:
 *   $env:ALLOW_ONRENDER='1'
 *   $env:PROJECT_ID='...'   # optional
 *   node tests/expense-inventory/probe-planned-readers.mjs
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
const YEAR = String(new Date().getFullYear());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, endpoint, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await sleep(attempt * 1500);
        continue;
      }
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
  return res.data.access_token;
}

async function projectId(token) {
  if (process.env.PROJECT_ID) return process.env.PROJECT_ID;
  const res = await req('GET', '/v1/projects', { token });
  const list = Array.isArray(res.data) ? res.data : res.data?.data;
  return list[0].id;
}

async function createItem(token, stock = 100) {
  const res = await req('POST', '/v1/inventory/items', {
    token,
    body: {
      code: `TQA-PLAN-${RUN}`.toUpperCase(),
      name: `${PREFIX}PLAN_READER_${RUN}`,
      category: 'gift',
      unit: 'pcs',
      batchCode: `TQA-PLAN-B-${RUN}`.toUpperCase(),
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
  if (!item?.id) throw new Error(`createItem: ${res.status} ${JSON.stringify(res.data)}`);
  return item;
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

async function addWorkaroundLine(token, expenseId, item) {
  return req('POST', `/v1/expenses/${expenseId}/lines`, {
    token,
    body: {
      name: item.name,
      hangMucLon: 'Vật phẩm',
      categoryId: null,
      expenseDate: TODAY,
      inventoryItemId: item.id,
      isCustom: false,
      plannedQuantity: 0,
      actualQuantity: 0,
      plannedAmount: 270000,
      vatRate: 8,
      unitPriceBeforeVat: 10000,
      unitPriceAfterVat: 10800,
      actualUnitPrice: 10000,
      note: `${PREFIX}planned reader probe`,
    },
  });
}

async function projectSummary(token, pid) {
  const res = await req('GET', `/v1/projects/${pid}/expense-summary`, { token });
  return { status: res.status, data: res.data?.data ?? res.data };
}

async function overview(token, pid) {
  const res = await req('GET', `/v1/expenses/overview?period=${YEAR}&projectId=${pid}`, { token });
  const data = res.data?.data ?? res.data;
  const row = (Array.isArray(data?.projects) ? data.projects : []).find((p) => p.projectId === pid) || null;
  return { status: res.status, row };
}

async function cleanup(token, pid, itemId, expenseId) {
  if (expenseId) {
    try { await req('DELETE', `/v1/expenses/${expenseId}`, { token }); } catch { /* ignore */ }
  }
  if (itemId) {
    try { await req('DELETE', `/v1/inventory/items/${itemId}`, { token }); } catch { /* ignore */ }
  }
}

const token = await login(MANAGER);
const pid = await projectId(token);
let item = null;
let expense = null;
try {
  const summaryBefore = await projectSummary(token, pid);
  const overviewBefore = await overview(token, pid);

  item = await createItem(token);
  expense = await createExpense(token, pid);
  const line = await addWorkaroundLine(token, expense, item);

  const summaryAfter = await projectSummary(token, pid);
  const overviewAfter = await overview(token, pid);

  const result = {
    ranAt: new Date().toISOString(),
    apiBase: API_BASE,
    run: RUN,
    projectId: pid,
    lineStatus: line.status,
    line: line.data?.data ?? line.data,
    projectExpenseSummary: {
      before: summaryBefore,
      after: summaryAfter,
      plannedDelta: Number(summaryAfter.data?.plannedBeforeVat) - Number(summaryBefore.data?.plannedBeforeVat),
      actualDelta: Number(summaryAfter.data?.actualBeforeVat) - Number(summaryBefore.data?.actualBeforeVat),
    },
    expenseOverview: {
      before: overviewBefore,
      after: overviewAfter,
      plannedDelta: Number(overviewAfter.row?.plannedTotal ?? overviewAfter.row?.budgetTotal) - Number(overviewBefore.row?.plannedTotal ?? overviewBefore.row?.budgetTotal),
      actualDelta: Number(overviewAfter.row?.actualTotal) - Number(overviewBefore.row?.actualTotal),
    },
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await cleanup(token, pid, item?.id, expense);
}
