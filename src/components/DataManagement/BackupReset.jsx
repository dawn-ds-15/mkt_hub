import { useEffect, useState } from 'react';
import { getBackupData } from '../../services/api';

export default function BackupReset() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetInput, setResetInput] = useState('');

  useEffect(() => {
    getBackupData().then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, []);

  const getRelativeTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffH = Math.floor((now - date) / 3600000);
    if (diffH < 1) return 'Vừa xong';
    if (diffH < 24) return `${diffH} giờ trước`;
    return `${Math.floor(diffH / 24)} ngày trước`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Sao lưu & Đặt lại</h2>
          <p className="text-on-surface-variant text-body-md mt-1">Quản lý ảnh chụp hệ thống và môi trường khôi phục không gian làm việc.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-title-md hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined">cloud_upload</span>
          Tạo Sao lưu
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Snapshot History */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Lịch sử Snapshot</h3>
            <span className="text-primary font-body-md text-sm">{data.snapshots.length} Bản sao lưu ({data.totalSize})</span>
          </div>
          <div className="flex flex-col gap-3">
            {data.snapshots.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant rounded-xl hover:bg-surface-container transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">folder_zip</span>
                  </div>
                  <div>
                    <p className="font-title-md text-on-surface">{item.name}</p>
                    <p className="text-on-surface-variant font-body-md text-sm">
                      {item.date} • {item.time} • {item.size} • <span className="text-success">Đã xác minh</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all" title="Download">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                  <button className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all" title="Delete">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 flex justify-center border-t border-outline-variant">
            <button className="text-on-surface-variant hover:text-primary text-body-md flex items-center gap-1 transition-all underline underline-offset-4 decoration-primary/30">
              Xem Tất cả Snapshot Đã lưu
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Restore Upload */}
          <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center text-center gap-4 hover:border-primary/50 transition-all min-h-[220px]">
            <div className="w-16 h-16 rounded-full bg-primary-fixed/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
            </div>
            <div>
              <p className="font-title-md text-on-surface">Thả tệp sao lưu vào đây</p>
              <p className="text-on-surface-variant text-sm mt-1 px-4">Tải lên tệp .zip từ lần xuất trước để khôi phục trạng thái không gian làm việc.</p>
            </div>
            <button className="px-6 py-2 border border-outline text-on-surface hover:bg-surface-container transition-all rounded-lg text-body-md">
              Chọn Tệp
            </button>
          </div>

          {/* Reset Sandbox */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 border-l-4 border-error bg-error/5">
            <h3 className="font-label-md text-label-md text-error uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">warning</span>
              Đặt lại Sandbox
            </h3>
            <p className="text-on-surface-variant text-sm mb-6">
              Thao tác này sẽ xóa tất cả dữ liệu chiến dịch marketing, lịch sử lead và cấu hình không gian làm việc trong môi trường sandbox. Hành động này <span className="text-error font-bold">không thể hoàn tác</span>.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-label-md text-on-surface-variant mb-2 block">NHẬP 'RESET' ĐỂ XÁC NHẬN</label>
                <input
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-center tracking-[0.3em] focus:ring-2 focus:ring-error focus:outline-none transition-all"
                  placeholder="RESET"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                />
              </div>
              <button
                disabled={resetInput !== 'RESET'}
                className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${
                  resetInput === 'RESET'
                    ? 'bg-error text-on-error hover:brightness-110 active:scale-95 shadow-lg shadow-error/30'
                    : 'bg-error/10 border border-error/20 text-error/50 cursor-not-allowed'
                }`}
              >
                Đặt lại Mặc định
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary bg-primary-fixed/30 p-2 rounded-lg">history</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">SAO LƯU GẦN NHẤT</p>
            <p className="font-body-md font-semibold">{getRelativeTime(data.lastBackup)}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-success bg-success/10 p-2 rounded-lg">verified</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">KIỂM TRA TOÀN VẸN</p>
            <p className="font-body-md font-semibold">{data.integrityCheck}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary bg-primary-fixed/30 p-2 rounded-lg">storage</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">DUNG LƯỢNG ĐĨA</p>
            <p className="font-body-md font-semibold">{data.diskUsage}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-on-surface-variant bg-surface-container-high p-2 rounded-lg">schedule</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">TỰ ĐỘNG CHỤP</p>
            <p className="font-body-md font-semibold">{data.autoSnapshot}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
