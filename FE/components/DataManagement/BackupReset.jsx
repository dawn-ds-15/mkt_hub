import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getBackupData, createBackup, deleteBackup, resetSandbox, restoreBackup } from '../../services/api';

export default function BackupReset() {
  const { locale } = useDashboard();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetInput, setResetInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await getBackupData();
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await createBackup();
      showToast(locale === 'vi' ? 'Tạo backup thành công' : 'Backup created successfully');
      load();
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi tạo backup' : 'Error creating backup', 'error');
    }
    setCreating(false);
  };

  const handleDeleteBackup = async (id) => {
    if (!window.confirm(locale === 'vi' ? 'Xóa bản sao lưu này?' : 'Delete this backup?')) return;
    setData(prev => prev ? { ...prev, snapshots: (prev.snapshots || []).filter(b => b.id !== id) } : prev);
    try {
      await deleteBackup(id);
      showToast(locale === 'vi' ? 'Đã xóa bản sao lưu' : 'Backup deleted');
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi xóa' : 'Error deleting', 'error');
    }
  };

  const handleRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.json';
    input.onchange = async () => {
      if (!input.files[0]) return;
      const fd = new FormData();
      fd.append('file', input.files[0]);
      try {
        const res = await restoreBackup(fd);
        showToast(res.data.success ? (locale === 'vi' ? 'Khôi phục thành công' : 'Restore successful') : (locale === 'vi' ? 'Khôi phục thất bại' : 'Restore failed'), res.data.success ? 'success' : 'error');
        if (res.data.success) load();
      } catch {
        showToast(locale === 'vi' ? 'Lỗi khi khôi phục' : 'Error restoring', 'error');
      }
    };
    input.click();
  };

  const handleReset = async () => {
    if (resetInput !== 'RESET') return;
    if (!window.confirm(locale === 'vi' ? 'Thao tác này sẽ xóa toàn bộ dữ liệu! Bạn có chắc chắn?' : 'This will delete all data! Are you sure?')) return;
    try {
      const res = await resetSandbox();
      showToast(locale === 'vi' ? `Đã reset sandbox. Xóa ${res.data.removed || 0} bản ghi.` : `Sandbox reset. Deleted ${res.data.removed || 0} records.`);
      setResetInput('');
      load();
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi reset' : 'Error resetting', 'error');
    }
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return locale === 'vi' ? 'Chưa có' : 'None';
    const now = new Date();
    const date = new Date(dateStr);
    const diffH = Math.floor((now - date) / 3600000);
    if (diffH < 1) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    if (diffH < 24) return locale === 'vi' ? `${diffH} giờ trước` : `${diffH}h ago`;
    return locale === 'vi' ? `${Math.floor(diffH / 24)} ngày trước` : `${Math.floor(diffH / 24)} days ago`;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{locale === 'vi' ? 'Sao lưu & Đặt lại' : 'Backup & Reset'}</h2>
          <p className="text-on-surface-variant text-body-md mt-1">{locale === 'vi' ? 'Quản lý ảnh chụp hệ thống và môi trường khôi phục không gian làm việc.' : 'Manage system snapshots and workspace recovery environment.'}</p>
        </div>
        <button onClick={handleCreateBackup} disabled={creating} className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-title-md hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
          <span className="material-symbols-outlined">{creating ? 'sync' : 'cloud_upload'}</span>
          {creating ? (locale === 'vi' ? 'Đang tạo...' : 'Creating...') : (locale === 'vi' ? 'Tạo Sao lưu' : 'Create Backup')}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Snapshot History */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Lịch sử Snapshot' : 'Snapshot History'}</h3>
            <span className="text-primary font-body-md text-sm">{data.snapshots.length} {locale === 'vi' ? 'Bản sao lưu' : 'Backups'} ({data.totalSize})</span>
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
                    <p className="text-on-surface-variant font-body-md text-sm">{item.date} • {item.time} • {item.size}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDeleteBackup(item.id)} className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
            {data.snapshots.length === 0 && (
              <div className="p-8 text-center text-on-surface-variant text-sm">{locale === 'vi' ? 'Chưa có bản sao lưu nào. Nhấn "Tạo Sao lưu" để bắt đầu.' : 'No backups yet. Click "Create Backup" to start.'}</div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Restore Upload */}
          <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center text-center gap-4 hover:border-primary/50 transition-all min-h-[220px] cursor-pointer" onClick={handleRestore}>
            <div className="w-16 h-16 rounded-full bg-primary-fixed/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
            </div>
            <div>
              <p className="font-title-md text-on-surface">{locale === 'vi' ? 'Thả tệp sao lưu vào đây' : 'Drop backup file here'}</p>
              <p className="text-on-surface-variant text-sm mt-1 px-4">{locale === 'vi' ? 'Tải lên tệp .zip hoặc .json từ lần xuất trước để khôi phục.' : 'Upload a .zip or .json file from a previous export to restore.'}</p>
            </div>
            <button className="px-6 py-2 border border-outline text-on-surface hover:bg-surface-container transition-all rounded-lg text-body-md">{locale === 'vi' ? 'Chọn Tệp' : 'Select File'}</button>
          </div>

          {/* Reset Sandbox */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 border-l-4 border-error bg-error/5">
            <h3 className="font-label-md text-label-md text-error uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">warning</span>
              {locale === 'vi' ? 'Đặt lại Sandbox' : 'Reset Sandbox'}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6">
              {locale === 'vi' ? 'Thao tác này sẽ xóa tất cả dữ liệu demo/test. Hành động này' : 'This will delete all demo/test data. This action is'} <span className="text-error font-bold">{locale === 'vi' ? 'không thể hoàn tác' : 'irreversible'}</span>.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-label-md text-on-surface-variant mb-2 block">{locale === 'vi' ? "NHẬP 'RESET' ĐỂ XÁC NHẬN" : "TYPE 'RESET' TO CONFIRM"}</label>
                <input className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-center tracking-[0.3em] focus:ring-2 focus:ring-error focus:outline-none transition-all" placeholder="RESET" value={resetInput} onChange={(e) => setResetInput(e.target.value)} />
              </div>
              <button
                disabled={resetInput !== 'RESET'}
                onClick={handleReset}
                className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${
                  resetInput === 'RESET'
                    ? 'bg-error text-on-error hover:brightness-110 active:scale-95 shadow-lg shadow-error/30'
                    : 'bg-error/10 border border-error/20 text-error/50 cursor-not-allowed'
                }`}
              >{locale === 'vi' ? 'Đặt lại Mặc định' : 'Reset to Default'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary bg-primary-fixed/30 p-2 rounded-lg">history</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">{locale === 'vi' ? 'SAO LƯU GẦN NHẤT' : 'LAST BACKUP'}</p>
            <p className="font-body-md font-semibold">{getRelativeTime(data.lastBackup)}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-success bg-success/10 p-2 rounded-lg">verified</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">{locale === 'vi' ? 'KIỂM TRA TOÀN VẸN' : 'INTEGRITY CHECK'}</p>
            <p className="font-body-md font-semibold">{data.integrityCheck}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary bg-primary-fixed/30 p-2 rounded-lg">storage</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">{locale === 'vi' ? 'DUNG LƯỢNG ĐĨA' : 'DISK USAGE'}</p>
            <p className="font-body-md font-semibold">{data.diskUsage}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-on-surface-variant bg-surface-container-high p-2 rounded-lg">schedule</span>
          <div>
            <p className="text-xs font-label-md text-on-surface-variant opacity-70">{locale === 'vi' ? 'TỰ ĐỘNG CHỤP' : 'AUTO SNAPSHOT'}</p>
            <p className="font-body-md font-semibold">{data.autoSnapshot}</p>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
