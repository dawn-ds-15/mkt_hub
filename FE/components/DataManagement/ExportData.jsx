import { useState } from 'react';

export default function ExportData() {
  const [reportPeriod, setReportPeriod] = useState('Monthly');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const periods = ['Hàng tháng', 'Hàng quý', 'Hàng tuần', 'Hàng năm'];

  const simulateExport = () => {
    if (exporting) return;
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Export Dữ liệu</h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">Tạo và tải xuống các báo cáo hiệu suất, dữ liệu thô và ảnh chụp dashboard để phân tích bên ngoài.</p>
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
                <h3 className="font-title-md text-title-md">Báo cáo Tuần</h3>
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">Định dạng Tài liệu • PDF</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">CHỌN TUẦN & NĂM</label>
              <div className="flex gap-2">
                <select className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                  <option>Tuần 42</option>
                  <option>Tuần 41</option>
                  <option>Tuần 40</option>
                </select>
                <select className="w-24 bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                  <option>2023</option>
                  <option>2024</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">DANH MỤC DỰ ÁN</label>
              <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                <option>Tất cả Dự án</option>
                <option>Tăng trưởng Q4</option>
                <option>Retention Beta</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">THÀNH VIÊN</label>
              <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary focus:border-primary transition-all">
                <option>Toàn bộ Nhóm</option>
                <option>Design Ops</option>
                <option>Chiến lược</option>
              </select>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant italic">Dung lượng ước tính: ~2.4MB</p>
            <button className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-on-surface-variant font-title-md text-sm py-3 px-6 rounded-xl flex items-center gap-2 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
              Xuất PDF
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
              <h3 className="font-title-md text-title-md">Báo cáo Dashboard</h3>
              <span className="text-xs text-on-surface-variant uppercase tracking-wider">Bảng tính • XLSX</span>
            </div>
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">KỲ BÁO CÁO</label>
              <div className="grid grid-cols-2 gap-2">
                {periods.map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`py-2 px-3 rounded-lg text-xs font-title-md text-center transition-all ${
                      reportPeriod === p
                        ? 'bg-primary-fixed/20 border border-primary/30 text-primary'
                        : 'bg-surface-container-low border border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">NĂM TÀI CHÍNH</label>
              <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-primary transition-all">
                <option>2024 (Hiện tại)</option>
                <option>2023</option>
                <option>2022</option>
              </select>
            </div>
          </div>
          <button className="mt-6 w-full bg-success text-on-primary font-title-md text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            Xuất Excel
          </button>
        </section>

        {/* Section 3: System Archive & Backup */}
        <section className="md:col-span-12 bg-surface-container-lowest border-2 border-primary/10 rounded-xl p-8 relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-fixed/30 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">Lưu trữ & Sao lưu Hệ thống</h3>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-primary uppercase bg-primary-fixed/20 px-2 py-0.5 rounded font-semibold">Toàn bộ Hệ thống</span>
                    <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-xs">verified_user</span>
                      CHỈ QUẢN LÝ
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-body-md text-on-surface-variant max-w-xl leading-relaxed">
                Thực hiện xuất toàn bộ hệ thống bao gồm dữ liệu không gian làm việc, tương tác nhóm, nhật ký lịch sử và cấu hình tùy chỉnh. Thao tác này tạo một kho lưu trữ JSON nén để khôi phục thảm họa hoặc di chuyển không gian làm việc.
              </p>
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
                  <span className="material-symbols-outlined text-[14px]">storage</span>
                  Ước tính 450 MB
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  Sao lưu gần nhất: 2 ngày trước
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 w-full md:w-auto">
              <button
                onClick={simulateExport}
                disabled={exporting}
                className={`w-full md:w-64 font-title-md text-lg py-5 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all relative overflow-hidden ${
                  exported
                    ? 'bg-success text-on-primary'
                    : 'bg-primary text-on-primary hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {exporting && (
                  <div className="absolute inset-0 bg-primary-container transition-all duration-[3000ms] ease-out w-full" />
                )}
                <span className="material-symbols-outlined text-2xl relative z-10">
                  {exporting ? 'sync' : exported ? 'check_circle' : 'package_2'}
                </span>
                <span className="relative z-10">
                  {exporting ? 'Đang xử lý...' : exported ? 'Sẵn sàng Tải xuống' : 'Xuất Toàn bộ Dữ liệu'}
                </span>
              </button>
              <p className="text-[10px] text-on-surface-variant opacity-50 text-center uppercase tracking-wider">ĐÓNG GÓI MÃ HÓA AES-256</p>
            </div>
          </div>
        </section>

        {/* Preview Card */}
        <div className="md:col-span-12 bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-4 flex items-center justify-center gap-6">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary-fixed/30 flex items-center justify-center text-[10px] font-bold">PDF</div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-success/20 flex items-center justify-center text-[10px] font-bold">XLS</div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-[#ffb59c]/20 flex items-center justify-center text-[10px] font-bold">JSON</div>
          </div>
          <p className="text-sm text-on-surface-variant">Chọn một module ở trên để khởi tạo luồng dữ liệu xuất. Tất cả các lần xuất đều được ghi lại để tuân thủ.</p>
        </div>
      </div>
    </div>
  );
}
