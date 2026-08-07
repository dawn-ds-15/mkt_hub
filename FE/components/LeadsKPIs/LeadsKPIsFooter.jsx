import { useRef, useState } from 'react';
import { exportDashboardExcel, importKPIHistory, importClosedDeals } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';

export default function LeadsKPIsFooter() {
  const { locale } = useDashboard();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDashboardExcel({ period: 'year', year: String(new Date().getFullYear()) });
    } catch {
      alert(locale === 'vi' ? 'Không thể xuất dữ liệu. Vui lòng thử lại.' : 'Unable to export data. Please try again.');
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
        alert(locale === 'vi' ? `Đã import thành công ${result.imported} dòng!` : `Successfully imported ${result.imported} rows!`);
        window.location.reload();
      } else if (result.errors > 0) {
        alert(locale === 'vi' ? `Import hoàn tất với ${result.errors} lỗi. Vui lòng kiểm tra file.` : `Import completed with ${result.errors} errors. Please check the file.`);
      } else {
        alert(locale === 'vi' ? 'Không có dữ liệu được import.' : 'No data was imported.');
      }
    } catch {
      alert(locale === 'vi' ? 'Lỗi khi import dữ liệu. Vui lòng thử lại.' : 'Error importing data. Please try again.');
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
          <h5 className="text-label-md font-semibold text-on-surface">{locale === 'vi' ? 'Hướng dẫn Import' : 'Import Guide'}</h5>
          <p className="text-body-sm text-on-surface-variant">
            {locale === 'vi'
              ? <>Nếu có thắc mắc về phân bổ Kế hoạch hoặc chuyển trạng thái Cơ hội, vui lòng tham khảo{' '}
                <a className="text-primary hover:underline" href="#">Sổ tay người dùng</a>.</>
              : <>For questions about Plan allocation or Opportunities status transitions, please refer to the{' '}
                <a className="text-primary hover:underline" href="#">User Manual</a>.</>}
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
          {exporting ? (locale === 'vi' ? 'Đang xuất...' : 'Exporting...') : (locale === 'vi' ? 'Xuất Excel' : 'Export Excel')}
        </button>
        <button
          onClick={handleImportCSV}
          disabled={importing}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
        >
          {importing ? (locale === 'vi' ? 'Đang nhập...' : 'Importing...') : (locale === 'vi' ? 'Nhập từ CSV' : 'Import from CSV')}
        </button>
      </div>
    </footer>
  );
}
