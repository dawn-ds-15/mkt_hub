import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { exportWeeklyReportPDF, exportDashboardExcel, exportFullData } from '../../services/api';

export default function ExportData() {
  const { locale } = useDashboard();
  const [reportPeriod, setReportPeriod] = useState('Hàng tháng');
  const [week, setWeek] = useState(29);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const periods = ['Hàng tháng', 'Hàng quý', 'Hàng tuần', 'Hàng năm'];
  const periodMap = { 'Hàng tháng': 'month', 'Hàng quý': 'quarter', 'Hàng tuần': 'week', 'Hàng năm': 'year' };
  const periodLabel = (p) => locale === 'vi' ? p : { 'Hàng tháng': 'Monthly', 'Hàng quý': 'Quarterly', 'Hàng tuần': 'Weekly', 'Hàng năm': 'Yearly' }[p] || p;

  const showToast = (msg, type = 'success') => {
    const el = document.createElement('div');
    el.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold ${type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  const handleExport = async (type) => {
    if (exporting) return;
    setExporting(true);
    try {
      if (type === 'pdf') {
        await exportWeeklyReportPDF({ week, year, project: 'all' });
        showToast(locale === 'vi' ? 'Xuất PDF thành công' : 'PDF exported successfully');
      } else if (type === 'excel') {
        await exportDashboardExcel({ period: periodMap[reportPeriod] || 'year', year });
        showToast(locale === 'vi' ? 'Xuất Excel thành công' : 'Excel exported successfully');
      } else if (type === 'full') {
        await exportFullData();
        showToast(locale === 'vi' ? 'Xuất toàn bộ dữ liệu thành công' : 'All data exported successfully');
      }
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Lỗi không xác định' : 'Unknown error');
      showToast(`${locale === 'vi' ? 'Xuất thất bại:' : 'Export failed:'} ${msg}`, 'error');
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{locale === 'vi' ? 'Xuất dữ liệu' : 'Export Data'}</h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">{locale === 'vi' ? 'Tạo và tải xuống báo cáo hiệu suất, dữ liệu thô và ảnh chụp nhanh bảng điều khiển để phân tích bên ngoài.' : 'Generate and download performance reports, raw data, and dashboard snapshots for external analysis.'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Section 1: Weekly Report PDF */}
        <section className="md:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
                <span className="material-symbols-outlined">picture_as_pdf</span>
              </div>
              <div>
                <h3 className="font-title-md text-title-md">{locale === 'vi' ? 'Báo cáo hàng tuần' : 'Weekly Report'}</h3>
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Định dạng tài liệu • PDF' : 'Document Format • PDF'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? 'CHỌN TUẦN & NĂM' : 'SELECT WEEK & YEAR'}</label>
              <div className="flex gap-2">
                <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="flex-1 bg-surface-container-low text-body-md border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                  {Array.from({ length: 53 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{locale === 'vi' ? `Tuần ${w}` : `Week ${w}`}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-24 bg-surface-container-low text-body-md border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                  {[2026, 2025, 2024, 2023].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? 'DỰ ÁN' : 'PROJECT'}</label>
              <select className="w-full bg-surface-container-low text-body-md border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                <option>{locale === 'vi' ? 'Tất cả dự án' : 'All projects'}</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? 'THÀNH VIÊN' : 'MEMBER'}</label>
              <select className="w-full bg-surface-container-low text-body-md border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                <option>{locale === 'vi' ? 'Tất cả thành viên' : 'All members'}</option>
              </select>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant italic">{locale === 'vi' ? 'Kích thước ước tính: ~2.4MB' : 'Estimated size: ~2.4MB'}</p>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-on-surface-variant font-title-md text-sm py-3 px-6 rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
              {exporting ? (locale === 'vi' ? 'Đang xuất...' : 'Exporting...') : (locale === 'vi' ? 'Xuất PDF' : 'Export PDF')}
            </button>
          </div>
        </section>

        {/* Section 2: Dashboard Report Excel */}
        <section className="md:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>
            </div>
              <div>
                <h3 className="font-title-md text-title-md">{locale === 'vi' ? 'Báo cáo Dashboard' : 'Dashboard Report'}</h3>
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Bảng tính • XLSX' : 'Spreadsheet • XLSX'}</span>
              </div>
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? 'KỲ BÁO CÁO' : 'REPORT PERIOD'}</label>
              <div className="grid grid-cols-2 gap-2">
                {periods.map((p) => (
                  <button key={p} onClick={() => setReportPeriod(p)}
                    className={`py-2 px-3 rounded-lg text-xs font-title-md text-center transition-all ${
                      reportPeriod === p
                        ? 'bg-primary-fixed/20 border border-primary/30 text-primary'
                        : 'bg-primary text-white border border-primary text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >{periodLabel(p)}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? 'NĂM TÀI CHÍNH' : 'FISCAL YEAR'}</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-surface-container-low text-body-md border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary transition-all">
                <option>2026</option>
                <option>2025</option>
                <option>2024</option>
              </select>
            </div>
          </div>
          <button onClick={() => handleExport('excel')} disabled={exporting} className="mt-6 w-full bg-success text-on-primary font-title-md text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            {exporting ? (locale === 'vi' ? 'Đang xuất...' : 'Exporting...') : (locale === 'vi' ? 'Xuất Excel' : 'Export Excel')}
          </button>
        </section>

        {/* Section 3: System Archive & Backup */}
        <section className="md:col-span-12 bg-surface-container-lowest border-2 border-primary/10 rounded-xl p-8 relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-fixed/30 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">{locale === 'vi' ? 'Lưu trữ & Sao lưu Hệ thống' : 'System Archive & Backup'}</h3>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-primary uppercase bg-primary-fixed/20 px-2 py-0.5 rounded font-semibold">{locale === 'vi' ? 'Toàn bộ hệ thống' : 'Full System'}</span>
                    <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-xs">verified_user</span> {locale === 'vi' ? 'CHỈ ADMIN' : 'ADMIN ONLY'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-body-md text-on-surface-variant max-w-xl leading-relaxed">
                {locale === 'vi' ? 'Xuất toàn bộ hệ thống bao gồm dữ liệu không gian làm việc, tương tác nhóm, nhật ký lịch sử và cấu hình tùy chỉnh.' : 'Export the entire system including workspace data, team interactions, history logs, and custom configurations.'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
                  <span className="material-symbols-outlined text-[14px]">storage</span> {locale === 'vi' ? 'Ước tính 450 MB' : 'Estimated 450 MB'}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => handleExport('full')}
                disabled={exporting}
                className={`w-full md:w-64 font-title-md text-lg py-5 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all relative overflow-hidden ${
                  exported ? 'bg-success text-on-primary' : 'bg-primary text-on-primary hover:scale-[1.02] active:scale-[0.98]'
                } disabled:opacity-50`}
              >
                <span className="material-symbols-outlined text-2xl">{exporting ? 'sync' : exported ? 'check_circle' : 'package_2'}</span>
                <span>{exporting ? (locale === 'vi' ? 'Đang xử lý...' : 'Processing...') : exported ? (locale === 'vi' ? 'Sẵn sàng tải xuống' : 'Ready to download') : (locale === 'vi' ? 'Xuất toàn bộ dữ liệu' : 'Export All Data')}</span>
              </button>
              <p className="text-[10px] text-on-surface-variant opacity-50 text-center uppercase tracking-wider">GÓI JSON</p>
            </div>
          </div>
        </section>

        <div className="md:col-span-12 bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-4 flex items-center justify-center gap-4 flex-wrap">
          <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-error/20 bg-error/5 hover:bg-error/10 text-error font-bold text-sm transition-all active:scale-95 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            PDF
          </button>
          <button onClick={() => handleExport('excel')} disabled={exporting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-success/20 bg-success/5 hover:bg-success/10 text-success font-bold text-sm transition-all active:scale-95 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>
            XLSX
          </button>
          <button onClick={() => handleExport('full')} disabled={exporting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning font-bold text-sm transition-all active:scale-95 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">inventory_2</span>
            JSON
          </button>
          <span className="text-xs text-on-surface-variant ml-2">{exporting ? (locale === 'vi' ? 'Đang xuất...' : 'Exporting...') : exported ? (locale === 'vi' ? 'Xuất thành công!' : 'Export successful!') : (locale === 'vi' ? 'Chọn định dạng để xuất dữ liệu' : 'Select format to export data')}</span>
        </div>
      </div>
    </div>
  );
}
