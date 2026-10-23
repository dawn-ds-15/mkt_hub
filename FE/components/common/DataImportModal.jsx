import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { importKPIHistory, importClosedDeals, downloadTemplate } from '../../services/api';

// Import dữ liệu ngay tại module cần dùng (feedback 26/09 T07 — bỏ tab Import riêng ở Quản lý dữ liệu).
// type: 'kpi' (lịch sử KPI) | 'deals' (lịch sử won deal)
const IMPORTERS = { kpi: importKPIHistory, deals: importClosedDeals };
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function DataImportModal({ type, onClose, onImported }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const title = type === 'kpi' ? t('Import lịch sử KPI', 'Import KPI history') : t('Import won deal', 'Import won deals');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !importing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, importing]);

  const pick = (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) { setError(t('Chỉ nhận file CSV / Excel', 'Only CSV / Excel files')); return; }
    if (f.size > 10 * 1024 * 1024) { setError(t('File tối đa 10MB', 'File must be 10MB or smaller')); return; }
    setError('');
    setResult(null);
    setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', year);
    try {
      const res = await IMPORTERS[type](fd);
      setResult(res.data);
      if (res.data.imported > 0 && onImported) onImported(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
      setError(`${t('Import thất bại', 'Import failed')}${msg ? `: ${Array.isArray(msg) ? msg.join('; ') : msg}` : ''}`);
    } finally {
      setImporting(false);
    }
  };

  const errorList = Array.isArray(result?.errorList) ? result.errorList : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !importing && onClose()}>
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
          <h3 className="text-base font-bold text-on-surface">{title}</h3>
          <button onClick={onClose} disabled={importing} className="p-1 rounded hover:bg-surface-container-low text-on-surface-variant" aria-label={t('Đóng', 'Close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-[12px] font-medium text-on-surface-variant">
              {t('Năm dữ liệu', 'Data year')}
              <select value={year} onChange={(e) => setYear(e.target.value)} className="border border-border-light rounded-lg px-3 py-2 text-[13px] text-on-surface bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={() => downloadTemplate(type)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-primary hover:bg-primary/10 rounded-lg"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t('Tải file mẫu', 'Download template')}
            </button>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
            className={`border-2 border-dashed rounded-xl px-4 py-8 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <span className="material-symbols-outlined text-[40px] text-primary">cloud_upload</span>
            {file ? (
              <>
                <p className="text-[14px] font-semibold text-on-surface break-all">{file.name}</p>
                <p className="text-[12px] text-on-surface-variant">{(file.size / 1024).toFixed(1)} KB · {t('bấm để đổi file', 'click to change')}</p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-on-surface">{t('Kéo thả file CSV / Excel vào đây', 'Drop a CSV / Excel file here')}</p>
                <p className="text-[12px] text-on-surface-variant">{t('hoặc bấm để chọn file · tối đa 10MB · CSV dùng UTF-8', 'or click to pick · max 10MB · UTF-8 CSV')}</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          {result && (
            <div className="rounded-lg border border-border-light p-3 space-y-2">
              <p className="text-[13px] text-on-surface">
                <span className="font-semibold text-success">{t(`${result.imported} dòng hợp lệ`, `${result.imported} rows imported`)}</span>
                {result.errors > 0 && <span className="font-semibold text-danger"> · {t(`${result.errors} dòng lỗi`, `${result.errors} error rows`)}</span>}
              </p>
              {errorList.length > 0 && (
                <ul className="max-h-32 overflow-y-auto space-y-1 text-[12px] text-on-surface-variant">
                  {errorList.map((e, i) => <li key={i} className="flex gap-1.5"><span className="material-symbols-outlined text-[14px] text-danger">error</span>{String(e)}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border-light flex justify-end gap-2">
          <button onClick={onClose} disabled={importing} className="px-4 py-2 border border-border-light rounded-lg text-[13px] font-medium hover:bg-surface-container-low">
            {result ? t('Đóng', 'Close') : t('Hủy', 'Cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-[13px] font-bold hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <span className={`material-symbols-outlined text-[18px] ${importing ? 'animate-spin' : ''}`}>{importing ? 'sync' : 'upload'}</span>
            {importing ? t('Đang import...', 'Importing...') : t('Import', 'Import')}
          </button>
        </div>
      </div>
    </div>
  );
}
