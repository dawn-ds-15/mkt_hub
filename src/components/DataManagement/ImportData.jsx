import { useState } from 'react';

export default function ImportData() {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setFileName(file.name);
  };
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx';
    input.onchange = () => {
      if (input.files[0]) setFileName(input.files[0].name);
    };
    input.click();
  };

  const previewData = [
    { id: '#001024', task: 'Digital Campaign Q2', owner: { initials: 'AM', name: 'Alex Miller', color: 'bg-blue-500/20 text-blue-500' }, value: '45,000,000', due: '2024-06-15', status: 'Active' },
    { id: '#001025', task: 'Brand Relaunch Strategy', owner: { initials: 'SK', name: 'Sarah King', color: 'bg-purple-500/20 text-purple-500' }, value: '120,500,000', due: '2024-07-01', status: 'Active' },
    { id: '#001026', task: 'SEO Backlink Audit', owner: { initials: 'JT', name: 'John Tan', color: 'bg-emerald-500/20 text-emerald-500' }, value: '12,200,000', due: '2024-05-30', status: 'Active' },
    { id: '#ERROR', task: '--- Invalid Content ---', owner: null, value: 'NULL', due: '2024/13/45', status: 'Error', error: true },
    { id: '#001027', task: 'Social Media Blitz', owner: { initials: 'RW', name: 'Ray White', color: 'bg-orange-500/20 text-orange-500' }, value: '35,000,000', due: '2024-06-22', status: 'Active' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Import Data</h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">Upload CSV or Excel files to import task history, KPI data, and closed deal records into the workspace.</p>
      </div>

      {/* Configuration Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-wider mb-2">LOẠI DỮ LIỆU</label>
          <div className="relative">
            <select className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all">
              <option>Task History</option>
              <option>KPI History</option>
              <option>Closed Deal History</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
          </div>
        </div>
        <div className="w-40">
          <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-wider mb-2">NĂM DỮ LIỆU</label>
          <div className="relative">
            <select className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all">
              <option>2024</option>
              <option>2023</option>
              <option>2022</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">calendar_month</span>
          </div>
        </div>
        <div className="flex items-center bg-primary-fixed/10 border border-primary-fixed/30 rounded-xl px-4 py-3 gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <p className="text-primary text-xs leading-tight">Vui lòng đảm bảo định dạng file CSV chuẩn UTF-8 để tránh lỗi phông chữ.</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Drag & Drop Zone */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-1 overflow-hidden flex flex-col">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
            className={`flex-1 border-2 border-dashed rounded-[calc(1.5rem-4px)] m-2 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer relative overflow-hidden min-h-[280px] ${
              dragOver ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
            <div className="w-20 h-20 rounded-full bg-primary-fixed/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-5xl">cloud_upload</span>
            </div>
            <div className="text-center z-10">
              {fileName ? (
                <>
                  <h3 className="font-title-md text-title-md text-on-surface mb-1">{fileName}</h3>
                  <p className="text-on-surface-variant text-sm">File ready for import</p>
                </>
              ) : (
                <>
                  <h3 className="font-title-md text-title-md text-on-surface mb-1">Kéo thả file CSV/Excel vào đây</h3>
                  <p className="text-on-surface-variant">hoặc click để chọn tệp từ máy tính của bạn</p>
                </>
              )}
            </div>
            <div className="flex gap-4 mt-2 z-10">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="material-symbols-outlined text-base">description</span> MAX 50MB
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="material-symbols-outlined text-base">table_chart</span> .CSV, .XLSX
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <span className="material-symbols-outlined text-6xl text-success">check_circle</span>
            </div>
            <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-4">TỔNG QUAN XỬ LÝ</label>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-success font-title-md text-2xl">1,248</span>
                  <span className="text-on-surface-variant text-xs">Hợp lệ</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-success w-[92%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-error font-title-md text-2xl">42</span>
                  <span className="text-on-surface-variant text-xs">Lỗi định dạng</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-error w-[8%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col">
            <label className="block text-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">DANH SÁCH LỖI</label>
            <div className="flex-1 space-y-2 pr-2 max-h-[140px] overflow-y-auto">
              <div className="flex items-start gap-3 p-2 rounded-lg bg-error/5 border border-error/10">
                <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
                <div className="text-xs">
                  <p className="text-on-surface font-medium">Dòng 24: Sai định dạng ngày tháng</p>
                  <p className="text-on-surface-variant opacity-70">Giá trị: "2024/13/45"</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg bg-error/5 border border-error/10">
                <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
                <div className="text-xs">
                  <p className="text-on-surface font-medium">Dòng 102: Thiếu trường bắt buộc</p>
                  <p className="text-on-surface-variant opacity-70">Cột: Deal_Value</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
          <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-widest">XEM TRƯỚC DỮ LIỆU (5 DÒNG ĐẦU)</label>
          <span className="text-xs text-on-surface-variant font-medium">
            {fileName || 'CSV_Import_2024_05_22.csv'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant">ID</th>
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant">TASK NAME</th>
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant">OWNER</th>
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant text-right">VALUE (VND)</th>
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant">DUE DATE</th>
                <th className="px-6 py-3 text-xs text-on-surface-variant font-semibold uppercase tracking-wider border-b border-outline-variant">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {previewData.map((row, i) => (
                <tr key={i} className={`${row.error ? 'bg-error/5 hover:bg-error/10' : 'hover:bg-primary/5'} transition-colors`}>
                  <td className={`px-6 py-4 text-sm font-medium ${row.error ? 'text-error' : 'text-on-surface-variant'}`}>{row.id}</td>
                  <td className={`px-6 py-4 text-sm ${row.error ? 'text-error' : 'text-on-surface'}`}>{row.task}</td>
                  <td className="px-6 py-4">
                    {row.owner ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${row.owner.color.split(' ')[0]} flex items-center justify-center text-[10px] ${row.owner.color.split(' ')[1]}`}>
                          {row.owner.initials}
                        </div>
                        <span className="text-sm">{row.owner.name}</span>
                      </div>
                    ) : (
                      <span className="text-error italic text-sm">N/A</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-right text-sm font-medium ${row.error ? 'text-error' : 'text-primary'}`}>{row.value}</td>
                  <td className={`px-6 py-4 text-sm ${row.error ? 'text-error' : 'text-on-surface-variant'}`}>{row.due}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      row.error
                        ? 'bg-error/10 text-error border border-error/20'
                        : 'bg-success/10 text-success border border-success/20'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 bg-surface/80 backdrop-blur-xl border border-outline-variant rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <button className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all px-4 py-2 hover:bg-surface-container-high rounded-xl">
          <span className="material-symbols-outlined">download</span>
          <span className="font-medium text-sm">Download Template</span>
        </button>
        <div className="ml-auto flex gap-4">
          <button className="px-6 py-2.5 text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant hover:border-outline rounded-xl font-medium text-sm">
            Hủy
          </button>
          <button className="px-8 py-2.5 bg-primary text-on-primary font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Xác nhận Import
          </button>
        </div>
      </div>
    </div>
  );
}
