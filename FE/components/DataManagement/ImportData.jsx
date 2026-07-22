import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { importTasks, importKPIHistory, importClosedDeals, downloadTemplate } from '../../services/api';

export default function ImportData() {
  const { locale } = useDashboard();
  const [dragOver, setDragOver] = useState(false);
  const [dataType, setDataType] = useState('tasks');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); }
  };
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = () => { if (input.files[0]) { setFile(input.files[0]); setResult(null); } };
    input.click();
  };

  const handleImport = async () => {
    if (!file) { showToast(locale === 'vi' ? 'Vui lòng chọn file để import' : 'Please select a file to import', 'error'); return; }
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', year);

    const importers = { tasks: importTasks, kpi: importKPIHistory, deals: importClosedDeals };
    try {
      const res = await importers[dataType](fd);
      setResult(res.data);
      if (res.data.imported > 0) showToast(locale === 'vi' ? `Import thành công ${res.data.imported} dòng` : `Successfully imported ${res.data.imported} rows`);
      if (res.data.errors > 0) showToast(locale === 'vi' ? `${res.data.errors} dòng lỗi` : `${res.data.errors} error rows`, 'error');
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi import dữ liệu' : 'Error importing data', 'error');
    }
    setImporting(false);
  };

  const typeLabel = { tasks: locale === 'vi' ? 'Lịch sử Task' : 'Task History', kpi: locale === 'vi' ? 'Lịch sử KPI' : 'KPI History', deals: locale === 'vi' ? 'Lịch sử Deal đã đóng' : 'Closed Deal History' };
  const typeMap = { tasks: 'tasks', 'Lịch sử Task': 'tasks', kpi: 'kpi', 'Lịch sử KPI': 'kpi', deals: 'deals', 'Lịch sử Deal đã đóng': 'deals' };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{locale === 'vi' ? 'Import Dữ liệu' : 'Import Data'}</h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">{locale === 'vi' ? 'Tải lên tệp CSV hoặc Excel để nhập lịch sử công việc, dữ liệu KPI và hồ sơ deal đã đóng.' : 'Upload CSV or Excel files to import task history, KPI data, and closed deal records.'}</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-wider mb-2">{locale === 'vi' ? 'LOẠI DỮ LIỆU' : 'DATA TYPE'}</label>
          <div className="relative">
            <select value={dataType} onChange={(e) => { setDataType(e.target.value); setResult(null); }} className="w-full bg-surface-container-high text-on-surface border border-outline-variant rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all">
              <option value="tasks">{locale === 'vi' ? 'Lịch sử Task' : 'Task History'}</option>
              <option value="kpi">{locale === 'vi' ? 'Lịch sử KPI' : 'KPI History'}</option>
              <option value="deals">{locale === 'vi' ? 'Lịch sử Deal đã đóng' : 'Closed Deal History'}</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
          </div>
        </div>
        <div className="w-40">
          <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-wider mb-2">{locale === 'vi' ? 'NĂM DỮ LIỆU' : 'DATA YEAR'}</label>
          <div className="relative">
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-surface-container-high text-on-surface border border-outline-variant rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all">
              {[2026, 2025, 2024, 2023, 2022].map(y => <option key={y}>{y}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">calendar_month</span>
          </div>
        </div>
        <div className="flex items-center bg-primary-fixed/10 border border-primary-fixed/30 rounded-xl px-4 py-3 gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <p className="text-primary text-xs leading-tight">{locale === 'vi' ? 'Vui lòng đảm bảo định dạng file CSV chuẩn UTF-8 để tránh lỗi phông chữ.' : 'Please ensure the CSV file uses UTF-8 encoding to avoid font issues.'}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-1 overflow-hidden flex flex-col">
          <div
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={handleFileSelect}
            className={`flex-1 border-2 border-dashed rounded-[calc(1.5rem-4px)] m-2 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer relative overflow-hidden min-h-[280px] ${
              dragOver ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="w-20 h-20 rounded-full bg-primary-fixed/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-5xl">cloud_upload</span>
            </div>
            <div className="text-center z-10">
              {file ? (
                <>
                  <h3 className="font-title-md text-title-md text-on-surface mb-1">{file.name}</h3>
                  <p className="text-on-surface-variant text-sm">{(file.size / 1024).toFixed(1)} KB — {locale === 'vi' ? 'Sẵn sàng import' : 'Ready to import'}</p>
                </>
              ) : (
                <>
                  <h3 className="font-title-md text-title-md text-on-surface mb-1">{locale === 'vi' ? 'Kéo thả file CSV/Excel vào đây' : 'Drag & drop CSV/Excel file here'}</h3>
                  <p className="text-on-surface-variant">{locale === 'vi' ? 'hoặc click để chọn tệp từ máy tính' : 'or click to select a file from your computer'}</p>
                </>
              )}
            </div>
            <div className="flex gap-4 mt-2 z-10">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="material-symbols-outlined text-base">description</span> MAX 10MB
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="material-symbols-outlined text-base">table_chart</span> .CSV, .XLSX
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <span className="material-symbols-outlined text-6xl text-success">check_circle</span>
            </div>
            <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-4">{locale === 'vi' ? 'TỔNG QUAN XỬ LÝ' : 'PROCESS OVERVIEW'}</label>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-success font-title-md text-2xl">{result ? result.imported : '—'}</span>
                  <span className="text-on-surface-variant text-xs">{locale === 'vi' ? 'Hợp lệ' : 'Valid'}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  {result && <div className="h-full bg-success" style={{ width: `${result.imported + result.errors > 0 ? (result.imported / (result.imported + result.errors)) * 100 : 0}%` }} />}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-error font-title-md text-2xl">{result ? result.errors : '—'}</span>
                  <span className="text-on-surface-variant text-xs">{locale === 'vi' ? 'Lỗi' : 'Errors'}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  {result && <div className="h-full bg-error" style={{ width: `${result.imported + result.errors > 0 ? (result.errors / (result.imported + result.errors)) * 100 : 10}%` }} />}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col">
            <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">{locale === 'vi' ? 'DANH SÁCH LỖI' : 'ERROR LIST'}</label>
            <div className="flex-1 space-y-2 pr-2 max-h-[140px] overflow-y-auto">
              {(result?.errorList?.length > 0 ? result.errorList : []).map((err, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-error/5 border border-error/10">
                  <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
                  <div className="text-xs">
                    <p className="text-on-surface font-medium">{err}</p>
                  </div>
                </div>
              ))}
              {(!result || result.errors === 0) && (
                <p className="text-xs text-on-surface-variant italic p-2">{locale === 'vi' ? 'Chưa có lỗi. Import file để xem kết quả.' : 'No errors yet. Import a file to see results.'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-widest">{locale === 'vi' ? 'KẾT QUẢ IMPORT' : 'IMPORT RESULT'}</label>
            <span className="text-xs text-on-surface-variant font-medium">{file?.name}</span>
          </div>
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-success">check_circle</span>
            <p className="font-title-md mt-2">{locale === 'vi' ? `Import thành công ${result.imported} dòng` : `Successfully imported ${result.imported} rows`}</p>
            {result.errors > 0 && <p className="text-error text-sm mt-1">{locale === 'vi' ? `${result.errors} dòng bị lỗi` : `${result.errors} rows with errors`}</p>}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-surface/80 backdrop-blur-xl border border-outline-variant rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <button onClick={() => downloadTemplate(typeMap[dataType] || 'tasks')} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all px-4 py-2 hover:bg-surface-container-high rounded-xl">
          <span className="material-symbols-outlined">download</span>
          <span className="font-medium text-sm">{locale === 'vi' ? 'Tải Template' : 'Download Template'}</span>
        </button>
        <div className="ml-auto flex gap-4">
          <button onClick={() => { setFile(null); setResult(null); }} className="px-6 py-2.5 text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant hover:border-outline rounded-xl font-medium text-sm">
            {locale === 'vi' ? 'Hủy' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-8 py-2.5 bg-primary text-on-primary font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{importing ? 'sync' : 'check_circle'}</span>
            {importing ? (locale === 'vi' ? 'Đang Import...' : 'Importing...') : (locale === 'vi' ? 'Xác nhận Import' : 'Confirm Import')}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
