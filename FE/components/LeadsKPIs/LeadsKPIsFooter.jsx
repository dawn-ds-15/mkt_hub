import { useRef } from 'react';

function getAllData() {
  const plans = [];
  const actuals = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('mkt_hub_plan_kpis_')) {
      try { plans.push(JSON.parse(localStorage.getItem(key))); } catch { }
    }
    if (key.startsWith('mkt_hub_actuals_')) {
      try { actuals.push(JSON.parse(localStorage.getItem(key))); } catch { }
    }
  }
  return { plans, actuals };
}

function toCSV(data, filename) {
  if (!data.length) { alert('Không có dữ liệu để xuất!'); return; }
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const v = row[h];
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

export default function LeadsKPIsFooter() {
  const fileInputRef = useRef(null);

  const handleExportExcel = () => {
    const { plans, actuals } = getAllData();
    const rows = [];
    for (const p of plans) {
      rows.push({ Loại: 'Kế hoạch', Năm: p.year, 'Target Leads': p.targetLeads, 'MQL Target': p.mqlTarget, 'SQL Target': p.sqlTarget, 'Số OPP': p.opportunityCount, 'Closed Deal': p.closedDealCount, 'Pipeline Value': p.pipelineValue, 'Won Value': p.wonValue });
    }
    for (const a of actuals) {
      rows.push({ Loại: 'Thực tế', Năm: a.week || '', 'Target Leads': a.rawLeads, 'MQL Target': a.mqlActual, 'SQL Target': a.sqlActual, 'Số OPP': '', 'Closed Deal': '', 'Pipeline Value': '', 'Won Value': '' });
    }
    toCSV(rows, `MKT_Hub_Data_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (!text) return;
      const rows = parseCSV(text);
      let imported = 0;
      for (const row of rows) {
        if (row.Loại === 'Kế hoạch' && row.Năm) {
          const key = `mkt_hub_plan_kpis_${row.Năm}`;
          const existing = JSON.parse(localStorage.getItem(key) || '{}');
          localStorage.setItem(key, JSON.stringify({ ...existing, year: Number(row.Năm), targetLeads: Number(row['Target Leads']) || 0, mqlTarget: Number(row['MQL Target']) || 0, sqlTarget: Number(row['SQL Target']) || 0, opportunityCount: Number(row['Số OPP']) || 0, closedDealCount: Number(row['Closed Deal']) || 0, pipelineValue: Number(row['Pipeline Value']) || 0, wonValue: Number(row['Won Value']) || 0 }));
          imported++;
        } else if (row.Loại === 'Thực tế' && row.Năm) {
          const key = `mkt_hub_actuals_${row.Năm}`;
          const existing = JSON.parse(localStorage.getItem(key) || '{}');
          localStorage.setItem(key, JSON.stringify({ ...existing, week: row.Năm, rawLeads: Number(row['Target Leads']) || 0, mqlActual: Number(row['MQL Target']) || 0, sqlActual: Number(row['SQL Target']) || 0 }));
          imported++;
        }
      }
      alert(`Đã import ${imported} dòng thành công!`);
      window.location.reload();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <footer className="bg-white border border-border-light rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-surface-container rounded-full">
          <span className="material-symbols-outlined text-on-surface-variant">help_center</span>
        </div>
        <div>
          <h5 className="text-label-md font-semibold text-on-surface">Hướng dẫn nhập liệu</h5>
          <p className="text-body-sm text-on-surface-variant">
            Mọi thắc mắc về phân bổ Plan hoặc chuyển đổi trạng thái Opportunities, vui lòng xem{' '}
            <a className="text-primary hover:underline" href="#">
              Tài liệu HDSD
            </a>.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all"
        >
          Xuất File Excel
        </button>
        <button
          onClick={handleImportCSV}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all"
        >
          Nhập từ CSV
        </button>
      </div>
    </footer>
  );
}
