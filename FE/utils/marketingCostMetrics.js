// Tiện ích kỳ + won deal dùng để HIỂN THỊ (lọc Won Value theo kỳ, liệt kê won deal trong popup ROAS / CAC).
// Số liệu chi phí / ROAS / CAC / CPMQL / CPSQL do BE tính (/v1/expenses/overview, /v1/dashboard/kpi-cards):
// chi phí dự án lead, won deal xếp kỳ theo NGÀY BẮT ĐẦU của opportunity nguồn (initiationDate).

// Kỳ: { year, type: 'year'|'quarter'|'month'|'week' (ISO), value } → khoảng ngày [from, to] dạng YYYY-MM-DD
export function periodRange({ year, type, value }) {
  const y = Number(year);
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = (m) => new Date(y, m, 0).getDate();
  if (type === 'week') {
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(value) - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }
  if (type === 'month') {
    const m = Number(value);
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(m))}` };
  }
  if (type === 'quarter') {
    const q = Number(value);
    return { from: `${y}-${pad(q * 3 - 2)}-01`, to: `${y}-${pad(q * 3)}-${pad(lastDay(q * 3))}` };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function dealStartDate(deal) {
  return String(deal.initiationDate || deal.opportunity?.initiationDate || deal.opportunityInitiationDate || '').slice(0, 10);
}

// Giá trị won deal cho ROAS = Fees của deal (setupFee), cùng quy tắc với BE (overview / kpi-cards) và card Won.
export function dealValue(deal) {
  return Number(deal.setupFee ?? deal.dealValue) || 0;
}

// Won deal chưa có ngày bắt đầu opp (BE chưa trả) → tạm dùng ngày ký để không mất số liệu
export function dealPeriodDate(deal) {
  return dealStartDate(deal) || String(deal.closedDate || deal.signedDate || '').slice(0, 10);
}
