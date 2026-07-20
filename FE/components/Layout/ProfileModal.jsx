import { useState } from 'react';
import { changePassword } from '../../services/api';

export default function ProfileModal({ onClose, userEmail }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!oldPassword || !newPassword) {
      setMessage('Vui lòng nhập đầy đủ thông tin'); setMsgType('error'); return;
    }
    if (newPassword.length < 6) {
      setMessage('Mật khẩu mới phải có ít nhất 6 ký tự'); setMsgType('error'); return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp'); setMsgType('error'); return;
    }
    setSaving(true);
    setMessage('');
    try {
      await changePassword(oldPassword, newPassword);
      setMessage('Đổi mật khẩu thành công'); setMsgType('success');
      setTimeout(() => { setMessage(''); onClose(); }, 1200);
    } catch (err) {
      const errData = err?.response?.data;
      const msg = errData?.message || errData?.error || 'Đổi mật khẩu thất bại';
      setMessage(msg); setMsgType('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold">Đổi mật khẩu</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {userEmail && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <p className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-500">{userEmail}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="old-pw" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mật khẩu hiện tại</label>
                <input id="old-pw" name="oldPassword" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-pw" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mật khẩu mới</label>
                <input id="new-pw" name="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" />
              </div>
              <div className="space-y-1">
                <label htmlFor="confirm-pw" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Xác nhận mật khẩu mới</label>
                <input id="confirm-pw" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" />
              </div>
            </div>

            {message && (
              <p className={`text-xs flex items-center gap-1 ${msgType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                <span className="material-symbols-outlined text-[14px]">{msgType === 'success' ? 'check_circle' : 'error'}</span>
                {message}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
