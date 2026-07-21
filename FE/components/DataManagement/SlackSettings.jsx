import { useEffect, useState, useCallback } from 'react';
import { getSlackSettings, saveSlackSettings, testSlackWebhook, getSlackNotificationHistory } from '../../services/api';

export default function SlackSettings() {
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('mkt-alerts');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('08:00');
  const [notifyDays, setNotifyDays] = useState(3);
  const [days, setDays] = useState({ monFri: true, sat: true, sun: false });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [sRes, hRes] = await Promise.all([getSlackSettings(), getSlackNotificationHistory()]);
      const s = sRes.data;
      setSettings(s);
      setWebhookUrl(s.webhookUrl || '');
      setChannel(s.channel || 'mkt-alerts');
      setScheduleEnabled(s.enabled !== false);
      setSendTime(s.sendTime || '08:00');
      setNotifyDays(s.notifyDays || 3);
      if (s.days) setDays(s.days);
      setHistory(Array.isArray(hRes.data) ? hRes.data : []);
    } catch {
      setSettings({});
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const payload = { webhookUrl, channel, enabled: scheduleEnabled, sendTime, notifyDays, days };
    try {
      await saveSlackSettings(payload);
      showToast('Đã lưu cấu hình Slack');
    } catch {
      showToast('Lỗi khi lưu cấu hình', 'error');
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) { showToast('Nhập Webhook URL trước khi test', 'error'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSlackWebhook(webhookUrl);
      setTestResult(res.data);
      showToast(res.data.success ? 'Kết nối thành công!' : 'Kết nối thất bại', res.data.success ? 'success' : 'error');
    } catch {
      setTestResult({ success: false, message: 'Lỗi kết nối' });
      showToast('Lỗi khi test webhook', 'error');
    }
    setTesting(false);
  };

  if (!settings) return <div className="flex items-center justify-center h-64"><p className="text-on-surface-variant">Đang tải...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Cấu hình Slack</h2>
          <p className="text-body-md text-on-surface-variant">Cấu hình cảnh báo tự động và hook tích hợp.</p>
        </div>
        <button className="px-4 py-2 text-primary border border-primary/20 rounded-xl font-medium hover:bg-primary/10 transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">open_in_new</span> Tài liệu Bên ngoài
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Webhook Config */}
        <div className="md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary">webhook</span>
            <h3 className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Cấu hình Webhook</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant ml-1">URL Webhook Slack</label>
              <input className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm" placeholder="https://hooks.slack.com/services/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant ml-1">Tên Kênh</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">#</span>
                <input className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm" value={channel} onChange={(e) => setChannel(e.target.value)} />
              </div>
            </div>
          </div>
          {testResult && (
            <div className={`px-4 py-2 rounded-lg text-sm ${testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {testResult.success ? '✅ Kết nối thành công!' : `❌ ${testResult.message || 'Kết nối thất bại'}`}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-2">
            <button onClick={handleTest} disabled={testing} className="px-5 py-2.5 text-on-surface-variant font-medium border border-outline-variant rounded-xl hover:bg-surface-container-high active:scale-95 transition-all text-sm">
              {testing ? 'Đang kiểm tra...' : 'Kiểm tra Webhook'}
            </button>
            <button onClick={handleSave} className="px-8 py-2.5 bg-primary text-on-primary font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all text-sm">Lưu</button>
          </div>
        </div>

        {/* Deadline Alert */}
        <div className="md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-error">notification_important</span>
            <h3 className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Cảnh báo Hạn chót</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant ml-1">Cảnh báo sắp hạn (số ngày)</label>
            <div className="flex items-center gap-3">
              <input type="number" value={notifyDays} onChange={(e) => setNotifyDays(Number(e.target.value))} className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-center text-lg" />
              <span className="text-on-surface-variant text-sm whitespace-nowrap">Ngày trước</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant/70 italic">Hệ thống sẽ gửi thông báo mỗi sáng cho các công việc còn thời hạn dưới số ngày này.</p>
        </div>

        {/* Notification Schedule */}
        <div className="md:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success">schedule</span>
              <h3 className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Lịch Thông báo</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={scheduleEnabled} onChange={() => setScheduleEnabled(!scheduleEnabled)} />
              <div className="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant">
              <span className="text-sm">Giờ Gửi</span>
              <input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="bg-transparent border-none text-primary text-lg p-0 focus:ring-0 cursor-pointer" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'monFri', label: 'T2-T6' },
                { key: 'sat', label: 'T7' },
                { key: 'sun', label: 'CN' },
              ].map((d) => (
                <label key={d.key} className="flex flex-col items-center gap-2 p-2 rounded-lg border border-outline-variant bg-surface-container-low cursor-pointer hover:border-primary/50 transition-all">
                  <span className="text-[10px] text-on-surface-variant font-bold">{d.label}</span>
                  <input type="checkbox" checked={days[d.key]} onChange={() => setDays(p => ({ ...p, [d.key]: !p[d.key] }))} className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40" />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="md:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#4A154B]">visibility</span>
            <h3 className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Xem trước</h3>
          </div>
          <div className="bg-white rounded-lg p-4 text-[15px] border border-outline-variant">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded bg-primary-fixed/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">hub</span>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-on-surface">MKT Hub Bot</span>
                  <span className="bg-surface-container-high text-on-surface-variant text-[10px] px-1 rounded uppercase font-bold">APP</span>
                  <span className="text-on-surface-variant text-xs">{sendTime}</span>
                </div>
                <div className="text-on-surface">Báo cáo công việc hàng ngày - <span className="text-primary">MKT Hub Pulse</span></div>
                <div className="mt-2 border-l-4 border-error/80 pl-3 py-1 bg-error/5">
                  <div className="font-bold text-on-surface">Quá hạn (Overdue)</div>
                  <div className="text-sm mt-1">• <span className="text-error font-medium">Task:</span> Quá hạn {notifyDays}+ ngày</div>
                </div>
                <div className="mt-2 border-l-4 border-success pl-3 py-1 bg-success/5">
                  <div className="font-bold text-on-surface">Sắp đến hạn (Upcoming)</div>
                  <div className="text-sm mt-1">• <span className="text-success font-medium">Task:</span> Còn {notifyDays} ngày trước deadline</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[10px] text-center text-on-surface-variant/50 uppercase tracking-widest font-bold">Ví dụ Kết quả Gửi</div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            <h3 className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Lịch sử Thông báo</h3>
          </div>
          <span className="text-xs text-on-surface-variant">{history.length} lần gửi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high/40">
              <tr>
                <th className="p-4 text-xs font-bold text-on-surface-variant border-b uppercase tracking-wider">Thời gian</th>
                <th className="p-4 text-xs font-bold text-on-surface-variant border-b uppercase tracking-wider">Người nhận</th>
                <th className="p-4 text-xs font-bold text-on-surface-variant border-b text-center uppercase tracking-wider">Quá hạn</th>
                <th className="p-4 text-xs font-bold text-on-surface-variant border-b text-center uppercase tracking-wider">Sắp đến</th>
                <th className="p-4 text-xs font-bold text-on-surface-variant border-b text-right uppercase tracking-wider">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {history.map((row, i) => (
                <tr key={i} className="hover:bg-primary/5 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{row.date}</span>
                      <span className="text-[10px] text-on-surface-variant">{row.time}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium">{row.recipient || channel}</td>
                  <td className="p-4 text-center">
                    {row.overdue != null ? (
                      <span className="bg-error/20 text-error px-2 py-0.5 rounded-full text-xs font-bold">{row.overdue} items</span>
                    ) : <span className="text-on-surface-variant opacity-50">—</span>}
                  </td>
                  <td className="p-4 text-center">
                    {row.upcoming != null ? (
                      <span className="bg-success/20 text-success px-2 py-0.5 rounded-full text-xs font-bold">{row.upcoming} items</span>
                    ) : <span className="text-on-surface-variant opacity-50">—</span>}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`material-symbols-outlined ${row.success ? 'text-success' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {row.success ? 'check_circle' : 'error'}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-on-surface-variant text-sm">Chưa có lịch sử thông báo</td></tr>
              )}
            </tbody>
          </table>
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
