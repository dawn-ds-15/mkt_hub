import { useRef, useState } from 'react';
import { exportDashboardExcel, importKPIHistory, importClosedDeals } from '../../services/api';

export default function LeadsKPIsFooter() {
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDashboardExcel({ period: 'year', year: String(new Date().getFullYear()) });
    } catch {
      alert('Unable to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importing) return;
    setImporting(true);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', String(new Date().getFullYear()));

    try {
      const res = await importKPIHistory(fd);
      const result = res.data;
      if (result.imported > 0) {
        alert(`Successfully imported ${result.imported} rows!`);
        window.location.reload();
      } else if (result.errors > 0) {
        alert(`Import completed with ${result.errors} errors. Please check the file.`);
      } else {
        alert('No data was imported.');
      }
    } catch {
      alert('Error importing data. Please try again.');
    } finally {
      setImporting(false);
    }

    e.target.value = '';
  };

  return (
    <footer className="bg-white border border-border-light rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-surface-container rounded-full">
          <span className="material-symbols-outlined text-on-surface-variant">help_center</span>
        </div>
        <div>
          <h5 className="text-label-md font-semibold text-on-surface">Import Guide</h5>
          <p className="text-body-sm text-on-surface-variant">
            For questions about Plan allocation or Opportunities status transitions, please refer to the{' '}
            <a className="text-primary hover:underline" href="#">
              User Manual
            </a>.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
        <button
          onClick={handleImportCSV}
          disabled={importing}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import from CSV'}
        </button>
      </div>
    </footer>
  );
}
